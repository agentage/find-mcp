import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { forward } from '../src/server/forward.js';
import type { UpstreamClient } from '../src/upstream.js';

const schema = z.object({}).loose();

// A stub UpstreamClient whose get() hands back scripted request behaviours in turn;
// reset() advances to the next one (used to drive the reconnect path).
const stubUpstream = (
  behaviours: Array<() => Promise<unknown>>
): { upstream: UpstreamClient; resets: () => number } => {
  let i = 0;
  let resets = 0;
  const upstream = {
    get: async () => ({ request: () => behaviours[i]() }),
    reset: () => {
      resets++;
      i++;
    },
  } as unknown as UpstreamClient;
  return { upstream, resets: () => resets };
};

const req = { method: 'tools/list' as const };

describe('forward error + reconnect mapping', () => {
  it('returns the upstream result verbatim', async () => {
    const { upstream } = stubUpstream([async () => ({ ok: true })]);
    await expect(forward(upstream, req, schema)).resolves.toEqual({ ok: true });
  });

  it('reconnects once on a dropped connection then succeeds', async () => {
    const { upstream, resets } = stubUpstream([
      async () => {
        throw new McpError(ErrorCode.ConnectionClosed, 'closed');
      },
      async () => ({ recovered: true }),
    ]);
    await expect(forward(upstream, req, schema)).resolves.toEqual({ recovered: true });
    expect(resets()).toBe(1);
  });

  it('gives up after a second disconnect, passing the McpError through', async () => {
    const { upstream } = stubUpstream([
      async () => {
        throw new McpError(ErrorCode.ConnectionClosed, 'closed');
      },
      async () => {
        throw new McpError(ErrorCode.ConnectionClosed, 'closed again');
      },
    ]);
    await expect(forward(upstream, req, schema)).rejects.toMatchObject({
      code: ErrorCode.ConnectionClosed,
    });
  });

  it('passes a non-disconnect upstream McpError through verbatim, no reconnect', async () => {
    const { upstream, resets } = stubUpstream([
      async () => {
        throw new McpError(-32011, 'bad request');
      },
    ]);
    await expect(forward(upstream, req, schema)).rejects.toMatchObject({
      code: -32011,
      message: expect.stringContaining('bad request'),
    });
    expect(resets()).toBe(0);
  });

  it('recovers the embedded JSON-RPC code from an HTTP error body', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'slow down' } });
    const { upstream } = stubUpstream([
      async () => {
        throw new StreamableHTTPError(429, `Error POSTing to endpoint: ${body}`);
      },
    ]);
    await expect(forward(upstream, req, schema)).rejects.toMatchObject({
      code: -32000,
      message: expect.stringContaining('slow down'),
    });
  });

  it('maps a bodyless HTTP error to InternalError with the status', async () => {
    const { upstream } = stubUpstream([
      async () => {
        throw new StreamableHTTPError(500, 'boom');
      },
    ]);
    await expect(forward(upstream, req, schema)).rejects.toMatchObject({
      code: ErrorCode.InternalError,
      message: expect.stringContaining('HTTP 500'),
    });
  });

  it('maps an unreachable transport error to InternalError', async () => {
    const { upstream } = stubUpstream([
      async () => {
        throw new Error('ECONNREFUSED');
      },
    ]);
    await expect(forward(upstream, req, schema)).rejects.toMatchObject({
      code: ErrorCode.InternalError,
      message: expect.stringContaining('unreachable'),
    });
  });
});
