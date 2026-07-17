import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { UpstreamClient } from '../src/upstream.js';
import { createFindProxyServer } from '../src/server/create-find-proxy.js';
import { startMockUpstream, type MockUpstream } from './fixtures/mock-upstream.js';

// A test Client -> proxy Server (in memory) -> UpstreamClient -> mock HTTP upstream.
const connectProxy = async (url: string): Promise<Client> => {
  const server = createFindProxyServer(new UpstreamClient({ url }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
};

describe('find-mcp proxy passthrough', () => {
  let mock: MockUpstream;
  let client: Client;

  beforeAll(async () => {
    mock = await startMockUpstream();
    client = await connectProxy(mock.url);
  });

  afterAll(async () => {
    await client.close();
    await mock.close();
  });

  it('forwards tools/list verbatim (names + schemas)', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['mcp_categories', 'mcp_get', 'mcp_search']);
    const search = tools.find((t) => t.name === 'mcp_search');
    expect(search?.description).toBe('Find MCP servers by keyword');
    expect(search?.inputSchema.properties).toHaveProperty('query');
  });

  it('round-trips tools/call results verbatim', async () => {
    const res = (await client.callTool({
      name: 'mcp_search',
      arguments: { query: 'postgres' },
    })) as { content: { type: string; text: string }[] };
    expect(res.content[0].text).toBe('search:postgres');
  });

  it('passes another tool through by slug', async () => {
    const res = (await client.callTool({
      name: 'mcp_get',
      arguments: { slug: 'io.agentage' },
    })) as { content: { type: string; text: string }[] };
    expect(res.content[0].text).toBe('get:io.agentage');
  });

  it('preserves _meta, annotations, and nextCursor from the upstream tools/list', async () => {
    mock.richListNextCall();
    const res = (await client.listTools()) as {
      tools: { annotations?: unknown; _meta?: unknown }[];
      nextCursor?: string;
      _meta?: Record<string, unknown>;
    };
    expect(res.nextCursor).toBe('cursor-page-2');
    expect(res._meta).toMatchObject({ 'io.agentage/total': 17300 });
    expect(res.tools[0].annotations).toMatchObject({
      readOnlyHint: true,
      title: 'Search directory',
    });
    expect(res.tools[0]._meta).toMatchObject({ 'io.agentage/tool': 'search' });
  });

  it('passes the upstream -32000 rate-limit error through verbatim', async () => {
    mock.rateLimitNextCall();
    await expect(client.callTool({ name: 'mcp_categories', arguments: {} })).rejects.toMatchObject({
      code: -32000,
      message: expect.stringContaining('Rate limit'),
    });
  });

  it('surfaces an unreachable upstream as a JSON-RPC error, no crash', async () => {
    const dead = await connectProxy('http://127.0.0.1:1/mcp');
    await expect(dead.listTools()).rejects.toBeInstanceOf(McpError);
    await dead.close();
  });
});
