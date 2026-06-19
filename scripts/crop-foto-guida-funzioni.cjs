// Script Node.js per crop automatico dei bordi trasparenti da tutte le immagini PNG/JPG in una cartella
// Usa: node scripts/crop-foto-guida-funzioni.cjs

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '../public/foto-guida-funzioni');
const OUT_DIR = path.join(__dirname, '../public/foto-guida-funzioni-cropped');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

fs.readdirSync(DIR).forEach((file) => {
  if (!/\.(png|jpe?g)$/i.test(file)) return;
  const inputPath = path.join(DIR, file);
  const outputPath = path.join(OUT_DIR, file);
  sharp(inputPath)
    .metadata()
    .then(meta => {
      if (meta.format === 'png') {
        return sharp(inputPath).trim().toFile(outputPath);
      } else {
        // Per JPG: taglia i bordi bianchi
        return sharp(inputPath).trim({ background: { r: 255, g: 255, b: 255, alpha: 1 } }).toFile(outputPath);
      }
    })
    .then(() => {
      console.log('Croppata:', file);
    })
    .catch(e => {
      console.error('Errore su', file, e.message);
    });
});

console.log('Fatto! Le immagini croppate sono in', OUT_DIR);
