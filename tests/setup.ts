import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
});
