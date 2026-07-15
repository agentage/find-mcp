import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { UpstreamClient } from '../src/upstream.js';
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
        { method: 'tools/call', params: { name: 'catalog__facets', arguments: {} } },
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
