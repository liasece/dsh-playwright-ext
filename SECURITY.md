# Security

This extension is a local development tool and is **not** an official Playwright
or DeepSeek product.

## Permissions

- `debugger`, `tabs`, `tabGroups`, `activeTab`
- `host_permissions: <all_urls>`

These permissions let the extension read and control any tab in the browser.
Only load it from source you trust.

## Token

The extension status page generates a `PLAYWRIGHT_MCP_EXTENSION_TOKEN`. Treat it
like a password: it authorizes an MCP client to connect to your browser profile.
Do not commit it, paste it into logs, or share it publicly.

## Extension ID

The manifest keeps the public `key` of the official Playwright Extension so the
stock Playwright MCP client can discover the fork. You must remove the official
extension before loading this one; they cannot coexist. This project is
unofficial and is not affiliated with Microsoft.

## Reporting

Open a GitHub issue for non-sensitive bugs. For sensitive reports, contact the
repository owner privately.
