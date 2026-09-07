import type { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp|avif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype =
      allowedTypes.test(file.mimetype) ||
      file.mimetype === 'image/svg+xml' ||
      file.mimetype === 'image/avif';
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PNG, JPG, JPEG, SVG, WEBP, and AVIF files are allowed.'));
  },
});

function runMiddleware(req: any, res: any, fn: any): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await runMiddleware(req, res, upload.single('logo'));

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file was provided for upload.' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const isSvg = ext === '.svg' || file.mimetype === 'image/svg+xml';
    const buffer: Buffer = file.buffer;

    // Generate optimized sizes using Sharp
    const sizes = [1024, 512, 256, 128];
    const result: Record<string, string> = {};

    for (const size of sizes) {
      try {
        const pipeline = isSvg ? sharp(buffer, { density: 300 }) : sharp(buffer);
        const optimizedBuf = await pipeline
          .resize({ width: size, fit: 'inside', withoutEnlargement: false })
          .png({ compressionLevel: 8, quality: 90 })
          .toBuffer();

        result[`logo${size}`] = `data:image/png;base64,${optimizedBuf.toString('base64')}`;
      } catch (sharpError) {
        console.warn(`Sharp optimization failed for size ${size}:`, sharpError);
        const mime = file.mimetype || 'image/png';
        result[`logo${size}`] = `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }

    // Default primary URL (1024px optimized version or SVG raw data URI)
    let primaryUrl: string;
    if (isSvg) {
      primaryUrl = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
    } else {
      primaryUrl = result.logo1024 || `data:${file.mimetype || 'image/png'};base64,${buffer.toString('base64')}`;
    }

    // When running locally in non-Vercel environment, optionally cache to uploadsDir
    if (!process.env.VERCEL) {
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const localFileName = `logo-${uniqueSuffix}${ext}`;
        fs.writeFileSync(path.join(uploadsDir, localFileName), buffer);
      } catch (localWriteErr) {
        // Safe to ignore in read-only environments
      }
    }

    return res.status(200).json({
      url: primaryUrl,
      logo1024: result.logo1024 || primaryUrl,
      logo512: result.logo512 || primaryUrl,
      logo256: result.logo256 || primaryUrl,
      logo128: result.logo128 || primaryUrl,
      filename: file.originalname,
      size: file.size,
    });
  } catch (uploadError: any) {
    console.error('Upload processing error:', uploadError);
    return res.status(500).json({
      error: uploadError.message || 'Failed to process and optimize uploaded logo.',
    });
  }
}
