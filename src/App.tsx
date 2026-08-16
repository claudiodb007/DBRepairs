import { useState } from "react";
import CustomersPage from "./pages/CustomersPage";
import LanguageDropdown from "./components/LanguageDropdown";
import RepairPrintSheet from "./components/RepairPrintSheet";
import { useI18n } from "./i18n/I18nProvider";

type Page = "dashboard" | "repairs" | "customers" | "settings";

const cards = [
  ["dashboard.openRepairs", "0"],
  ["dashboard.waitingCustomer", "0"],
  ["dashboard.ready", "0"],
  ["dashboard.closedToday", "0"],
] as const;

const printPreviewData = {
  repairNumber: "2026-000001",
  openedAt: "16/08/2026 11:54",
  customerName: "Cliente de exemplo",
  phone: "912 345 678",
  email: "cliente@example.com",
  deviceType: "Telemóvel",
  brand: "Marca",
  model: "Modelo",
  serialNumber: "SN123456789",
  reportedFault: "Equipamento não liga.",
  accessories: "Capa e carregador.",
  generalCondition: "Marcas normais de utilização.",
  internalNotes: "Área reservada à cópia da loja.",
};

export default function App() {
  const { t, locale, setLocale, locales } = useI18n();
  const [page, setPage] = useState<Page>("dashboard");
  const [printPreview, setPrintPreview] = useState(false);

  const languageControl = (
    <LanguageDropdown
      locale={locale}
      setLocale={setLocale}
      locales={locales}
      label={t("settings.language")}
      searchLabel={t("settings.searchLanguage")}
    />
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">DBRepairs <span>0.1</span></div>
        <nav>
          <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>{t("nav.dashboard")}</button>
          <button className={page === "repairs" ? "active" : ""} onClick={() => setPage("repairs")}>{t("nav.repairs")}</button>
          <button className={page === "customers" ? "active" : ""} onClick={() => setPage("customers")}>{t("nav.customers")}</button>
          <button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}>{t("nav.settings")}</button>
        </nav>
        <div className="sidebar-language">{languageControl}</div>
      </aside>

      <main>
        {page === "dashboard" && (
          <>
            <header>
              <div>
                <h1>{t("dashboard.title")}</h1>
                <p>{t("dashboard.subtitle")}</p>
              </div>
            </header>

            <section className="cards">
              {cards.map(([label, value]) => (
                <article className="card" key={label}>
                  <strong>{value}</strong>
                  <span>{t(label)}</span>
                </article>
              ))}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>{t("repairs.title")}</h2>
                  <p>{t("repairs.emptyHint")}</p>
                </div>
                <button className="primary" onClick={() => setPage("repairs")}>+ {t("repair.new")}</button>
              </div>
              <div className="empty-state">{t("repairs.empty")}</div>
            </section>
          </>
        )}

        {page === "customers" && <CustomersPage />}

        {page === "repairs" && (
          <>
            <header className="page-header">
              <div><h1>{t("repairs.title")}</h1><p>{t("repairs.emptyHint")}</p></div>
              <div className="header-actions">
                <button className="secondary" onClick={() => setPrintPreview(true)}>{t("print.preview")}</button>
                <button className="primary">+ {t("repair.new")}</button>
              </div>
            </header>
            <section className="panel"><div className="empty-state compact">{t("repairs.empty")}</div></section>
          </>
        )}

        {page === "settings" && (
          <>
            <header className="page-header"><div><h1>{t("settings.title")}</h1><p>{t("settings.subtitle")}</p></div></header>
            <section className="panel settings-panel">
              <label className="field settings-field"><span>{t("settings.language")}</span>{languageControl}</label>
            </section>
          </>
        )}
      </main>

      {printPreview && (
        <div className="print-preview-backdrop">
          <div className="print-preview-shell">
            <div className="print-preview-toolbar">
              <strong>{t("print.preview")}</strong>
              <div>
                <button className="secondary" onClick={() => setPrintPreview(false)}>{t("common.close")}</button>
                <button className="primary" onClick={() => window.print()}>{t("print.print")}</button>
              </div>
            </div>
            <RepairPrintSheet data={printPreviewData} />
          </div>
        </div>
      )}
    </div>
  );
}
