// src/workers/pdfTextWorker.ts

/* eslint-disable no-restricted-globals */
import { getDocument, GlobalWorkerOptions, version } from 'pdfjs-dist';

/**
 * Configure the workerSrc for pdfjs so that the
 * internal rendering worker can be located after bundling.
 * We point at the CDN‐hosted build to avoid additional bundle size
 * while still keeping parsing off the UI thread.
 *
 * If you prefer to self-host the worker file, import the asset
 * and construct a URL relative to `import.meta.url` instead.
 */
GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.js`;

self.onmessage = async (event: MessageEvent) => {
  const { arrayBuffer } = event.data as { arrayBuffer: ArrayBuffer };

  if (!arrayBuffer) {
    self.postMessage({ type: 'error', error: 'No data received by worker.' });
    return;
  }

  try {
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const pageText = (textContent.items as any[])
        .map(item => ('str' in item ? item.str : ''))
        .join(' ');

      fullText += `--- Page ${i} ---\n${pageText}\n\n`;

      // Emit progress so the UI can reflect per-page updates if desired
      const progress = Math.round((i / totalPages) * 100);
      self.postMessage({ type: 'progress', value: progress });
    }

    self.postMessage({ type: 'done', text: fullText });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err)
    });
  }
};

// Mark as a module to keep TypeScript happy
export {};
