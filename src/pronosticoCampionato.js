// ===== LOGICA PRONOSTICO CAMPIONATO =====

function getVettorePuntiGara(gara, classifica) {
  if (gara.accorciata) {
    if (gara.percentuale_accorciata === 'custom' && Array.isArray(gara.custom_punti)) {
      return gara.custom_punti.map(Number)
    }
    if (gara.percentuale_accorciata === 25) return [6, 4, 3, 2, 1]
    if (gara.percentuale_accorciata === 50) return [13, 10, 8, 6, 5, 4, 3, 2, 1]
    if (gara.percentuale_accorciata === 75) return [19, 14, 12, 10, 8, 6, 4, 3, 2, 1]
  }
  if (classifica?.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti) && classifica.modificatore_libero_punti.length) {
    return classifica.modificatore_libero_punti.map(Number)
  }
  const tabelle = {
    sprint: [8, 7, 6, 5, 4, 3, 2, 1],
    sprintRace: [8, 7, 6, 5, 4, 3, 2, 1],
    featureRace: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    f2sprint: [10, 8, 6, 5, 4, 3, 2, 1],
  }
  return tabelle[gara.tipo_gara] || [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
}

function calcolaPuntiPosizione(pos, tipoGara, classifica, gara = {}) {
  if (!pos || pos < 1) return 0
  const garaNormalizzata = { tipo_gara: tipoGara, ...gara }
  const vettore = getVettorePuntiGara(garaNormalizzata, classifica)
  return pos <= vettore.length ? Number(vettore[pos - 1]) || 0 : 0
}

function calcolaPuntiAccorciati(pos, percentuale, customPuntiArr) {
  return calcolaPuntiPosizione(pos, null, null, { accorciata: true, percentuale_accorciata: percentuale, custom_punti: customPuntiArr })
}

function getGareGP(gp) {
  if (gp.gare && gp.gare.length > 0) return gp.gare
  if (gp.tipo_weekend === 'sprintF1') return [{ tipo_gara: 'sprint' }, { tipo_gara: 'principale' }]
  if (gp.tipo_weekend === 'f2') return [{ tipo_gara: 'f2sprint' }, { tipo_gara: 'featureRace' }]
  return [{ tipo_gara: 'principale' }]
}

function nomeGaraLabel(gara) {
  const labels = { principale: 'Gara', sprint: 'Sprint', featureRace: 'Feature Race', f2sprint: 'Sprint Race' }
  return labels[gara.tipo_gara] || 'Gara'
}

function puntiBonusMassimi(classifica) {
  const pole = classifica.punti_pole_attivo ? (Number(classifica.punti_pole_valore) || 0) : 0
  const giroVeloce = classifica.giro_veloce_attivo ? (Number(classifica.giro_veloce_valore) || 0) : 0
  return pole + giroVeloce
}

function puntiMassimiGaraPilota(gara, classifica) {
  if (gara.completata) return 0
  const vettore = getVettorePuntiGara(gara, classifica).map(Number)
  const puntiPosizione = vettore.length ? Math.max(0, ...vettore) : 0
  return puntiPosizione + puntiBonusMassimi(classifica)
}

function puntiMassimiGaraCostruttore(gara, classifica) {
  if (gara.completata) return 0
  const vettore = getVettorePuntiGara(gara, classifica).map(Number).sort((a, b) => b - a)
  const top1 = vettore[0] || 0
  const top2 = vettore[1] || 0
  return top1 + top2 + puntiBonusMassimi(classifica)
}

function puntiMassimiGP(gp, classifica, perCostruttore) {
  return getGareGP(gp).reduce((tot, gara) =>
    tot + (perCostruttore ? puntiMassimiGaraCostruttore(gara, classifica) : puntiMassimiGaraPilota(gara, classifica)), 0)
}

