// Express dev server for local API routes
// Install: npm install express node-fetch dotenv
// Run: node server.js
import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ttsHandler } from './api/ttsHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

app.post('/api/tts', async (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  const { text, voiceName = 'Kore' } = req.body;
  if (!apiKey) return res.status(500).send('Missing GOOGLE_API_KEY');
  if (!text) return res.status(400).send('Missing text');
  try {
    const audioBase64 = await ttsHandler({ text, voiceName, apiKey });
    res.json({ audio: audioBase64 });
  } catch (e) {
    res.status(500).send(e.message || 'TTS failed');
  }
});

app.listen(8080, () => console.log('Server running on http://localhost:8080'));