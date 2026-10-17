import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";
import { isServerMode } from "./runtime";

export type CustomerAttachment = {
  id: number;
  customer_id: number;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
]);

function extension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

export function validateCustomerAttachment(file: File) {
  if (!ALLOWED_EXTENSIONS.has(extension(file.name))) {
    throw new Error("unsupported-type");
  }

  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("file-too-large");
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)),
    );
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const result = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    result[i] = binary.charCodeAt(i);
  }

  return result;
}

async function responseError(response: Response) {
  try {
    const body = await response.json() as { error?: string };
    return body.error || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function listCustomerAttachments(
  customerId: number,
): Promise<CustomerAttachment[]> {
  if (isServerMode) {
    const response = await fetch(`/api/customers/${customerId}/attachments`);

    if (!response.ok) {
      throw new Error(await responseError(response));
    }

    return response.json();
  }

  const db = await getDatabase();

  return db.select<CustomerAttachment[]>(
    `SELECT
       id,
       customer_id,
       filename,
       content_type,
       size,
       created_at
     FROM customer_attachments
     WHERE customer_id = ?1
     ORDER BY id DESC`,
    [customerId],
  );
}

export async function addCustomerAttachment(
  customerId: number,
  file: File,
): Promise<void> {
  validateCustomerAttachment(file);

  const buffer = await file.arrayBuffer();
  const contentType = file.type || "application/octet-stream";

  if (isServerMode) {
    const response = await fetch(
      `/api/customers/${customerId}/attachments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-DBRepairs-Filename": encodeURIComponent(file.name),
          "X-DBRepairs-Content-Type": contentType,
        },
        body: buffer,
      },
    );

    if (!response.ok) {
      throw new Error(await responseError(response));
    }

    return;
  }

  const db = await getDatabase();

  await db.execute(
    `INSERT INTO customer_attachments
       (customer_id, filename, content_type, size, data_base64)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
    [
      customerId,
      file.name,
      contentType,
      file.size,
      arrayBufferToBase64(buffer),
    ],
  );
}

export async function downloadCustomerAttachment(
  attachment: CustomerAttachment,
): Promise<void> {
  if (isServerMode) {
    const response = await fetch(
      `/api/customers/${attachment.customer_id}/attachments/${attachment.id}`,
    );

    if (!response.ok) {
      throw new Error(await responseError(response));
    }

    downloadBlob(
      await response.blob(),
      attachment.filename,
    );

    return;
  }

  const db = await getDatabase();

  const rows = await db.select<{ data_base64: string }[]>(
    `SELECT data_base64
     FROM customer_attachments
     WHERE id = ?1
       AND customer_id = ?2`,
    [
      attachment.id,
      attachment.customer_id,
    ],
  );

  if (!rows.length) {
    throw new Error("attachment-not-found");
  }

  await invoke("export_binary_file", {
    filename: attachment.filename,
    data: Array.from(base64ToBytes(rows[0].data_base64)),
  });
}

export async function deleteCustomerAttachment(
  attachment: CustomerAttachment,
): Promise<void> {
  if (isServerMode) {
    const response = await fetch(
      `/api/customers/${attachment.customer_id}/attachments/${attachment.id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      throw new Error(await responseError(response));
    }

    return;
  }

  const db = await getDatabase();

  await db.execute(
    `DELETE FROM customer_attachments
     WHERE id = ?1
       AND customer_id = ?2`,
    [
      attachment.id,
      attachment.customer_id,
    ],
  );
}
