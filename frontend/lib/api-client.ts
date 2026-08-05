export type NextFetchRequestConfig = {
  revalidate?: number | false;
  tags?: string[];
};

export type ApiRequestOptions<TBody = unknown> = {
  method?: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: HeadersInit;
  body?: TBody;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
};

export type ApiErrorData = {
  message?: string;
};

export class ApiError<T = ApiErrorData> extends Error {
  status: number;
  data?: T;

  constructor(message: string, status: number, data?: T) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const buildUrl = (path: string, query?: ApiRequestOptions['query']) => {
  const base = isAbsoluteUrl(path) ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const url = new URL(base);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
};

const isFormData = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData;

const isBodyInit = (body: unknown): body is BodyInit =>
  typeof body === 'string' ||
  (typeof Blob !== 'undefined' && body instanceof Blob) ||
  (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer);

export const apiClient = {
  async request<TResponse = unknown, TBody = unknown>(
    path: string,
    options: ApiRequestOptions<TBody> = {},
  ) {
    const {
      method = 'GET',
      query,
      headers,
      body,
      credentials = 'include',
      signal,
      cache,
      next,
    } = options;
    const url = buildUrl(path, query);

    const requestHeaders = new Headers(headers);
    requestHeaders.set('Accept', 'application/json');

    let requestBody: BodyInit | undefined;
    if (body !== undefined && body !== null) {
      if (isFormData(body) || isBodyInit(body)) {
        requestBody = body;
      } else {
        requestHeaders.set('Content-Type', 'application/json');
        requestBody = JSON.stringify(body);
      }
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      credentials,
      signal,
      cache,
      next,
    });

    if (response.status === 204) {
      return null as TResponse;
    }

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    const data = isJson
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const message =
        (typeof data === 'object' && data && 'message' in data && (data as ApiErrorData).message) ||
        response.statusText ||
        'Request failed';
      throw new ApiError(message, response.status, data as ApiErrorData);
    }

    return data as TResponse;
  },
  get<TResponse = unknown>(path: string, options?: ApiRequestOptions) {
    return this.request<TResponse>(path, { ...options, method: 'GET' });
  },
  post<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiRequestOptions,
  ) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'POST', body });
  },
  put<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiRequestOptions,
  ) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'PUT', body });
  },
  patch<TResponse = unknown, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: ApiRequestOptions,
  ) {
    return this.request<TResponse, TBody>(path, { ...options, method: 'PATCH', body });
  },
  delete<TResponse = unknown>(path: string, options?: ApiRequestOptions) {
    return this.request<TResponse>(path, { ...options, method: 'DELETE' });
  },
};

export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};
