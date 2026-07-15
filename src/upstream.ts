import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PACKAGE_VERSION } from './version.js';

export const DEFAULT_CATALOG_MCP_URL = 'https://catalog.agentage.io/mcp';

export interface UpstreamOptions {
  url?: string;
}

// Resolve the upstream endpoint: explicit option -> CATALOG_MCP_URL env -> default.
const resolveUrl = (opts: UpstreamOptions): URL =>
  new URL(opts.url ?? process.env.CATALOG_MCP_URL ?? DEFAULT_CATALOG_MCP_URL);

// A lazily-connected SDK Client to the remote catalog over Streamable HTTP. One
// in-flight connect is shared across concurrent calls; a dropped connection is
// reconnected on the next get(). All slot mutations are identity-guarded so a
// concurrent reset()+reconnect never double-connects or orphans a socket.
export class UpstreamClient {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;
  private readonly url: URL;

  constructor(opts: UpstreamOptions = {}) {
    this.url = resolveUrl(opts);
  }

  get target(): string {
    return this.url.href;
  }

  async get(): Promise<Client> {
    if (this.client) return this.client;
    if (!this.connecting) {
      const pending: Promise<Client> = this.connect().finally(() => {
        // Only clear the slot this exact attempt still owns.
        if (this.connecting === pending) this.connecting = null;
      });
      this.connecting = pending;
    }
    return this.connecting;
  }

  // Drop a client known to be dead so the next get() reconnects. Identity-guarded:
  // a concurrent caller that already installed a newer client is left untouched.
  reset(client: Client): void {
    if (this.client === client) this.client = null;
  }

  // Tear down the live client (if any); tolerant of a never-connected instance.
  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.connecting = null;
    if (!client) return;
    try {
      await client.close();
    } catch {
      // best-effort teardown - never throw on shutdown.
    }
  }

  private async connect(): Promise<Client> {
    const client = new Client(
      { name: 'agentage-catalog-mcp', version: PACKAGE_VERSION },
      { capabilities: {} }
    );
    client.onclose = () => {
      // Forget this client only if a newer one has not replaced it.
      if (this.client === client) this.client = null;
    };
    await client.connect(new StreamableHTTPClientTransport(this.url));
    this.client = client;
    return client;
  }
}
