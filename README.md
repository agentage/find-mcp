# @agentage/find-mcp

![Your AI finds the right tool in seconds - from 17,000+](https://github.com/agentage/find-mcp/raw/master/docs/banner.svg)

Give your AI a directory of 17,000+ tools. One command connects Claude, Cursor, or VS Code to
the public [agentage MCP directory](https://catalog.agentage.io/mcp), and your AI finds the
right tool in seconds - free, read-only, no sign-up.

## What is this?

AI apps like Claude and Cursor can use outside tools - for reading databases, sending email,
searching the web, and thousands of other things - through an open standard called
[MCP](https://modelcontextprotocol.io). The hard part is finding the right tool.

This package solves that: it gives your AI a searchable directory of 17,000+ of those tools,
so you can simply ask for what you need and let the AI find it. Nothing to install permanently,
no account, and it can only read the directory - it never changes anything on your machine.

Prefer to look around yourself? The same directory is browsable at
[catalog.agentage.io/mcp](https://catalog.agentage.io/mcp).

## Get started

Add this to your AI app, then ask away.

### Claude Desktop / Cursor / VS Code (`mcp.json`)

```json
{
  "mcpServers": {
    "find-mcp": {
      "command": "npx",
      "args": ["-y", "@agentage/find-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add find-mcp -- npx -y @agentage/find-mcp
```

### Then ask your AI things like

- "Find me a tool that connects you to Postgres."
- "Is there an MCP server for Notion? How do I install it?"
- "What are the most popular tools for browser automation?"

## Tools

The tool set is served by the remote directory (this proxy forwards it as-is):

| Tool             | What it does                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `mcp_search`     | Find MCP servers by keyword, with category/language/license filters   |
| `mcp_get`        | Return one server's full packages, tools, and install command by slug |
| `mcp_categories` | List the category/language/license values you can filter on          |

## How it works

This is the **npm client for the agentage MCP directory** - a thin stdio proxy that bridges
stdio-only MCP clients to the public remote endpoint `https://catalog.agentage.io/mcp`.

It is intentionally **tiny**: it holds no tool logic. On start it connects to the remote
directory over Streamable HTTP and forwards `tools/list` and `tools/call` verbatim, so upstream
tool changes flow through without republishing this package. Forwarding is bounded by the pinned
MCP SDK schemas, so a brand-new upstream tool field may need an SDK bump here to pass through.
The directory is **public and read-only** - no auth, no keys, nothing installed or executed.

### Remote clients don't need this package

Clients that support **remote** MCP servers can point straight at the Streamable HTTP endpoint:

```
https://catalog.agentage.io/mcp
```

This package exists only to bridge **stdio-only** clients to that same endpoint.

## Configuration

| Env               | Default                            | Purpose                                              |
| ----------------- | ----------------------------------- | ---------------------------------------------------- |
| `FIND_MCP_URL`    | `https://catalog.agentage.io/mcp`  | Override the upstream endpoint (dev)                 |
| `CATALOG_MCP_URL` | -                                   | Deprecated alias for `FIND_MCP_URL`, still accepted   |

## Develop

```bash
npm install
npm test                # vitest: in-process mock-upstream contract + forwarding tests
LIVE_SMOKE=1 npm test   # also runs the live smoke against the real endpoint
npm run verify          # type-check + lint + format:check + test + build
```

## Release

Releases publish to npm via GitHub Actions when a `chore(release): vX.Y.Z` commit that touches
`package.json` lands on `master` (the squash-merge subject of a release PR). The workflow skips
any version already on npm.

## License

MIT - see [LICENSE](./LICENSE).
