import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: { compilerOptions: { target: 'es2022', useDefineForClassFields: true } },
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // bin = the stdio process entrypoint (needs a spawned child); index = a pure
      // re-export barrel. Both are exercised end-to-end, not by unit tests.
      exclude: ['src/bin/**', 'src/index.ts'],
      thresholds: { branches: 70, functions: 70, lines: 70, statements: 70 },
    },
  },
});
