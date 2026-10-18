## 0.2.6

- On service-worker startup, if the active tab is already an agent tab (connect page/group), restore the most recently used non-agent tab.
- Covers activations that happen before the onActivated listener is registered.

## 0.2.5

- The connect page is always treated as an agent tab: any activation of it restores the most recently used non-agent tab.
- Group tab activation is still reverted only within 3s of a relay command, so the user can inspect the group intentionally.

## 0.2.4

- Added a background tab-activation guard: within 3s of a relay command, an activation of an agent tab is reverted to the user's last active tab.
- This is a backstop for activation routes that do not go through the blocked CDP commands.

## 0.2.3

- Block `Page.bringToFront` in addition to `Target.activateTarget`.
- Live retest showed `browser_tabs list` still activated the agent tab on 0.2.2; Playwright uses `Page.bringToFront` for tab targets.

## 0.2.2

- Block `Target.activateTarget` in the relay: the MCP client can no longer bring a tab to the front.
- Re-assert `active: false` after every `chrome.tabs.create`.
- This follows a live test where `browser_tabs list` switched the user's active Bilibili tab to the agent's Welcome page.

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
