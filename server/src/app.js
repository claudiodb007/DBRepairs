import Fastify from "fastify";
import { createPostgresBackup, isPostgresBackup, restorePostgresBackup } from "./backup.js";
import { customerInput, officeSettingsInput, pathId, repairInput, ValidationError } from "./validation.js";

const repairSelect = `SELECT r.*, c.name customer_name, s.code status_code, s.label_key status_label_key
  FROM repairs r
  JOIN customers c ON c.id = r.customer_id
  JOIN repair_statuses s ON s.id = r.status_id`;

function replyNotFound(reply) {
  return reply.code(404).send({ error: "Not found" });
}

export function buildApp({ pool, config, logger = true, migrateDatabase }) {
  const app = Fastify({ logger, trustProxy: config.trustProxy, bodyLimit: 3_200_000 });
  let restoring = false;

  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: 256 * 1024 * 1024 }, (_request, body, done) => {
    done(null, body);
  });

  app.addHook("onRequest", async (request, reply) => {
    if (restoring && request.url !== "/api/health") {
      return reply.code(503).send({ error: "Database restore in progress" });
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "SAMEORIGIN");
    reply.header("Referrer-Policy", "same-origin");
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ValidationError) return reply.code(400).send({ error: error.message });
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error.code === "23503") return reply.code(409).send({ error: "This record is still in use" });
    request.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  app.get("/api/health", async () => {
    if (restoring) return { status: "restoring" };
    await pool.query("SELECT 1");
    return { status: "ok" };
  });

  app.get("/api/customers", async (request) => {
    const search = typeof request.query?.search === "string" ? request.query.search.trim() : "";
    const term = `%${search}%`;
    return (await pool.query(`SELECT id, name, company, tax_number, phone, email, address, notes, created_at, updated_at
      FROM customers
      WHERE $1 = '%%'
         OR name ILIKE $1
         OR COALESCE(company, '') ILIKE $1
         OR COALESCE(tax_number, '') ILIKE $1
         OR COALESCE(phone, '') ILIKE $1
         OR COALESCE(email, '') ILIKE $1
      ORDER BY lower(name), id`, [term])).rows;
  });

  app.post("/api/customers", async (request, reply) => {
    const input = customerInput(request.body);
    const result = await pool.query(`INSERT INTO customers (name, company, tax_number, phone, email, address, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [input.name, input.company, input.taxNumber, input.phone, input.email, input.address, input.notes]);
    return reply.code(201).send({ id: result.rows[0].id });
  });

  app.put("/api/customers/:id", async (request, reply) => {
    const id = pathId(request.params.id);
    const input = customerInput(request.body);
    const result = await pool.query(`UPDATE customers SET name=$1, company=$2, tax_number=$3, phone=$4, email=$5,
      address=$6, notes=$7, updated_at=now() WHERE id=$8`,
      [input.name, input.company, input.taxNumber, input.phone, input.email, input.address, input.notes, id]);
    if (!result.rowCount) return replyNotFound(reply);
    return reply.code(204).send();
  });

  app.delete("/api/customers/:id", async (request, reply) => {
    const result = await pool.query("DELETE FROM customers WHERE id=$1", [pathId(request.params.id)]);
    if (!result.rowCount) return replyNotFound(reply);
    return reply.code(204).send();
  });

  app.get("/api/statuses", async () =>
    (await pool.query("SELECT id, code, label_key, sort_order FROM repair_statuses WHERE active=true ORDER BY sort_order")).rows);

  app.get("/api/repairs", async (request) => {
    const customerId = request.query?.customerId;
    if (customerId != null && customerId !== "") {
      return (await pool.query(`${repairSelect} WHERE r.customer_id=$1 ORDER BY r.id DESC`, [pathId(customerId, "customerId")])).rows;
    }
    return (await pool.query(`${repairSelect} ORDER BY r.id DESC`)).rows;
  });

  app.get("/api/repairs/:id", async (request, reply) => {
    const result = await pool.query(`${repairSelect} WHERE r.id=$1 LIMIT 1`, [pathId(request.params.id)]);
    if (!result.rowCount) return replyNotFound(reply);
    return result.rows[0];
  });

  app.get("/api/repairs/:id/history", async (request) =>
    (await pool.query(`SELECT h.id, h.status_id, s.code status_code, s.label_key status_label_key, h.changed_at, h.note
      FROM repair_status_history h JOIN repair_statuses s ON s.id=h.status_id
      WHERE h.repair_id=$1 ORDER BY h.id DESC`, [pathId(request.params.id)])).rows);

  app.post("/api/repairs", async (request, reply) => {
    const input = repairInput(request.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const temporary = `TMP-${crypto.randomUUID()}`;
      const result = await client.query(`INSERT INTO repairs
        (repair_number,customer_id,status_id,device_type,brand,model,serial_number,imei,reported_fault,accessories,general_condition,estimated_value,internal_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, EXTRACT(YEAR FROM opened_at)::integer opened_year`,
        [temporary,input.customer_id,input.status_id,input.device_type,input.brand,input.model,input.serial_number,input.imei,input.reported_fault,
          input.accessories,input.general_condition,input.estimated_value,input.internal_notes]);
      const { id, opened_year: openedYear } = result.rows[0];
      const repairNumber = `${openedYear}-${String(id).padStart(6, "0")}`;
      await client.query("UPDATE repairs SET repair_number=$1 WHERE id=$2", [repairNumber, id]);
      await client.query("INSERT INTO repair_status_history (repair_id,status_id) VALUES ($1,$2)", [id,input.status_id]);
      await client.query("COMMIT");
      return reply.code(201).send({ id });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.put("/api/repairs/:id", async (request, reply) => {
    const id = pathId(request.params.id);
    const input = repairInput(request.body, true);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT status_id FROM repairs WHERE id=$1 FOR UPDATE", [id]);
      if (!current.rowCount) {
        await client.query("ROLLBACK");
        return replyNotFound(reply);
      }
      await client.query(`UPDATE repairs SET customer_id=$1, status_id=$2, device_type=$3, brand=$4, model=$5, serial_number=$6,
        imei=$7, reported_fault=$8, accessories=$9, general_condition=$10, diagnosis=$11, work_performed=$12, estimated_value=$13,
        final_value=$14, internal_notes=$15, updated_at=now(), closed_at=CASE
          WHEN (SELECT code FROM repair_statuses WHERE id=$2) IN ('DELIVERED','CANCELLED') THEN COALESCE(closed_at,now()) ELSE NULL END
        WHERE id=$16`, [input.customer_id,input.status_id,input.device_type,input.brand,input.model,input.serial_number,input.imei,
          input.reported_fault,input.accessories,input.general_condition,input.diagnosis,input.work_performed,input.estimated_value,
          input.final_value,input.internal_notes,id]);
      if (current.rows[0].status_id !== input.status_id) {
        await client.query("INSERT INTO repair_status_history (repair_id,status_id,note) VALUES ($1,$2,$3)", [id,input.status_id,input.statusNote]);
      }
      await client.query("COMMIT");
      return reply.code(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/api/dashboard", async () => {
    const [counts, recent] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE s.code NOT IN ('DELIVERED','CANCELLED'))::integer open_repairs,
        COUNT(*) FILTER (WHERE s.code='WAITING_CUSTOMER')::integer waiting_customer,
        COUNT(*) FILTER (WHERE s.code='READY')::integer ready,
        COUNT(*) FILTER (WHERE r.closed_at IS NOT NULL AND r.closed_at::date = CURRENT_DATE)::integer closed_today
        FROM repairs r JOIN repair_statuses s ON s.id=r.status_id`),
      pool.query(`SELECT r.id,r.repair_number,c.name customer_name,s.code status_code,s.label_key status_label_key,
        r.device_type,r.brand,r.model,r.opened_at FROM repairs r JOIN customers c ON c.id=r.customer_id
        JOIN repair_statuses s ON s.id=r.status_id ORDER BY r.id DESC LIMIT 5`),
    ]);
    const row = counts.rows[0];
    return { stats: { openRepairs: row.open_repairs, waitingCustomer: row.waiting_customer, ready: row.ready, closedToday: row.closed_today }, recent: recent.rows };
  });

  const settingKeys = {
    companyName: "office.companyName", taxNumber: "office.taxNumber", address: "office.address",
    phone: "office.phone", email: "office.email", logoDataUrl: "office.logoDataUrl",
  };

  app.get("/api/settings/office", async () => {
    const rows = (await pool.query("SELECT key,value FROM app_settings WHERE key=ANY($1)", [Object.values(settingKeys)])).rows;
    const values = new Map(rows.map((row) => [row.key, row.value]));
    return Object.fromEntries(Object.entries(settingKeys).map(([field, key]) => [field, values.get(key) || ""]));
  });

  app.put("/api/settings/office", async (request, reply) => {
    const settings = officeSettingsInput(request.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [field, key] of Object.entries(settingKeys)) {
        await client.query(`INSERT INTO app_settings (key,value) VALUES ($1,$2)
          ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [key, settings[field]]);
      }
      await client.query("COMMIT");
      return reply.code(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.get("/api/backups/database", async (_request, reply) => {
    const backup = await createPostgresBackup(config.database);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return reply
      .header("Content-Type", "application/octet-stream")
      .header("Content-Disposition", `attachment; filename=DBRepairs-${stamp}.dump`)
      .send(backup);
  });

  app.put("/api/backups/database", { bodyLimit: 256 * 1024 * 1024 }, async (request, reply) => {
    if (!isPostgresBackup(request.body)) return reply.code(400).send({ error: "Invalid PostgreSQL backup" });
    restoring = true;
    try {
      await restorePostgresBackup(config.database, request.body);
      if (migrateDatabase) await migrateDatabase();
      return reply.code(204).send();
    } finally {
      restoring = false;
    }
  });

  return app;
}
