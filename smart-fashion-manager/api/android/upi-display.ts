import type { VercelRequest, VercelResponse } from '@vercel/node';
import { execFile } from 'child_process';
import fs from 'fs';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { amount, upiId, invoice } = req.body || {};

  if (!amount || !upiId || !invoice) {
    return res.status(400).json({
      success: false,
      error: 'amount, upiId and invoice are required.',
    });
  }

  // Detect if running on Vercel Serverless (Linux Cloud) or non-Windows environment
  if (process.env.VERCEL || process.platform !== 'win32') {
    return res.status(200).json({
      success: false,
      isLocalOnly: true,
      message: 'Android UPI display is available only on the local Windows server.',
    });
  }

  // Windows Localhost ADB execution
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
      return res.status(500).json({
        success: false,
        error: 'Android phone not connected or ADB is unavailable.',
        details: stderr || error.message,
      });
    }

    return res.json({
      success: true,
      message: 'UPI QR display sent to Android phone.',
    });
  });
}
