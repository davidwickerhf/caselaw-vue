import {
  createError,
  defineEventHandler,
  getMethod,
  getQuery,
  getRequestHeaders,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3';
import { joinURL, withQuery } from 'ufo';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const backendUrl = String(config.apiBackendUrl || '').replace(/\/$/, '');
  const token = String(config.apiBearerToken || '').trim();

  if (!backendUrl) {
    throw createError({ statusCode: 500, statusMessage: 'API backend URL is not configured' });
  }

  const path = event.context.params?.path || '';
  const targetUrl = withQuery(joinURL(backendUrl, 'api', path), getQuery(event));
  const method = getMethod(event);
  const startedAt = Date.now();
  const requestHeaders = getRequestHeaders(event);
  const headers = new Headers();

  for (const [name, value] of Object.entries(requestHeaders)) {
    if (value && !HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  }

  if (token) {
    headers.set('Authorization', token.toLowerCase().startsWith('bearer ') ? token : `Bearer ${token}`);
  }

  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await readRawBody(event, false);

  if (import.meta.dev) {
    console.info(`[api-proxy] ${method} /api/${path} -> ${targetUrl} auth=${token ? 'yes' : 'no'}`);
  }

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: 'manual',
  }).catch((error) => {
    console.error(`[api-proxy] ${method} ${targetUrl} failed after ${Date.now() - startedAt}ms`, error);
    throw createError({
      statusCode: 502,
      statusMessage: 'API proxy failed',
      message: `Failed to reach citation API at ${targetUrl}: ${error instanceof Error ? error.message : String(error)}`,
    });
  });

  if (import.meta.dev) {
    console.info(`[api-proxy] ${method} ${targetUrl} <- ${response.status} ${response.statusText} (${Date.now() - startedAt}ms)`);
  }

  setResponseStatus(event, response.status, response.statusText);
  response.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) {
      setResponseHeader(event, name, value);
    }
  });

  return response.body;
});
