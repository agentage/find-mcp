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
// reconnected on the next get().
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
      this.connecting = this.connect().finally(() => {
        this.connecting = null;
      });
    }
    return this.connecting;
  }

  reset(): void {
    this.client = null;
    this.connecting = null;
  }

  private async connect(): Promise<Client> {
    const client = new Client(
      { name: 'agentage-catalog-mcp', version: PACKAGE_VERSION },
      { capabilities: {} }
    );
    client.onclose = () => {
      this.client = null;
    };
    await client.connect(new StreamableHTTPClientTransport(this.url));
    this.client = client;
    return client;
  }
}
