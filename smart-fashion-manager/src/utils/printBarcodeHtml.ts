/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BarcodePrintOptions {
  pageWidthMm: number;
  pageHeightMm: number;
  title?: string;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extracts inner HTML from the printable container while preserving:
 * - Full SVG barcode markup
 * - HTML5 Canvas content by converting to image data URLs if canvas is used
 * - Label elements without hidden screen-only states
 */
export function extractPrintableBarcodeHtml(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;

  // Preserve any canvas content by converting each to an image
  const originalCanvases = container.querySelectorAll('canvas');
  const clonedCanvases = clone.querySelectorAll('canvas');
  originalCanvases.forEach((origCanvas, i) => {
    try {
      const dataUrl = origCanvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.style.cssText = origCanvas.style.cssText;
      img.className = origCanvas.className;
      img.width = origCanvas.width;
      img.height = origCanvas.height;
      clonedCanvases[i]?.parentNode?.replaceChild(img, clonedCanvases[i]);
    } catch (e) {
      console.warn('Canvas clone warning in barcode printing:', e);
    }
  });

  return clone.innerHTML;
}

/**
 * Builds a complete, standalone, self-contained HTML document for printing
 * barcode labels using the EXACT SAME architecture as the invoice print page.
 */
export function buildCompleteBarcodePrintPageHtml(
  barcodeHtml: string,
  options: BarcodePrintOptions
): string {
  const docTitle = options.title || 'Print Barcode Labels';
  const pageW = options.pageWidthMm || 50;
  const pageH = options.pageHeightMm || 25;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(docTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

    @page {
      size: ${pageW}mm ${pageH}mm;
      margin: 0;
    }

    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    /* Container ensures #barcode-direct-print-area is always fully visible */
    #barcode-direct-print-area {
      display: block !important;
      position: static !important;
      visibility: visible !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      overflow: visible !important;
    }

    #barcode-direct-print-area * {
      visibility: visible !important;
      box-sizing: border-box !important;
    }

    /* Override any screen hidden classes */
    .print-only,
    .print-only-invoice {
      display: block !important;
      visibility: visible !important;
    }

    /* Typography & Font Classes */
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
    .font-sans { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
    .font-serif { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
    .italic { font-style: italic !important; }
    .font-bold { font-weight: 700 !important; }
    .font-black { font-weight: 900 !important; }
    .font-medium { font-weight: 500 !important; }
    .uppercase { text-transform: uppercase !important; }
    .text-center { text-align: center !important; }
    .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .line-through { text-decoration: line-through !important; }
    .tracking-\\[1\\.5px\\] { letter-spacing: 1.5px !important; }

    /* Flexbox & Layout Classes */
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-wrap { flex-wrap: wrap !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .justify-between { justify-content: space-between !important; }
    .justify-center { justify-content: center !important; }
    .items-center { align-items: center !important; }
    .items-start { align-items: flex-start !important; }
    .shrink-0 { flex-shrink: 0 !important; }
    .relative { position: relative !important; }
    .block { display: block !important; }
    .mx-auto { margin-left: auto !important; margin-right: auto !important; }
    .overflow-hidden { overflow: hidden !important; }
    .border { border-width: 1px !important; border-style: solid !important; border-color: #e2e8f0 !important; }

    /* Sizing & Spacing Classes */
    .gap-0\\.5 { gap: 0.125rem !important; }
    .gap-1 { gap: 0.25rem !important; }
    .gap-1\\.5 { gap: 0.375rem !important; }
    .my-0\\.5 { margin-top: 0.125rem !important; margin-bottom: 0.125rem !important; }
    .my-1 { margin-top: 0.25rem !important; margin-bottom: 0.25rem !important; }
    .mb-0\\.5 { margin-bottom: 0.125rem !important; }
    .mt-0\\.5 { margin-top: 0.125rem !important; }
    .px-0\\.5 { padding-left: 0.125rem !important; padding-right: 0.125rem !important; }
    .pt-0\\.5 { padding-top: 0.125rem !important; }
    .max-w-\\[50px\\] { max-width: 50px !important; }

    /* Color & Opacity Classes */
    .opacity-80 { opacity: 0.8 !important; }
    .opacity-60 { opacity: 0.6 !important; }
    .text-slate-900 { color: #0f172a !important; }
    .text-slate-950 { color: #020617 !important; }
    .text-slate-800 { color: #1e293b !important; }
    .text-slate-500 { color: #64748b !important; }

    /* Barcode Item Containers */
    .barcode-print-label-item {
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      background: #ffffff !important;
    }
    .barcode-print-sheet-item {
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
      background: #ffffff !important;
    }

    /* Preserve complete SVG barcode and bars */
    svg {
      display: block !important;
      max-width: 100% !important;
    }
    svg rect {
      fill: #000000 !important;
    }

    img {
      max-width: 100% !important;
      height: auto;
    }

    /* Print media rules */
    @media print {
      @page {
        size: ${pageW}mm ${pageH}mm;
        margin: 0;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body * {
        visibility: hidden;
      }
      #barcode-direct-print-area,
      #barcode-direct-print-area * {
        visibility: visible !important;
      }
      .barcode-print-label-item {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .barcode-print-sheet-item {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div id="barcode-direct-print-area">
    ${barcodeHtml}
  </div>
  <script>
    (function () {
      var printed = false;
      function triggerPrint() {
        if (printed) return;
        printed = true;
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error('Print trigger error:', e);
        }
      }

      function waitForImages(callback) {
        var images = Array.from(document.images);
        if (images.length === 0) {
          callback();
          return;
        }
        var pending = images.length;
        function done() {
          pending--;
          if (pending <= 0) {
            callback();
          }
        }
        images.forEach(function (img) {
          if (img.complete) {
            done();
          } else {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }
        });
      }

      function onReady() {
        waitForImages(function () {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
              setTimeout(triggerPrint, 250);
            }).catch(function () {
              setTimeout(triggerPrint, 250);
            });
          } else {
            setTimeout(triggerPrint, 250);
          }
        });
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        onReady();
      } else {
        window.addEventListener('load', onReady, { once: true });
      }

      // Fallback timer to guarantee print runs once
      setTimeout(triggerPrint, 1000);

      window.addEventListener('afterprint', function () {
        setTimeout(function () {
          try { window.close(); } catch (e) {}
        }, 500);
      }, { once: true });
    })();
  </script>
</body>
</html>`;
}
