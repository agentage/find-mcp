import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULT_FIND_MCP_URL, UpstreamClient } from '../src/upstream.js';
import { startMockUpstream, type MockUpstream } from './fixtures/mock-upstream.js';

const listReq = { method: 'tools/list' as const };
const resultSchema = z.object({}).loose();

describe('UpstreamClient lifecycle + reconnect guards', () => {
  let mock: MockUpstream;

  beforeEach(async () => {
    mock = await startMockUpstream();
  });

  afterEach(async () => {
    await mock.close();
  });

  it('reconnects after a dropped connection so the next call succeeds', async () => {
    const upstream = new UpstreamClient({ url: mock.url });
    const first = await upstream.get();
    await first.request(listReq, resultSchema);
    expect(mock.connectCount()).toBe(1);

    // Simulate an upstream drop: the live client goes away.
    await first.close();

    const second = await upstream.get();
    await expect(second.request(listReq, resultSchema)).resolves.toBeTruthy();
    expect(second).not.toBe(first);
    expect(mock.connectCount()).toBe(2);
  });

  it('coalesces two calls racing the same drop into one reconnect', async () => {
    const upstream = new UpstreamClient({ url: mock.url });
    const live = await upstream.get();
    expect(mock.connectCount()).toBe(1);

    // Two concurrent forwards both catch the same dead client and reset it; the
    // identity guard means only the first reset takes effect (no double-connect).
    upstream.reset(live);
    upstream.reset(live);

    const [a, b] = await Promise.all([upstream.get(), upstream.get()]);
    expect(a).toBe(b);
    expect(a).not.toBe(live);
    expect(mock.connectCount()).toBe(2);
  });

  it('rejects rather than hangs when the upstream never responds', async () => {
    const upstream = new UpstreamClient({ url: mock.url });
    const client = await upstream.get();
    mock.hangNextCall();
    await expect(
      client.request(
        { method: 'tools/call', params: { name: 'mcp_categories', arguments: {} } },
        resultSchema,
        { timeout: 200 }
      )
    ).rejects.toMatchObject({ code: ErrorCode.RequestTimeout });
  });

  it('close() clears state and reconnects on the next get()', async () => {
    const upstream = new UpstreamClient({ url: mock.url });
    const first = await upstream.get();
    await upstream.close();

    const second = await upstream.get();
    expect(second).not.toBe(first);
    expect(mock.connectCount()).toBe(2);
  });

  it('close() on a never-connected client does not throw', async () => {
    const upstream = new UpstreamClient({ url: mock.url });
    await expect(upstream.close()).resolves.toBeUndefined();
    expect(mock.connectCount()).toBe(0);
  });
});

describe('UpstreamClient endpoint resolution', () => {
  const envKeys = ['FIND_MCP_URL', 'CATALOG_MCP_URL'] as const;
  const saved: Partial<Record<(typeof envKeys)[number], string>> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('defaults to DEFAULT_FIND_MCP_URL when nothing is set', () => {
    expect(new UpstreamClient().target).toBe(DEFAULT_FIND_MCP_URL);
  });

  it('falls back to the deprecated CATALOG_MCP_URL when FIND_MCP_URL is unset', () => {
    process.env.CATALOG_MCP_URL = 'http://127.0.0.1:9/legacy';
    expect(new UpstreamClient().target).toBe('http://127.0.0.1:9/legacy');
  });

  it('prefers FIND_MCP_URL over the deprecated CATALOG_MCP_URL', () => {
    process.env.FIND_MCP_URL = 'http://127.0.0.1:9/primary';
    process.env.CATALOG_MCP_URL = 'http://127.0.0.1:9/legacy';
    expect(new UpstreamClient().target).toBe('http://127.0.0.1:9/primary');
  });

  it('prefers the explicit url option over either env var', () => {
    process.env.FIND_MCP_URL = 'http://127.0.0.1:9/primary';
    expect(new UpstreamClient({ url: 'http://127.0.0.1:9/explicit' }).target).toBe(
      'http://127.0.0.1:9/explicit'
    );
  });
});
