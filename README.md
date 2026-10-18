# dsh-playwright-ext

An **unofficial** fork of the [Playwright Extension](https://github.com/microsoft/playwright/tree/main/packages/extension) for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH).

It lets an AI agent work in a **background tab group** without switching your active tab or pulling Chrome to the foreground. You keep using Chrome while the agent reads and navigates pages in its own group.

> This project is not affiliated with Microsoft or DeepSeek. The extension keeps the public `key` of the official Playwright Extension so the stock Playwright MCP client can discover it, which means the official extension must be removed before loading this fork.

## Why

The stock Playwright Extension opens a connect page with `chrome.tabs.create({ url })`. Chrome makes new tabs active by default, and after a connection is approved the extension calls:

```ts
chrome.tabs.update(tab.id, { active: true })
chrome.windows.update(tab.windowId, { focused: true })
```

That is why Chrome jumps to the agent's page and steals focus. This fork leaves the rest of the extension intact and changes exactly those two behaviors.

## Changes

- `src/relayConnection.ts` — every `chrome.tabs.create` relayed from the MCP client is forced to `active: false`.
- `src/background.ts` — the tab activation and window focus calls were removed from the connect flow.

The tab group, relay protocol, token auth, and connect/status UI are the official 0.4.0 implementation.

## Features

- Background connect page and background tabs: no active-tab switch, no window focus steal.
- A visible `DSH · <tab title>` tab group (connection-time title until a tab is shared) plus a `DSH` toolbar badge.
- An in-page activity pill and a custom cursor that follows agent clicks (`content/overlay.js`).
- System notifications when an agent connects or disconnects.
- Agent confined to its own tab group; drag tabs in or out to share.
- Token auth still bypasses the per-connection approval dialog.
- Reuses your real Chrome profile, cookies, and logged-in sessions.

## Requirements

- Chrome/Chromium (Manifest V3, targeting Chrome 155; smoke-tested in Playwright Chromium 1243, not yet in a real Chrome profile).
- Node.js 20+ to build the extension.
- A Playwright MCP server and DSH for the agent side. The extension is discovered by the stock Playwright MCP client through the official extension ID.

## Build

```sh
npm install
npm run build
```

The loadable unpacked extension is written to `dist/`.

## Install

1. Quit DSH so the MCP server and any `chrome.debugger` session are released.
2. Open `chrome://extensions`, enable **Developer mode**, and **remove** the official **Playwright Extension**. The fork uses the same extension ID and cannot coexist with it.
3. Click **Load unpacked** and select the `dist/` directory.
4. Click the extension icon, open its status page, and copy `PLAYWRIGHT_MCP_EXTENSION_TOKEN`.
5. Add or update the MCP client entry in your DSH profile patch, for example `~/.dsh/profiles/desktop/cordis.patch.yml`:

```yaml
- insert:
    - id: mcp-playwright-ext
      name: "@deepseek-ai/dsh-mcp-client"
      config:
        serverName: playwright-ext
        transport: stdio
        command: node
        args:
          - /absolute/path/to/@playwright/mcp/cli.js
          - --extension
        env:
          PLAYWRIGHT_MCP_EXTENSION_TOKEN: "<token from the extension status page>"
        toolCallTimeoutMs: 120000
        failOnStartupError: false
```

6. Restart DSH and verify the agent's browser tools appear.

The `@playwright/mcp` path depends on your installation. In a DSH desktop profile it is typically `~/.dsh/profiles/desktop/node_modules/@playwright/mcp/cli.js`. Use an absolute node path (for example `/opt/homebrew/bin/node`) if DSH is launched from Finder and does not inherit your shell PATH.

## Usage

- The connect page is created in the background on each MCP connection; the agent's tab starts there and can navigate normally with your existing login state.
- The agent only sees tabs in its own group. Drag a tab into the group to share it; drag it out to revoke access.
- The extension still uses `chrome.debugger`. Chrome may show the usual "Playwright Extension is debugging this browser" infobar; this fork only removes the tab switch and window focus.
- Closing the agent's tab / quitting DSH disconnects the client.

## Security

- Permissions: `debugger`, `activeTab`, `tabs`, `tabGroups`, `notifications`, and `<all_urls>`. The extension can read and control any tab in the profile.
- `content/overlay.js` is injected into `<all_urls>` to render the activity pill and cursor. It is `pointer-events: none` and only becomes visible for a tab attached to a client.
- The token authorizes an MCP client to attach to your browser. Treat it like a password and never commit it.
- The fork preserves the official extension's public key. Load it only from source you trust.
- Unpacked extensions do not auto-update. Rebase this fork when Playwright's extension changes.

## Limitations

- The connect page still exists (in the background) and the agent's first tab is that page.
- The agent's tab group is the isolation boundary; there is no per-site allowlist or prompt yet.
- The group title follows the shared tab title or the connection time; there is no rename UI yet.
- The extension ID is preserved for client compatibility, so the official extension must be removed.
- The Chrome debugger infobar remains while a tab is attached.
- No automated test suite; CI verifies the production build.

## Roadmap

- Per-site allowlists and first-use prompts.
- A toolbar popup to share the current tab with one click.
- A side panel / status surface and group rename.
- A native host or DSH settings page for permissions.
- Tests for the relay, overlay, and tab-group lifecycle.
- A release workflow that publishes the zip artifact automatically.

## Development

```
src/                    patched Playwright extension sources
extension/              static manifest, HTML, icons, prebuilt official UI
scripts/build.mjs       esbuild bundle + copy to dist/
dist/                   generated unpacked extension (gitignored)
```

The prebuilt UI under `extension/lib/ui` comes from the official Playwright Extension 0.4.0 distribution and is licensed under Apache-2.0. The background service worker is built from `src/`.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

---

## 中文摘要

这是微软 Playwright Extension 0.4.0 的非官方 fork，目标是让 AI 在后台 tab group 里操作浏览器，**不切换你的当前标签、不抢 Chrome 窗口焦点**。只改了两处：connect 页强制 `active: false`，以及移除连接流程里的 `tabs.update({active:true})` / `windows.update({focused:true})`。

安装：`npm install && npm run build`，在 Chrome 里移除官方 Playwright Extension，加载 `dist/`，复制 token 填进 DSH 的 `mcp-playwright-ext` 配置，重启 DSH。扩展保留官方 ID，因此不能和商店版共存；也未与微软/DeepSeek 关联。
