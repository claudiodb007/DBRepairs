import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const run = promisify(execFile);

function connection(database) {
  const parsed = database.connectionString ? new URL(database.connectionString) : null;
  return {
    host: parsed?.hostname || database.host,
    port: parsed?.port || String(database.port || 5432),
    user: parsed ? decodeURIComponent(parsed.username) : database.user,
    password: parsed ? decodeURIComponent(parsed.password) : database.password,
    name: parsed ? decodeURIComponent(parsed.pathname.slice(1)) : database.database,
  };
}

function connectionArgs(database) {
  const { host, port, user, name } = connection(database);
  return ["--host", host, "--port", port, "--username", user, "--dbname", name];
}

function databaseEnvironment(database) {
  return { ...process.env, PGPASSWORD: connection(database).password };
}

export async function createPostgresBackup(database) {
  const args = ["--format=custom", "--no-owner", "--no-privileges", ...connectionArgs(database)];
  const { stdout } = await run("pg_dump", args, {
    encoding: "buffer",
    env: databaseEnvironment(database),
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

export function isPostgresBackup(data) {
  return Buffer.isBuffer(data) && data.length >= 5 && data.subarray(0, 5).toString("ascii") === "PGDMP";
}

export async function restorePostgresBackup(database, data) {
  if (!isPostgresBackup(data)) throw new Error("Invalid PostgreSQL custom-format backup");
  const directory = await mkdtemp(join(tmpdir(), "dbrepairs-restore-"));
  const path = join(directory, "restore.dump");
  try {
    await writeFile(path, data, { mode: 0o600 });
    await run("pg_restore", [
      "--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction",
      ...connectionArgs(database), path,
    ], {
      env: databaseEnvironment(database),
      maxBuffer: 16 * 1024 * 1024,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
