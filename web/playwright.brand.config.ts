import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/brand', timeout: 30_000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3058', browserName: 'chromium', colorScheme: 'light', reducedMotion: 'reduce' },
  projects: [375, 768, 1440].map(width => ({name: `width-${width}`, use: {viewport: {width, height: 1000}}})),
  reporter: [['list'], ['html', {open:'never',outputFolder:'brand-report'}]],
  outputDir: 'brand-test-results',
  webServer: [
    {command:'node ../tools/property-search/preview-data.mjs',url:'http://127.0.0.1:4055/rest/v1/rpc/search_property_parcels?p_query=Oak&p_page=0&p_show_all=false',timeout:30_000,reuseExistingServer:false},
    {command:'npm run start -- --port 3058 --hostname 127.0.0.1',url:'http://127.0.0.1:3058',timeout:30_000,reuseExistingServer:false,env:{SUPABASE_URL:'http://127.0.0.1:4055',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}},
  ],
});
