// Script Node.js per aggiornare automaticamente l'array FOTO_LIST in FotoGuidaFunzioniSelector.jsx
// Esegui: node scripts/update-foto-list.js

const fs = require('fs')
const path = require('path')

const fotoDir = path.join(__dirname, '../public/foto-guida-funzioni')
const selectorPath = path.join(__dirname, '../src/FotoGuidaFunzioniSelector.jsx')

// Leggi i file immagine nella cartella
const files = fs.readdirSync(fotoDir).filter(f => /\.(png|jpe?g|gif|webp)$/i.test(f))

// Genera la stringa dell'array
const fotoListString = `const FOTO_LIST = [\n  ${files.map(f => `'${f}'`).join(',\n  ')}\n]`

// Leggi il file selector
let selectorCode = fs.readFileSync(selectorPath, 'utf8')

// Sostituisci l'array FOTO_LIST
selectorCode = selectorCode.replace(/const FOTO_LIST = \[[\s\S]*?\]/, fotoListString)

// Scrivi il file aggiornato
fs.writeFileSync(selectorPath, selectorCode)

console.log(`FOTO_LIST aggiornato con ${files.length} file!`)
