import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { UpstreamClient } from '../upstream.js';
import { forward } from './forward.js';
import { PACKAGE_VERSION } from '../version.js';

export const SERVER_NAME = 'find-mcp';
export const SERVER_TITLE = 'Find MCP - Agentage MCP Directory';

const INSTRUCTIONS =
  'A public directory of Model Context Protocol (MCP) servers, crawled from the official registry. Use it to discover, compare, and look up MCP servers on request ("is there an MCP for X", "which MCP server does Y"). mcp_search finds servers by keyword and filters; mcp_get returns one server\'s full packages, tools, and install command by slug; mcp_categories lists the category/language/license values you can filter on. Read-only - it never installs or runs anything. This package is a thin stdio proxy to catalog.agentage.io/mcp; the tool set is served by the remote and may evolve.';

// A low-level MCP Server that forwards tools/list and tools/call to the remote
// directory verbatim - tools are NOT hard-coded, so upstream changes flow through
// without republishing this package.
export const createFindProxyServer = (upstream: UpstreamClient): Server => {
  const server = new Server(
    {
      name: SERVER_NAME,
      title: SERVER_TITLE,
      version: PACKAGE_VERSION,
      websiteUrl: 'https://catalog.agentage.io/mcp',
    },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, (req) =>
    forward(upstream, { method: 'tools/list', params: req.params }, ListToolsResultSchema)
  );
  server.setRequestHandler(CallToolRequestSchema, (req) =>
    forward(upstream, { method: 'tools/call', params: req.params }, CallToolResultSchema)
  );

  return server;
};
