import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { UpstreamClient, DEFAULT_FIND_MCP_URL } from '../upstream.js';
import { createFindProxyServer } from '../server/create-find-proxy.js';
import { PACKAGE_VERSION } from '../version.js';

export const HELP = `@agentage/find-mcp v${PACKAGE_VERSION}

A thin stdio MCP proxy that bridges stdio-only MCP clients (Claude Desktop,
Cursor, VS Code) to the public agentage MCP directory at ${DEFAULT_FIND_MCP_URL}.
It forwards tools/list and tools/call verbatim - no auth, read-only.

Usage:
  npx -y @agentage/find-mcp        Start the stdio server (default)
  npx -y @agentage/find-mcp --help Show this help
  npx -y @agentage/find-mcp --version

Env:
  FIND_MCP_URL      Override the upstream endpoint (default above)
  CATALOG_MCP_URL   Deprecated alias for FIND_MCP_URL (still accepted)

Docs: https://catalog.agentage.io/mcp
`;

// Resolve a --help/--version flag to the text to print, or null to start the server.
export const flagOutput = (argv: readonly string[]): string | null => {
  if (argv.includes('--help') || argv.includes('-h')) return HELP;
  if (argv.includes('--version') || argv.includes('-v')) return `${PACKAGE_VERSION}\n`;
  return null;
};

export interface Bootstrapped {
  upstream: UpstreamClient;
  close: () => Promise<void>;
}

// Wire a catalog proxy server onto the given transport and report readiness to
// stderr (stdout is the JSON-RPC wire). Returns a teardown for clean shutdown.
export const bootstrap = async (transport: Transport): Promise<Bootstrapped> => {
  const upstream = new UpstreamClient();
  const server = createFindProxyServer(upstream);
  await server.connect(transport);
  process.stderr.write(`[find-mcp] stdio ready, proxying to ${upstream.target}\n`);
  return {
    upstream,
    close: async () => {
      await server.close();
      await upstream.close();
    },
  };
};
