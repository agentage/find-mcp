// @agentage/find-mcp public API - a thin stdio MCP proxy to the agentage MCP directory.
export { UpstreamClient, DEFAULT_FIND_MCP_URL, type UpstreamOptions } from './upstream.js';
export { createFindProxyServer, SERVER_NAME, SERVER_TITLE } from './server/create-find-proxy.js';
export { forward } from './server/forward.js';
export { PACKAGE_VERSION } from './version.js';
