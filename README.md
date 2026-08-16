# DBRepairs

DBRepairs is a simple, open-source repair-shop manager being rewritten from scratch with the practical workflow of classic workshop software in mind.

## Principles

- Simple first.
- Fast repair intake and lookup.
- Linux Debian-based and Windows desktop builds.
- Docker/server edition from the same project.
- SQLite by default.
- Easy community translations.
- GPL-3.0.

## 0.1 foundation

This first foundation contains:

- React + TypeScript interface.
- Tauri 2 desktop shell.
- SQLite database via the official Tauri SQL plugin.
- Initial customer, repair, status and status-history schema.
- Portuguese, English, Spanish and French translations.
- English fallback for missing translations.
- Linux/Windows packaging configuration.
- Reserved Docker target.

## Development

Prerequisites: Node.js, Rust and the platform dependencies required by Tauri 2.

```bash
npm install
npm run tauri dev
```

Build:

```bash
npm run tauri build
```

Tauri can generate Debian/AppImage targets on Linux and NSIS/MSI targets on Windows. Builds should normally be produced on their native OS or with CI.

## License

GPL-3.0. See `LICENSE`.

## UI decisions for 0.1

- One global application language. Changing the language changes the whole interface and printed documents.
- Language selection uses a searchable dropdown so the project can scale to many translations.
- Repair intake printing uses one A4 portrait sheet with two copies: shop copy on top, customer copy below, separated by a cut line.
- The project intentionally stays small: customers, repairs, statuses, printing, settings and backup are the initial scope.
