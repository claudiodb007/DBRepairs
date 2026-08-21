import test from "node:test";
import assert from "node:assert/strict";
import { PortableBackupError, validatePortableBackup } from "../src/portable.js";

const empty = { format:"dbrepairs-portable",version:1,createdAt:"2026-08-21T12:00:00.000Z",sourceEngine:"sqlite",data:{settings:[],statuses:[{id:1,code:"RECEIVED",label_key:"status.received",sort_order:10,active:true}],customers:[],repairs:[],history:[]} };

test("portable backup accepts a valid empty archive", () => {
  assert.equal(validatePortableBackup(empty).sourceEngine, "sqlite");
});

test("portable backup rejects unsupported versions", () => {
  assert.throws(() => validatePortableBackup({ ...empty, version: 99 }), PortableBackupError);
});

test("portable backup rejects broken relationships", () => {
  const archive = structuredClone(empty);
  archive.data.repairs.push({id:1,repair_number:"2026-000001",customer_id:1,status_id:1,device_type:null,brand:null,model:null,serial_number:null,imei:null,reported_fault:null,accessories:null,general_condition:null,diagnosis:null,work_performed:null,estimated_value:null,final_value:null,internal_notes:null,opened_at:"2026-08-21T12:00:00Z",closed_at:null,created_at:"2026-08-21T12:00:00Z",updated_at:"2026-08-21T12:00:00Z"});
  assert.throws(() => validatePortableBackup(archive), /missing customer or status/);
});