function calcolaPuntiMassimiRimanenti(classifica, tipo = 'pilota') {
  const gpNonCompletati = (classifica.gp || []).filter(g => !g.completato)
  return gpNonCompletati.reduce((tot, gp) => tot + puntiMassimiGP(gp, classifica, tipo === 'costruttore'), 0)
}

function contaPiazzamenti(pilotaId, classifica, filtroTipoGara = null) {
  const conteggio = {}
  ;(classifica.gp || []).forEach(gp => {
    getGareGP(gp).forEach(gara => {
      if (!gara.completata) return
      if (filtroTipoGara && gara.tipo_gara !== filtroTipoGara) return
      const risultato = (gara.risultati || {})[pilotaId]
      if (!risultato) return
      const posizione = typeof risultato === 'object' ? risultato.posizione : risultato
      const pos = Number(posizione)
      if (!pos || pos < 1) return
      conteggio[pos] = (conteggio[pos] || 0) + 1
    })
  })
  return conteggio
}

function contaPole(pilotaId, classifica) {
  let n = 0
  ;(classifica.gp || []).forEach(gp => {
    getGareGP(gp).forEach(gara => {
      if (gara.completata && String(gara.pole_id) === String(pilotaId)) n++
    })
  })
  return n
}

function confrontaConteggi(conteggioA, conteggioB, maxPos = 25) {
  for (let pos = 1; pos <= maxPos; pos++) {
    const a = conteggioA[pos] || 0
    const b = conteggioB[pos] || 0
    if (a !== b) return a > b ? 1 : -1
  }
  return 0
}

function determinaTipoSpareggio(classifica) {
  if (classifica.nome === 'Formula 1') return 'f1'
  if (classifica.nome === 'Formula E') return 'fe'
  return classifica.tipo_spareggio || 'nessuno'
}

function chiVinceSpareggio(pilotaA, pilotaB, classifica) {
  const tipo = determinaTipoSpareggio(classifica)

  if (tipo === 'f2f3') {
    const featureA = contaPiazzamenti(pilotaA.id, classifica, 'featureRace')
    const featureB = contaPiazzamenti(pilotaB.id, classifica, 'featureRace')
    if ((featureA[1] || 0) !== (featureB[1] || 0)) return (featureA[1] || 0) > (featureB[1] || 0) ? 1 : -1
    const sprintA = contaPiazzamenti(pilotaA.id, classifica, 'f2sprint')
    const sprintB = contaPiazzamenti(pilotaB.id, classifica, 'f2sprint')
    if ((sprintA[1] || 0) !== (sprintB[1] || 0)) return (sprintA[1] || 0) > (sprintB[1] || 0) ? 1 : -1
    const tuttiA = contaPiazzamenti(pilotaA.id, classifica)
    const tuttiB = contaPiazzamenti(pilotaB.id, classifica)
    return confrontaConteggi(tuttiA, tuttiB)
  }

  if (tipo === 'fe') {
    const tuttiA = contaPiazzamenti(pilotaA.id, classifica)
    const tuttiB = contaPiazzamenti(pilotaB.id, classifica)
    const esito = confrontaConteggi(tuttiA, tuttiB)
    if (esito !== 0) return esito
    const poleA = contaPole(pilotaA.id, classifica)
    const poleB = contaPole(pilotaB.id, classifica)
    if (poleA !== poleB) return poleA > poleB ? 1 : -1
    return 0
  }

  if (tipo === 'f1') {
    const tuttiA = contaPiazzamenti(pilotaA.id, classifica)
    const tuttiB = contaPiazzamenti(pilotaB.id, classifica)
    return confrontaConteggi(tuttiA, tuttiB)
  }

  return 0
}

