PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repair_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repair_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(repair_id) REFERENCES repairs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS repair_attachments_repair_id_idx
  ON repair_attachments(repair_id);
