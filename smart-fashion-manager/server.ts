/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from 'child_process';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser
  app.use(express.json());

  // Serve uploaded files statically
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Serve assets statically
  const assetsDir = path.join(process.cwd(), 'assets');
  if (process.env.NODE_ENV === 'production') {
    app.use('/assets', express.static(assetsDir));
  }

  // Serve public directory
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Configure multer storage with NO file size limit
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `logo-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      // Support: PNG, JPG, JPEG, SVG, WEBP, AVIF
      const allowedTypes = /jpeg|jpg|png|gif|svg|webp|avif/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/svg+xml' || file.mimetype === 'image/avif';
      if (extname && mimetype) {
        return cb(null, true);
      }
      cb(new Error('Only PNG, JPG, JPEG, SVG, WEBP, and AVIF files are allowed.'));
    },
  });

  // Helper function to generate optimized image sizes (1024px, 512px, 256px, 128px) automatically
  async function generateOptimizedVersions(originalPath: string, filename: string, ext: string) {
    const dir = path.dirname(originalPath);
    const baseName = path.basename(filename, ext);
    const relativeOriginal = `/uploads/${filename}`;
    
    const result = {
      logo1024: relativeOriginal,
      logo512: relativeOriginal,
      logo256: relativeOriginal,
      logo128: relativeOriginal,
    };

    try {
      const sizes = [1024, 512, 256, 128];
      const isSvg = ext === '.svg';

      for (const size of sizes) {
        const outFilename = `${baseName}-${size}.png`;
        const outPath = path.join(dir, outFilename);

        let pipeline;
        if (isSvg) {
          // Specify density to render SVG with extremely crisp quality at target scale
          pipeline = sharp(originalPath, { density: 300 });
        } else {
          pipeline = sharp(originalPath);
        }

        // Resize maintaining original aspect ratio without auto cropping
        await pipeline
          .resize({
            width: size,
            fit: 'inside',
            withoutEnlargement: false,
          })
          .png({ compressionLevel: 8, quality: 90 }) // Optimize and compress while preserving transparency
          .toFile(outPath);

        result[`logo${size}` as 'logo1024' | 'logo512' | 'logo256' | 'logo128'] = `/uploads/${outFilename}`;
      }
    } catch (err) {
      console.error('Error generating optimized image versions in background:', err);
    }

    return result;
  }

  // Server-side lazy-initialized Gemini SDK
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

  // API endpoint for uploading the logo
  app.post('/api/upload', (req, res) => {
    upload.single('logo')(req, res, async (err) => {
      if (err) {
        console.error('Multer upload error:', err);
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No file was provided for upload.' });
      }

      try {
        const fileUrl = `/uploads/${req.file.filename}`;
        const ext = path.extname(req.file.filename).toLowerCase();
        
        // Automatically optimize and generate the 1024, 512, 256, and 128 versions in the background
        const optimized = await generateOptimizedVersions(req.file.path, req.file.filename, ext);

        return res.json({
          url: fileUrl,
          ...optimized,
        });
      } catch (uploadProcessError: any) {
        console.error('Error processing uploaded logo:', uploadProcessError);
        return res.status(500).json({ error: uploadProcessError.message || 'Failed to optimize uploaded logo.' });
      }
    });
  });

  // API endpoint for deleting an uploaded logo
  app.post('/api/upload/delete', (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'No file URL provided.' });
      }

      // Persistent base64 data URLs: Client state update removes the branding logo
      if (url.startsWith('data:')) {
        return res.json({ success: true, message: 'Data logo removed successfully.' });
      }

      // Check if file is part of our local uploads
      if (url.startsWith('/uploads/') && !url.includes('..')) {
        const fileName = url.substring('/uploads/'.length);
        const filePath = path.join(uploadsDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        // Also clean up all generated optimized versions (1024, 512, 256, 128)
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const sizes = [1024, 512, 256, 128];
        for (const size of sizes) {
          const optFilePath = path.join(uploadsDir, `${baseName}-${size}.png`);
          if (fs.existsSync(optFilePath)) {
            fs.unlinkSync(optFilePath);
          }
        }

        return res.json({ success: true, message: 'Logo and all optimized sizes deleted successfully.' });
      }
      return res.json({ success: true, message: 'File did not exist or was external.' });
    } catch (error: any) {
      console.error('Delete logo file error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete the file.' });
    }
  });

  // API endpoint for SMART FASHION AI Assistant
  app.post('/api/assistant', async (req, res) => {
    try {
      const { prompt, businessData, history = [] } = req.body;

      if (!prompt) {
        res.status(400).json({ error: 'Prompt is required' });
        return;
      }

      // Initialize Gemini Client
      const ai = getAiClient();

      // Formulate a robust system instruction giving the AI context of the showroom
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

      // Structure conversation history for Gemini if present
      // We will map past messages to Gemini contents schema
      const contents = [
        ...history.map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = response.text || "I apologize, but I am unable to generate a analysis right now. Please verify your stock files and retry.";
      res.json({ text: replyText });
    } catch (error: any) {
      console.error('Error in /api/assistant:', error);
      res.status(500).json({
        error: error.message || 'An error occurred during Gemini processing.',
      });
    }
  });

  // ====================================================
// ANDROID PAYMENT DISPLAY — USB / ADB
// ====================================================
app.post('/api/android/upi-display', (req, res) => {
  const { amount, upiId, invoice } = req.body;

  if (!amount || !upiId || !invoice) {
    return res.status(400).json({
      success: false,
      error: 'amount, upiId and invoice are required.',
    });
  }

  // Detect non-Windows or Vercel environment where USB ADB is unavailable
  if (process.env.VERCEL || process.platform !== 'win32') {
    return res.status(200).json({
      success: false,
      isLocalOnly: true,
      message: 'Android UPI display is available only on the local Windows server.',
    });
  }

  const adbPath = 'C:\\platform-tools\\adb.exe';

  if (!fs.existsSync(adbPath)) {
    return res.status(200).json({
      success: false,
      isLocalOnly: true,
      message: 'Android UPI display is available only on the local Windows server with platform-tools installed.',
    });
  }

  const args = [
    'shell',
    'am',
    'start',
    '-n',
    'com.smartfashion.display/.MainActivity',
    '--es',
    'amount',
    Number(amount).toFixed(2),
    '--es',
    'upiId',
    String(upiId),
    '--es',
    'invoice',
    String(invoice),
  ];

  execFile(adbPath, args, { windowsHide: true }, (error, stdout, stderr) => {
    if (error) {
      console.error('ADB Android display error:', error);
      console.error('ADB stderr:', stderr);

      return res.status(500).json({
        success: false,
        error: 'Android phone not connected or ADB is unavailable.',
        details: stderr || error.message,
      });
    }

    console.log('Android UPI display updated:', {
      amount,
      upiId,
      invoice,
      stdout,
    });

    return res.json({
      success: true,
      message: 'UPI QR display sent to Android phone.',
    });
  });
});
  
  // Health check
  app.all('/api/health', (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', ['GET', 'HEAD']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    res.json({
      status: 'ok',
      service: 'Smart Fashion Manager API',
      environment: 'local',
      time: new Date().toISOString(),
    });
  });

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // Serve assets statically after Vite middleware so ?import query params are intercepted by Vite first.
    app.use('/assets', express.static(assetsDir));
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SMART FASHION server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