function calcolaPilotiInLotta(classifica) {
  const pilotiOrdinati = (classifica.piloti || []).filter(p => p.attivo).sort((a, b) => (b.punti || 0) - (a.punti || 0))
  if (pilotiOrdinati.length === 0) return []
  const leader = pilotiOrdinati[0]
  const puntiMax = calcolaPuntiMassimiRimanenti(classifica, 'pilota')
  return pilotiOrdinati.filter(p => {
    const massimoFinale = (p.punti || 0) + puntiMax
    if (massimoFinale > (leader.punti || 0)) return true
    if (massimoFinale === (leader.punti || 0)) {
      if (String(p.id) === String(leader.id)) return true
      return chiVinceSpareggio(p, leader, classifica) === 1
    }
    return false
  })
}

function elencoGareRimanenti(classifica) {
  const risultato = []
  ;(classifica.gp || []).filter(gp => !gp.completato).forEach(gp => {
    getGareGP(gp).forEach(gara => {
      if (!gara.completata) risultato.push({ gp, gara })
    })
  })
  return risultato
}

function trovaTuttiGliScenari(pilotaChiVince, rivali, classifica, maxScenari = 5) {
  if (!rivali || rivali.length === 0) return []
  const gareRimanenti = elencoGareRimanenti(classifica)
  if (gareRimanenti.length === 0) return []

  const maxPerGara = gareRimanenti.map(({ gara }) => puntiMassimiGaraPilota(gara, classifica))
  const suffixMax = new Array(gareRimanenti.length + 1).fill(0)
  for (let i = gareRimanenti.length - 1; i >= 0; i--) {
    suffixMax[i] = suffixMax[i + 1] + maxPerGara[i]
  }

  const bonusPole = classifica.punti_pole_attivo ? (Number(classifica.punti_pole_valore) || 0) : 0
  const bonusFL = classifica.giro_veloce_attivo ? (Number(classifica.giro_veloce_valore) || 0) : 0

  const combiBonus = [
    { pole: false, fl: false, valore: 0 },
    ...(bonusFL > 0 ? [{ pole: false, fl: true, valore: bonusFL }] : []),
    ...(bonusPole > 0 ? [{ pole: true, fl: false, valore: bonusPole }] : []),
    ...(bonusPole > 0 && bonusFL > 0 ? [{ pole: true, fl: true, valore: bonusPole + bonusFL }] : []),
  ]

  const scenari = []

  for (let i = 0; i < gareRimanenti.length; i++) {
    const { gp, gara } = gareRimanenti[i]
    const vettore = getVettorePuntiGara(gara, classifica).map(Number)
    const suffixDopo = suffixMax[i + 1]
    let trovatoInQuestaGara = false

    for (const combo of combiBonus) {
      if (trovatoInQuestaGara) break

      for (let posProtagonista = vettore.length; posProtagonista >= 1; posProtagonista--) {
        const puntiPosizione = vettore[posProtagonista - 1] || 0
        const puntiGarantitiProtagonista = (pilotaChiVince.punti || 0) + puntiPosizione + combo.valore

        const richiesteRivali = []
        let scenarioValido = true
        const bonusResiduoPerRivale = (combo.pole ? 0 : bonusPole) + (combo.fl ? 0 : bonusFL)

        for (const rivale of rivali) {
          let posRivaleTrovata = null
          for (let posRivale = 1; posRivale <= vettore.length + 5; posRivale++) {
            if (posRivale === posProtagonista) continue
            const puntiRivale = posRivale <= vettore.length ? vettore[posRivale - 1] : 0
            const massimoFinaleRivale = (rivale.punti || 0) + puntiRivale + bonusResiduoPerRivale + suffixDopo
            const paritaEVinceProtagonista = massimoFinaleRivale === puntiGarantitiProtagonista &&
              chiVinceSpareggio(pilotaChiVince, rivale, classifica) === 1
            if (massimoFinaleRivale < puntiGarantitiProtagonista || paritaEVinceProtagonista) {
              posRivaleTrovata = posRivale
              break
            }
          }
          if (posRivaleTrovata === null) { scenarioValido = false; break }
          richiesteRivali.push({
            nome: rivale.nome,
            id: rivale.id,
            posMin: posRivaleTrovata,
            fuoriPunti: posRivaleTrovata > vettore.length
          })
        }

        if (scenarioValido) {
          const richiesteRivaliVisibili = richiesteRivali.filter(r => r.posMin > 1)
          scenari.push({
            gpNome: gp.nome,
            garaLabel: nomeGaraLabel(gara),
            indiceGara: i,
            protagonista: pilotaChiVince.nome,
            posProtagonista,
            richiedePole: combo.pole,
            richiedeGiroVeloce: combo.fl,
            richiesteRivali,
            richiesteRivaliVisibili,
            rivaliSenzaVincoli: richiesteRivali.length - richiesteRivaliVisibili.length
          })
          trovatoInQuestaGara = true
          break
        }
      }
    }

    if (trovatoInQuestaGara && scenari.length >= maxScenari) break
  }

  return scenari
}

