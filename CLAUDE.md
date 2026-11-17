# CLAUDE.md - agentage/find-mcp

Public repo. `@agentage/find-mcp`: a thin stdio MCP proxy to the remote directory at `https://catalog.agentage.io/mcp`. It holds no tool logic. Standards: the engineering standards batch (`~/vaults/engineering/standards/`, start at `README.md`); this file only adds what the tree does not say. Words and usage: [README.md](README.md).

## Layout

- `src/bin/find-mcp.ts`: the `agentage-find-mcp` bin entry; `src/bin/bootstrap.ts`: flags (`--help`, `--version`) and the stdio wiring.
- `src/upstream.ts`: the Streamable HTTP client. `FIND_MCP_URL` overrides the endpoint; `CATALOG_MCP_URL` is the deprecated alias.
- `src/server/`: the proxy server; `tools/list` and `tools/call` are forwarded verbatim.
- `src/index.ts`: the public API. Only what `package.json` `exports` reaches is public.
- `test/`: Vitest with an in-process mock upstream (`test/fixtures/`). `LIVE_SMOKE=1 npm test` also hits the real endpoint.

## Commands

- `npm run verify`: type-check, lint, format check, test, build.

## Release

- `server.json` (official MCP registry manifest) carries the package version twice; `test/server-json.test.ts` asserts it matches `package.json`. Bump all three together.
- Release rules: README "Release" (proof: `.github/workflows/release.yml`, `prepare-release.yml`).

## Gotchas

- stdout is the JSON-RPC wire. Write logs to stderr only.
- `src/version.ts` reads `package.json` at runtime so tsc `rootDir` stays `src`.
