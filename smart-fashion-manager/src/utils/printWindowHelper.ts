/**
 * Unified and controlled browser printing helper.
 * 
 * Flow:
 * 1. Synchronous popup is already open.
 * 2. Writes finalHtml exactly once into printWindow and closes document.
 * 3. Awaits:
 *    A. Document readiness (load event if not interactive/complete)
 *    B. Document fonts readiness (document.fonts.ready)
 *    C. All images in the document (Promise-based waitForImages)
 *    D. requestAnimationFrame pass 1
 *    E. requestAnimationFrame pass 2
 *    F. Short 150ms final render delay
 * 4. Calls printWindow.focus() and printWindow.print() exactly ONCE.
 */

export function triggerWindowPrint(printWindow: Window, finalHtml?: string): void {
  if (!printWindow || printWindow.closed) return;

  // 1. Write final HTML directly into the window once if provided
  if (typeof finalHtml === 'string') {
    try {
      printWindow.document.open();
      printWindow.document.write(finalHtml);
      printWindow.document.close();
    } catch (err) {
      console.error('Failed to write HTML to print window:', err);
    }
  }

  let hasPrinted = false;

  const doPrint = () => {
    if (hasPrinted) return;
    if (!printWindow || printWindow.closed) return;

    hasPrinted = true;

    try {
      printWindow.focus();
      printWindow.print();
    } catch (error) {
      console.error('Failed to execute printWindow.print():', error);
    }
  };

  // Promise-based readiness pipeline
  const runControlledReadiness = async () => {
    try {
      const doc = printWindow.document;
      if (!doc) {
        doPrint();
        return;
      }

      // A. Document readiness
      if (doc.readyState !== 'interactive' && doc.readyState !== 'complete') {
        await new Promise<void>((resolve) => {
          printWindow.addEventListener('load', () => resolve(), { once: true });
        });
      }

      // B. Fonts readiness
      try {
        if (doc.fonts && doc.fonts.ready) {
          await doc.fonts.ready;
        }

        // Explicitly check that Poppins is available when the document uses it
        if (doc.fonts && typeof doc.fonts.check === 'function') {
          const isPoppinsLoaded = doc.fonts.check('10px Poppins');
          if (!isPoppinsLoaded && typeof doc.fonts.load === 'function') {
            try {
              // Fast bounded check to avoid blocking forever
              await Promise.race([
                doc.fonts.load('10px Poppins'),
                new Promise<void>((resolve) => setTimeout(resolve, 800))
              ]);
            } catch {
              // Never block forever waiting for the font
            }
          }
        }
      } catch (fontErr) {
        console.warn('Font loading check completed with notice:', fontErr);
      }

      // C. All images in print document
      const waitForImages = async (): Promise<void> => {
        try {
          const images = Array.from(doc.images || []);
          if (images.length === 0) return;

          const imagePromises = images.map((img) => {
            return new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) {
                // Resolved immediately for loaded image
                resolve();
              } else if (img.complete && img.naturalWidth === 0) {
                // Treat failed/broken image as resolved immediately to avoid blocking
                resolve();
              } else {
                // Wait for either load or error
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }
            });
          });

          await Promise.all(imagePromises);
        } catch {
          // Continue if reading images fails
        }
      };

      await waitForImages();

      // D. Browser rendering pass 1 using requestAnimationFrame
      const rAF = (
        (window.requestAnimationFrame && window.requestAnimationFrame.bind(window)) ||
        (printWindow.requestAnimationFrame && printWindow.requestAnimationFrame.bind(printWindow)) ||
        ((cb: () => void) => setTimeout(cb, 16))
      );
      await new Promise<void>((resolve) => rAF(() => resolve()));

      // E. Browser rendering pass 2 using requestAnimationFrame
      await new Promise<void>((resolve) => rAF(() => resolve()));

      // Force the final layout calculation by accessing the print area's layout
      try {
        const printArea =
          doc.getElementById('invoice-print-area') ||
          doc.getElementById('barcode-direct-print-area');

        if (printArea) {
          void printArea.getBoundingClientRect();
          void printArea.scrollHeight;
          void printArea.offsetHeight;
        }
      } catch (layoutErr) {
        console.warn('Layout forcing notice:', layoutErr);
      }

      // F. Final rendering delay of approximately 150ms
      await new Promise<void>((resolve) => setTimeout(resolve, 150));

      // After all readiness requirements pass: trigger single print
      doPrint();
    } catch (err) {
      console.error('Error during print readiness pipeline:', err);
      // Still attempt doPrint() once if an unexpected error occurs, provided print window is open
      doPrint();
    }
  };

  runControlledReadiness();
}

export const printToWindow = triggerWindowPrint;
