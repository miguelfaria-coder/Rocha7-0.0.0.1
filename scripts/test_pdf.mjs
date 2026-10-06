import fs from 'fs';
import * as pdfjsLib from './node_modules/pdfjs-dist/build/pdf.mjs';

async function run() {
  const data = new Uint8Array(fs.readFileSync('Catálogo R7 Confecções.pdf'));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log('Pages:', doc.numPages);
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    console.log(`Page ${i} text items count:`, content.items.length);
    for (const item of content.items) {
      if (item.str && item.str.trim()) {
        console.log(`[P${i}]`, item.str);
      }
    }
  }
}

run().catch(console.error);
