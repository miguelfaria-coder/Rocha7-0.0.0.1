const fs = require('fs');
const path = require('path');

const pdfBuf = fs.readFileSync('Catálogo R7 Confecções.pdf');
const outDir = path.join(__dirname, 'extracted_pdf_images');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

// Find JPEG markers: FF D8 FF
let count = 0;
for (let i = 0; i < pdfBuf.length - 3; i++) {
  if (pdfBuf[i] === 0xFF && pdfBuf[i+1] === 0xD8 && pdfBuf[i+2] === 0xFF) {
    // Find FF D9 (JPEG EOI)
    let end = -1;
    for (let j = i + 3; j < pdfBuf.length - 1; j++) {
      if (pdfBuf[j] === 0xFF && pdfBuf[j+1] === 0xD9) {
        end = j + 2;
        break;
      }
    }
    if (end > i && (end - i) > 1000) { // filter tiny thumbnails
      count++;
      const imgData = pdfBuf.subarray(i, end);
      fs.writeFileSync(path.join(outDir, `img_${count}_len_${imgData.length}.jpg`), imgData);
      console.log(`Saved img_${count}: size ${imgData.length} bytes`);
      i = end; // skip past this image
    }
  }
}

console.log(`Total JPEG images extracted: ${count}`);
