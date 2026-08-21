# DBRepairs Server / Docker

The server edition uses the existing React interface with a central API and PostgreSQL database. The Tauri desktop edition remains separate and continues to use its local SQLite database.

## Quick start

1. Copy `.env.example` to `.env`.
2. Replace `POSTGRES_PASSWORD` with a long, unique password.
3. Start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Open `http://SERVER-IP:8080` from the counter and office computers.

Only the web port is published. PostgreSQL and the API remain on the private Docker network. Do not expose the application directly to the Internet: this first LAN release does not include user authentication. Use a VPN or an authenticated reverse proxy before enabling remote access.

## Portainer

Deploy the repository as a Git stack so that Portainer has the Dockerfiles and build context. Use `compose.yaml` and define these environment variables in the stack:

- `POSTGRES_PASSWORD` (required);
- `DBREPAIRS_PORT` (default `8080`);
- `POSTGRES_DB` and `POSTGRES_USER` (both default to `dbrepairs`);
- `BACKUP_INTERVAL_SECONDS` (default one day);
- `BACKUP_RETENTION_DAYS` (default 14 days);
- `TZ` (default `Europe/Lisbon`).

After deployment, all four services (`db`, `api`, `web`, and `backup`) should be healthy or running.

## TrueNAS SCALE 25.10

The ready-to-paste configuration is `compose.truenas.yaml`. It uses port `31500` and the public DBRepairs images from GitHub Container Registry.

Before installing the app, create two datasets under the `Apps` pool using the **Apps** dataset preset:

- `Apps/dbrepairs-postgres` for the PostgreSQL database;
- `Apps/dbrepairs-backups` for automatic dumps.

Their host paths must be:

```text
/mnt/Apps/dbrepairs-postgres
/mnt/Apps/dbrepairs-backups
```

If PostgreSQL reports a permission error, edit the ACL for `dbrepairs-postgres` and grant full control to user ID `70`, the `postgres` user in the Alpine image.

In TrueNAS:

1. Open **Apps → Discover Apps**.
2. Open the actions menu and select **Install via YAML**.
3. Use `dbrepairs` as the application name.
4. Copy all of `compose.truenas.yaml` into **Custom Config**.
5. Replace `CHANGE-THIS-LONG-PASSWORD` with a unique password.
6. Save and wait for all four containers to start.
7. Open `http://TRUENAS-IP:31500`.

TrueNAS custom YAML apps currently use a generic icon in the Apps list. The DBRepairs web interface and browser favicon use `dbrepairs-icon-square.png`.

## Backups

The `backup` service creates a PostgreSQL custom-format dump immediately after the API is healthy and then at the configured interval. Files are stored in the `postgres_backups` Docker volume and expired according to `BACKUP_RETENTION_DAYS`.

A manual dump can also be downloaded from **Settings → Create backup** in the web interface. Keep an additional copy outside the Docker host.

List automatic backups:

```bash
docker compose exec backup sh -c 'ls -lh /backups'
```

Copy one to the current directory:

```bash
docker compose cp backup:/backups/DBRepairs-YYYYMMDD-HHMMSS.dump ./DBRepairs.dump
```

Restore into an empty or deliberately replaceable database during a maintenance window:

```bash
docker compose stop web api backup
docker compose cp ./DBRepairs.dump db:/tmp/DBRepairs.dump
docker compose exec db pg_restore --clean --if-exists --no-owner --no-privileges -U dbrepairs -d dbrepairs /tmp/DBRepairs.dump
docker compose start api backup web
```

Change the database/user arguments if `POSTGRES_DB` or `POSTGRES_USER` were customized. Restoring overwrites server data; take a fresh backup first.

## Operations

View service state and logs:

```bash
docker compose ps
docker compose logs -f api db backup
```

Update after pulling a new release:

```bash
docker compose up -d --build
```

Database migrations run automatically and transactionally when the API starts. Persistent data remains in the `postgres_data` volume.

To stop the application without deleting data:

```bash
docker compose down
```

Do not add `--volumes` unless the PostgreSQL data and backup volumes are intentionally being deleted.

## Development

Start PostgreSQL and the API, then run Vite locally:

```bash
docker compose up -d db api
npm run dev
```

Vite forwards `/api` to `http://localhost:3000`. A normal browser session uses the server API; a Tauri session continues to use SQLite.
