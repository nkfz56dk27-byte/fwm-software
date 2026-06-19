import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const JOLPICA_BASE_URL = 'https://api.jolpi.ca/ergast/f1'

export default function Statistiche({ onClose, user, isMobile, campionati }) {
  const [loading, setLoading] = useState(true)
  const [statistiche, setStatistiche] = useState({})
  const [selectedSeason, setSelectedSeason] = useState('current')
  const [currentSeason, setCurrentSeason] = useState(null)
  const [error, setError] = useState(null)
  const [selectedRace, setSelectedRace] = useState(null)
  const [selectedDriverId, setSelectedDriverId] = useState(null)
  const [selectedConstructorId, setSelectedConstructorId] = useState(null)
  const [archiviando, setArchiviando] = useState(false)
  const [showArchiveButton, setShowArchiveButton] = useState(false)

  useEffect(() => {
    caricaStatistiche()
  }, [selectedSeason])

  // Ricarica quando campionati cambia (per gestire il caricamento asincrono)
  useEffect(() => {
    if (campionati && campionati.length > 0) {
      const seasonYear = selectedSeason === 'current' ? parseInt(currentSeason) : parseInt(selectedSeason)
      if (seasonYear >= 2026) {
        caricaDatiLocali(seasonYear)
      }
    }
  }, [campionati])

  // Mostra bottone archivio da metà dicembre in poi
  useEffect(() => {
    const today = new Date()
    const month = today.getMonth() // 0-11, dicembre=11
    const day = today.getDate()
    
    // Mostra da 15 dicembre a 31 dicembre
    if (month === 11 && day >= 15) {
      setShowArchiveButton(true)
      
      // Auto-archivio il 31 dicembre
      if (day === 31 && selectedSeason === 'current') {
        console.log('[AUTO-ARCHIVE] 31 dicembre rilevato, archivio stagione in corso...')
        archiviaSeasoneCorrente(true)
      }
    } else {
      setShowArchiveButton(false)
    }
  }, [selectedSeason, statistiche])

  const fetchFromJolpica = async (endpoint) => {
    try {
      const response = await fetch(`${JOLPICA_BASE_URL}${endpoint}`)
      if (!response.ok) {
        // Jolpica returns 400 for some endpoints (e.g. laps/pitstops for 'current')
        // Return an empty MRData structure for 400/404 to handle gracefully
        if (response.status === 400 || response.status === 404) {
          console.warn(`Jolpica ${endpoint} returned ${response.status}; returning empty MRData`)
          return { MRData: { RaceTable: { Races: [] }, total: '0' } }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      return data
    } catch (error) {
      console.error(`Errore fetch da Jolpica (${endpoint}):`, error)
      // In case of network errors, return empty structure to keep UI stable
      return { MRData: { RaceTable: { Races: [] } } }
    }
  }

  const formatDateItalian = (dateString) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  const archiviaSeasoneCorrente = async (isAuto = false) => {
    try {
      if (!currentSeason || !statistiche.driverStandings) {
        setError('Dati insufficienti per archiviare la stagione')
        return
      }

      setArchiviando(true)

      const archiveData = {
        season: parseInt(currentSeason),
        data_archiviazione: new Date().toISOString(),
        driver_standings_json: statistiche.driverStandings || [],
        constructor_standings_json: statistiche.constructorStandings || [],
        results_json: statistiche.results || [],
        qualifying_json: statistiche.qualifying || [],
        races_json: statistiche.races || [],
        drivers_json: statistiche.drivers || [],
        constructors_json: statistiche.constructors || []
      }

      // Salva in Supabase
      const { data, error: insertError } = await supabase
        .from('f1_seasons_archive')
        .upsert([archiveData], { onConflict: 'season' })

      if (insertError) throw insertError

      // Genera download JSON se manuale
      if (!isAuto) {
        const jsonStr = JSON.stringify(archiveData, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `f1_season_${currentSeason}_backup_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      console.log(`[ARCHIVE] Stagione ${currentSeason} archiviata${isAuto ? ' (auto)' : ' (manuale)'}`)
      if (!isAuto) {
        setError(null)
      }
    } catch (error) {
      console.error('Errore archiviazione stagione:', error)
      if (!isAuto) {
        setError(`Errore archiviazione: ${error.message}`)
      }
    } finally {
      setArchiviando(false)
    }
  }

  const getResultsForRace = (race) => {
    return race?.Results || race?.SprintResults || race?.Sprint || race?.RaceResults || []
  }

  const calculateDriverStats = (driverId, results, qualifying, status) => {
    // La struttura corretta dell'API è: results è un array di race, ogni race ha Results array
    const driverResults = results?.flatMap(race =>
      race.Results?.filter(result => result.Driver?.driverId === driverId) || []
    ) || []

    const driverQualifying = qualifying?.flatMap(race =>
      race.QualifyingResults?.filter(q => q.Driver?.driverId === driverId) || []
    ) || []

    // Calcola vittorie
    const wins = driverResults.filter(r => r.position === '1').length

    // Calcola podi (posizioni 1, 2, 3)
    const podiums = driverResults.filter(r => ['1', '2', '3'].includes(r.position)).length

    // Calcola pole positions
    const polePositions = driverQualifying.filter(q => q.position === '1').length

    // Calcola DNF (Did Not Finish) - status che indicano ritiro
    const dnfStatuses = ['Retired', 'Accident', 'Spun off', 'Engine', 'Gearbox', 'Transmission', 'Hydraulics', 'Electrical', 'Suspension', 'Brakes', 'Tyre', 'Overheating', 'Mechanical', 'Collision', 'Puncture']
    const dnf = driverResults.filter(r => dnfStatuses.includes(r.status)).length

    // Calcola DSQ (Disqualified)
    const dsq = driverResults.filter(r => r.status === 'Disqualified').length

    // Calcola ultima vittoria - la data viene dalla race, non dal result
    const winsWithDates = results
      ?.filter(race =>
        race.Results?.some(result => result.Driver?.driverId === driverId && result.position === '1')
      )
      .map(race => ({
        date: race.date,
        raceName: race.raceName
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)) || []

    const lastWin = winsWithDates.length > 0 ? winsWithDates[0] : null

    // Calcola giorni senza vittorie
    let daysSinceLastWin = null
    if (lastWin) {
      const lastWinDate = new Date(lastWin.date)
      const today = new Date()
      const diffTime = Math.abs(today - lastWinDate)
      daysSinceLastWin = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    } else if (wins === 0 && driverResults.length > 0) {
      // Se non ha mai vinto, calcola giorni dal debutto
      const firstRaceDate = results
        ?.filter(race =>
          race.Results?.some(result => result.Driver?.driverId === driverId)
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0]?.date

      if (firstRaceDate) {
        const debutDate = new Date(firstRaceDate)
        const today = new Date()
        const diffTime = Math.abs(today - debutDate)
        daysSinceLastWin = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }
    }

    return {
      wins,
      podiums,
      polePositions,
      dnf,
      dsq,
      lastWin,
      daysSinceLastWin
    }
  }

  const caricaStatistiche = async () => {
    try {
      setLoading(true)
      setError(null)

      const season = selectedSeason === 'current' ? 'current' : selectedSeason
      const seasonParam = season === 'current' ? 'current' : season

      // Recupera la stagione corrente
      const currentSeasonData = await fetchFromJolpica('/current.json')
      const currentSeasonYear = currentSeasonData?.MRData?.RaceTable?.Races?.[0]?.season
      setCurrentSeason(currentSeasonYear)

      // Determina l'anno della stagione da caricare
      let seasonYear
      if (selectedSeason === 'current') {
        seasonYear = parseInt(currentSeasonYear)
      } else {
        seasonYear = parseInt(selectedSeason)
      }

      const apiSeasonParam = seasonParam === 'current' && currentSeasonYear ? currentSeasonYear : seasonParam

      // Strategie di caricamento:
      // - Stagione corrente: classifiche dal locale (aggiornate), dettagli gara dall'API
      // - Stagioni passate (< corrente): sempre API (anche se >=2026)
      // - Stagioni esplicite >=2026 E uguali a corrente: tutto dal locale
      // - Altre stagioni: tutto dall'API
      if (selectedSeason === 'current' && campionati && campionati.length > 0) {
        // Misto: classifiche locali + dettagli gara API
        await caricaDatiMisti(parseInt(currentSeasonYear), apiSeasonParam)
      } else if (seasonYear >= 2026 && seasonYear === parseInt(currentSeasonYear) && campionati && campionati.length > 0) {
        // Stagione esplicita >=2026 E uguale alla stagione corrente: tutto dal locale
        await caricaDatiLocali(seasonYear)
      } else {
        // Stagioni passate o <2026: tutto dall'API
        await caricaDatiAPI(apiSeasonParam)
      }
    } catch (error) {
      console.error('Errore caricamento statistiche:', error)
      setError('Impossibile caricare le statistiche. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  const caricaDatiAPI = async (seasonParam) => {
    // Funzione helper per recuperare tutti i dati con paginazione
    const fetchAllData = async (endpoint) => {
      try {
        let allData = []
        let offset = 0
        const limit = 100
        let hasMore = true

        while (hasMore) {
          const data = await fetchFromJolpica(`${endpoint}?limit=${limit}&offset=${offset}`)
          const items = data?.MRData?.RaceTable?.Races || []
          allData = allData.concat(items)

          const total = parseInt(data?.MRData?.total || '0')
          hasMore = allData.length < total && items.length > 0
          offset += limit
        }

        // Rimuovi duplicati basandoti su season + round
        const uniqueData = allData.filter((race, index, self) =>
          index === self.findIndex(r => r.season === race.season && r.round === race.round)
        )

        return { MRData: { RaceTable: { Races: uniqueData } } }
      } catch (error) {
        console.error('Errore in fetchAllData per', endpoint, error)
        return { MRData: { RaceTable: { Races: [] } } }
      }
    }

    // Recupera TUTTI i dati disponibili dall'API Jolpica F1 senza limiti
    // Fetch dei dati principali
    const [
      driversData,
      constructorsData,
      racesData,
      standingsData,
      constructorStandingsData,
      seasonsData,
      resultsData,
      qualifyingData,
      sprintData,
      statusData
    ] = await Promise.all([
      fetchFromJolpica(`/${seasonParam}/drivers.json`),
      fetchFromJolpica(`/${seasonParam}/constructors.json`),
      fetchFromJolpica(`/${seasonParam}/races.json`),
      fetchFromJolpica(`/${seasonParam}/driverStandings.json`),
      fetchFromJolpica(`/${seasonParam}/constructorStandings.json`),
      fetchFromJolpica(`/seasons.json?limit=1000`),
      fetchAllData(`/${seasonParam}/results.json`),
      fetchAllData(`/${seasonParam}/qualifying.json`),
      fetchAllData(`/${seasonParam}/sprint.json`),
      fetchFromJolpica(`/${seasonParam}/status.json`)
    ])

    // Fetch separati per laps e pitstops (possono fallire con 'current')
    let lapsData = null
    let pitstopsData = null
    try {
      lapsData = await fetchFromJolpica(`/${seasonParam}/laps.json`)
    } catch (error) {
      console.warn('Errore fetch laps.json:', error)
    }
    try {
      pitstopsData = await fetchFromJolpica(`/${seasonParam}/pitstops.json`)
    } catch (error) {
      console.warn('Errore fetch pitstops.json:', error)
    }

    // Estrai circuiti dalle gare per ottenere dati location completi
    const circuitsFromRaces = racesData?.MRData?.RaceTable?.Races?.map(race => race.Circuit) || []
    const uniqueCircuits = circuitsFromRaces.filter((circuit, index, self) =>
      index === self.findIndex(c => c.circuitId === circuit.circuitId)
    )

    const drivers = driversData?.MRData?.DriverTable?.Drivers || []
    const results = resultsData?.MRData?.RaceTable?.Races || []
    const qualifying = qualifyingData?.MRData?.RaceTable?.Races || []
    const status = statusData?.MRData?.StatusTable?.Status || []

    // Calcola statistiche per ogni pilota
    const driversWithStats = drivers.map(driver => ({
      ...driver,
      stats: calculateDriverStats(driver.driverId, results, qualifying, status)
    }))

    setStatistiche({
      drivers: driversWithStats,
      constructors: constructorsData?.MRData?.ConstructorTable?.Constructors || [],
      circuits: uniqueCircuits,
      races: racesData?.MRData?.RaceTable?.Races || [],
      driverStandings: standingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [],
      constructorStandings: constructorStandingsData?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [],
      seasons: seasonsData?.MRData?.SeasonTable?.Seasons || [],
      results: results,
      qualifying: qualifying,
      laps: lapsData?.MRData?.RaceTable?.Races || [],
      pitstops: pitstopsData?.MRData?.RaceTable?.Races || [],
      sprint: sprintData?.MRData?.RaceTable?.Races || [],
      status: status
    })
  }

  const caricaDatiMisti = async (currentSeasonYear, apiSeasonParam) => {
    // Carica le classifiche dal locale (aggiornate in tempo reale)
    // ma i dettagli gara (risultati, qualifiche, gara) dall'API
    
    // Recupera i dati locali per le classifiche
    const campionatoF1 = campionati?.find(c => c.nome.includes('Formula 1'))
    if (!campionatoF1) {
      // Nessun dato locale, usa solo API
      await caricaDatiAPI(apiSeasonParam)
      return
    }

    const piloti = campionatoF1.piloti || []
    const costruttori = campionatoF1.costruttori || []

    // Recupera dati dall'API per i dettagli gara
    const fetchAllData = async (endpoint) => {
      try {
        let allData = []
        let offset = 0
        const limit = 100
        let hasMore = true

        while (hasMore) {
          const data = await fetchFromJolpica(`${endpoint}?limit=${limit}&offset=${offset}`)
          const items = data?.MRData?.RaceTable?.Races || []
          allData = allData.concat(items)

          const total = parseInt(data?.MRData?.total || '0')
          hasMore = allData.length < total && items.length > 0
          offset += limit
        }

        const uniqueData = allData.filter((race, index, self) =>
          index === self.findIndex(r => r.season === race.season && r.round === race.round)
        )

        return { MRData: { RaceTable: { Races: uniqueData } } }
      } catch (error) {
        console.error('Errore in fetchAllData per', endpoint, error)
        return { MRData: { RaceTable: { Races: [] } } }
      }
    }

    // Fetch dati da API per dettagli gara e costruttori
    const [
      driversData,
      constructorsData,
      racesData,
      seasonsData,
      resultsData,
      qualifyingData,
      sprintData,
      statusData
    ] = await Promise.all([
      fetchFromJolpica(`/${apiSeasonParam}/drivers.json`),
      fetchFromJolpica(`/${apiSeasonParam}/constructors.json`),
      fetchFromJolpica(`/${apiSeasonParam}/races.json`),
      fetchFromJolpica(`/seasons.json?limit=1000`),
      fetchAllData(`/${apiSeasonParam}/results.json`),
      fetchAllData(`/${apiSeasonParam}/qualifying.json`),
      fetchAllData(`/${apiSeasonParam}/sprint.json`),
      fetchFromJolpica(`/${apiSeasonParam}/status.json`)
    ])

    // Estrai circuiti dalle gare API
    const circuitsFromRaces = racesData?.MRData?.RaceTable?.Races?.map(race => race.Circuit) || []
    const uniqueCircuits = circuitsFromRaces.filter((circuit, index, self) =>
      index === self.findIndex(c => c.circuitId === circuit.circuitId)
    )

    const drivers = driversData?.MRData?.DriverTable?.Drivers || []
    const results = resultsData?.MRData?.RaceTable?.Races || []
    const qualifying = qualifyingData?.MRData?.RaceTable?.Races || []
    const status = statusData?.MRData?.StatusTable?.Status || []

    // Calcola statistiche per ogni pilota (dai dati API)
    const driversWithStats = drivers.map(driver => ({
      ...driver,
      stats: calculateDriverStats(driver.driverId, results, qualifying, status)
    }))

    // Calcola le classifiche dai dati LOCALI (sempre aggiornate)
    const driverStandings = piloti.map(pilota => ({
      Driver: {
        driverId: pilota.id?.toString() || pilota.nome?.toLowerCase().replace(/\s/g, '_'),
        givenName: pilota.nome || '',
        familyName: pilota.cognome || '',
        permanentNumber: pilota.numero?.toString() || ''
      },
      points: pilota.punti || 0,
      position: piloti.sort((a, b) => (b.punti || 0) - (a.punti || 0)).findIndex(p => p.id === pilota.id) + 1
    })).sort((a, b) => b.points - a.points)

    const constructorStandings = costruttori.map(costruttore => ({
      Constructor: {
        constructorId: costruttore.id?.toString() || costruttore.nome?.toLowerCase().replace(/\s/g, '_'),
        name: costruttore.nome || ''
      },
      points: costruttore.punti || 0,
      position: costruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)).findIndex(c => c.id === costruttore.id) + 1
    })).sort((a, b) => b.points - a.points)

    setStatistiche({
      drivers: driversWithStats,
      constructors: constructorsData?.MRData?.ConstructorTable?.Constructors || [],
      circuits: uniqueCircuits,
      races: racesData?.MRData?.RaceTable?.Races || [],
      driverStandings: driverStandings,
      constructorStandings: constructorStandings,
      seasons: seasonsData?.MRData?.SeasonTable?.Seasons || [],
      results: results,
      qualifying: qualifying,
      laps: [],
      pitstops: [],
      sprint: sprintData?.MRData?.RaceTable?.Races || [],
      status: status
    })
  }

  const caricaDatiLocali = async (seasonYear) => {
    // loading local championship data for season

    // Trova il campionato F1 per la stagione specificata
    // Prima cerca solo "Formula 1" per vedere la struttura
    const campionatoF1 = campionati?.find(c => c.nome.includes('Formula 1'))

    if (!campionatoF1) {
      // no local F1 championship found
    }

    if (!campionatoF1) {
      setError(`Nessun campionato F1 trovato per la stagione ${seasonYear}`)
      setStatistiche({})
      return
    }

    // Estrai i dati dal campionato locale
    const gp = campionatoF1.gp || []
    const piloti = campionatoF1.piloti || []
    const costruttori = campionatoF1.costruttori || []

    // Recupera le date delle gare, il calendario completo e i circuiti dall'API
    let raceDates = {}
    let apiRaces = []
    let apiCircuits = {}
    try {
      const racesData = await fetchFromJolpica(`/${seasonYear}.json`)
      apiRaces = racesData?.MRData?.RaceTable?.Races || []
      apiRaces.forEach(race => {
        raceDates[race.round] = race.date
        // Estrai i circuiti
        if (race.Circuit) {
          apiCircuits[race.Circuit.circuitId] = race.Circuit
        }
      })
      // api races/circuits loaded
    } catch (error) {
      console.error('Errore recupero date gare dall\'API:', error)
    }

    // Recupera piloti e costruttori dall'API per ottenere le nazionalità
    let apiDrivers = []
    let apiConstructors = []
    try {
      const driversData = await fetchFromJolpica(`/${seasonYear}/drivers.json`)
      apiDrivers = driversData?.MRData?.DriverTable?.Drivers || []
      // api drivers loaded
    } catch (error) {
      console.error('Errore recupero piloti dall\'API:', error)
    }

    try {
      const constructorsData = await fetchFromJolpica(`/${seasonYear}/constructors.json`)
      apiConstructors = constructorsData?.MRData?.ConstructorTable?.Constructors || []
      // api constructors loaded
    } catch (error) {
      console.error('Errore recupero costruttori dall\'API:', error)
    }

    // Recupera tutte le stagioni storiche dall'API per il selettore
    let seasons = []
    try {
      const seasonsData = await fetchFromJolpica('/seasons.json?limit=100')
      seasons = seasonsData?.MRData?.SeasonTable?.Seasons || []
      // seasons loaded
    } catch (error) {
      console.error('Errore recupero stagioni storiche dall\'API:', error)
    }

    // Converti i dati locali nel formato atteso da Statistiche
    // Per il calendario, usa i dati dell'API se disponibili, altrimenti usa i dati locali
    const localRaceItems = gp.flatMap((gpItem, gpIndex) => {
      if (gpItem.gare && Array.isArray(gpItem.gare) && gpItem.gare.length > 0) {
        return gpItem.gare.map((gara, garaIndex) => ({
          season: seasonYear.toString(),
          round: (gpIndex + 1).toString(),
          raceName: gara.nome || gpItem.nome || `GP ${gpIndex + 1}`,
          date: gara.data || gpItem.data || '',
          circuito: gpItem.circuito || gara.circuito || 'Circuito',
          circuitoLocation: {
            locality: gpItem.luogo || gara.luogo || '',
            country: gpItem.paese || gara.paese || ''
          },
          tipiGara: gara.tipo_gara || gpItem.tipo_gara || 'principale',
          localGpIndex: gpIndex,
          localRaceIndex: garaIndex,
          originalRace: gara,
          originalGp: gpItem
        }))
      }
      return [{
        season: seasonYear.toString(),
        round: (gpIndex + 1).toString(),
        raceName: gpItem.nome || `GP ${gpIndex + 1}`,
        date: gpItem.data || '',
        circuito: gpItem.circuito || 'Circuito',
        circuitoLocation: {
          locality: gpItem.luogo || '',
          country: gpItem.paese || ''
        },
        tipiGara: gpItem.tipo_gara || 'principale',
        localGpIndex: gpIndex,
        localRaceIndex: 0,
        originalRace: gpItem,
        originalGp: gpItem
      }]
    })

    const races = apiRaces.length > 0 ? apiRaces : localRaceItems.map((item, index) => ({
      season: item.season,
      round: item.round,
      raceName: item.raceName,
      date: item.date,
      circuitName: item.circuito,
      Circuit: {
        circuitId: `circuit_${item.localGpIndex}`,
        circuitName: item.circuito,
        Location: {
          locality: item.circuitoLocation.locality,
          country: item.circuitoLocation.country
        }
      }
    }))

    // Estrai i risultati dalle gare
    const results = localRaceItems.map((item, index) => {
      const gara = item.originalRace
      return {
        season: item.season,
        round: item.round,
        raceName: item.raceName,
        date: item.date,
        Results: gara.risultati ? Object.entries(gara.risultati).map(([pilotaId, posizione]) => {
          const pilota = piloti.find(p => String(p.id) === String(pilotaId))

          // normalizza posizione che può essere numero o oggetto { posizione, flag, time, points }
          let pos = ''
          let status = undefined
          let time = undefined
          let points = 0

          if (posizione && typeof posizione === 'object') {
            // try common keys for position
            const posKeys = ['posizione', 'position', 'pos', 'positionText', 'position_text']
            let foundPos = undefined
            for (const k of posKeys) {
              if (posizione[k] !== undefined && posizione[k] !== null) {
                foundPos = posizione[k]
                break
              }
            }
            if (foundPos !== undefined) {
              pos = String(foundPos)
            } else {
              // fallback: if object serializes to meaningful string, skip; else leave empty
              pos = ''
            }

            status = posizione.flag || posizione.status || posizione.stato || undefined
            if (posizione.time) time = { time: posizione.time }
            else if (posizione.tempo) time = { time: posizione.tempo }
            else if (posizione.Time && posizione.Time.time) time = { time: posizione.Time.time }

            const pts = posizione.points ?? posizione.punti
            if (pts !== undefined && !isNaN(Number(pts))) points = Number(pts)
          } else if (typeof posizione === 'string') {
            // strings might be numeric positions or status codes like 'DNF'
            const n = Number(posizione)
            if (!isNaN(n)) pos = String(n)
            else status = posizione
          } else if (typeof posizione === 'number') {
            pos = String(posizione)
          }

          const driverId = pilota?.id ? String(pilota.id) : String(pilotaId)

          return {
            position: pos,
            positionText: pos,
            number: pilota?.numero ? String(pilota.numero) : undefined,
            points: points,
            status: status,
            Time: time,
            Driver: {
              driverId: driverId,
              givenName: pilota?.nome || driverId,
              familyName: pilota?.cognome || '',
              permanentNumber: pilota?.numero ? String(pilota.numero) : ''
            },
            Constructor: {
              name: pilota?.costruttore || (gara.costruttore || '')
            }
          }
        }) : []
      }
    })

    // Calcola le classifiche dai dati locali
    const driverStandings = piloti.map(pilota => ({
      Driver: {
        driverId: pilota.id?.toString() || pilota.nome?.toLowerCase().replace(/\s/g, '_'),
        givenName: pilota.nome || '',
        familyName: pilota.cognome || '',
        permanentNumber: pilota.numero?.toString() || ''
      },
      points: pilota.punti || 0,
      position: piloti.sort((a, b) => (b.punti || 0) - (a.punti || 0)).findIndex(p => p.id === pilota.id) + 1
    })).sort((a, b) => b.points - a.points)

    const constructorStandings = costruttori.map(costruttore => ({
      Constructor: {
        constructorId: costruttore.id?.toString() || costruttore.nome?.toLowerCase().replace(/\s/g, '_'),
        name: costruttore.nome || ''
      },
      points: costruttore.punti || 0,
      position: costruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)).findIndex(c => c.id === costruttore.id) + 1
    })).sort((a, b) => b.points - a.points)

    // Calcola statistiche per ogni pilota dai dati locali
    // Aggiungi nazionalità dall'API se disponibile
    const driversWithStats = piloti.map(pilota => {
      let wins = 0
      let podiums = 0
      let dnf = 0
      let dsq = 0
      let poles = 0
      let lastWinRound = null

      // Cerca la nazionalità del pilota nell'API
      // Mapping manuale per nomi locali che non corrispondono all'API
      const driverMapping = {
        'Sergio Perez': 'Sergio Pérez',
        'Nico Hulkenberg': 'Nico Hülkenberg'
      }

      const mappedName = driverMapping[pilota.cognome ? `${pilota.nome} ${pilota.cognome}` : pilota.nome] || (pilota.cognome ? `${pilota.nome} ${pilota.cognome}` : pilota.nome)

      const apiDriver = apiDrivers.find(d => {
        const driverName = `${d.givenName} ${d.familyName}`.toLowerCase()
        const localName = mappedName?.toLowerCase()
        return driverName === localName ||
               d.familyName?.toLowerCase() === pilota.cognome?.toLowerCase() ||
               (pilota.cognome && d.familyName?.toLowerCase() === pilota.cognome?.toLowerCase()) ||
               (!pilota.cognome && driverName.includes(pilota.nome?.toLowerCase()))
      })

      const nationality = apiDriver?.nationality || ''

      if (!nationality) {
          // nationality for pilot not found in API mapping
      }

      // Itera su tutti i GP per calcolare le statistiche
      gp.forEach((gpItem, gpIndex) => {
        // Itera su tutte le gare del GP (sprint, principale, feature race, etc.)
        if (gpItem.gare && Array.isArray(gpItem.gare)) {
          gpItem.gare.forEach(gara => {
            // Controlla risultati della gara
            if (gara.risultati && gara.risultati[pilota.id]) {
              const risultato = gara.risultati[pilota.id]
              const posizione = parseInt(risultato?.posizione)
              if (posizione === 1) {
                wins++
                // Aggiorna round dell'ultima vittoria (usando l'indice del GP)
                lastWinRound = gpIndex + 1
              }
              if (posizione >= 1 && posizione <= 3) podiums++

              // Controlla flag per DNF, DSQ, DNS
              if (risultato?.flag) {
                const flag = risultato.flag
                if (flag === 'DNF') dnf++
                if (flag === 'DSQ') dsq++
              }
            }

            // Controlla qualifiche per pole position (solo per gara principale)
            if (gara.tipo_gara === 'principale' || gara.tipo_gara === 'featureRace') {
              if (gara.qualifiche && gara.qualifiche[pilota.id]) {
                const qualifica = gara.qualifiche[pilota.id]
                const posizioneQualifica = parseInt(qualifica?.posizione)
                if (posizioneQualifica === 1) poles++
              }
            }
          })
        }
      })

      // Calcola giorni senza vittorie usando le date dell'API
      let daysSinceLastWin = null
      if (lastWinRound && raceDates[lastWinRound.toString()]) {
        const winDate = new Date(raceDates[lastWinRound.toString()])
        const today = new Date()
        const diffTime = Math.abs(today - winDate)
        daysSinceLastWin = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      return {
        driverId: pilota.id?.toString() || pilota.nome?.toLowerCase().replace(/\s/g, '_'),
        givenName: pilota.nome || '',
        familyName: pilota.cognome || '',
        permanentNumber: pilota.numero?.toString() || '',
        nationality: nationality,
        stats: {
          dnf: dnf,
          dsq: dsq,
          wins: wins,
          podiums: podiums,
          poles: poles,
          daysSinceLastWin: daysSinceLastWin
        }
      }
    })

    // Aggiungi nazionalità ai costruttori dall'API
    const constructorsWithNationality = costruttori.map(costruttore => {
      // Mapping manuale per nomi locali che non corrispondono all'API
      const constructorMapping = {
        'Racing Bulls': 'Red Bull',
        'RB': 'Red Bull'
      }

      const mappedName = constructorMapping[costruttore.nome] || costruttore.nome

      const apiConstructor = apiConstructors.find(c => {
        const constructorName = c.name?.toLowerCase()
        const localName = mappedName?.toLowerCase()
        return constructorName === localName || constructorName?.includes(localName) || localName?.includes(constructorName)
      })

      const nationality = apiConstructor?.nationality || ''

      // constructor nationality mapping attempted

      return {
        constructorId: costruttore.id?.toString() || costruttore.nome?.toLowerCase().replace(/\s/g, '_'),
        name: costruttore.nome || '',
        nationality: nationality
      }
    })

    // Usa i circuiti dell'API se disponibili, altrimenti array vuoto
    const circuits = Object.keys(apiCircuits).length > 0 ? Object.values(apiCircuits) : []

    const statisticheData = {
      drivers: driversWithStats,
      constructors: constructorsWithNationality,
      circuits: circuits,
      races: races,
      driverStandings: driverStandings,
      constructorStandings: constructorStandings,
      seasons: seasons,
      results: results,
      qualifying: [],
      laps: [],
      pitstops: [],
      sprint: [],
      status: []
    }

    setStatistiche(statisticheData)
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'url(/sfondo-fwm.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: '20px',
          color: '#FFF',
          fontSize: '18px'
        }}>
          Caricamento statistiche...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundImage: 'url(/sfondo-fwm.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        position: 'absolute',
        top: isMobile ? '80px' : '20px',
        left: '20px',
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'center',
        zIndex: 100
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: '#007AFF',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}>
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
          Indietro
        </button>
      </div>

      <div style={{
        background: 'rgba(0, 0, 0, 0.85)',
        border: '2px solid rgba(51, 51, 51, 0.8)',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '1200px',
        width: '100%',
        color: '#FFF',
        marginTop: isMobile ? '100px' : '60px',
        marginBottom: '20px'
      }}>
        <h2 style={{
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: 'bold',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          STATISTICHE F1
        </h2>

        {error && (
          <div style={{
            background: 'rgba(255, 0, 0, 0.2)',
            border: '1px solid rgba(255, 0, 0, 0.5)',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px',
            textAlign: 'center',
            color: '#FF6B6B'
          }}>
            {error}
          </div>
        )}

        {/* Season Selector */}
        <div style={{
          marginBottom: '30px',
          display: 'flex',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setSelectedSeason('current')}
            style={{
              padding: '10px 20px',
              background: selectedSeason === 'current' ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
              border: selectedSeason === 'current' ? '2px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: '#FFF',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Stagione Corrente
          </button>
          {statistiche.seasons?.filter(season => season.season !== currentSeason).sort((a, b) => b.season - a.season).map(season => (
            <button
              key={season.season}
              onClick={() => setSelectedSeason(season.season)}
              style={{
                padding: '10px 20px',
                background: selectedSeason === season.season ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
                border: selectedSeason === season.season ? '2px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: '#FFF',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {season.season}
            </button>
          ))}
          
          {/* Archive Button - visible from Dec 15 onwards */}
          {showArchiveButton && selectedSeason === 'current' && (
            <button
              onClick={() => archiviaSeasoneCorrente(false)}
              disabled={archiviando}
              style={{
                padding: '10px 20px',
                background: archiviando ? 'rgba(76, 175, 80, 0.5)' : '#4CAF50',
                border: '2px solid rgba(76, 175, 80, 0.8)',
                borderRadius: '8px',
                color: '#FFF',
                cursor: archiviando ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                marginLeft: '15px',
                opacity: archiviando ? 0.6 : 1
              }}
            >
              {archiviando ? '⏳ Archiviando...' : '💾 Archivia Stagione'}
            </button>
          )}
        </div>

        {/* Statistics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '20px'
        }}>
          {/* Drivers */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Piloti ({statistiche.drivers?.length || 0})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.drivers?.map(driver => (
                <div key={driver.driverId} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>{driver.givenName} {driver.familyName}</span>
                    <span style={{ color: '#AAA' }}>{driver.nationality}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <span>Vittorie: {driver.stats?.wins || 0}</span>
                    <span>Podi: {driver.stats?.podiums || 0}</span>
                    <span>Pole: {driver.stats?.polePositions || 0}</span>
                    <span>DNF: {driver.stats?.dnf || 0}</span>
                    <span>DSQ: {driver.stats?.dsq || 0}</span>
                    {driver.stats?.lastWin && (
                      <span>Ultima vittoria: {formatDateItalian(driver.stats.lastWin.date)}</span>
                    )}
                    {driver.stats?.daysSinceLastWin !== null && (
                      <span>Giorni senza vittoria: {driver.stats.daysSinceLastWin}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Constructors */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Costruttori ({statistiche.constructors?.length || 0})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.constructors?.map(constructor => (
                <div key={constructor.constructorId} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{constructor.name}</span>
                  <span style={{ color: '#AAA' }}>{constructor.nationality}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Circuits */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Circuiti ({statistiche.circuits?.length || 0})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.circuits?.slice(0, 20).map(circuit => (
                <div key={circuit.circuitId} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div>{circuit.circuitName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{circuit.Location?.locality}, {circuit.Location?.country}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Races */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Calendario stagione ({statistiche.races?.length || 0})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.races?.map((race, index) => (
                <div key={`${race.season}-${race.round}-${index}`} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)} {race.circuitName}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Driver Standings */}
        {statistiche.driverStandings?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Classifica Piloti
            </h3>
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.driverStandings.map((standing, index) => (
                <div
                  key={standing.Driver?.driverId}
                  onClick={() => { console.log('FWM_LOG DRIVER_STANDING', standing); setSelectedDriverId(selectedDriverId === standing.Driver?.driverId ? null : standing.Driver?.driverId) }}
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: selectedDriverId === standing.Driver?.driverId ? 'rgba(0, 122, 255, 0.08)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{
                      fontWeight: 'bold',
                      color: index < 3 ? '#FFD700' : '#FFF',
                      minWidth: '30px'
                    }}>
                      {standing.position}
                    </span>
                    <span>{standing.Driver?.givenName} {standing.Driver?.familyName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ color: '#AAA' }}>{standing.Constructors?.[0]?.name}</span>
                    <span style={{
                      fontWeight: 'bold',
                      color: '#007AFF',
                      minWidth: '50px',
                      textAlign: 'right'
                    }}>
                      {standing.points}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Driver Details */}
        {selectedDriverId && statistiche.results && (() => {
          const driverResults = statistiche.results.flatMap(race => 
            getResultsForRace(race).filter(res => res.Driver?.driverId === selectedDriverId).map(res => ({ race, res }))
          )
          return (
            <div style={{
              marginTop: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h4 style={{ color: '#00A0FF', marginBottom: '10px' }}>Risultati Pilota</h4>
              {driverResults.length > 0 ? (
                <div style={{ fontSize: '13px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '12px' }}>Gara</th>
                        <th style={{ textAlign: 'center', padding: '6px', fontSize: '12px' }}>Pos</th>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '12px' }}>Team</th>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '12px' }}>Risultato</th>
                        <th style={{ textAlign: 'center', padding: '6px', fontSize: '12px' }}>Punti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverResults.map(({ race, res }) => (
                        <tr key={`${race.season}-${race.round}-${res.Driver.driverId}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{race.raceName}</td>
                          <td style={{ padding: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', color: res.position === '1' ? '#FFD700' : '#FFF' }}>{res.position}</td>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{res.Constructor?.name}</td>
                          <td style={{ padding: '6px', fontSize: '12px', color: '#AAA' }}>{res.Time?.time || res.status || '-'}</td>
                          <td style={{ padding: '6px', fontSize: '12px', textAlign: 'center', color: res.points > 0 ? '#00FF00' : '#888' }}>{res.points || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#888', fontSize: '13px', padding: '10px' }}>
                  ⚠️ Nessun risultato trovato per questo pilota (ID: {selectedDriverId})
                </div>
              )}
            </div>
          )
        })()}

        {/* Constructor Standings */}
        {statistiche.constructorStandings?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Classifica Costruttori ({statistiche.constructorStandings.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.constructorStandings.map((standing, index) => (
                <div
                  key={standing.Constructor?.constructorId}
                  onClick={() => { console.log('FWM_LOG CONSTRUCTOR_STANDING', standing); setSelectedConstructorId(selectedConstructorId === standing.Constructor?.constructorId ? null : standing.Constructor?.constructorId) }}
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: selectedConstructorId === standing.Constructor?.constructorId ? 'rgba(0, 122, 255, 0.08)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{
                      fontWeight: 'bold',
                      color: index < 3 ? '#FFD700' : '#FFF',
                      minWidth: '30px'
                    }}>
                      {standing.position}
                    </span>
                    <span>{standing.Constructor?.name}</span>
                  </div>
                  <span style={{
                    fontWeight: 'bold',
                    color: '#007AFF',
                    minWidth: '50px',
                    textAlign: 'right'
                  }}>
                    {standing.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Constructor Details */}
        {selectedConstructorId && statistiche.results && (() => {
          const constructorName = statistiche.constructorStandings.find(c => c.Constructor?.constructorId === selectedConstructorId)?.Constructor?.name
          const constructorResults = statistiche.results.flatMap(race => 
            getResultsForRace(race).filter(res => res.Constructor?.name?.toLowerCase() === constructorName?.toLowerCase()).map(res => ({ race, res }))
          )
          return (
            <div style={{
              marginTop: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h4 style={{ color: '#00A0FF', marginBottom: '10px' }}>Risultati Costruttore: {constructorName}</h4>
              {constructorResults.length > 0 ? (
                <div style={{ fontSize: '13px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '12px' }}>Gara</th>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '12px' }}>Pilota</th>
                        <th style={{ textAlign: 'center', padding: '6px', fontSize: '12px' }}>Pos</th>
                        <th style={{ textAlign: 'left', padding: '6px', fontSize: '12px' }}>Risultato</th>
                        <th style={{ textAlign: 'center', padding: '6px', fontSize: '12px' }}>Punti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {constructorResults.map(({ race, res }) => (
                        <tr key={`${race.season}-${race.round}-${res.Driver.driverId}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{race.raceName}</td>
                          <td style={{ padding: '6px', fontSize: '12px' }}>{res.Driver?.givenName} {res.Driver?.familyName}</td>
                          <td style={{ padding: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', color: res.position === '1' ? '#FFD700' : '#FFF' }}>{res.position}</td>
                          <td style={{ padding: '6px', fontSize: '12px', color: '#AAA' }}>{res.Time?.time || res.status || '-'}</td>
                          <td style={{ padding: '6px', fontSize: '12px', textAlign: 'center', color: res.points > 0 ? '#00FF00' : '#888' }}>{res.points || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#888', fontSize: '13px', padding: '10px' }}>
                  ⚠️ Nessun risultato trovato per {constructorName}
                </div>
              )}
            </div>
          )
        })()}

        {/* Results */}
        {statistiche.results?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Risultati Gare ({statistiche.results.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.results.map((race, index) => (
                <div
                  key={`results-${race.season}-${race.round}-${index}`}
                  onClick={() => {
                    console.log('FWM_LOG RACE_CLICK', race)
                    try {
                      // log JSON only for local seasons (>=2026) to help debugging
                      if (race && race.season && Number(race.season) >= 2026) console.log('FWM_LOG RACE_CLICK_FULL', JSON.stringify(race))
                    } catch (e) {
                      console.warn('FWM_LOG JSON stringify failed', e)
                    }
                    setSelectedRace(selectedRace?.type === 'race' && selectedRace?.__idx === index ? null : { ...race, type: 'race', __idx: index })
                  }}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    backgroundColor: selectedRace?.type === 'race' && selectedRace?.__idx === index ? 'rgba(0, 122, 255, 0.2)' : 'transparent'
                  }}
                >
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)}</div>
                  {selectedRace?.type === 'race' && selectedRace?.__idx === index && (() => {
                    const resultsForRace = getResultsForRace(race)
                    return resultsForRace?.length > 0 ? (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Pos</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Pilota</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Team</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Tempo</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Punti</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultsForRace.map(result => (
                              <tr key={result.Driver?.driverId || result.number} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                <td style={{ padding: '4px' }}>{result.position}</td>
                                <td style={{ padding: '4px' }}>{result.Driver?.givenName} {result.Driver?.familyName}</td>
                                <td style={{ padding: '4px' }}>{result.Constructor?.name}</td>
                                <td style={{ padding: '4px' }}>{result.Time?.time || result.status}</td>
                                <td style={{ padding: '4px' }}>{result.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ color: '#888', fontSize: '13px', padding: '10px' }}>Nessun risultato disponibile per questa gara</div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Qualifying */}
        {statistiche.qualifying?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Qualifiche ({statistiche.qualifying.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.qualifying.map((race, index) => (
                <div
                  key={`qualifying-${race.season}-${race.round}-${index}`}
                  onClick={() => { console.log('FWM_LOG QUALIFY_CLICK', race, race.QualifyingResults || race.Qualifying); setSelectedRace(selectedRace?.type === 'qualifying' && selectedRace?.__idx === index ? null : { ...race, type: 'qualifying', __idx: index }) }}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    backgroundColor: selectedRace?.type === 'qualifying' && selectedRace?.__idx === index ? 'rgba(0, 122, 255, 0.2)' : 'transparent'
                  }}
                >
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)}</div>
                  {selectedRace?.type === 'qualifying' && selectedRace?.__idx === index && (race.QualifyingResults || race.Qualifying) && (
                    <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Pos</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Pilota</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Q1</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Q2</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Q3</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(race.QualifyingResults || race.Qualifying || []).map(q => (
                            <tr key={q.Driver?.driverId || q.number} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <td style={{ padding: '6px' }}>{q.position}</td>
                              <td style={{ padding: '6px' }}>{q.Driver?.givenName} {q.Driver?.familyName}</td>
                              <td style={{ padding: '6px' }}>{q.Q1 || q.q1 || '-'}</td>
                              <td style={{ padding: '6px' }}>{q.Q2 || q.q2 || '-'}</td>
                              <td style={{ padding: '6px' }}>{q.Q3 || q.q3 || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Laps */}
        {statistiche.laps?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Tempi sui Giri ({statistiche.laps.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.laps.map((race, index) => (
                <div key={`${race.season}-${race.round}-${index}`} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pit Stops */}
        {statistiche.pitstops?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Pit Stops ({statistiche.pitstops.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.pitstops.map((race, index) => (
                <div key={`${race.season}-${race.round}-${index}`} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sprint */}
        {statistiche.sprint?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Sprint Races ({statistiche.sprint.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.sprint.map((race, index) => (
                <div
                  key={`sprint-${race.season}-${race.round}-${index}`}
                  onClick={() => setSelectedRace(selectedRace?.type === 'sprint' && selectedRace?.__idx === index ? null : { ...race, type: 'sprint', __idx: index })}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    backgroundColor: selectedRace?.type === 'sprint' && selectedRace?.__idx === index ? 'rgba(0, 122, 255, 0.2)' : 'transparent'
                  }}
                >
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)}</div>
                  {selectedRace?.type === 'sprint' && selectedRace?.__idx === index && (() => {
                    const resultsForRace = getResultsForRace(race)
                    return resultsForRace?.length > 0 ? (
                      <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Pos</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Pilota</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Team</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Tempo</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Punti</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultsForRace.map(result => (
                              <tr key={result.Driver?.driverId || result.number} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <td style={{ padding: '6px' }}>{result.position}</td>
                                <td style={{ padding: '6px' }}>{result.Driver?.givenName} {result.Driver?.familyName}</td>
                                <td style={{ padding: '6px' }}>{result.Constructor?.name}</td>
                                <td style={{ padding: '6px' }}>{result.Time?.time || result.status}</td>
                                <td style={{ padding: '6px' }}>{result.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{ color: '#888', fontSize: '13px', padding: '10px' }}>Nessun risultato disponibile per questa sprint</div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {statistiche.status?.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#007AFF'
            }}>
              Status Piloti ({statistiche.status.length})
            </h3>
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: '14px'
            }}>
              {statistiche.status.map(status => (
                <div key={status.statusId} style={{
                  padding: '8px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div>{status.status}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{status.count} occorrenze</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
