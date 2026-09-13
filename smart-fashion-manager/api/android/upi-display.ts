import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  // OS & Environment detection: Vercel and non-Windows environments must NEVER execute ADB
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
  const isWindows = process.platform === 'win32';

  if (isVercel || !isWindows) {
    return res.status(200).json({
      success: false,
      isLocalOnly: true,
      message: 'Android UPI display is available only on the local Windows server.',
    });
  }

  // Running locally on Windows - dynamically load Windows-specific modules only when needed
  try {
    const fs = await import('fs');
    const { execFile } = await import('child_process');

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { amount, upiId, invoice } = body;

    if (!amount || !upiId || !invoice) {
      return res.status(400).json({
        success: false,
        error: 'amount, upiId and invoice are required.',
      });
    }

    const adbPath = 'C:\\platform-tools\\adb.exe';

    if (!fs.existsSync(adbPath)) {
      return res.status(500).json({
        success: false,
        error: 'ADB is unavailable at C:\\platform-tools\\adb.exe on this host.',
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

      return res.status(200).json({
        success: true,
        message: 'UPI QR display sent to Android phone.',
      });
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to initialize local ADB module: ' + (err?.message || String(err)),
    });
  }
}
