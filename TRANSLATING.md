# Translating DBRepairs

Translations are intentionally simple.

1. Copy `src/i18n/locales/en.json` to a new language file, for example `de.json`.
2. Translate only the values. Never change the keys on the left.
3. Add the language to `supportedLocales` and `dictionaries` in `src/i18n/I18nProvider.tsx`.
4. Keep files encoded as UTF-8.
5. If a translation key is missing, DBRepairs falls back to English.

Example:

```json
{
  "repair.new": "New repair"
}
```

becomes:

```json
{
  "repair.new": "Neue Reparatur"
}
```
