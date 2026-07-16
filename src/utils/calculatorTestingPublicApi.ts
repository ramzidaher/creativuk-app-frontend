/**
 * Unauthenticated API client for local calculator testing.
 * Talks to scripts/calculator-testing-ui-server.ts on port 3099.
 */

const DEFAULT_PORT = '3099';

function getBaseUrl(): string {
  const fromEnv =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CALCULATOR_TESTING_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).replace(/\/$/, '');
  }

  // Match the host the browser used for the frontend (localhost, 127.0.0.1, LAN IP, etc.)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${DEFAULT_PORT}`;
  }

  return `http://localhost:${DEFAULT_PORT}`;
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const base = getBaseUrl();
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {};
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data: T | undefined;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        return { success: false, error: `Invalid JSON from ${url}` };
      }
    }

    if (!response.ok) {
      const err =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error?: string }).error)
          : text || `HTTP ${response.status}`;
      return { success: false, error: err };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return {
      success: false,
      error: `${message} (tried ${getBaseUrl()}). Start the server: npm run calculator-testing:ui-server in creativuk-app-backend`,
    };
  }
}

export const calculatorTestingPublicApi = {
  getBaseUrl,
  health: () => request<{ ok: boolean }>('GET', '/health'),
  getSchema: <T>() => request<T>('GET', '/calculator-testing/schema'),
  getEquipment: <T>() => request<T>('GET', '/calculator-testing/equipment'),
  preview: <T>(body: unknown) => request<T>('POST', '/calculator-testing/preview', body),
  save: <T>(body: unknown) => request<T>('POST', '/calculator-testing/save', body),
  printContract: <T>(body: unknown) =>
    request<T>('POST', '/calculator-testing/print-contract', body),
  recalculate: <T>(body: unknown) =>
    request<T>('POST', '/calculator-testing/recalculate', body),
  downloadUrl: (fileName: string) =>
    `${getBaseUrl()}/calculator-testing/download/${encodeURIComponent(fileName)}`,
};
