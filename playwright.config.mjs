import { defineConfig, devices } from '@playwright/test';

// Las pruebas E2E mockean Supabase interceptando **/rest/v1/** y **/auth/**
// vía page.route — NO tocan staging. Levantan el sitio con http-server.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'npx http-server . -p 5173 -c-1',
    url: 'http://localhost:5173/Pagina%20Torneo.html',
    reuseExistingServer: true,
    timeout: 20000
  }
});
