import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { UpstreamClient, DEFAULT_CATALOG_MCP_URL } from '../src/upstream.js';
import { createCatalogProxyServer } from '../src/server/create-catalog-proxy.js';

// Live network smoke against the real catalog. Gated behind LIVE_SMOKE=1 so CI and
// the default `npm test` stay hermetic and offline.
const run = process.env.LIVE_SMOKE === '1' ? describe : describe.skip;

run('live catalog smoke', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createCatalogProxyServer(new UpstreamClient({ url: DEFAULT_CATALOG_MCP_URL }));
    const [c, s] = InMemoryTransport.createLinkedPair();
    await server.connect(s);
    client = new Client({ name: 'live-smoke', version: '0.0.0' });
    await client.connect(c);
  });

  afterAll(async () => {
    await client.close();
  });

  it('lists the 3 catalog__ tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(['catalog__facets', 'catalog__get', 'catalog__search']);
  });

  it('runs catalog__facets against the live endpoint', async () => {
    const res = (await client.callTool({ name: 'catalog__facets', arguments: {} })) as {
      isError?: boolean;
      content: { type: string; text?: string }[];
    };
    expect(res.isError).not.toBe(true);
    expect(res.content.length).toBeGreaterThan(0);
  });
});
