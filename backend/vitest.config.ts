import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // TEST-1: no threshold existed at all before this — set just under the actual baseline
    // (81.57/72.94/79.95/82.30 measured via `npm run test:cov` at the time this was added) so it
    // gates real regression without being so tight that unrelated noise trips it. Raise these as
    // coverage genuinely improves; never lower them to make a failing build pass.
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 78,
        branches: 68,
        functions: 76,
        lines: 78,
      },
    },
  },
});
