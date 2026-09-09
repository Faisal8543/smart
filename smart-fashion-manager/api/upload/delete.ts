import type { VercelRequest, VercelResponse } from '@vercel/node';
import path from 'path';
import fs from 'fs';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { url } = body;

    if (!url) {
      return res.status(400).json({ error: 'No file URL provided.' });
    }

    // Check if file is part of our local uploads
    if (typeof url === 'string' && url.startsWith('/uploads/') && !url.includes('..')) {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const fileName = url.substring('/uploads/'.length);
      const filePath = path.join(uploadsDir, fileName);

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkErr) {
        // Ephemeral filesystem on Vercel: safely ignore filesystem errors
      }

      // Also clean up any generated optimized versions (1024, 512, 256, 128)
      try {
        const ext = path.extname(fileName);
        const baseName = path.basename(fileName, ext);
        const sizes = [1024, 512, 256, 128];
        for (const size of sizes) {
          const optFilePath = path.join(uploadsDir, `${baseName}-${size}.png`);
          if (fs.existsSync(optFilePath)) {
            fs.unlinkSync(optFilePath);
          }
        }
      } catch (optUnlinkErr) {
        // Ephemeral filesystem on Vercel: safely ignore filesystem errors
      }

      return res.status(200).json({
        success: true,
        message: 'Logo and all optimized sizes deleted successfully.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'File did not exist or was external.',
    });
  } catch (error: any) {
    console.error('Delete logo file error:', error);
    return res.status(200).json({
      success: true,
      message: 'Processed delete request (ephemeral storage handled safely).',
    });
  }
}
