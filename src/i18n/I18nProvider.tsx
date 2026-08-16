import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import ptPT from "./locales/pt-PT.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

const dictionaries: Record<string, Record<string, string>> = { "pt-PT": ptPT, en, es, fr };
export const supportedLocales = [
  { code: "pt-PT", name: "Português" },
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" }
];

type I18nContextValue = {
  locale: string;
  locales: typeof supportedLocales;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState(() => localStorage.getItem("dbrepairs.locale") || "pt-PT");
  const setLocale = (next: string) => {
    if (!dictionaries[next]) return;
    localStorage.setItem("dbrepairs.locale", next);
    document.documentElement.lang = next;
    updateLocale(next);
  };
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    locales: supportedLocales,
    setLocale,
    t: (key) => dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key
  }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
