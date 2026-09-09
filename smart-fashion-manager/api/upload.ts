import type { VercelRequest, VercelResponse } from '@vercel/node';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// Disable Vercel's default body parser to let Multer parse multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp|avif/;
    const ext = path.extname(file.originalname).toLowerCase();
    const isExtAllowed = allowedTypes.test(ext);
    const isMimeAllowed =
      allowedTypes.test(file.mimetype) ||
      file.mimetype === 'image/svg+xml' ||
      file.mimetype === 'image/avif';

    if (isExtAllowed || isMimeAllowed) {
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
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    await runMiddleware(req, res, upload.single('logo'));

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No file was provided for upload.' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const isSvg = ext === '.svg' || file.mimetype === 'image/svg+xml';
    const mimeType = file.mimetype || (isSvg ? 'image/svg+xml' : 'image/png');

    // Generate base64 Data URL for original
    const originalDataUrl = `data:${mimeType};base64,${file.buffer.toString('base64')}`;

    // Automatically optimize and generate 1024, 512, 256, and 128 versions
    const sizes = [1024, 512, 256, 128] as const;
    const optimized: Record<string, string> = {
      logo1024: originalDataUrl,
      logo512: originalDataUrl,
      logo256: originalDataUrl,
      logo128: originalDataUrl,
    };

    for (const size of sizes) {
      try {
        const pipeline = isSvg
          ? sharp(file.buffer, { density: 300 })
          : sharp(file.buffer);

        const resizedBuffer = await pipeline
          .resize({
            width: size,
            fit: 'inside',
            withoutEnlargement: false,
          })
          .png({ compressionLevel: 8, quality: 90 })
          .toBuffer();

        optimized[`logo${size}`] = `data:image/png;base64,${resizedBuffer.toString('base64')}`;
      } catch (resizeErr) {
        console.warn(`Warning: Sharp resizing to ${size}px fell back to original:`, resizeErr);
        optimized[`logo${size}`] = originalDataUrl;
      }
    }

    // Try local filesystem write if uploads folder exists and is writable (for local dev parity)
    let localFileUrl: string | null = null;
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (fs.existsSync(uploadsDir)) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `logo-${uniqueSuffix}${ext || '.png'}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, file.buffer);
        localFileUrl = `/uploads/${filename}`;
      }
    } catch {
      // Ephemeral / read-only filesystem on Vercel is expected
    }

    // Use data URL for Vercel serverless to guarantee persistence across invocations
    const url = process.env.VERCEL ? originalDataUrl : (localFileUrl || originalDataUrl);

    return res.status(200).json({
      url,
      originalDataUrl,
      ...optimized,
    });
  } catch (error: any) {
    console.error('Multer/Sharp upload error in /api/upload:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process uploaded logo.',
    });
  }
}
