/**
 * Workflow routing helpers.
 *
 * In-app navigation passes objects via navigate() params (not the URL).
 * Share links use path-only URLs (/calculator-inputs/:id?calculatorType=v44);
 * customer details and radios load from saved progress on the server.
 */

import { Platform } from 'react-native';

export type TemplateSelectedOptions = {
  solar?: boolean;
  battery?: boolean;
  solarHybrid?: boolean;
  batteryInverter?: boolean;
};

export type RouteCustomerDetails = {
  customerName: string;
  address: string;
  postcode: string;
};

const INVALID_OBJECT_STRING = '[object Object]';

export function isInvalidObjectString(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value === INVALID_OBJECT_STRING || value === 'object Object')
  );
}

/** Decode query values that were URL-encoded more than once (legacy share links). */
function fullyDecodeURIComponent(value: string): string {
  let current = value.trim();
  for (let i = 0; i < 5; i++) {
    if (!current.includes('%')) {
      break;
    }
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) {
        break;
      }
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

/** Parse JSON that may be wrapped in quotes and/or multiply URL-encoded. */
function parseJsonStringDeep<T>(raw: string): T | undefined {
  let current: unknown = fullyDecodeURIComponent(raw);

  for (let i = 0; i < 3; i++) {
    if (typeof current === 'object' && current !== null) {
      return current as T;
    }
    if (typeof current !== 'string') {
      return undefined;
    }
    const s = current.trim();
    if (!s || isInvalidObjectString(s)) {
      return undefined;
    }
    try {
      current = JSON.parse(s);
    } catch {
      return i === 0 ? undefined : (current as T);
    }
  }

  return typeof current === 'object' && current !== null ? (current as T) : undefined;
}

export function parseJsonParam<T = unknown>(value: unknown): T | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    // Reject plain objects that came from String(obj) → "[object Object]" character map
    if (isStringifiedObjectObject(value)) {
      return undefined;
    }
    return value as T;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  return parseJsonStringDeep<T>(value);
}

/** Detect {0:'[',1:'o',...} shape from broken URL object params */
function isStringifiedObjectObject(value: object): boolean {
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length < 10) {
    return false;
  }
  const numericKeys = entries.filter(([k]) => /^\d+$/.test(k));
  if (numericKeys.length < 10) {
    return false;
  }
  const chars = numericKeys
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, v]) => v)
    .join('');
  return chars === INVALID_OBJECT_STRING;
}

export function stringifyJsonParam(value: unknown): string {
  // React Navigation / URLSearchParams encode once — do not pre-encodeURIComponent.
  return JSON.stringify(value);
}

export function normalizeParamValue(value: unknown): unknown {
  if (value == null || value === '') {
    return undefined;
  }
  if (isInvalidObjectString(value)) {
    return undefined;
  }
  if (typeof value === 'object') {
    if (isStringifiedObjectObject(value)) {
      return undefined;
    }
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isInvalidObjectString(trimmed)) {
      return undefined;
    }
    if (
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed.startsWith('%7B') ||
      trimmed.startsWith('%5B')
    ) {
      const parsed = parseJsonParam(trimmed);
      if (parsed !== undefined) {
        return parsed;
      }
    }
    return decodeRouteString(trimmed) ?? trimmed;
  }
  return value;
}

/** Normalize all route params (fixes [object Object] and JSON query strings). */
export function normalizeRouteParams(
  params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!params) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeParamValue(value);
    if (normalized !== undefined) {
      out[key] = normalized;
    }
  }
  return out;
}

/** Read opportunityId from route params or web URL path (e.g. /hometree/:id). */
export function resolveOpportunityIdFromRoute(
  routeParams: unknown,
  pathSegment: string,
): string | undefined {
  const params = normalizeRouteParams(routeParams as Record<string, unknown>);
  const fromParams = params.opportunityId;
  if (typeof fromParams === 'string' && fromParams.trim()) {
    return fromParams.trim();
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const escaped = pathSegment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = window.location.pathname.match(
      new RegExp(`/${escaped}/([^/?#]+)`),
    );
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return undefined;
}

/** Drop legacy JSON query params from the address bar after they are read once. */
export function cleanLegacyWorkflowUrl(calculatorType?: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  const search = window.location.search;
  if (
    !search.includes('customerDetails') &&
    !search.includes('pendingRadios') &&
    !search.includes('selectedOptions')
  ) {
    return;
  }
  const params = new URLSearchParams();
  if (calculatorType) {
    params.set('calculatorType', calculatorType);
  }
  const next = params.toString();
  const url = next
    ? `${window.location.pathname}?${next}`
    : window.location.pathname;
  window.history.replaceState({}, '', url);
}

/** One-time read of legacy query params (old GHL share links). Not synced to the URL bar. */
export function readInitialUrlQueryParams(): Record<string, unknown> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(window.location.search)) {
    const normalized = normalizeParamValue(value);
    if (normalized !== undefined) {
      out[key] = normalized;
    }
  }
  return out;
}

/** In-app route params win over legacy URL query params. */
export function mergeWorkflowRouteParams(
  routeParams: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return {
    ...readInitialUrlQueryParams(),
    ...normalizeRouteParams(routeParams),
  };
}

