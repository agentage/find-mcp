# @agentage/catalog-mcp

![Your AI finds the right tool in seconds - from 14,000+](https://github.com/agentage/catalog-mcp/raw/master/docs/banner.svg)

Give your AI a catalog of 14,000+ tools. One command connects Claude, Cursor, or VS Code to
the public [agentage MCP catalog](https://catalog.agentage.io/mcp), and your AI finds the
right tool in seconds - free, read-only, no sign-up.

## What is this?

AI apps like Claude and Cursor can use outside tools - for reading databases, sending email,
searching the web, and thousands of other things - through an open standard called
[MCP](https://modelcontextprotocol.io). The hard part is finding the right tool.

This package solves that: it gives your AI a searchable directory of 14,000+ of those tools,
so you can simply ask for what you need and let the AI find it. Nothing to install permanently,
no account, and it can only read the catalog - it never changes anything on your machine.

Prefer to look around yourself? The same catalog is browsable at
[catalog.agentage.io/mcp](https://catalog.agentage.io/mcp).

## Get started

Add this to your AI app, then ask away.

### Claude Desktop / Cursor / VS Code (`mcp.json`)

```json
{
  "mcpServers": {
    "agentage-catalog": {
      "command": "npx",
      "args": ["-y", "@agentage/catalog-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add agentage-catalog -- npx -y @agentage/catalog-mcp
```

### Then ask your AI things like

- "Find me a tool that connects you to Postgres."
- "Is there an MCP server for Notion? How do I install it?"
- "What are the most popular tools for browser automation?"

## Tools

The tool set is served by the remote catalog (this proxy forwards it as-is):

| Tool              | What it does                                                          |
| ----------------- | --------------------------------------------------------------------- |
| `catalog__search` | Find MCP servers by keyword, with category/language/license filters   |
| `catalog__get`    | Return one server's full packages, tools, and install command by slug |
| `catalog__facets` | List the category/language/license values you can filter on           |

## How it works

This is the **npm client for the agentage MCP catalog** - a thin stdio proxy that bridges
stdio-only MCP clients to the public remote endpoint `https://catalog.agentage.io/mcp`.

It is intentionally **tiny**: it holds no tool logic. On start it connects to the remote catalog
over Streamable HTTP and forwards `tools/list` and `tools/call` verbatim, so upstream tool
changes flow through without republishing this package. The catalog is **public and read-only** -
no auth, no keys, nothing installed or executed.

### Remote clients don't need this package

Clients that support **remote** MCP servers can point straight at the Streamable HTTP endpoint:

```
https://catalog.agentage.io/mcp
```

This package exists only to bridge **stdio-only** clients to that same endpoint.

## Configuration

| Env               | Default                           | Purpose                              |
| ----------------- | --------------------------------- | ------------------------------------ |
| `CATALOG_MCP_URL` | `https://catalog.agentage.io/mcp` | Override the upstream endpoint (dev) |

## Develop

```bash
npm install
npm test                # vitest: in-process mock-upstream contract + forwarding tests
LIVE_SMOKE=1 npm test   # also runs the live smoke against the real endpoint
npm run verify          # type-check + lint + format:check + test + build
```

## License

MIT - see [LICENSE](./LICENSE).
