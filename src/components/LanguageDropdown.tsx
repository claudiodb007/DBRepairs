import { useEffect, useMemo, useRef, useState } from "react";

type LocaleOption = { code: string; name: string };

type Props = {
  locale: string;
  setLocale: (locale: string) => void;
  locales: LocaleOption[];
  label: string;
  searchLabel: string;
};

export default function LanguageDropdown({ locale, setLocale, locales, label, searchLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const current = locales.find((item) => item.code === locale) ?? locales[0];

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return locales;
    return locales.filter((item) =>
      `${item.name} ${item.code}`.toLocaleLowerCase().includes(term),
    );
  }, [locales, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div className="language-dropdown" ref={rootRef}>
      <button
        type="button"
        className="language-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{current?.name ?? locale}</span>
        <small>{current?.code ?? locale}</small>
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="language-menu">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
          />
          <div className="language-options" role="listbox" aria-label={label}>
            {filtered.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={item.code === locale}
                className={item.code === locale ? "selected" : ""}
                key={item.code}
                onClick={() => {
                  setLocale(item.code);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{item.name}</span>
                <small>{item.code}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
