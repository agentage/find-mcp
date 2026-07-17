import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { UpstreamClient, DEFAULT_FIND_MCP_URL } from '../src/upstream.js';
import { createFindProxyServer } from '../src/server/create-find-proxy.js';

// Live network smoke against the real directory. Gated behind LIVE_SMOKE=1 so CI and
// the default `npm test` stay hermetic and offline.
const run = process.env.LIVE_SMOKE === '1' ? describe : describe.skip;

const TOOL_NAMES = ['mcp_categories', 'mcp_get', 'mcp_search'];

run('live directory smoke', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createFindProxyServer(new UpstreamClient({ url: DEFAULT_FIND_MCP_URL }));
    const [c, s] = InMemoryTransport.createLinkedPair();
    await server.connect(s);
    client = new Client({ name: 'live-smoke', version: '0.0.0' });
    await client.connect(c);
  });

  afterAll(async () => {
    await client.close();
  });

  it('lists exactly the 3 mcp_* tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(TOOL_NAMES);
  });

  it('runs mcp_categories against the live endpoint', async () => {
    const res = (await client.callTool({ name: 'mcp_categories', arguments: {} })) as {
      isError?: boolean;
      content: { type: string; text?: string }[];
    };
    expect(res.isError).not.toBe(true);
    expect(res.content.length).toBeGreaterThan(0);
  });
});
