# DBRepairs 0.2.0

DBRepairs 0.2 introduces the central Server/Docker edition while preserving the standalone SQLite desktop application.

## Server edition

- Central PostgreSQL database for simultaneous use from multiple computers.
- Shared browser interface backed by a transactional HTTP API.
- Docker Compose deployment for servers, Portainer and TrueNAS SCALE.
- Scheduled PostgreSQL backups with configurable retention.
- Manual PostgreSQL backup download and transactional restore.

## Portable backups

- New versioned `.dbrepairs` portable backup format.
- Two-way data transfer between SQLite desktop and PostgreSQL server editions.
- Includes company settings and logo, statuses, customers, repairs and complete status history.
- Validates relationships and identifiers before replacing data.
- Creates a native safety backup before restore.
- Restores in a single transaction so failed imports leave current data unchanged.

## Desktop compatibility

- Existing SQLite data and native `.db` backups remain supported.
- Desktop CSV exports and workflow remain unchanged.
