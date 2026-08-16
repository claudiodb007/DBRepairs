import { getDatabase } from "./database";

export type Customer = {
  id: number;
  name: string;
  company: string | null;
  tax_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerInput = {
  name: string;
  company: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  return db.select<Customer[]>(
    `SELECT id, name, company, tax_number, phone, email, address, notes, created_at, updated_at
     FROM customers
     WHERE (?1 = '%%')
        OR name LIKE ?1 COLLATE NOCASE
        OR COALESCE(company, '') LIKE ?1 COLLATE NOCASE
        OR COALESCE(tax_number, '') LIKE ?1 COLLATE NOCASE
        OR COALESCE(phone, '') LIKE ?1 COLLATE NOCASE
        OR COALESCE(email, '') LIKE ?1 COLLATE NOCASE
     ORDER BY name COLLATE NOCASE, id`,
    [term],
  );
}

export async function createCustomer(input: CustomerInput): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO customers (name, company, tax_number, phone, email, address, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    [
      input.name.trim(),
      clean(input.company),
      clean(input.taxNumber),
      clean(input.phone),
      clean(input.email),
      clean(input.address),
      clean(input.notes),
    ],
  );
  return Number(result.lastInsertId ?? 0);
}

export async function updateCustomer(id: number, input: CustomerInput): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE customers
     SET name = ?1,
         company = ?2,
         tax_number = ?3,
         phone = ?4,
         email = ?5,
         address = ?6,
         notes = ?7,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?8`,
    [
      input.name.trim(),
      clean(input.company),
      clean(input.taxNumber),
      clean(input.phone),
      clean(input.email),
      clean(input.address),
      clean(input.notes),
      id,
    ],
  );
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDatabase();
  await db.execute("DELETE FROM customers WHERE id = ?1", [id]);
}
