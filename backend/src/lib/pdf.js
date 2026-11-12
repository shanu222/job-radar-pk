// PDF → text using Mozilla PDF.js (via unpdf). Errors are thrown as normal, catchable errors.
import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfToText(buffer, { maxPages = 20 } = {}) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    if (pdf.numPages > maxPages) {
      const parts = [];
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const c = await page.getTextContent();
        parts.push(c.items.map((it) => it.str).join(' '));
      }
      return parts.join('\n');
    }
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } finally {
    pdf.destroy?.().catch?.(() => {});
  }
}