function trovaScenarioMultiGara(pilotaChiVince, rivali, classifica, maxGareBlocco = null) {
  const gareRimanenti = elencoGareRimanenti(classifica)
  if (gareRimanenti.length < 2) return null

  const numGare = maxGareBlocco ? Math.min(maxGareBlocco, gareRimanenti.length) : gareRimanenti.length
  const blocco = gareRimanenti.slice(0, numGare)
  const puntiBloccoMax = blocco.reduce((tot, { gara }) => tot + puntiMassimiGaraPilota(gara, classifica), 0)

  const maxPerGara = gareRimanenti.map(({ gara }) => puntiMassimiGaraPilota(gara, classifica))
  const suffixMax = new Array(gareRimanenti.length + 1).fill(0)
  for (let i = gareRimanenti.length - 1; i >= 0; i--) {
    suffixMax[i] = suffixMax[i + 1] + maxPerGara[i]
  }
  const suffixDopoBlocco = suffixMax[numGare]

  // Ordina i rivali dal più forte al più debole; considera solo i primi 2
  // come "rivali principali" con budget condiviso, stile comunicati ufficiali
  const rivaliOrdinati = [...rivali].sort((a, b) => (b.punti || 0) - (a.punti || 0))
  const rivalePiuForte = rivaliOrdinati[0]

  const vinceSeParoConPiuForte = chiVinceSpareggio(pilotaChiVince, rivalePiuForte, classifica) === 1
  const massimoRivalePiuForteScenario = (rivalePiuForte.punti || 0) + suffixDopoBlocco
  let T = massimoRivalePiuForteScenario - (pilotaChiVince.punti || 0) + (vinceSeParoConPiuForte ? 0 : 1)
  T = Math.max(0, Math.min(T, puntiBloccoMax))

  const gapDalLeader = puntiBloccoMax > 0 ? (T / puntiBloccoMax) : 0
  if (gapDalLeader >= 0.75) {
    T = puntiBloccoMax
  }

  const puntiFinaliPilota = (pilotaChiVince.punti || 0) + T
  const caps = rivaliOrdinati.map((rivale, idx) => {
    const vinceSeParo = chiVinceSpareggio(pilotaChiVince, rivale, classifica) === 1
    const capTotale = puntiFinaliPilota - (rivale.punti || 0) - (vinceSeParo ? 0 : 1)
    const capNelBlocco = Math.max(0, capTotale - suffixDopoBlocco)
    return { nome: rivale.nome, id: rivale.id, capPunti: Math.min(capNelBlocco, puntiBloccoMax), principale: idx === 0 }
  })

  const nomiGare = blocco.map(({ gp, gara }) => `${gp.nome} (${nomeGaraLabel(gara)})`)

  return {
    numGareCoinvolte: numGare,
    nomiGare,
    puntiTotaliRichiesti: T,
    puntiBloccoMax,
    caps: caps.filter(c => c.capPunti < puntiBloccoMax)
  }
}

