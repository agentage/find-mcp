#!/usr/bin/env node
// @agentage/catalog-mcp - the stdio MCP client for the agentage MCP catalog.
// `npx @agentage/catalog-mcp` bridges a stdio MCP client (Claude Desktop, Cursor,
// VS Code) to the public remote endpoint catalog.agentage.io/mcp, forwarding
// tools/list and tools/call verbatim. No auth - the catalog is public, read-only.
//
// stdout is the JSON-RPC wire; ALL diagnostics MUST go to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { UpstreamClient } from '../upstream.js';
import { createCatalogProxyServer } from '../server/create-catalog-proxy.js';

const main = async (): Promise<void> => {
  const upstream = new UpstreamClient();
  const server = createCatalogProxyServer(upstream);
  await server.connect(new StdioServerTransport());
  // The connection to the remote is lazy: it opens on the first tools request.
  process.stderr.write(`[catalog-mcp] stdio ready, proxying to ${upstream.target}\n`);
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[catalog-mcp] fatal: ${message}\n`);
  process.exit(1);
});
