import { createServer, type Server as HttpServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface MockUpstream {
  url: string;
  // Force the next tools/call to return an HTTP 429 with a -32000 JSON-RPC body.
  rateLimitNextCall: () => void;
  close: () => Promise<void>;
}

// Three fake catalog__* tools with distinct schemas, mirroring the live surface.
const buildServer = (): McpServer => {
  const server = new McpServer(
    { name: 'mock-catalog', version: '0.0.0-test' },
    { capabilities: { tools: {} } }
  );
  server.registerTool(
    'catalog__search',
    { description: 'Find MCP servers by keyword', inputSchema: { query: z.string() } },
    ({ query }) => ({ content: [{ type: 'text', text: `search:${query}` }] })
  );
  server.registerTool(
    'catalog__get',
    { description: 'Get one server by slug', inputSchema: { slug: z.string() } },
    ({ slug }) => ({ content: [{ type: 'text', text: `get:${slug}` }] })
  );
  server.registerTool(
    'catalog__facets',
    { description: 'List filterable facet values', inputSchema: {} },
    () => ({ content: [{ type: 'text', text: 'facets' }] })
  );
  return server;
};

const readBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => resolve(raw ? JSON.parse(raw) : undefined));
  });

// A stateless Streamable HTTP endpoint (a fresh server+transport per request),
// matching the live catalog. rateLimit short-circuits tools/call with a 429.
export const startMockUpstream = async (): Promise<MockUpstream> => {
  let rateLimit = false;
  const http = createServer(async (req, res) => {
    const body = (await readBody(req)) as { method?: string; id?: unknown } | undefined;
    if (rateLimit && body?.method === 'tools/call') {
      rateLimit = false;
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id ?? null,
          error: { code: -32000, message: 'Rate limit exceeded. Slow down and retry shortly.' },
        })
      );
      return;
    }
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const port = (http.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    rateLimitNextCall: () => {
      rateLimit = true;
    },
    close: () =>
      new Promise((resolve, reject) => {
        (http as HttpServer).closeAllConnections();
        http.close((err) => (err ? reject(err) : resolve()));
      }),
  };
};
