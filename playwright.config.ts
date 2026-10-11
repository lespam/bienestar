import { defineConfig } from '@playwright/test';

// Revisión automática antes de publicar: pantallas a 412, 384 y 360 px (plan, puntos 1 y 2c).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block', locale: 'es-MX', acceptDownloads: true },
  webServer: { command: 'npm run build && npm run preview', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  projects: [
    { name: '412', use: { viewport: { width: 412, height: 915 } } },
    { name: '384', use: { viewport: { width: 384, height: 854 } } },
    { name: '360', use: { viewport: { width: 360, height: 800 } } }
  ]
});
