import { getDatabase } from "./database";

export type RepairStatus = { id: number; code: string; label_key: string; sort_order: number };
export type Repair = {
  id: number; repair_number: string; customer_id: number; customer_name: string; status_id: number; status_code: string; status_label_key: string;
  device_type: string | null; brand: string | null; model: string | null; serial_number: string | null; imei: string | null;
  reported_fault: string | null; accessories: string | null; general_condition: string | null; diagnosis: string | null; work_performed: string | null;
  estimated_value: number | null; final_value: number | null; internal_notes: string | null; opened_at: string; closed_at: string | null;
};

export type RepairInput = {
  customer_id: number; status_id: number; device_type: string; brand: string; model: string; serial_number: string; imei: string;
  reported_fault: string; accessories: string; general_condition: string; estimated_value: string; internal_notes: string;
};

export type RepairUpdateInput = RepairInput & {
  diagnosis: string;
  work_performed: string;
  final_value: string;
};

export type RepairStatusHistory = {
  id: number;
  status_id: number;
  status_code: string;
  status_label_key: string;
  changed_at: string;
  note: string | null;
};

export async function listStatuses(): Promise<RepairStatus[]> {
  const db = await getDatabase();
  return db.select("SELECT id, code, label_key, sort_order FROM repair_statuses WHERE active=1 ORDER BY sort_order");
}

export async function listRepairs(): Promise<Repair[]> {
  const db = await getDatabase();
  return db.select(`SELECT r.*, c.name customer_name, s.code status_code, s.label_key status_label_key
    FROM repairs r JOIN customers c ON c.id=r.customer_id JOIN repair_statuses s ON s.id=r.status_id
    ORDER BY r.id DESC`);
}

export async function getRepair(id: number): Promise<Repair | null> {
  const db = await getDatabase();
  const rows = await db.select<Repair[]>(`SELECT r.*, c.name customer_name, s.code status_code, s.label_key status_label_key
    FROM repairs r JOIN customers c ON c.id=r.customer_id JOIN repair_statuses s ON s.id=r.status_id
    WHERE r.id=? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function listRepairStatusHistory(repairId: number): Promise<RepairStatusHistory[]> {
  const db = await getDatabase();
  return db.select(`SELECT h.id, h.status_id, s.code status_code, s.label_key status_label_key, h.changed_at, h.note
    FROM repair_status_history h JOIN repair_statuses s ON s.id=h.status_id
    WHERE h.repair_id=? ORDER BY h.id DESC`, [repairId]);
}

function repairNumber(id: number) {
  const year = new Date().getFullYear();
  return `${year}-${String(id).padStart(6,"0")}`;
}

export async function createRepair(input: RepairInput): Promise<number> {
  const db = await getDatabase();
  const temp = `TMP-${Date.now()}`;
  const result = await db.execute(`INSERT INTO repairs
    (repair_number,customer_id,status_id,device_type,brand,model,serial_number,imei,reported_fault,accessories,general_condition,estimated_value,internal_notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [temp,input.customer_id,input.status_id,input.device_type||null,input.brand||null,input.model||null,input.serial_number||null,input.imei||null,input.reported_fault||null,input.accessories||null,input.general_condition||null,input.estimated_value?Number(input.estimated_value):null,input.internal_notes||null]);
  const id = Number(result.lastInsertId);
  await db.execute("UPDATE repairs SET repair_number=? WHERE id=?", [repairNumber(id), id]);
  await db.execute("INSERT INTO repair_status_history (repair_id,status_id) VALUES (?,?)", [id,input.status_id]);
  return id;
}

export async function updateRepair(id: number, input: RepairUpdateInput, previousStatusId: number, statusNote = ""): Promise<void> {
  const db = await getDatabase();
  await db.execute(`UPDATE repairs SET
    customer_id=?, status_id=?, device_type=?, brand=?, model=?, serial_number=?, imei=?, reported_fault=?, accessories=?, general_condition=?,
    diagnosis=?, work_performed=?, estimated_value=?, final_value=?, internal_notes=?, updated_at=CURRENT_TIMESTAMP,
    closed_at=CASE WHEN (SELECT code FROM repair_statuses WHERE id=?) IN ('DELIVERED','CANCELLED') THEN COALESCE(closed_at,CURRENT_TIMESTAMP) ELSE NULL END
    WHERE id=?`, [
      input.customer_id,input.status_id,input.device_type||null,input.brand||null,input.model||null,input.serial_number||null,input.imei||null,
      input.reported_fault||null,input.accessories||null,input.general_condition||null,input.diagnosis||null,input.work_performed||null,
      input.estimated_value?Number(input.estimated_value):null,input.final_value?Number(input.final_value):null,input.internal_notes||null,input.status_id,id
    ]);
  if (input.status_id !== previousStatusId) {
    await db.execute("INSERT INTO repair_status_history (repair_id,status_id,note) VALUES (?,?,?)", [id,input.status_id,statusNote.trim()||null]);
  }
}
