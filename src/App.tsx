import { useState } from "react";
import CustomersPage from "./pages/CustomersPage";
import LanguageDropdown from "./components/LanguageDropdown";
import SettingsPage from "./pages/SettingsPage";
import RepairsPage from "./pages/RepairsPage";
import { useI18n } from "./i18n/I18nProvider";

type Page = "dashboard" | "repairs" | "customers" | "settings";

const cards = [
  ["dashboard.openRepairs", "0"],
  ["dashboard.waitingCustomer", "0"],
  ["dashboard.ready", "0"],
  ["dashboard.closedToday", "0"],
] as const;

export default function App() {
  const { t, locale, setLocale, locales } = useI18n();
  const [page, setPage] = useState<Page>("dashboard");

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
        <div className="brand"><img src="/dbrepairs-icon.png" alt="" /><div>DBRepairs <span>0.1</span></div></div>
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

        {page === "repairs" && <RepairsPage />}

        {page === "settings" && <SettingsPage />}
      </main>

    </div>
  );
}
