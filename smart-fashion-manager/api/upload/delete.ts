import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'No file URL provided.' });
    }

    // Persistent base64 data URLs: Client state update removes the branding logo
    if (url.startsWith('data:')) {
      return res.status(200).json({ success: true, message: 'Data logo removed successfully.' });
    }

    // Local /uploads/ files: clean up from disk if running locally
    if (url.startsWith('/uploads/') && !url.includes('..')) {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const fileName = url.substring('/uploads/'.length);
      const filePath = path.join(uploadsDir, fileName);

      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          // May be read-only or in ephemeral container
        }
      }

      // Also clean up any size variants
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const sizes = [1024, 512, 256, 128];
      for (const size of sizes) {
        const optFilePath = path.join(uploadsDir, `${baseName}-${size}.png`);
        if (fs.existsSync(optFilePath)) {
          try {
            fs.unlinkSync(optFilePath);
          } catch (e) {}
        }
      }

      return res.status(200).json({ success: true, message: 'Logo and optimized sizes deleted.' });
    }

    return res.status(200).json({ success: true, message: 'File did not exist or was external.' });
  } catch (error: any) {
    console.error('Delete logo file error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete file.' });
  }
}
