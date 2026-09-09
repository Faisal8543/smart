/**
 * Standard CODE 128 (Subset B) Barcode Generator
 * Generates crisp, compliant, vector SVG barcodes for invoice / bill lookups.
 */

const CODE128_PATTERNS: string[] = [
  '11011001100', // 0
  '11001101100', // 1
  '11001100110', // 2
  '10010011000', // 3
  '10010001100', // 4
  '10001001100', // 5
  '10011001000', // 6
  '10011000100', // 7
  '10001100100', // 8
  '11001001000', // 9
  '11001000100', // 10
  '11000100100', // 11
  '10110011100', // 12
  '10011011100', // 13
  '10011001110', // 14
  '10111001100', // 15
  '10011101100', // 16
  '10011100110', // 17
  '11001110010', // 18
  '11001011100', // 19
  '11001001110', // 20
  '11011100100', // 21
  '11001110100', // 22
  '11101101110', // 23
  '11101001100', // 24
  '11100101100', // 25
  '11100100110', // 26
  '11101100100', // 27
  '11100110100', // 28
  '11100110010', // 29
  '11011011000', // 30
  '11011000110', // 31
  '11000110110', // 32
  '10100011000', // 33
  '10001011000', // 34
  '10001000110', // 35
  '10110001000', // 36
  '10001101000', // 37
  '10001100010', // 38
  '11010001000', // 39
  '11000101000', // 40
  '11000100010', // 41
  '10110111000', // 42
  '10110001110', // 43
  '10001101110', // 44
  '10111011000', // 45
  '10111000110', // 46
  '10001110110', // 47
  '11101110110', // 48
  '11010001110', // 49
  '11000101110', // 50
  '11011101000', // 51
  '11011100010', // 52
  '11011101110', // 53
  '11101011000', // 54
  '11101000110', // 55
  '11100010110', // 56
  '11101101000', // 57
  '11101100010', // 58
  '11100011010', // 59
  '11101111010', // 60
  '11001000010', // 61
  '11110001010', // 62
  '10100110000', // 63
  '10100001100', // 64
  '10010110000', // 65
  '10010000110', // 66
  '10000101100', // 67
  '10000100110', // 68
  '10110010000', // 69
  '10110000100', // 70
  '10011010000', // 71
  '10011000010', // 72
  '10000110100', // 73
  '10000110010', // 74
  '11000010010', // 75
  '11001010000', // 76
  '11110111010', // 77
  '11000010100', // 78
  '10001111010', // 79
  '10100111100', // 80
  '10010111100', // 81
  '10010011110', // 82
  '10111100100', // 83
  '10011110100', // 84
  '10011110010', // 85
  '11110100100', // 86
  '11110010100', // 87
  '11110010010', // 88
  '11011011110', // 89
  '11011110110', // 90
  '11110110110', // 91
  '10101111000', // 92
  '10100011110', // 93
  '10001011110', // 94
  '10111101000', // 95
  '10111100010', // 96
  '11110101000', // 97
  '11110100010', // 98
  '10111011110', // 99
  '10111101110', // 100
  '11101011110', // 101
  '11110101110', // 102
  '11010000100', // 103: Start A
  '11010010000', // 104: Start B
  '11010011100', // 105: Start C
  '1100011101011', // 106: Stop (with 2 termination bars)
];

const START_B_CODE = 104;
const STOP_CODE = 106;

/**
 * Encodes any string into a Code 128 (Subset B) binary string ('1's for bars, '0's for spaces)
 */
export function encodeCode128B(rawText: string): { binary: string; cleanText: string } {
  const cleanText = (rawText || '').trim();
  if (!cleanText) {
    return { binary: '', cleanText: '' };
  }

  let checksum = START_B_CODE;
  let binary = CODE128_PATTERNS[START_B_CODE];

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    // Code 128B maps ASCII 32 (' ') to 126 ('~') as values 0 to 94
    let val = charCode - 32;
    if (val < 0 || val > 94) {
      val = 0; // fallback to space if out of range
    }
    checksum += val * (i + 1);
    binary += CODE128_PATTERNS[val];
  }

  const checkDigit = checksum % 103;
  binary += CODE128_PATTERNS[checkDigit];
  binary += CODE128_PATTERNS[STOP_CODE];

  return { binary, cleanText };
}

/**
 * Generates an SVG string representation of the Code 128 barcode
 */
export function generateCode128SvgString(
  rawText: string,
  options?: {
    height?: number; // Height in pixels (default: 46px / ~12-14mm)
    barWidth?: number; // Base width per module (default: 1.2)
    maxWidth?: string; // Max width CSS (default: '54mm')
    includeText?: boolean; // Whether to include human readable text below (default: true)
    fontSize?: number; // Font size of human readable text (default: 10)
  }
): string {
  const { binary, cleanText } = encodeCode128B(rawText);
  if (!binary) return '';

  const height = options?.height ?? 46;
  const barWidth = options?.barWidth ?? 1.2;
  const totalWidth = binary.length * barWidth;
  const maxWidth = options?.maxWidth ?? '54mm';
  const includeText = options?.includeText ?? true;
  const fontSize = options?.fontSize ?? 10;

  let rects = '';
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      const x = (i * barWidth).toFixed(2);
      rects += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`;
    }
  }

  const svgBarcode = `
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 ${totalWidth} ${height}" 
      style="width:100%;max-width:${maxWidth};height:${height}px;display:block;margin:0 auto;background:#ffffff;"
      shape-rendering="crispEdges"
    >
      ${rects}
    </svg>
  `;

  if (!includeText) {
    return svgBarcode;
  }

  return `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;margin:1.5px auto 0 auto;width:100%;text-align:center;">
      ${svgBarcode}
      <div style="font-family:'Poppins',-apple-system,BlinkMacSystemFont,sans-serif;font-size:${fontSize}px;font-weight:600;color:#000000;letter-spacing:0px;margin-top:1.5px;line-height:1;text-align:center;word-break:break-all;">
        ${cleanText}
      </div>
    </div>
  `;
}
