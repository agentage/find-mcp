import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ServerJson {
  $schema: string;
  name: string;
  version: string;
  websiteUrl: string;
  packages: Array<{ registryType: string; identifier: string; version: string }>;
  remotes: Array<{ type: string; url: string }>;
}

interface PackageJson {
  name: string;
  version: string;
  mcpName: string;
}

const serverJson = JSON.parse(
  readFileSync(new URL('../server.json', import.meta.url), 'utf8')
) as ServerJson;
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as PackageJson;

describe('server.json (official MCP registry manifest)', () => {
  it('validates against the pinned registry schema', () => {
    expect(serverJson.$schema).toBe(
      'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json'
    );
  });

  it('names the server after the npm mcpName', () => {
    expect(serverJson.name).toBe('io.agentage/find-mcp');
    expect(pkg.mcpName).toBe(serverJson.name);
  });

  it('has a semver version', () => {
    expect(serverJson.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('advertises this npm package at the package.json version', () => {
    const npm = serverJson.packages.find((p) => p.registryType === 'npm');
    expect(npm?.identifier).toBe(pkg.name);
    expect(npm?.version).toBe(pkg.version);
  });

  it('keeps a streamable-http remote ending in /mcp', () => {
    const remote = serverJson.remotes.find((r) => r.type === 'streamable-http');
    expect(remote?.url).toMatch(/\/mcp$/);
  });
});