function calcolaCombinazioniVittoria(pilota, classifica, maxScenari = 5) {
  const inLotta = calcolaPilotiInLotta(classifica)
  if (!inLotta.some(p => String(p.id) === String(pilota.id))) return { stato: 'fuori', scenari: [] }

  const rivali = inLotta.filter(p => String(p.id) !== String(pilota.id))
  if (rivali.length === 0) return { stato: 'campione', scenari: [] }

  const scenari = trovaTuttiGliScenari(pilota, rivali, classifica, maxScenari)
  if (scenari.length > 0) return { stato: 'ok', scenari }

  const multiGara = trovaScenarioMultiGara(pilota, rivali, classifica)
  if (multiGara) return { stato: 'ok_multigara', multiGara }

  return { stato: 'nessuno_scenario_singolo', scenari: [] }
}

function calcolaCombinazioniEliminazione(pilotaBersaglio, classifica, maxScenariPerRivale = 3) {
  const inLotta = calcolaPilotiInLotta(classifica)
  if (!inLotta.some(p => String(p.id) === String(pilotaBersaglio.id))) return { gruppi: [], multiGaraPerRivale: [] }

  const rivali = inLotta.filter(p => String(p.id) !== String(pilotaBersaglio.id))
  if (rivali.length === 0) return { gruppi: [], multiGaraPerRivale: [] }

  const gruppiPerRivale = []
  const multiGaraPerRivale = []
  for (const rivale of rivali) {
    const scenari = trovaTuttiGliScenari(rivale, [pilotaBersaglio], classifica, maxScenariPerRivale)
    if (scenari.length > 0) {
      gruppiPerRivale.push({ rivale: rivale.nome, rivaleId: rivale.id, scenari })
    } else {
      const multiGara = trovaScenarioMultiGara(rivale, [pilotaBersaglio], classifica)
      if (multiGara) multiGaraPerRivale.push({ rivale: rivale.nome, rivaleId: rivale.id, multiGara })
    }
  }
  return { gruppi: gruppiPerRivale, multiGaraPerRivale }
}

function calcolaCostruttoriInLotta(classifica) {
  const ordinati = (classifica.costruttori || []).slice().sort((a, b) => (b.punti || 0) - (a.punti || 0))
  if (ordinati.length === 0) return []
  const leader = ordinati[0]
  const puntiMax = calcolaPuntiMassimiRimanenti(classifica, 'costruttore')
  return ordinati.filter(c => ((c.punti || 0) + puntiMax) >= (leader.punti || 0))
}

function trovaClinchGaraSingolaCostruttore(costruttore, rivali, classifica) {
  const gpNonCompletati = (classifica.gp || []).filter(g => !g.completato)
  if (gpNonCompletati.length === 0) return null

  const maxPerGP = gpNonCompletati.map(gp => puntiMassimiGP(gp, classifica, true))
  const suffixMax = new Array(gpNonCompletati.length + 1).fill(0)
  for (let i = gpNonCompletati.length - 1; i >= 0; i--) {
    suffixMax[i] = suffixMax[i + 1] + maxPerGP[i]
  }

  for (let i = 0; i < gpNonCompletati.length; i++) {
    const gp = gpNonCompletati[i]
    const puntiMaxQuestoGP = maxPerGP[i]
    const suffixDopo = suffixMax[i + 1]

    for (let t = 0; t <= puntiMaxQuestoGP; t++) {
      const puntiGarantiti = (costruttore.punti || 0) + t
      const tuttiOk = rivali.every(rivale => {
        const massimoRivale = (rivale.punti || 0) + suffixDopo
        return massimoRivale < puntiGarantiti
      })
      if (tuttiOk) {
        return { gpNome: gp.nome, puntiOttenuti: t, puntiMaxGP: puntiMaxQuestoGP }
      }
    }
  }
  return null
}

