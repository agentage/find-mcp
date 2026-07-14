// @agentage/catalog-mcp public API - a thin stdio MCP proxy to the agentage catalog.
export { UpstreamClient, DEFAULT_CATALOG_MCP_URL, type UpstreamOptions } from './upstream.js';
export {
  createCatalogProxyServer,
  SERVER_NAME,
  SERVER_TITLE,
} from './server/create-catalog-proxy.js';
export { forward } from './server/forward.js';
export { PACKAGE_VERSION } from './version.js';
