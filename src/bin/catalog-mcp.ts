#!/usr/bin/env node
// @agentage/catalog-mcp - the stdio MCP client for the agentage MCP catalog.
// `npx @agentage/catalog-mcp` bridges a stdio MCP client (Claude Desktop, Cursor,
// VS Code) to the public remote endpoint catalog.agentage.io/mcp, forwarding
// tools/list and tools/call verbatim. No auth - the catalog is public, read-only.
//
// stdout is the JSON-RPC wire; ALL diagnostics MUST go to stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { bootstrap, flagOutput } from './bootstrap.js';

const main = async (): Promise<void> => {
  const out = flagOutput(process.argv.slice(2));
  if (out !== null) {
    process.stdout.write(out);
    process.exit(0);
  }

  const app = await bootstrap(new StdioServerTransport());

  // The SDK stdio transport doesn't exit when the host closes stdin, so drive a
  // clean shutdown ourselves. Guarded so overlapping signals tear down once.
  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await app.close();
    process.exit(0);
  };

  process.stdin.on('end', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
};

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[catalog-mcp] fatal: ${message}\n`);
  process.exit(1);
});
