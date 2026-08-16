import { useI18n } from "../i18n/I18nProvider";

export type RepairPrintData = {
  repairNumber: string;
  openedAt: string;
  customerName: string;
  phone?: string;
  email?: string;
  deviceType?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  imei?: string;
  reportedFault?: string;
  accessories?: string;
  generalCondition?: string;
  internalNotes?: string;
};

export default function RepairPrintSheet({ data }: { data: RepairPrintData }) {
  const { t } = useI18n();
  return (
    <section className="print-a4" aria-label={t("print.preview")}> 
      <RepairHalf title={t("print.shopCopy")} data={data} shopCopy />
      <div className="cut-line"><span>✂ {t("print.cutHere")}</span></div>
      <RepairHalf title={t("print.customerCopy")} data={data} />
    </section>
  );
}

function RepairHalf({ title, data, shopCopy = false }: { title: string; data: RepairPrintData; shopCopy?: boolean }) {
  const { t } = useI18n();
  const device = [data.deviceType, data.brand, data.model].filter(Boolean).join(" · ") || "—";
  const serial = data.imei || data.serialNumber || "—";
  return (
    <article className="repair-slip">
      <div className="slip-head">
        <div><strong className="slip-brand">DBRepairs</strong><span>{title}</span></div>
        <div className="slip-number"><span>{t("print.repairNumber")}</span><strong>{data.repairNumber}</strong></div>
      </div>
      <div className="slip-grid">
        <div><span>{t("customer.name")}</span><strong>{data.customerName}</strong></div>
        <div><span>{t("repair.openedAt")}</span><strong>{data.openedAt}</strong></div>
        <div><span>{t("customer.phone")}</span><strong>{data.phone || "—"}</strong></div>
        <div><span>{t("repair.device")}</span><strong>{device}</strong></div>
        <div><span>{t("customer.email")}</span><strong>{data.email || "—"}</strong></div>
        <div><span>{t("repair.serialOrImei")}</span><strong>{serial}</strong></div>
      </div>
      <div className="slip-row"><span>{t("repair.reportedFault")}</span><p>{data.reportedFault || "—"}</p></div>
      <div className="slip-row"><span>{t("repair.accessories")}</span><p>{data.accessories || "—"}</p></div>
      <div className="slip-row"><span>{t("repair.generalCondition")}</span><p>{data.generalCondition || "—"}</p></div>
      {shopCopy && <div className="slip-row internal"><span>{t("repair.internalNotes")}</span><p>{data.internalNotes || "—"}</p></div>}
      <div className="signature-row">
        <div><span>{t("print.customerSignature")}</span></div>
        <div><span>{t("print.shopSignature")}</span></div>
      </div>
    </article>
  );
}
