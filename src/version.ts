import { createRequire } from 'node:module';

// Read the package version at runtime; a static import of package.json would break
// tsc's rootDir:src. `../` climbs to the package root from both src (tests) and dist.
const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export const PACKAGE_VERSION = pkg.version;
