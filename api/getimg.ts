export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.GETIMG_API_KEY;
  const url = new URL(req.url);
  const pathname = url.pathname; // e.g., /api/getimg

  // We support two operations via this single endpoint using a query flag or path segment:
  // - POST /api/getimg (text-to-image)
  // - GET /api/getimg?op=balance (account balance)

  if (req.method === 'POST') {
    if (!apiKey) return new Response('Server not configured: missing GETIMG_API_KEY', { status: 500 });
    let body: any;
    try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

    // Minimal passthrough for FLUX schnell text-to-image
    const upstream = await fetch('https://api.getimg.ai/v1/flux-schnell/text-to-image', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
    });
  }

  if (req.method === 'GET') {
    // Balance check
    const op = url.searchParams.get('op');
    if (op === 'balance') {
      if (!apiKey) return new Response('Server not configured: missing GETIMG_API_KEY', { status: 500 });
      const upstream = await fetch('https://api.getimg.ai/v1/account/balance', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}


