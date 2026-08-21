use std::{fs, path::Path, time::{SystemTime, UNIX_EPOCH}};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use rusqlite::{params, Connection};
use serde::Deserialize;


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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableArchive { format: String, version: u32, data: PortableData }
#[derive(Deserialize)]
struct PortableData { settings: Vec<PortableSetting>, statuses: Vec<PortableStatus>, customers: Vec<PortableCustomer>, repairs: Vec<PortableRepair>, history: Vec<PortableHistory> }
#[derive(Deserialize)]
struct PortableSetting { key: String, value: String }
#[derive(Deserialize)]
struct PortableStatus { id: i64, code: String, label_key: String, sort_order: i64, active: bool }
#[derive(Deserialize)]
struct PortableCustomer { id: i64, name: String, company: Option<String>, tax_number: Option<String>, phone: Option<String>, email: Option<String>, address: Option<String>, notes: Option<String>, created_at: String, updated_at: String }
#[derive(Deserialize)]
struct PortableRepair {
    id: i64, repair_number: String, customer_id: i64, status_id: i64, device_type: Option<String>, brand: Option<String>, model: Option<String>,
    serial_number: Option<String>, imei: Option<String>, reported_fault: Option<String>, accessories: Option<String>, general_condition: Option<String>,
    diagnosis: Option<String>, work_performed: Option<String>, estimated_value: Option<f64>, final_value: Option<f64>, internal_notes: Option<String>,
    opened_at: String, closed_at: Option<String>, created_at: String, updated_at: String,
}
#[derive(Deserialize)]
struct PortableHistory { id: i64, repair_id: i64, status_id: i64, changed_at: String, note: Option<String> }

#[tauri::command]
fn restore_portable_database(app: tauri::AppHandle, archive: PortableArchive) -> Result<(), String> {
    if archive.format != "dbrepairs-portable" || archive.version != 1 || archive.data.statuses.is_empty() {
        return Err("Unsupported or incomplete DBRepairs portable backup".into());
    }
    let path = app.path().app_config_dir().map_err(|e|e.to_string())?.join("dbrepairs.db");
    if !path.exists() { return Err("Database file not found".into()); }
    let mut connection = Connection::open(path).map_err(|e|e.to_string())?;
    restore_portable_connection(&mut connection, archive)
}

fn restore_portable_connection(connection: &mut Connection, archive: PortableArchive) -> Result<(), String> {
    connection.pragma_update(None, "foreign_keys", true).map_err(|e|e.to_string())?;
    let transaction = connection.transaction().map_err(|e|e.to_string())?;
    transaction.execute_batch("DELETE FROM repair_status_history; DELETE FROM repairs; DELETE FROM customers; DELETE FROM repair_statuses; DELETE FROM app_settings;").map_err(|e|e.to_string())?;
    for row in archive.data.settings {
        transaction.execute("INSERT INTO app_settings (key,value) VALUES (?1,?2)", params![row.key,row.value]).map_err(|e|e.to_string())?;
    }
    for row in archive.data.statuses {
        transaction.execute("INSERT INTO repair_statuses (id,code,label_key,sort_order,active) VALUES (?1,?2,?3,?4,?5)", params![row.id,row.code,row.label_key,row.sort_order,row.active]).map_err(|e|e.to_string())?;
    }
    for row in archive.data.customers {
        transaction.execute("INSERT INTO customers (id,name,company,tax_number,phone,email,address,notes,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)", params![row.id,row.name,row.company,row.tax_number,row.phone,row.email,row.address,row.notes,row.created_at,row.updated_at]).map_err(|e|e.to_string())?;
    }
    for row in archive.data.repairs {
        transaction.execute("INSERT INTO repairs (id,repair_number,customer_id,status_id,device_type,brand,model,serial_number,imei,reported_fault,accessories,general_condition,diagnosis,work_performed,estimated_value,final_value,internal_notes,opened_at,closed_at,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)", params![row.id,row.repair_number,row.customer_id,row.status_id,row.device_type,row.brand,row.model,row.serial_number,row.imei,row.reported_fault,row.accessories,row.general_condition,row.diagnosis,row.work_performed,row.estimated_value,row.final_value,row.internal_notes,row.opened_at,row.closed_at,row.created_at,row.updated_at]).map_err(|e|e.to_string())?;
    }
    for row in archive.data.history {
        transaction.execute("INSERT INTO repair_status_history (id,repair_id,status_id,changed_at,note) VALUES (?1,?2,?3,?4,?5)", params![row.id,row.repair_id,row.status_id,row.changed_at,row.note]).map_err(|e|e.to_string())?;
    }
    transaction.execute("DELETE FROM sqlite_sequence WHERE name IN ('repair_statuses','customers','repairs','repair_status_history')", []).map_err(|e|e.to_string())?;
    for table in ["repair_statuses","customers","repairs","repair_status_history"] {
        transaction.execute(&format!("INSERT INTO sqlite_sequence (name,seq) SELECT '{table}',COALESCE(MAX(id),0) FROM {table}"), []).map_err(|e|e.to_string())?;
    }
    transaction.commit().map_err(|e|e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn portable_restore_is_transactional_and_resets_sequences() {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch(include_str!("../migrations/0001_initial.sql")).unwrap();
        connection.execute("INSERT INTO customers (name) VALUES ('Old data')", []).unwrap();
        let archive = PortableArchive { format:"dbrepairs-portable".into(), version:1, data:PortableData {
            settings:vec![PortableSetting{key:"office.companyName".into(),value:"RepairsLab".into()}],
            statuses:vec![PortableStatus{id:4,code:"RECEIVED".into(),label_key:"status.received".into(),sort_order:10,active:true}],
            customers:vec![PortableCustomer{id:7,name:"Portable customer".into(),company:None,tax_number:None,phone:None,email:None,address:None,notes:None,created_at:"2026-08-21 12:00:00".into(),updated_at:"2026-08-21 12:00:00".into()}],
            repairs:vec![PortableRepair{id:9,repair_number:"2026-000009".into(),customer_id:7,status_id:4,device_type:Some("Laptop".into()),brand:None,model:None,serial_number:None,imei:None,reported_fault:Some("Test".into()),accessories:None,general_condition:None,diagnosis:None,work_performed:None,estimated_value:None,final_value:None,internal_notes:None,opened_at:"2026-08-21 12:00:00".into(),closed_at:None,created_at:"2026-08-21 12:00:00".into(),updated_at:"2026-08-21 12:00:00".into()}],
            history:vec![PortableHistory{id:11,repair_id:9,status_id:4,changed_at:"2026-08-21 12:00:00".into(),note:None}],
        }};
        restore_portable_connection(&mut connection, archive).unwrap();
        assert_eq!(connection.query_row("SELECT name FROM customers", [], |row| row.get::<_,String>(0)).unwrap(), "Portable customer");
        connection.execute("INSERT INTO customers (name) VALUES ('Next')", []).unwrap();
        assert_eq!(connection.query_row("SELECT MAX(id) FROM customers", [], |row| row.get::<_,i64>(0)).unwrap(), 8);
    }
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
        .invoke_handler(tauri::generate_handler![backup_database, restore_database, export_text_file, restore_portable_database])
        .setup(|app| {
            apply_pending_restore(app.handle()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run DBRepairs");
}
