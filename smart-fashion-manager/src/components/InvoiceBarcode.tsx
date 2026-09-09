/**
 * InvoiceBarcode Component
 * Renders a crisp vector SVG Code 128 barcode with human-readable invoice number below.
 * Tailored for 80mm thermal receipt printing (~55-60mm width, ~12-15mm height, centered).
 */

import React, { useMemo } from 'react';
import { encodeCode128B } from '../utils/code128';

interface InvoiceBarcodeProps {
  invoiceNo: string;
  height?: number;
  maxWidth?: string;
  className?: string;
  showText?: boolean;
}

export const InvoiceBarcode: React.FC<InvoiceBarcodeProps> = ({
  invoiceNo,
  height = 46,
  maxWidth = '58mm',
  className = '',
  showText = true,
}) => {
  const { binary, cleanText } = useMemo(() => encodeCode128B(invoiceNo), [invoiceNo]);

  if (!binary) return null;

  const barWidth = 1.2;
  const totalWidth = binary.length * barWidth;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center w-full ${className}`}
      style={{ margin: '1.5px auto 0 auto' }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${totalWidth} ${height}`}
        style={{
          width: '100%',
          maxWidth,
          height: `${height}px`,
          display: 'block',
          margin: '0 auto',
          background: '#ffffff',
        }}
        shapeRendering="crispEdges"
      >
        {binary.split('').map((bit, idx) => {
          if (bit === '1') {
            return (
              <rect
                key={idx}
                x={idx * barWidth}
                y={0}
                width={barWidth}
                height={height}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>

      {showText && (
        <div
          className="font-bold text-black text-center text-[9.5px] leading-none"
          style={{
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: '9.5px',
            fontWeight: 600,
            color: '#000000',
            letterSpacing: '0px',
            marginTop: '1.5px',
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          {cleanText}
        </div>
      )}
    </div>
  );
};