export function parseSelectedOptions(value: unknown): TemplateSelectedOptions | undefined {
  return parseJsonParam<TemplateSelectedOptions>(value);
}

export function parseRadioButtonSelections(value: unknown): Record<string, string> | undefined {
  const parsed = parseJsonParam<Record<string, string>>(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed;
}

export function parseRouteCustomerDetails(value: unknown): RouteCustomerDetails | undefined {
  const parsed = parseJsonParam<RouteCustomerDetails>(value);
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }
  if (
    typeof parsed.customerName !== 'string' &&
    typeof parsed.address !== 'string' &&
    typeof parsed.postcode !== 'string'
  ) {
    return undefined;
  }
  return {
    customerName: String(parsed.customerName ?? ''),
    address: String(parsed.address ?? ''),
    postcode: String(parsed.postcode ?? ''),
  };
}

/** Read customer fields from flat query params or nested customerDetails JSON. */
export function getCustomerDetailsFromRouteParams(params: Record<string, unknown> | undefined): RouteCustomerDetails | undefined {
  if (!params) {
    return undefined;
  }

  const normalized = normalizeRouteParams(params);
  const nested = parseRouteCustomerDetails(normalized.customerDetails);
  if (nested) {
    return nested;
  }

  const customerName = normalized.customerName;
  const address = normalized.address;
  const postcode = normalized.postcode;

  if (
    typeof customerName !== 'string' &&
    typeof address !== 'string' &&
    typeof postcode !== 'string'
  ) {
    return undefined;
  }

  return {
    customerName: typeof customerName === 'string' ? customerName : '',
    address: typeof address === 'string' ? address : '',
    postcode: typeof postcode === 'string' ? postcode : '',
  };
}

export function decodeRouteString(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Build a shareable customer-details URL with JSON-safe query params. */
export function buildCustomerDetailsShareUrl(
  baseOrigin: string,
  opportunityId: string,
  params: {
    calculatorType?: string;
    templateFileName?: string;
    selectedOptions?: TemplateSelectedOptions;
    customerName?: string;
    address?: string;
    postcode?: string;
    customerDetails?: RouteCustomerDetails;
  },
): string {
  const url = new URL(`${baseOrigin.replace(/\/$/, '')}/customer-details/${encodeURIComponent(opportunityId)}`);

  if (params.calculatorType) {
    url.searchParams.set('calculatorType', params.calculatorType);
  }
  if (params.templateFileName) {
    url.searchParams.set('templateFileName', params.templateFileName);
  }
  if (params.selectedOptions) {
    url.searchParams.set('selectedOptions', JSON.stringify(params.selectedOptions));
  }

  const details = params.customerDetails ?? (
    params.customerName || params.address || params.postcode
      ? {
          customerName: params.customerName ?? '',
          address: params.address ?? '',
          postcode: params.postcode ?? '',
        }
      : undefined
  );

  if (details) {
    url.searchParams.set('customerDetails', JSON.stringify(details));
  }

  return url.toString();
}

/** Build a shareable workflow URL with correctly encoded query params. */
export function buildWorkflowShareUrl(
  baseOrigin: string,
  pathSegment: string,
  opportunityId: string,
  params: Record<string, unknown> = {},
): string {
  const url = new URL(
    `${baseOrigin.replace(/\/$/, '')}/${pathSegment.replace(/^\//, '')}/${encodeURIComponent(opportunityId)}`,
  );

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') {
      continue;
    }
    if (typeof value === 'object') {
      url.searchParams.set(key, JSON.stringify(value));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

/** v4.4 Calculator Questions — Self-Consumption + Single Rate (replaces old radio buttons). */
export function buildV44SingleSelfConsumptionQuestionsUrl(
  baseOrigin: string,
  opportunityId: string,
  customerDetails: RouteCustomerDetails,
): string {
  return buildWorkflowShareUrl(baseOrigin, 'calculator-questions', opportunityId, {
    calculatorType: 'v44',
    customerDetails,
    pendingRadios: {
      battery_savings: 1,
      current_tariff: 1,
    },
  });
}

/** v4.4 Calculator Inputs — Self-Consumption + Single Rate (skip questions page). */
export function buildV44SingleSelfConsumptionInputsUrl(
  baseOrigin: string,
  opportunityId: string,
  customerDetails: RouteCustomerDetails,
): string {
  return buildWorkflowShareUrl(baseOrigin, 'calculator-inputs', opportunityId, {
    calculatorType: 'v44',
    customerDetails,
    pendingRadios: {
      battery_savings: 1,
      current_tariff: 1,
      usage_known: 1,
      existing_solar: 2,
      installing_new_solar: 1,
      inverter_new: 1,
    },
  });
}

/**
 * Path-only deep links — only opportunityId (path) and calculatorType (query).
 * Objects (customerDetails, pendingRadios, etc.) stay in navigation state / progress API.
 */
export const workflowLinkingParse = {
  opportunityId: (id: string) => id,
  calculatorType: (v: string) => v,
};

export const workflowLinkingStringify = {
  calculatorType: (v: string) => v,
};

export function workflowScreenLinking(path: string) {
  return {
    path,
    parse: workflowLinkingParse,
    stringify: workflowLinkingStringify,
  };
}
