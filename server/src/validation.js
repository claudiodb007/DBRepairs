export class ValidationError extends Error {}

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("Expected a JSON object");
  }
  return value;
}

function text(value, field, { required = false, max = 10000 } = {}) {
  if (value == null) value = "";
  if (typeof value !== "string") throw new ValidationError(`${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ValidationError(`${field} is required`);
  if (trimmed.length > max) throw new ValidationError(`${field} is too long`);
  return trimmed || null;
}

function id(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new ValidationError(`${field} must be a positive integer`);
  return parsed;
}

function money(value, field) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new ValidationError(`${field} must be a positive number`);
  return parsed;
}

export function customerInput(value) {
  const body = object(value);
  return {
    name: text(body.name, "name", { required: true, max: 200 }),
    company: text(body.company, "company", { max: 200 }),
    taxNumber: text(body.taxNumber, "taxNumber", { max: 80 }),
    phone: text(body.phone, "phone", { max: 80 }),
    email: text(body.email, "email", { max: 254 }),
    address: text(body.address, "address", { max: 1000 }),
    notes: text(body.notes, "notes"),
  };
}

export function repairInput(value, update = false) {
  const body = object(value);
  const result = {
    customer_id: id(body.customer_id, "customer_id"),
    status_id: id(body.status_id, "status_id"),
    device_type: text(body.device_type, "device_type", { max: 200 }),
    brand: text(body.brand, "brand", { max: 200 }),
    model: text(body.model, "model", { max: 200 }),
    serial_number: text(body.serial_number, "serial_number", { max: 200 }),
    imei: text(body.imei, "imei", { max: 200 }),
    reported_fault: text(body.reported_fault, "reported_fault", { required: true }),
    accessories: text(body.accessories, "accessories"),
    general_condition: text(body.general_condition, "general_condition"),
    estimated_value: money(body.estimated_value, "estimated_value"),
    internal_notes: text(body.internal_notes, "internal_notes"),
  };
  if (update) {
    result.diagnosis = text(body.diagnosis, "diagnosis");
    result.work_performed = text(body.work_performed, "work_performed");
    result.final_value = money(body.final_value, "final_value");
    result.statusNote = text(body.statusNote, "statusNote");
  }
  return result;
}

const officeFields = ["companyName", "taxNumber", "address", "phone", "email", "logoDataUrl"];

export function officeSettingsInput(value) {
  const body = object(value);
  return Object.fromEntries(officeFields.map((field) => [field, text(body[field], field, { max: field === "logoDataUrl" ? 3_000_000 : 1000 }) || ""]));
}

export function pathId(value, field = "id") {
  return id(value, field);
}
