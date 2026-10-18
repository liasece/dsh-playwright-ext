## 0.2.1

- Group titles now follow page navigation and ignore `Welcome` / `about:blank` / `New Tab`.
- Documented `--timeout-action` for background-tab clicks.

## 0.2.0

- DSH toolbar badge and per-tab badge.
- In-page activity pill and click-following cursor.
- Task tab groups titled DSH · <tab title> with connection-time fallback.
- System notifications on connect and disconnect.
- All relay-created tabs (including the connect page) open in the background.

# Changelog

## 0.1.0

- Fork of the Playwright Extension 0.4.0 (Apache-2.0).
- Force the MCP connect page to open with `active: false`.
- Remove the tab activation and window focus calls from the connect flow.
- Add a reproducible esbuild build and load-unpacked documentation.
