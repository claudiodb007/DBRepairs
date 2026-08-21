import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

function testApp() {
  const pool = { query: async () => ({ rows: [{ "?column?": 1 }] }) };
  return buildApp({
    pool,
    config: { trustProxy: false, database: { connectionString: "postgres://unused" } },
    logger: false,
  });
}

test("health endpoint reports ready", async (t) => {
  const app = testApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("invalid customer payload returns a client error", async (t) => {
  const app = testApp();
  t.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/api/customers", payload: { name: " " } });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /name is required/);
});

test("restore rejects files that are not PostgreSQL dumps", async (t) => {
  const app = testApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: "PUT",
    url: "/api/backups/database",
    headers: { "content-type": "application/octet-stream" },
    payload: Buffer.from("not a database"),
  });
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /Invalid PostgreSQL backup/);
});
