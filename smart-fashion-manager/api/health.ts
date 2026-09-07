import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    status: 'ok',
    service: 'Smart Fashion Manager API',
    environment: process.env.VERCEL ? 'vercel-serverless' : 'local',
    time: new Date().toISOString(),
  });
}
