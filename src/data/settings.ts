import { getDatabase } from "./database";

export type OfficeSettings = {
  companyName: string;
  taxNumber: string;
  address: string;
  phone: string;
  email: string;
  logoDataUrl: string;
};

export const defaultOfficeSettings: OfficeSettings = {
  companyName: "",
  taxNumber: "",
  address: "",
  phone: "",
  email: "",
  logoDataUrl: "",
};

const keys: Record<keyof OfficeSettings, string> = {
  companyName: "office.companyName",
  taxNumber: "office.taxNumber",
  address: "office.address",
  phone: "office.phone",
  email: "office.email",
  logoDataUrl: "office.logoDataUrl",
};

export async function getOfficeSettings(): Promise<OfficeSettings> {
  const db = await getDatabase();
  const rows = await db.select<{ key: string; value: string }[]>(
    `SELECT key, value FROM app_settings WHERE key IN (${Object.values(keys).map(()=>"?").join(",")})`,
    Object.values(keys),
  );
  const byKey = new Map(rows.map(row => [row.key, row.value]));
  return {
    companyName: byKey.get(keys.companyName) || "",
    taxNumber: byKey.get(keys.taxNumber) || "",
    address: byKey.get(keys.address) || "",
    phone: byKey.get(keys.phone) || "",
    email: byKey.get(keys.email) || "",
    logoDataUrl: byKey.get(keys.logoDataUrl) || "",
  };
}

export async function saveOfficeSettings(settings: OfficeSettings): Promise<void> {
  const db = await getDatabase();
  for (const [field, key] of Object.entries(keys) as [keyof OfficeSettings, string][]) {
    await db.execute(
      "INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [key, settings[field]],
    );
  }
}
