/**
 * Unified and controlled in-document browser printing helper.
 *
 * Architecture:
 * 1. Renders the invoice / barcode HTML into a dedicated temporary container (#smart-fashion-print-container)
 *    appended directly to document.body.
 * 2. Scopes raw <style> tags to @media print to prevent any CSS bleed into the active application.
 * 3. Awaits:
 *    - document.fonts.ready (and Poppins font availability)
 *    - All <img> images in the container to load or error (with bounded race)
 *    - SVG / Barcode rendering
 *    - requestAnimationFrame pass 1
 *    - requestAnimationFrame pass 2
 *    - Layout calculation forcing (getBoundingClientRect, scrollHeight, offsetHeight)
 *    - Short 150ms render delay
 * 4. Calls window.focus() and window.print() exactly ONCE (duplicate print protection).
 * 5. Cleans up the temporary print container after the native print dialog closes via 'afterprint' event
 *    (with a safe fallback timeout).
 *
 * Zero popups. Zero window.open(). Zero new tabs. Zero iframes. Native Chrome Print Preview.
 */

/**
 * Unified and controlled in-document browser printing helper.
 *
 * Architecture:
 * 1. Parses printableHtml using DOMParser.
 * 2. Extracts <head> styles, <link> stylesheets, @font-face, and @page rules.
 * 3. Injects extracted styles safely into document.head scoped to @media print (keeping @page at top-level).
 * 4. Extracts ONLY the <body> content and injects it into #smart-fashion-print-container (no nested <html>, <head>, or <body>).
 * 5. Removes any inline scripts (e.g. legacy window.close() calls).
 * 6. Awaits:
 *    - document.fonts.ready (and Poppins font availability)
 *    - All <img> images in the container to load or error (with bounded race)
 *    - SVG / Barcode rendering
 *    - requestAnimationFrame pass 1
 *    - requestAnimationFrame pass 2
 *    - Layout calculation forcing (getBoundingClientRect, scrollHeight, offsetHeight)
 *    - Short 150ms render delay
 * 7. Calls window.focus() and window.print() exactly ONCE (duplicate print protection).
 * 8. Cleans up the temporary print container and injected styles after the native print dialog closes via 'afterprint' event
 *    (with a safe fallback timeout).
 *
 * Zero popups. Zero window.open(). Zero new tabs. Zero iframes. Native Chrome Print Preview.
 */

