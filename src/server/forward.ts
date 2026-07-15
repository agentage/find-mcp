import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AnySchema, SchemaOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { UpstreamClient } from '../upstream.js';

interface ForwardRequest {
  method: string;
  params?: Record<string, unknown>;
}

const isDisconnect = (err: unknown): boolean =>
  err instanceof McpError && err.code === ErrorCode.ConnectionClosed;

// Recover an embedded JSON-RPC error ({ code, message }) from an HTTP-error body,
// so the upstream rate-limit envelope (HTTP 429 + code -32000) passes through.
const embeddedRpcError = (message: string): McpError | null => {
  const start = message.indexOf('{');
  if (start === -1) return null;
  try {
    const body = JSON.parse(message.slice(start)) as {
      error?: { code?: number; message?: string };
    };
    const code = body.error?.code;
    if (typeof code !== 'number') return null;
    return new McpError(code, body.error?.message ?? 'upstream error');
  } catch {
    return null;
  }
};

// Upstream JSON-RPC errors pass through verbatim; an HTTP error surfaces its
// embedded JSON-RPC code (e.g. -32000 rate limit) or a clear InternalError.
// Transport/unreachable errors become an InternalError - never a crash.
const toRpcError = (err: unknown): McpError => {
  if (err instanceof McpError) return err;
  if (err instanceof StreamableHTTPError) {
    return (
      embeddedRpcError(err.message) ??
      new McpError(
        ErrorCode.InternalError,
        `catalog upstream error (HTTP ${err.code}): ${err.message}`
      )
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return new McpError(ErrorCode.InternalError, `catalog upstream unreachable: ${message}`);
};

// Forward one request to the upstream client and return the response verbatim.
// A dropped connection reconnects once before giving up.
export const forward = async <T extends AnySchema>(
  upstream: UpstreamClient,
  request: ForwardRequest,
  resultSchema: T
): Promise<SchemaOutput<T>> => {
  const client = await upstream.get();
  try {
    return await client.request(request, resultSchema);
  } catch (err) {
    if (!isDisconnect(err)) throw toRpcError(err);
    upstream.reset(client);
    try {
      return await (await upstream.get()).request(request, resultSchema);
    } catch (retryErr) {
      throw toRpcError(retryErr);
    }
  }
};
