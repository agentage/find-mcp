import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { bootstrap, flagOutput, HELP } from '../src/bin/bootstrap.js';
import { PACKAGE_VERSION } from '../src/version.js';
import { startMockUpstream, type MockUpstream } from './fixtures/mock-upstream.js';

describe('bin flag handling', () => {
  it('returns usage for --help / -h', () => {
    expect(flagOutput(['--help'])).toBe(HELP);
    expect(flagOutput(['-h'])).toBe(HELP);
    expect(HELP).toContain('npx -y @agentage/catalog-mcp');
    expect(HELP).toContain('CATALOG_MCP_URL');
  });

  it('returns the version for --version / -v', () => {
    expect(flagOutput(['--version'])).toBe(`${PACKAGE_VERSION}\n`);
    expect(flagOutput(['-v'])).toBe(`${PACKAGE_VERSION}\n`);
  });

  it('returns null (start the server) when no flag is given', () => {
    expect(flagOutput([])).toBeNull();
  });
});

describe('bin bootstrap stdout purity', () => {
  let mock: MockUpstream;
  let prevUrl: string | undefined;

  beforeEach(async () => {
    mock = await startMockUpstream();
    prevUrl = process.env.CATALOG_MCP_URL;
    process.env.CATALOG_MCP_URL = mock.url;
  });

  afterEach(async () => {
    if (prevUrl === undefined) delete process.env.CATALOG_MCP_URL;
    else process.env.CATALOG_MCP_URL = prevUrl;
    await mock.close();
  });

  it('writes the ready diagnostic to stderr, nothing to stdout', async () => {
    const outSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const errSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const [serverSide] = InMemoryTransport.createLinkedPair();
    try {
      const app = await bootstrap(serverSide);
      expect(outSpy).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[catalog-mcp] stdio ready'));
      await app.close();
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
