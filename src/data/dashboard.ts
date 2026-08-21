import { getDatabase } from "./database";
import { api } from "./api";
import { isServerMode } from "./runtime";

export type DashboardStats = {
  openRepairs: number;
  waitingCustomer: number;
  ready: number;
  closedToday: number;
};

export type DashboardRecentRepair = {
  id: number;
  repair_number: string;
  customer_name: string;
  status_code: string;
  status_label_key: string;
  device_type: string | null;
  brand: string | null;
  model: string | null;
  opened_at: string;
};

type DashboardData = { stats: DashboardStats; recent: DashboardRecentRepair[] };
let serverDashboardRequest: Promise<DashboardData> | undefined;

function getServerDashboard() {
  if (!serverDashboardRequest) {
    serverDashboardRequest = api<DashboardData>("/dashboard");
    window.setTimeout(() => { serverDashboardRequest = undefined; }, 0);
  }
  return serverDashboardRequest;
}

type CountRow = { count: number };

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<CountRow[]>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  if (isServerMode) return (await getServerDashboard()).stats;
  const [openRepairs, waitingCustomer, ready, closedToday] = await Promise.all([
    count(`SELECT COUNT(*) count
      FROM repairs r
      JOIN repair_statuses s ON s.id=r.status_id
      WHERE s.code NOT IN ('DELIVERED','CANCELLED')`),
    count(`SELECT COUNT(*) count
      FROM repairs r
      JOIN repair_statuses s ON s.id=r.status_id
      WHERE s.code='WAITING_CUSTOMER'`),
    count(`SELECT COUNT(*) count
      FROM repairs r
      JOIN repair_statuses s ON s.id=r.status_id
      WHERE s.code='READY'`),
    count(`SELECT COUNT(*) count
      FROM repairs
      WHERE closed_at IS NOT NULL
        AND date(closed_at,'localtime') = date('now','localtime')`),
  ]);

  return { openRepairs, waitingCustomer, ready, closedToday };
}

export async function listDashboardRecentRepairs(limit = 5): Promise<DashboardRecentRepair[]> {
  if (isServerMode) return (await getServerDashboard()).recent.slice(0, limit);
  const db = await getDatabase();
  return db.select(`SELECT
      r.id,
      r.repair_number,
      c.name customer_name,
      s.code status_code,
      s.label_key status_label_key,
      r.device_type,
      r.brand,
      r.model,
      r.opened_at
    FROM repairs r
    JOIN customers c ON c.id=r.customer_id
    JOIN repair_statuses s ON s.id=r.status_id
    ORDER BY r.id DESC
    LIMIT ?`, [limit]);
}
