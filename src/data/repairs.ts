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
