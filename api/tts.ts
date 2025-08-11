import { ttsHandler } from './ttsHandler';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const { text, voiceName } = body;
  if (!apiKey) return new Response('Missing GOOGLE_API_KEY', { status: 500 });
  if (!text) return new Response('Missing text', { status: 400 });

  try {
    const audioBase64 = await ttsHandler({ text, voiceName, apiKey });
    return new Response(JSON.stringify({ audio: audioBase64 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(e.message || 'TTS failed', { status: 500 });
  }
}
