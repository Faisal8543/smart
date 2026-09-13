import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { prompt, businessData, history = [] } = body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getAiClient();

    const systemInstruction = `You are "SMART FASHION AI Business Partner", a luxury menswear fashion advisor, inventory analyst, and operations manager for SMART FASHION, an elite men's showroom.
You help the store manager with fashion trends, marketing copies, inventory optimization, and sales performance analysis.

Here is the current real-time data of the store to help ground your answers:
- Total Active Products: ${businessData?.productCount || 0}
- Current Low Stock Alert Items: ${JSON.stringify(businessData?.lowStockItems || [])}
- Today's Sales: $${businessData?.todaySales || 0}
- Total Sales Logged: $${businessData?.totalSales || 0}
- Net Profit Margin estimated: ${businessData?.profitMargin || '20%'}
- Supplier Overdrafts / Outstanding: $${businessData?.outstandingSupplierBalance || 0}
- Major Expense Category totals: ${JSON.stringify(businessData?.expenseStats || {})}

Formulate your answers inside the luxury branding guidelines:
- Tone: Elegant, sharp, encouraging, and analytical (matching Black, White & Gold branding).
- Formatting: Use standard markdown with elegant spacing. Do not output raw JSON unless asked.
- Provide actionable advice: suggest specific clothing items to restock, draft high-end promotional copy for SMS or WhatsApp, or offer strategic guidance to reduce showroom utility and staff overheads.`;

    const contents = [
      ...history.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      })),
      { role: 'user', parts: [{ text: prompt }] },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const replyText = response.text || "I apologize, but I am unable to generate an analysis right now. Please verify your stock files and retry.";
    return res.status(200).json({ text: replyText });
  } catch (error: any) {
    console.error('Error in /api/assistant:', error);
    return res.status(500).json({
      error: error.message || 'An error occurred during Gemini processing.',
    });
  }
}
