use std::{fs, path::Path, time::{SystemTime, UNIX_EPOCH}};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};


const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";
fn is_sqlite_database(data: &[u8]) -> bool { data.len() >= 16 && &data[..16] == SQLITE_HEADER }
fn remove_if_exists(path: &Path) -> Result<(), String> { if path.exists(){fs::remove_file(path).map_err(|e|e.to_string())?;} Ok(()) }
fn apply_pending_restore(app: &tauri::AppHandle) -> Result<(), String> {
    let dir=app.path().app_config_dir().map_err(|e|e.to_string())?;
    let db=dir.join("dbrepairs.db"); let pending=dir.join("dbrepairs.restore.pending");
    if !pending.exists(){return Ok(());}
    let data=fs::read(&pending).map_err(|e|e.to_string())?;
    if !is_sqlite_database(&data){return Err("Invalid pending SQLite restore".into());}
    let rollback=dir.join("dbrepairs.restore.rollback"); remove_if_exists(&rollback)?;
    if db.exists(){fs::rename(&db,&rollback).map_err(|e|e.to_string())?;}
    if let Err(e)=fs::rename(&pending,&db){if rollback.exists()&&!db.exists(){let _=fs::rename(&rollback,&db);}return Err(e.to_string());}
    let _=remove_if_exists(&dir.join("dbrepairs.db-wal")); let _=remove_if_exists(&dir.join("dbrepairs.db-shm")); let _=remove_if_exists(&rollback); Ok(())
}

#[tauri::command]
fn backup_database(app: tauri::AppHandle) -> Result<String, String> {
    let source = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("dbrepairs.db");

    if !source.exists() {
        return Err("Database file not found".into());
    }

    let downloads = app.path().download_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let destination = downloads.join(format!("DBRepairs-backup-{stamp}.db"));
    fs::copy(&source, &destination).map_err(|e| e.to_string())?;

    Ok(destination.to_string_lossy().into_owned())
}


#[tauri::command]
fn restore_database(app: tauri::AppHandle, data: Vec<u8>) -> Result<(), String> {
    if !is_sqlite_database(&data){return Err("Selected file is not a valid SQLite database".into());}
    let dir=app.path().app_config_dir().map_err(|e|e.to_string())?; fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
    let db=dir.join("dbrepairs.db"); if !db.exists(){return Err("Current database file not found".into());}
    let downloads=app.path().download_dir().map_err(|e|e.to_string())?; fs::create_dir_all(&downloads).map_err(|e|e.to_string())?;
    let stamp=SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e|e.to_string())?.as_secs();
    fs::copy(&db,downloads.join(format!("DBRepairs-before-restore-{stamp}.db"))).map_err(|e|e.to_string())?;
    fs::write(dir.join("dbrepairs.restore.pending"),&data).map_err(|e|e.to_string())?;
    if cfg!(debug_assertions) {
        app.exit(0);
        Ok(())
    } else {
        app.restart()
    }
}

#[tauri::command]
fn export_text_file(app: tauri::AppHandle, filename: String, content: String) -> Result<String, String> {
    if filename.trim().is_empty() || filename.contains('/') || filename.contains('\\') {
        return Err("Invalid filename".into());
    }

    let downloads = app.path().download_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&downloads).map_err(|e| e.to_string())?;

    let destination = downloads.join(filename);
    fs::write(&destination, content.as_bytes()).map_err(|e| e.to_string())?;

    Ok(destination.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../migrations/0001_initial.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:dbrepairs.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![backup_database, restore_database, export_text_file])
        .setup(|app| {
            apply_pending_restore(app.handle()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run DBRepairs");
}
