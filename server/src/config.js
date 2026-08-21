function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim();
  const database = databaseUrl ? { connectionString: databaseUrl } : {
    host: env.PGHOST?.trim(),
    port: positiveInteger(env.PGPORT, 5432),
    database: env.PGDATABASE?.trim(),
    user: env.PGUSER?.trim(),
    password: env.PGPASSWORD,
  };
  if (!databaseUrl && (!database.host || !database.database || !database.user || !database.password)) {
    throw new Error("DATABASE_URL or PGHOST, PGDATABASE, PGUSER and PGPASSWORD are required");
  }

  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port: positiveInteger(env.PORT, 3000),
    database,
    databasePoolSize: positiveInteger(env.DATABASE_POOL_SIZE, 10),
    trustProxy: env.TRUST_PROXY === "true",
  };
}
