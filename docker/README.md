# Docker target

The Docker/server target is intentionally reserved, not duplicated yet.

DBRepairs 0.1 first validates the shared repair workflow, schema and translations on the desktop build. The Docker target will reuse the same frontend, SQLite schema and domain rules through a small HTTP server rather than creating a second product.
