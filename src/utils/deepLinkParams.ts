/**
 * Helpers for React Navigation web deep links.
 * Query params must be strings — objects need JSON encode/decode (not default toString).
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

  const trimmed = value.trim();
  if (!trimmed || isInvalidObjectString(trimmed)) {
    return undefined;
  }

  try {
    return JSON.parse(decodeURIComponent(trimmed)) as T;
  } catch {
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return undefined;
    }
  }
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
  return encodeURIComponent(JSON.stringify(value));
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

function stringifyParamsForUrl(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      continue;
    }
    if (typeof value === 'object') {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

type NavigationStateLike = {
  routes?: Array<{
    params?: Record<string, unknown>;
    state?: NavigationStateLike;
  }>;
};

/** Before building a URL — stringify object params so they are not [object Object]. */
export function patchNavigationStateForUrl<T extends NavigationStateLike>(state: T): T {
  if (!state?.routes?.length) {
    return state;
  }
  return {
    ...state,
    routes: state.routes.map((route) => {
      const next = { ...route };
      if (next.params && typeof next.params === 'object') {
        next.params = stringifyParamsForUrl(next.params);
      }
      if (next.state) {
        next.state = patchNavigationStateForUrl(next.state);
      }
      return next;
    }),
  } as T;
}

/** After parsing a URL — decode JSON query params and drop broken [object Object]. */
export function patchNavigationStateFromUrl<T extends NavigationStateLike>(state: T | undefined): T | undefined {
  if (!state?.routes?.length) {
    return state;
  }
  return {
    ...state,
    routes: state.routes.map((route) => {
      const next = { ...route };
      if (next.params && typeof next.params === 'object') {
        next.params = normalizeRouteParams(next.params);
      }
      if (next.state) {
        next.state = patchNavigationStateFromUrl(next.state);
      }
      return next;
    }),
  } as T;
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

/** Shared linking.parse / linking.stringify entries for JSON object params. */
export const linkingJsonObjectParam = {
  parse: (value: string) => parseJsonParam(value),
  stringify: (value: unknown) => stringifyJsonParam(value),
};

export const linkingCustomerDetailsParam = {
  parse: (value: string) => parseRouteCustomerDetails(value),
  stringify: (value: unknown) => stringifyJsonParam(value),
};

export const linkingPlainStringParam = {
  parse: (value: string) => decodeRouteString(value) ?? value,
  stringify: (value: string) => encodeURIComponent(value),
};

/** Common workflow screen params — use in per-screen linking config. */
export const workflowLinkingParse = {
  opportunityId: (id: string) => id,
  calculatorType: (v: string) => v,
  templateFileName: linkingPlainStringParam.parse,
  selectedOptions: linkingJsonObjectParam.parse,
  selectedTemplateOptions: linkingJsonObjectParam.parse,
  customerDetails: linkingCustomerDetailsParam.parse,
  customerName: linkingPlainStringParam.parse,
  address: linkingPlainStringParam.parse,
  postcode: linkingPlainStringParam.parse,
  opportunity: linkingJsonObjectParam.parse,
  radioButtonSelections: linkingJsonObjectParam.parse,
  pendingRadios: linkingJsonObjectParam.parse,
};

export const workflowLinkingStringify = {
  templateFileName: linkingPlainStringParam.stringify,
  selectedOptions: linkingJsonObjectParam.stringify,
  selectedTemplateOptions: linkingJsonObjectParam.stringify,
  customerDetails: linkingCustomerDetailsParam.stringify,
  customerName: linkingPlainStringParam.stringify,
  address: linkingPlainStringParam.stringify,
  postcode: linkingPlainStringParam.stringify,
  opportunity: linkingJsonObjectParam.stringify,
  radioButtonSelections: linkingJsonObjectParam.stringify,
  pendingRadios: linkingJsonObjectParam.stringify,
};

export function workflowScreenLinking(path: string) {
  return {
    path,
    parse: workflowLinkingParse,
    stringify: workflowLinkingStringify,
  };
}
