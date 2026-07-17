import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { UpstreamClient, DEFAULT_FIND_MCP_URL } from '../src/upstream.js';
import { createFindProxyServer } from '../src/server/create-find-proxy.js';

// Live network smoke against the real directory. Gated behind LIVE_SMOKE=1 so CI and
// the default `npm test` stay hermetic and offline.
const run = process.env.LIVE_SMOKE === '1' ? describe : describe.skip;

// TODO(server rename): the upstream tool rename (catalog__* -> mcp_search/mcp_get/
// mcp_categories) is landing in a parallel PR. Until it deploys to
// catalog.agentage.io/mcp, this suite accepts either name set. Tighten to the new
// names only once the server PR is live.
const OLD_NAMES = ['catalog__facets', 'catalog__get', 'catalog__search'];
const NEW_NAMES = ['mcp_categories', 'mcp_get', 'mcp_search'];
const categoriesToolName = (names: string[]): string =>
  names.includes('mcp_categories') ? 'mcp_categories' : 'catalog__facets';

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

  it('lists the 3 tools, under either the old or new names', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect([OLD_NAMES, NEW_NAMES]).toContainEqual(names);
  });

  it('runs the categories/facets tool against the live endpoint', async () => {
    const { tools } = await client.listTools();
    const toolName = categoriesToolName(tools.map((t) => t.name));
    const res = (await client.callTool({ name: toolName, arguments: {} })) as {
      isError?: boolean;
      content: { type: string; text?: string }[];
    };
    expect(res.isError).not.toBe(true);
    expect(res.content.length).toBeGreaterThan(0);
  });
});
