import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

test("configuration requires a database URL", () => {
  assert.throws(() => loadConfig({}), /DATABASE_URL or PGHOST/);
});

test("configuration applies safe defaults", () => {
  assert.deepEqual(loadConfig({ DATABASE_URL: "postgres://db/test" }), {
    host: "0.0.0.0", port: 3000, database: { connectionString: "postgres://db/test" }, databasePoolSize: 10, trustProxy: false,
  });
});

test("configuration accepts separate PostgreSQL variables", () => {
  assert.deepEqual(loadConfig({ PGHOST: "db", PGDATABASE: "repairs", PGUSER: "app", PGPASSWORD: "secret" }).database, {
    host: "db", port: 5432, database: "repairs", user: "app", password: "secret",
  });
});
