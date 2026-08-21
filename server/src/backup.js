import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export async function createPostgresBackup(database) {
  const parsed = database.connectionString ? new URL(database.connectionString) : null;
  const host = parsed?.hostname || database.host;
  const port = parsed?.port || String(database.port || 5432);
  const user = parsed ? decodeURIComponent(parsed.username) : database.user;
  const password = parsed ? decodeURIComponent(parsed.password) : database.password;
  const name = parsed ? decodeURIComponent(parsed.pathname.slice(1)) : database.database;
  const args = [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--host", host,
    "--port", port,
    "--username", user,
    "--dbname", name,
  ];
  const { stdout } = await run("pg_dump", args, {
    encoding: "buffer",
    env: { ...process.env, PGPASSWORD: password },
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}
