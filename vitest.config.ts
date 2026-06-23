import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Plain Vitest config (formerly @saas-maker/test-config/vitest factory).
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'components/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist/**', 'e2e/**', '.wrangler'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts', 'node_modules', 'dist', '.next', '.wrangler'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
