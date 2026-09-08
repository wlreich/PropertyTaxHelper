// Allow a slow successful API response while keeping every request bounded.
// Next.js routes using this budget allow 30 seconds for rendering and cleanup.
export const DATABASE_REQUEST_TIMEOUT_MS = 15_000;