function trovaScenarioMultiGaraCostruttore(costruttoreChiVince, rivali, classifica) {
  const gpNonCompletati = (classifica.gp || []).filter(g => !g.completato)
  if (gpNonCompletati.length === 0) return null

  const puntiBloccoMax = calcolaPuntiMassimiRimanenti(classifica, 'costruttore')

  // Ordina i rivali dal più forte al più debole; considera solo il rivale
  // più forte per calcolare il T minimo, non tutti insieme al massimo assoluto
  const rivaliOrdinati = [...rivali].sort((a, b) => (b.punti || 0) - (a.punti || 0))
  const rivalePiuForte = rivaliOrdinati[0]

  let T = (rivalePiuForte.punti || 0) - (costruttoreChiVince.punti || 0) + 1
  T = Math.max(0, Math.min(T, puntiBloccoMax))

  const gapDalLeader = puntiBloccoMax > 0 ? (T / puntiBloccoMax) : 0
  if (gapDalLeader >= 0.75) {
    T = puntiBloccoMax
  }

  const puntiFinaliProtagonista = (costruttoreChiVince.punti || 0) + T
  const caps = rivaliOrdinati.map(rivale => {
    const capPunti = puntiFinaliProtagonista - (rivale.punti || 0) - 1
    return {
      nome: rivale.nome,
      id: rivale.id,
      capPunti: Math.max(0, Math.min(capPunti, puntiBloccoMax)),
      bloccato: capPunti < 0
    }
  })

  return {
    numGP: gpNonCompletati.length,
    puntiTotaliRichiesti: T,
    puntiBloccoMax,
    caps: caps.filter(c => c.capPunti < puntiBloccoMax || c.bloccato),
    impossibile: caps.some(c => c.bloccato)
  }
}

function calcolaCombinazioniVittoriaCostruttore(costruttore, classifica) {
  const inLotta = calcolaCostruttoriInLotta(classifica)
  if (!inLotta.some(c => String(c.id) === String(costruttore.id))) return { stato: 'fuori' }

  const rivali = inLotta.filter(c => String(c.id) !== String(costruttore.id))
  if (rivali.length === 0) return { stato: 'campione' }

  const clinchSingolo = trovaClinchGaraSingolaCostruttore(costruttore, rivali, classifica)
  if (clinchSingolo) return { stato: 'ok_gara_singola', clinch: clinchSingolo }

  const multiGara = trovaScenarioMultiGaraCostruttore(costruttore, rivali, classifica)
  if (multiGara) return { stato: 'ok_multigara', multiGara }

  return { stato: 'nessuno_scenario' }
}

function calcolaEliminazioneCostruttore(costruttoreBersaglio, classifica) {
  const inLotta = calcolaCostruttoriInLotta(classifica)
  if (!inLotta.some(c => String(c.id) === String(costruttoreBersaglio.id))) return []

  const rivali = inLotta.filter(c => String(c.id) !== String(costruttoreBersaglio.id))
  return rivali
    .map(rivale => {
      const mg = trovaScenarioMultiGaraCostruttore(rivale, [costruttoreBersaglio], classifica)
      if (!mg) return null
      const capBersaglio = mg.caps.find(c => String(c.id) === String(costruttoreBersaglio.id))
      return {
        rivale: rivale.nome,
        rivaleId: rivale.id,
        puntiRichiesti: mg.puntiTotaliRichiesti,
        puntiDisponibili: mg.puntiBloccoMax,
        capBersaglio: capBersaglio ? capBersaglio.capPunti : null
      }
    })
    .filter(Boolean)
}

export default {
  calcolaPuntiAccorciati,
  calcolaPuntiPosizione,
  getVettorePuntiGara,
  getGareGP,
  puntiMassimiGP,
  puntiMassimiGaraPilota,
  puntiMassimiGaraCostruttore,
  calcolaPuntiMassimiRimanenti,
  calcolaPilotiInLotta,
  determinaTipoSpareggio,
  chiVinceSpareggio,
  trovaScenarioMultiGara,
  calcolaCombinazioniVittoria,
  calcolaCombinazioniEliminazione,
  calcolaCostruttoriInLotta,
  calcolaCombinazioniVittoriaCostruttore,
  calcolaEliminazioneCostruttore
}
