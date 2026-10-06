const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function sliceImage() {
  const imgPath = path.join(__dirname, 'extracted_pdf_images', 'img_1_len_7389985.jpg');
  const outDir = path.join(__dirname, 'catalog_slices');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const metadata = await sharp(imgPath).metadata();
  console.log(`Image dimensions: ${metadata.width} x ${metadata.height}`);

  const sliceCount = 8;
  const sliceHeight = Math.floor(metadata.height / sliceCount);

  for (let i = 0; i < sliceCount; i++) {
    const top = i * sliceHeight;
    const height = (i === sliceCount - 1) ? (metadata.height - top) : sliceHeight;

    const outPath = path.join(outDir, `slice_${i + 1}.png`);
    await sharp(imgPath)
      .extract({ left: 0, top, width: metadata.width, height })
      .toFile(outPath);
    console.log(`Saved slice_${i + 1}.png (top: ${top}, height: ${height})`);
  }
}

sliceImage().catch(console.error);
