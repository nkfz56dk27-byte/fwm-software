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

  useEffect(() => {
    caricaStatistiche()
  }, [selectedSeason])

  // Ricarica quando campionati cambia (per gestire il caricamento asincrono)
  useEffect(() => {
    if (campionati && campionati.length > 0) {
      const seasonYear = selectedSeason === 'current' ? parseInt(currentSeason) : parseInt(selectedSeason)
      if (seasonYear >= 2026) {
        console.log('🔍 DEBUG: campionati caricati, ricaricando dati locali...')
        caricaDatiLocali(seasonYear)
      }
    }
  }, [campionati])

  const fetchFromJolpica = async (endpoint) => {
    try {
      const response = await fetch(`${JOLPICA_BASE_URL}${endpoint}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      return data
    } catch (error) {
      console.error(`Errore fetch da Jolpica (${endpoint}):`, error)
      return null
    }
  }

  const formatDateItalian = (dateString) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
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

      console.log('🔍 DEBUG: selectedSeason =', selectedSeason)

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

      console.log('🔍 DEBUG: seasonYear =', seasonYear)

      // Sistema misto: API fino al 2025, dati locali dal 2026
      if (seasonYear >= 2026) {
        console.log('🔍 DEBUG: Usando dati locali per stagione', seasonYear)
        await caricaDatiLocali(seasonYear)
      } else {
        console.log('🔍 DEBUG: Usando API per stagione', seasonParam)
        await caricaDatiAPI(seasonParam)
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

  const caricaDatiLocali = async (seasonYear) => {
    console.log('🔍 DEBUG: caricaDatiLocali chiamato per stagione', seasonYear)
    console.log('🔍 DEBUG: campionati disponibili =', campionati?.length)
    console.log('🔍 DEBUG: nomi campionati =', campionati?.map(c => c.nome))
    console.log('🔍 DEBUG: dettagli campionati =', campionati?.map(c => ({ nome: c.nome, is_f1_or_fe: c.is_f1_or_fe })))

    // Trova il campionato F1 per la stagione specificata
    // Prima cerca solo "Formula 1" per vedere la struttura
    const campionatoF1 = campionati?.find(c => c.nome.includes('Formula 1'))

    console.log('🔍 DEBUG: campionatoF1 trovato =', campionatoF1 ? 'SI' : 'NO')
    if (campionatoF1) {
      console.log('🔍 DEBUG: nome campionato =', campionatoF1.nome)
      console.log('🔍 DEBUG: numero GP =', campionatoF1.gp?.length)
    } else {
      console.log('🔍 DEBUG: cercando campionato con nome che contiene "Formula 1"')
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
      console.log('🔍 DEBUG: date gare recuperate dall\'API =', Object.keys(raceDates).length)
      console.log('🔍 DEBUG: gare recuperate dall\'API =', apiRaces.length)
      console.log('🔍 DEBUG: circuiti recuperati dall\'API =', Object.keys(apiCircuits).length)
    } catch (error) {
      console.error('Errore recupero date gare dall\'API:', error)
    }

    // Recupera piloti e costruttori dall'API per ottenere le nazionalità
    let apiDrivers = []
    let apiConstructors = []
    try {
      const driversData = await fetchFromJolpica(`/${seasonYear}/drivers.json`)
      apiDrivers = driversData?.MRData?.DriverTable?.Drivers || []
      console.log('🔍 DEBUG: piloti recuperati dall\'API =', apiDrivers.length)
    } catch (error) {
      console.error('Errore recupero piloti dall\'API:', error)
    }

    try {
      const constructorsData = await fetchFromJolpica(`/${seasonYear}/constructors.json`)
      apiConstructors = constructorsData?.MRData?.ConstructorTable?.Constructors || []
      console.log('🔍 DEBUG: costruttori recuperati dall\'API =', apiConstructors.length)
    } catch (error) {
      console.error('Errore recupero costruttori dall\'API:', error)
    }

    // Recupera tutte le stagioni storiche dall'API per il selettore
    let seasons = []
    try {
      const seasonsData = await fetchFromJolpica('/seasons.json?limit=100')
      seasons = seasonsData?.MRData?.SeasonTable?.Seasons || []
      console.log('🔍 DEBUG: stagioni storiche recuperate dall\'API =', seasons.length)
    } catch (error) {
      console.error('Errore recupero stagioni storiche dall\'API:', error)
    }

    // Converti i dati locali nel formato atteso da Statistiche
    // Per il calendario, usa i dati dell'API se disponibili, altrimenti usa i dati locali
    const races = apiRaces.length > 0 ? apiRaces : gp.map((gara, index) => ({
      season: seasonYear.toString(),
      round: (index + 1).toString(),
      raceName: gara.nome || `GP ${index + 1}`,
      date: gara.data || '',
      circuitName: gara.circuito || 'Circuito',
      Circuit: {
        circuitId: `circuit_${index}`,
        circuitName: gara.circuito || 'Circuito',
        Location: {
          locality: gara.luogo || '',
          country: gara.paese || ''
        }
      }
    }))

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

    // Estrai i risultati dalle gare
    const results = gp.map((gara, index) => ({
      season: seasonYear.toString(),
      round: (index + 1).toString(),
      raceName: gara.nome || `GP ${index + 1}`,
      date: gara.data || '',
      Results: gara.risultati ? Object.entries(gara.risultati).map(([pilotaId, posizione]) => {
        const pilota = piloti.find(p => p.id === pilotaId)
        return {
          position: posizione?.toString() || '',
          positionText: posizione?.toString() || '',
          Driver: pilota ? {
            driverId: pilota.id?.toString() || pilota.nome?.toLowerCase().replace(/\s/g, '_'),
            givenName: pilota.nome || '',
            familyName: pilota.cognome || '',
            permanentNumber: pilota.numero?.toString() || ''
          } : {}
        }
      }) : []
    }))

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
        console.log('⚠️ DEBUG: Nazionalità pilota non trovata', {
          localName: pilota.cognome ? `${pilota.nome} ${pilota.cognome}` : pilota.nome,
          mappedName: mappedName,
          apiDrivers: apiDrivers.map(d => `${d.givenName} ${d.familyName}`)
        })
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

      if (!nationality) {
        console.log('⚠️ DEBUG: Nazionalità costruttore non trovata', {
          localName: costruttore.nome,
          mappedName: mappedName,
          apiConstructors: apiConstructors.map(c => c.name)
        })
      } else {
        console.log('✅ DEBUG: Nazionalità costruttore trovata', {
          localName: costruttore.nome,
          mappedName: mappedName,
          nationality: nationality
        })
      }

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

    console.log('🔍 DEBUG: statistiche calcolate =', {
      numDrivers: statisticheData.drivers?.length,
      numConstructors: statisticheData.constructors?.length,
      numRaces: statisticheData.races?.length,
      sampleDriver: statisticheData.drivers?.[0]
    })

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
          flexWrap: 'wrap'
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
              {statistiche.races?.map(race => (
                <div key={`${race.season}-${race.round}`} style={{
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
                <div key={standing.Driver?.driverId} style={{
                  padding: '10px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
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
                <div key={standing.Constructor?.constructorId} style={{
                  padding: '10px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
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
              {statistiche.results.map(race => (
                <div
                  key={`results-${race.season}-${race.round}`}
                  onClick={() => setSelectedRace(selectedRace?.season === race.season && selectedRace?.round === race.round ? null : race)}
                  style={{
                    padding: '8px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    backgroundColor: selectedRace?.season === race.season && selectedRace?.round === race.round ? 'rgba(0, 122, 255, 0.2)' : 'transparent'
                  }}
                >
                  <div>{race.raceName}</div>
                  <div style={{ color: '#AAA', fontSize: '12px' }}>{formatDateItalian(race.date)}</div>
                  {selectedRace?.season === race.season && selectedRace?.round === race.round && race.Results && (
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
                          {race.Results.map(result => (
                            <tr key={result.Driver.driverId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                              <td style={{ padding: '4px' }}>{result.position}</td>
                              <td style={{ padding: '4px' }}>{result.Driver.givenName} {result.Driver.familyName}</td>
                              <td style={{ padding: '4px' }}>{result.Constructor.name}</td>
                              <td style={{ padding: '4px' }}>{result.Time?.time || result.status}</td>
                              <td style={{ padding: '4px' }}>{result.points}</td>
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
              {statistiche.qualifying.map(race => (
                <div key={`qualifying-${race.season}-${race.round}`} style={{
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
              {statistiche.laps.map(race => (
                <div key={`${race.season}-${race.round}`} style={{
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
              {statistiche.pitstops.map(race => (
                <div key={`${race.season}-${race.round}`} style={{
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
              {statistiche.sprint.map(race => (
                <div key={`${race.season}-${race.round}`} style={{
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
