export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response('Server not configured: missing OPENROUTER_API_KEY', { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': body?.stream ? 'text/event-stream' : 'application/json',
      'HTTP-Referer': req.headers.get('origin') ?? '',
      'X-Title': 'LampsGPT',
    },
    body: JSON.stringify(body),
  });

  const contentType = upstream.headers.get('content-type') ?? (body?.stream ? 'text/event-stream' : 'application/json');
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': body?.stream ? 'text/event-stream; charset=utf-8' : contentType,
      'Cache-Control': body?.stream ? 'no-cache, no-transform' : 'no-cache',
      'Connection': body?.stream ? 'keep-alive' : 'close',
      'X-Accel-Buffering': body?.stream ? 'no' : 'yes',
    },
  });
}