function processExtractedStyles(rawCss: string): string {
  if (!rawCss || !rawCss.trim()) return '';

  const imports: string[] = [];
  const fontFaces: string[] = [];
  const pages: string[] = [];

  // Extract @import rules (must appear at the very top of style tag)
  let cleaned = rawCss.replace(/@import\s+[^;]+;/gi, (m) => {
    imports.push(m.trim());
    return '';
  });

  // Extract @font-face rules
  cleaned = cleaned.replace(/@font-face\s*\{[\s\S]*?\}/gi, (m) => {
    fontFaces.push(m.trim());
    return '';
  });

  // Extract @page rules (cannot be nested inside @media in CSS standard)
  cleaned = cleaned.replace(/@page\s*(?:[^{]*)?\{[\s\S]*?\}/gi, (m) => {
    pages.push(m.trim());
    return '';
  });

  // Wrap remaining CSS rules in @media print so they never bleed into the screen UI
  const remaining = cleaned.trim();
  let mediaBlock = '';
  if (remaining) {
    mediaBlock = `@media print {\n${remaining}\n}`;
  }

  return [...imports, ...fontFaces, ...pages, mediaBlock].filter(Boolean).join('\n\n');
}

export async function printInCurrentDocument(printableHtml: string, docTitle?: string): Promise<void> {
  if (!printableHtml || typeof document === 'undefined') return;

  // 1. Remove any previous container or temporary injected elements if lingering from an earlier action
  const existingContainer = document.getElementById('smart-fashion-print-container');
  if (existingContainer && existingContainer.parentNode) {
    existingContainer.parentNode.removeChild(existingContainer);
  }
  const existingTempStyles = document.getElementById('smart-fashion-injected-print-styles');
  if (existingTempStyles && existingTempStyles.parentNode) {
    existingTempStyles.parentNode.removeChild(existingTempStyles);
  }
  document.querySelectorAll('[data-smart-fashion-temp-print="true"]').forEach((el) => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });

  // 2. Parse printableHtml using DOMParser to extract styles, links, and body content
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(printableHtml, 'text/html');

  // 3. Document Title Handling: extract title from HTML or caller parameter
  const parsedTitle = parsedDoc.querySelector('title')?.textContent?.trim();
  const printTitle = docTitle || parsedTitle || undefined;
  const originalTitle = document.title;
  if (printTitle) {
    document.title = printTitle;
  }

  // 4. Extract and safely inject <link rel="stylesheet"> / fonts preconnect elements
  const linkElements = Array.from(
    parsedDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="preconnect"]')
  );
  linkElements.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && !document.querySelector(`link[href="${href}"]`)) {
      const newLink = document.createElement('link');
      if (link.getAttribute('rel')) newLink.setAttribute('rel', link.getAttribute('rel')!);
      newLink.setAttribute('href', href);
      if (link.getAttribute('crossorigin')) newLink.setAttribute('crossorigin', link.getAttribute('crossorigin')!);
      newLink.setAttribute('data-smart-fashion-temp-print', 'true');
      document.head.appendChild(newLink);
    }
  });

  // 5. Extract <style> elements from parsed document
  const styleNodes = Array.from(parsedDoc.querySelectorAll('style'));
  const rawCss = styleNodes.map((s) => s.textContent || '').join('\n');
  const processedCss = processExtractedStyles(rawCss);

  if (processedCss.trim()) {
    const tempStyleElement = document.createElement('style');
    tempStyleElement.id = 'smart-fashion-injected-print-styles';
    tempStyleElement.textContent = processedCss;
    document.head.appendChild(tempStyleElement);
  }

  // 6. Extract ONLY <body> content:
  // Strip out any <script> tags to avoid executing legacy popup scripts (e.g. window.close())
  parsedDoc.body.querySelectorAll('script').forEach((s) => s.remove());
  // Strip out any <style> tags already extracted
  parsedDoc.body.querySelectorAll('style').forEach((s) => s.remove());

  const bodyContent = parsedDoc.body.innerHTML;

  // 7. Create dedicated temporary print container and insert ONLY the body content
  // (NO nested <html>, <head>, or <body> inside the <div>)
  const printContainer = document.createElement('div');
  printContainer.id = 'smart-fashion-print-container';
  printContainer.innerHTML = bodyContent;
  document.body.appendChild(printContainer);

  // 8. Cleanup logic - removes temporary container and temporary styles after print dialog closes
  let isCleanedUp = false;
  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;

    // Remove temporary print container
    const container = document.getElementById('smart-fashion-print-container');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Remove injected print styles
    const tempStyles = document.getElementById('smart-fashion-injected-print-styles');
    if (tempStyles && tempStyles.parentNode) {
      tempStyles.parentNode.removeChild(tempStyles);
    }

    // Remove temporary links
    document.querySelectorAll('[data-smart-fashion-temp-print="true"]').forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    // Restore original document title
    if (printTitle) {
      document.title = originalTitle;
    }
    window.removeEventListener('afterprint', cleanup);
  };

  // Register cleanup listener on afterprint (fired when print dialog closes or cancels)
  window.addEventListener('afterprint', cleanup, { once: true });

  // Safe cleanup fallback (in case afterprint does not trigger in rare environments)
  setTimeout(() => {
    cleanup();
  }, 60000);

  // 9. Duplicate print protection guard
  let hasPrinted = false;
  const doPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;

    try {
      window.focus();
      window.print();
    } catch (err) {
      console.error('Failed to execute window.print():', err);
    }
  };

  // 10. Controlled readiness pipeline
  try {
    // A. Document fonts readiness
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      if (document.fonts && typeof document.fonts.check === 'function') {
        const isPoppinsLoaded = document.fonts.check('10px Poppins');
        if (!isPoppinsLoaded && typeof document.fonts.load === 'function') {
          try {
            await Promise.race([
              document.fonts.load('10px Poppins'),
              new Promise<void>((resolve) => setTimeout(resolve, 800)),
            ]);
          } catch {}
        }
      }
    } catch (fontErr) {
      console.warn('Font loading check notice:', fontErr);
    }

    // B. All images in print container
    const images = Array.from(printContainer.querySelectorAll('img'));
    if (images.length > 0) {
      const imagePromises = images.map((img) => {
        return new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }
        });
      });
      await Promise.race([
        Promise.all(imagePromises),
        new Promise<void>((resolve) => setTimeout(resolve, 1500)),
      ]);
    }

    // C. SVGs / Barcodes readiness
    const svgs = Array.from(printContainer.querySelectorAll('svg'));
    if (svgs.length > 0) {
      svgs.forEach((svg) => {
        try {
          void svg.getBoundingClientRect();
        } catch {}
      });
    }

    // D. Browser rendering pass 1 using requestAnimationFrame
    const rAF =
      (window.requestAnimationFrame && window.requestAnimationFrame.bind(window)) ||
      ((cb: () => void) => setTimeout(cb, 16));
    await new Promise<void>((resolve) => rAF(() => resolve()));

    // E. Browser rendering pass 2 using requestAnimationFrame
    await new Promise<void>((resolve) => rAF(() => resolve()));

    // Force the final layout calculation by accessing the print area's layout
    try {
      void printContainer.getBoundingClientRect();
      void printContainer.scrollHeight;
      void printContainer.offsetHeight;
    } catch (layoutErr) {
      console.warn('Layout forcing notice:', layoutErr);
    }

    // F. Final rendering delay of approximately 150ms
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    // After all readiness requirements pass: trigger single native print
    doPrint();
  } catch (err) {
    console.error('Error during print readiness pipeline:', err);
    doPrint();
  }
}

/**
 * Universal print trigger for current document or legacy calls.
 */
export function triggerWindowPrint(arg1?: any, finalHtml?: string): void {
  if (typeof finalHtml === 'string') {
    void printInCurrentDocument(finalHtml);
    return;
  }
  if (typeof arg1 === 'string') {
    void printInCurrentDocument(arg1);
    return;
  }
  window.print();
}

export const printToWindow = triggerWindowPrint;

