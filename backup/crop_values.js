const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function cropValues() {
  const imgPath = path.join(__dirname, 'extracted_pdf_images', 'img_1_len_7389985.jpg');
  const outDir = path.join(__dirname, 'valores_crops');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const metadata = await sharp(imgPath).metadata();
  console.log(`Dimensions: ${metadata.width} x ${metadata.height}`);

  // Let's crop vertical regions where VALORES are located
  // Section 1: Camiseta Premium 100% Algodão Penteado (~y: 2000 to 3500)
  // Section 2: Camiseta PV / Malha Fria (~y: 3500 to 5000)
  // Section 3: Camisa Gola Polo / Malha Piquet (~y: 5000 to 7000)
  // Section 4: Oversized (~y: 7000 to 9450)

  const crops = [
    { name: 'premium_full.png', top: 1800, height: 1800 },
    { name: 'pv_full.png', top: 3600, height: 1800 },
    { name: 'polo_full.png', top: 5400, height: 1800 },
    { name: 'oversized_full.png', top: 7200, height: 2200 }
  ];

  for (const c of crops) {
    await sharp(imgPath)
      .extract({ left: 0, top: c.top, width: metadata.width, height: c.height })
      .toFile(path.join(outDir, c.name));
    console.log(`Saved ${c.name}`);
  }
}

cropValues().catch(console.error);
