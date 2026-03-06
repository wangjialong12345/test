const UPSTREAM_ORIGIN = 'https://www.88code.ai';
const FUNCTION_ROUTE_PREFIX = '/.netlify/functions/88code-proxy/';

function getUpstreamPath(event) {
  const rawPath = event.path || '';
  if (rawPath.startsWith(FUNCTION_ROUTE_PREFIX)) {
    return `/${rawPath.slice(FUNCTION_ROUTE_PREFIX.length)}`;
  }

  // Fallback for unexpected route shapes.
  const marker = '/88code-proxy/';
  const idx = rawPath.indexOf(marker);
  if (idx >= 0) {
    return `/${rawPath.slice(idx + marker.length)}`;
  }
  return '/';
}

function pickRequestHeaders(event, hasAuthToken) {
  const source = event.headers || {};
  const headers = {
    accept: source.accept || '*/*',
  };

  if (source['content-type']) {
    headers['content-type'] = source['content-type'];
  }

  const authFromClient = source.authorization || source.Authorization;
  if (authFromClient) {
    headers.authorization = authFromClient;
  } else if (hasAuthToken) {
    headers.authorization = `Bearer ${hasAuthToken}`;
  }

  return headers;
}

exports.handler = async (event) => {
  try {
    const method = event.httpMethod || 'GET';

    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          allow: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    const authToken = process.env.EIGHTY_EIGHT_CODE_TOKEN || '';
    const upstreamPath = getUpstreamPath(event);
    const rawQuery = event.rawQuery
      || new URLSearchParams(event.queryStringParameters || {}).toString();
    const query = rawQuery ? `?${rawQuery}` : '';
    const upstreamUrl = `${UPSTREAM_ORIGIN}${upstreamPath}${query}`;

    const requestInit = {
      method,
      headers: pickRequestHeaders(event, authToken),
      redirect: 'manual',
    };

    if (method !== 'GET' && method !== 'HEAD') {
      requestInit.body = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64')
        : (event.body || '');
    }

    const upstreamResp = await fetch(upstreamUrl, requestInit);
    const textBody = await upstreamResp.text();

    const respHeaders = {
      'content-type': upstreamResp.headers.get('content-type') || 'application/json; charset=utf-8',
    };

    const cacheControl = upstreamResp.headers.get('cache-control');
    if (cacheControl) {
      respHeaders['cache-control'] = cacheControl;
    }

    return {
      statusCode: upstreamResp.status,
      headers: respHeaders,
      body: textBody,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        code: -1,
        ok: false,
        msg: error instanceof Error ? error.message : 'proxy request failed',
      }),
    };
  }
};
