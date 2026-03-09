const fs = require('fs');
const path = require('path');

const FOTO_DIR = path.join(__dirname, '../public/foto-guida-funzioni');
const SELECTOR_FILE = path.join(__dirname, '../src/FotoGuidaFunzioniSelector.jsx');

function getImageFiles() {
  return fs.readdirSync(FOTO_DIR).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
}

function updateSelectorFile(imageFiles) {
  const fileContent = fs.readFileSync(SELECTOR_FILE, 'utf8');
  const newList = `const FOTO_LIST = [\n${imageFiles.map(f => `  \"${f}\"`).join(',\n')}\n];`;
  const updated = fileContent.replace(/const FOTO_LIST = \[[\s\S]*?];/, newList);
  fs.writeFileSync(SELECTOR_FILE, updated, 'utf8');
  console.log('FOTO_LIST aggiornato con', imageFiles.length, 'immagini.');
}

const images = getImageFiles();
updateSelectorFile(images);
