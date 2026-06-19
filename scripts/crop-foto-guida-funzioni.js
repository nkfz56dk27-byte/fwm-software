// Script Node.js per crop automatico dei bordi trasparenti da tutte le immagini PNG/JPG in una cartella
// Usa: node scripts/crop-foto-guida-funzioni.cjs

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../public/foto-guida-funzioni');
const OUT_DIR = path.join(__dirname, '../public/foto-guida-funzioni-cropped');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

fs.readdirSync(DIR).forEach(async (file) => {
  if (!/\.(png|jpe?g)$/i.test(file)) return;
  const inputPath = path.join(DIR, file);
  const outputPath = path.join(OUT_DIR, file);
  try {
    const image = sharp(inputPath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    // Crop automatico dei bordi trasparenti (o bianchi per JPG)
    let cropped;
    if (/\.png$/i.test(file)) {
      cropped = image.trim(); // taglia trasparenza
    } else {
      // Per JPG: taglia i bordi bianchi
      cropped = image.trim({ background: { r: 255, g: 255, b: 255, alpha: 1 } });
    }
    await cropped.toFile(outputPath);
    console.log('Croppata:', file);
  } catch (e) {
    console.error('Errore su', file, e.message);
  }
});

console.log('Fatto! Le immagini croppate sono in', OUT_DIR);
