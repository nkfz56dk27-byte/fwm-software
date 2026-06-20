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
  const [seasonCarouselPage, setSeasonCarouselPage] = useState(0)
  const [careerDaysWithoutWin, setCareerDaysWithoutWin] = useState('-')
  const [careerLastWin, setCareerLastWin] = useState(null)
  const [careerDriverStats, setCareerDriverStats] = useState(null)
  const [careerConstructorStats, setCareerConstructorStats] = useState(null)
  const [expandedDriverMetric, setExpandedDriverMetric] = useState(null)
  const [expandedConstructorMetric, setExpandedConstructorMetric] = useState(null)
  const seasonsPerPage = isMobile ? 3 : 5

  useEffect(() => {
    caricaStatistiche()
  }, [selectedSeason])

  useEffect(() => {
    setExpandedDriverMetric(null)
  }, [selectedDriverId, selectedSeason])

  useEffect(() => {
    setExpandedConstructorMetric(null)
  }, [selectedConstructorId, selectedSeason])

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

  useEffect(() => {
    if (selectedSeason === 'current') return

    const pastSeasons = (statistiche.seasons || [])
      .filter(season => season.season !== currentSeason)
      .sort((a, b) => b.season - a.season)

    const selectedIndex = pastSeasons.findIndex(season => String(season.season) === String(selectedSeason))
    if (selectedIndex === -1) return

    const targetPage = Math.floor(selectedIndex / seasonsPerPage)
    setSeasonCarouselPage(prev => (prev === targetPage ? prev : targetPage))
  }, [selectedSeason, statistiche.seasons, currentSeason, seasonsPerPage])

  useEffect(() => {
    let cancelled = false

    const loadCareerDaysWithoutWin = async () => {
      const driver = (statistiche.drivers || []).find(d => d.driverId === selectedDriverId)
      const localWins = Number(driver?.stats?.wins || 0)
      const localDaysRaw = driver?.stats?.daysSinceLastWin
      const localDays = Number(localDaysRaw)
      const hasLocalDays = Number.isFinite(localDays) && localDays >= 0
      const localPodiums = Number(driver?.stats?.podiums || 0)
      const localDnf = Number(driver?.stats?.dnf || 0)
      const localDsq = Number(driver?.stats?.dsq || 0)

      if (!selectedDriverId || !driver) {
        setCareerDaysWithoutWin('-')
        setCareerLastWin(null)
        setCareerDriverStats(null)
        return
      }

      const setLocalFallbackStats = () => {
        setCareerDriverStats({
          races: null,
          wins: localWins,
          podiums: localPodiums,
          fastestLaps: null,
          dnf: localDnf,
          dns: null,
          dsq: localDsq,
          points: null,
          entries: []
        })
      }

      const lookupDriverId = driver.apiDriverId || driver.driverId
      const canQueryApi = !!driver.apiDriverId || (typeof lookupDriverId === 'string' && !lookupDriverId.includes('-'))

      if (!lookupDriverId || !canQueryApi) {
        setCareerDaysWithoutWin(localWins > 0 ? (driver?.stats?.daysSinceLastWin != null ? `${driver.stats.daysSinceLastWin}` : '-') : 'Mai vinto')
        setCareerLastWin(driver?.stats?.lastWin || null)
        setLocalFallbackStats()
        return
      }

      const normalizeDriverKey = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

      const candidateDriverIds = Array.from(new Set([
        driver.apiDriverId,
        driver.driverId,
        normalizeDriverKey(driver.familyName),
        normalizeDriverKey(`${driver.givenName || ''}_${driver.familyName || ''}`),
        normalizeDriverKey(driver.givenName)
      ].filter(Boolean)))

      const fetchCareerRacesByDriver = async (driverId) => {
        const limit = 100
        let offset = 0
        let total = null
        let resolvedDriverId = null
        let allRaces = []

        while (offset < 5000) {
          const pageData = await fetchFromJolpica(`/drivers/${driverId}/results.json?limit=${limit}&offset=${offset}`)
          const pageRaces = pageData?.MRData?.RaceTable?.Races || []
          const pageTotal = Number(pageData?.MRData?.total || 0)
          if (!resolvedDriverId) resolvedDriverId = pageData?.MRData?.RaceTable?.driverId || driverId
          if (total == null) total = Number.isFinite(pageTotal) ? pageTotal : 0

          if (!pageRaces.length) break
          allRaces = allRaces.concat(pageRaces)
          offset += limit

          if (offset >= total) break
        }

        return {
          races: allRaces,
          total: Number.isFinite(total) ? total : allRaces.length,
          resolvedDriverId: resolvedDriverId || driverId
        }
      }

      let allRaces = []
      let resolvedApiDriverId = lookupDriverId

      for (const candidateId of candidateDriverIds) {
        const result = await fetchCareerRacesByDriver(candidateId)
        if (result.total > 0 || result.races.length > 0) {
          allRaces = result.races
          resolvedApiDriverId = result.resolvedDriverId
          break
        }
      }

      const allDriverResults = allRaces.flatMap(race =>
        (race.Results || [])
          .filter(res => {
            const apiId = String(res?.Driver?.driverId || '')
            return !resolvedApiDriverId || apiId === String(resolvedApiDriverId)
          })
          .map(res => ({ race, res }))
      )

      const normalizeStatus = (status) => String(status || '').toLowerCase()
      const isDnsStatus = (status) => {
        const s = normalizeStatus(status)
        return s === 'dns' || s.includes('did not start')
      }
      const isDsqStatus = (status) => normalizeStatus(status).includes('disqual')
      const isDnfStatus = (status) => {
        const s = normalizeStatus(status)
        if (!s) return false
        if (isDnsStatus(s) || isDsqStatus(s)) return false
        return s === 'retired' ||
          s.includes('accident') ||
          s.includes('collision') ||
          s.includes('spun off') ||
          s.includes('engine') ||
          s.includes('gearbox') ||
          s.includes('transmission') ||
          s.includes('hydraulic') ||
          s.includes('electrical') ||
          s.includes('suspension') ||
          s.includes('brake') ||
          s.includes('tyre') ||
          s.includes('tire') ||
          s.includes('overheat') ||
          s.includes('mechanical') ||
          s.includes('puncture') ||
          s.includes('not classified') ||
          s.includes('+')
      }

      const winsCareer = allDriverResults.filter(({ res }) => String(res?.position) === '1').length
      const podiumsCareer = allDriverResults.filter(({ res }) => ['1', '2', '3'].includes(String(res?.position))).length
      const fastestLapsCareer = allDriverResults.filter(({ res }) => {
        const fastestLapRank = res?.FastestLap?.rank || res?.fastestLap?.rank || res?.fastestLapRank
        return String(fastestLapRank || '') === '1'
      }).length
      const dnsCareer = allDriverResults.filter(({ res }) => isDnsStatus(res?.status)).length
      const dsqCareer = allDriverResults.filter(({ res }) => isDsqStatus(res?.status)).length
      const dnfCareer = allDriverResults.filter(({ res }) => isDnfStatus(res?.status)).length
      const pointsCareer = allDriverResults.reduce((sum, { res }) => sum + Number(res?.points || 0), 0)

      if (!cancelled) {
        setCareerDriverStats({
          races: allDriverResults.length,
          wins: winsCareer,
          podiums: podiumsCareer,
          fastestLaps: fastestLapsCareer,
          dnf: dnfCareer,
          dns: dnsCareer,
          dsq: dsqCareer,
          points: pointsCareer,
          entries: allDriverResults
        })
      }

      const winRaces = allDriverResults
        .filter(({ res }) => String(res?.position) === '1')
        .map(({ race }) => race)

      if (!winRaces.length) {
        if (!cancelled) {
          if (localWins > 0) {
            setCareerDaysWithoutWin(driver?.stats?.daysSinceLastWin != null ? `${driver.stats.daysSinceLastWin}` : '-')
            setCareerLastWin(driver?.stats?.lastWin || null)
          } else {
            setCareerDaysWithoutWin('Mai vinto')
            setCareerLastWin(null)
          }

          // se API non ha dati ma localmente c'è qualcosa, mantieni fallback coerente
          if (!allDriverResults.length) {
            setLocalFallbackStats()
          }
        }
        return
      }

      const latestWinRace = winRaces.reduce((latest, race) => {
        if (!latest) return race
        return new Date(race.date) > new Date(latest.date) ? race : latest
      }, null)

      if (!latestWinRace?.date) {
        if (!cancelled) {
          setCareerDaysWithoutWin('-')
          setCareerLastWin(driver?.stats?.lastWin || null)
        }
        return
      }

      const latestWinDate = new Date(latestWinRace.date)
      const today = new Date()
      const diffTime = Math.abs(today - latestWinDate)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (!cancelled) {
        if (Number.isFinite(diffDays)) {
          // Se i dati locali mostrano una vittoria più recente, usa quelli.
          const bestDays = localWins > 0 && hasLocalDays ? Math.min(diffDays, localDays) : diffDays
          setCareerDaysWithoutWin(`${bestDays}`)
        } else {
          setCareerDaysWithoutWin('-')
        }
        setCareerLastWin({
          raceName: latestWinRace.raceName,
          date: latestWinRace.date
        })
      }
    }

    loadCareerDaysWithoutWin()

    return () => {
      cancelled = true
    }
  }, [selectedDriverId, statistiche.drivers])

  useEffect(() => {
    let cancelled = false

    const loadCareerConstructorStats = async () => {
      if (!selectedConstructorId) {
        setCareerConstructorStats(null)
        return
      }

      const normalizeStatus = (status) => String(status || '').toLowerCase()
      const isDnsStatus = (status) => {
        const s = normalizeStatus(status)
        return s === 'dns' || s.includes('did not start')
      }
      const isDsqStatus = (status) => normalizeStatus(status).includes('disqual')
      const isDnfStatus = (status) => {
        const s = normalizeStatus(status)
        if (!s) return false
        if (isDnsStatus(s) || isDsqStatus(s)) return false
        return s === 'retired' ||
          s.includes('accident') ||
          s.includes('collision') ||
          s.includes('spun off') ||
          s.includes('engine') ||
          s.includes('gearbox') ||
          s.includes('transmission') ||
          s.includes('hydraulic') ||
          s.includes('electrical') ||
          s.includes('suspension') ||
          s.includes('brake') ||
          s.includes('tyre') ||
          s.includes('tire') ||
          s.includes('overheat') ||
          s.includes('mechanical') ||
          s.includes('puncture') ||
          s.includes('not classified') ||
          s.includes('+')
      }

      const constructor = (statistiche.constructors || []).find(c => String(c?.constructorId || '') === String(selectedConstructorId))
      const normalizeConstructorName = (value) => {
        const normalized = String(value || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, ' ')
          .replace(/\b(f1|team|scuderia|formula|one)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        const aliases = {
          rb: 'racing bulls',
          'rb f1': 'racing bulls',
          'rb f1 team': 'racing bulls',
          'racing bull': 'racing bulls',
          'red bull racing': 'red bull',
          'mercedes benz': 'mercedes',
          'haas f1': 'haas',
          'cadillac f1': 'cadillac'
        }

        return aliases[normalized] || normalized
      }

      const constructorName = String(constructor?.name || '').trim().toLowerCase()
      const constructorNameNorm = normalizeConstructorName(constructorName)

      const fetchCareerByConstructor = async (constructorId) => {
        const limit = 100
        let offset = 0
        let total = null
        let allRaces = []

        while (offset < 5000) {
          const pageData = await fetchFromJolpica(`/constructors/${constructorId}/results.json?limit=${limit}&offset=${offset}`)
          const pageRaces = pageData?.MRData?.RaceTable?.Races || []
          const pageTotal = Number(pageData?.MRData?.total || 0)
          if (total == null) total = Number.isFinite(pageTotal) ? pageTotal : 0

          if (!pageRaces.length) break
          allRaces = allRaces.concat(pageRaces)
          offset += limit
          if (offset >= total) break
        }

        return allRaces
      }

      const normalizeConstructorId = (value) => String(value || '').toLowerCase().replace(/\s+/g, '_').trim()

      const constructorLineages = [
        {
          keys: ['racing bulls', 'rb', 'rb_f1_team', 'alphatauri', 'toro_rosso', 'toro rosso', 'minardi'],
          ids: ['rb', 'alphatauri', 'toro_rosso', 'minardi']
        }
      ]

      const constructorReferences = [
        normalizeConstructorName(constructor?.name),
        normalizeConstructorName(selectedConstructorId),
        normalizeConstructorName(constructor?.apiConstructorId),
        normalizeConstructorId(selectedConstructorId),
        normalizeConstructorId(constructor?.apiConstructorId)
      ].filter(Boolean)

      const lineageIds = constructorLineages
        .filter(lineage => lineage.keys.some(key => constructorReferences.some(ref => ref === key || ref.includes(key) || key.includes(ref))))
        .flatMap(lineage => lineage.ids)

      const extraAliasIds = []
      if (constructorNameNorm.includes('racing bulls')) extraAliasIds.push('rb')
      if (constructorNameNorm.includes('red bull')) extraAliasIds.push('red_bull')

      const candidateIds = Array.from(new Set([
        constructor?.apiConstructorId,
        selectedConstructorId,
        String(selectedConstructorId || '').toLowerCase(),
        String(selectedConstructorId || '').replace(/\s+/g, '_').toLowerCase(),
        ...lineageIds,
        ...extraAliasIds
      ].filter(Boolean)))

      const careerEntriesMap = new Map()

      for (const constructorId of candidateIds) {
        const allRaces = await fetchCareerByConstructor(constructorId)
        const entries = allRaces.flatMap(race =>
          (race?.Results || [])
            .filter(res => {
              const cid = String(res?.Constructor?.constructorId || '').toLowerCase()
              const cname = String(res?.Constructor?.name || '').trim().toLowerCase()
              const cnameNorm = normalizeConstructorName(cname)
              return (
                cid === String(constructorId || '').toLowerCase() ||
                (constructorName && cname === constructorName) ||
                (constructorNameNorm && cnameNorm === constructorNameNorm) ||
                (constructorNameNorm && cnameNorm.includes(constructorNameNorm)) ||
                (constructorNameNorm && constructorNameNorm.includes(cnameNorm))
              )
            })
            .map(res => ({ race, res }))
        )

        entries.forEach(entry => {
          const raceSeason = entry?.race?.season || ''
          const raceRound = entry?.race?.round || ''
          const driverId = entry?.res?.Driver?.driverId || ''
          const constructorResId = entry?.res?.Constructor?.constructorId || constructorId
          const key = `${raceSeason}-${raceRound}-${driverId}-${constructorResId}`
          if (!careerEntriesMap.has(key)) {
            careerEntriesMap.set(key, entry)
          }
        })
      }

      const careerEntries = Array.from(careerEntriesMap.values())

      if (!careerEntries.length) {
        if (!cancelled) setCareerConstructorStats(null)
        return
      }

      const wins = careerEntries.filter(({ res }) => String(res?.position) === '1').length
      const podiums = careerEntries.filter(({ res }) => ['1', '2', '3'].includes(String(res?.position))).length
      const dnf = careerEntries.filter(({ res }) => isDnfStatus(res?.status)).length
      const dns = careerEntries.filter(({ res }) => isDnsStatus(res?.status)).length
      const dsq = careerEntries.filter(({ res }) => isDsqStatus(res?.status)).length
      const points = careerEntries.reduce((sum, { res }) => sum + Number(res?.points || 0), 0)

      const bestEntry = careerEntries.reduce((best, entry) => {
        const currentPos = Number(entry?.res?.position)
        if (!Number.isFinite(currentPos)) return best
        if (!best) return entry

        const bestPos = Number(best?.res?.position)
        if (!Number.isFinite(bestPos) || currentPos < bestPos) return entry
        if (currentPos > bestPos) return best

        const bestDate = best?.race?.date ? new Date(best.race.date).getTime() : 0
        const currentDate = entry?.race?.date ? new Date(entry.race.date).getTime() : 0
        return currentDate > bestDate ? entry : best
      }, null)

      const lastPodiumEntry = careerEntries
        .filter(({ res }) => ['1', '2', '3'].includes(String(res?.position)))
        .reduce((latest, entry) => {
          if (!latest) return entry
          const latestDate = latest?.race?.date ? new Date(latest.race.date).getTime() : 0
          const currentDate = entry?.race?.date ? new Date(entry.race.date).getTime() : 0
          return currentDate > latestDate ? entry : latest
        }, null)

      if (!cancelled) {
        setCareerConstructorStats({
          races: careerEntries.length,
          wins,
          podiums,
          dnf,
          dns,
          dsq,
          points,
          bestEntry,
          lastPodiumEntry,
          entries: careerEntries
        })
      }
    }

    loadCareerConstructorStats()

    return () => {
      cancelled = true
    }
  }, [selectedConstructorId, statistiche.constructors])

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

  const getPodiumPositionColor = (position, defaultColor = '#FFF') =>
    ['1', '2', '3'].includes(String(position || '').trim()) ? '#FFD700' : defaultColor

  function translateNationalityToItalian(nationality) {
    const value = String(nationality || '').trim()
    if (!value) return ''

    const normalized = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z\s-]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const map = {
      italian: 'Italiana',
      british: 'Britannica',
      english: 'Inglese',
      scottish: 'Scozzese',
      welsh: 'Gallese',
      irish: 'Irlandese',
      french: 'Francese',
      german: 'Tedesca',
      spanish: 'Spagnola',
      portuguese: 'Portoghese',
      dutch: 'Olandese',
      belgian: 'Belga',
      austrian: 'Austriaca',
      swiss: 'Svizzera',
      danish: 'Danese',
      swedish: 'Svedese',
      norwegian: 'Norvegese',
      finnish: 'Finlandese',
      polish: 'Polacca',
      czech: 'Ceca',
      slovak: 'Slovacca',
      hungarian: 'Ungherese',
      romanian: 'Rumena',
      ukrainian: 'Ucraina',
      russian: 'Russa',
      turkish: 'Turca',
      greek: 'Greca',
      serbian: 'Serba',
      croatian: 'Croata',
      slovenian: 'Slovena',
      australian: 'Australiana',
      new_zealander: 'Neozelandese',
      'new zealander': 'Neozelandese',
      american: 'Statunitense',
      us: 'Statunitense',
      canadian: 'Canadese',
      mexican: 'Messicana',
      brazilian: 'Brasiliana',
      argentine: 'Argentina',
      argentinian: 'Argentina',
      colombian: 'Colombiana',
      venezuelan: 'Venezuelana',
      chilean: 'Cilena',
      peruvian: 'Peruviana',
      uruguayan: 'Uruguaiana',
      paraguayan: 'Paraguaiana',
      bolivian: 'Boliviana',
      ecuadorian: 'Ecuadoriana',
      japanese: 'Giapponese',
      chinese: 'Cinese',
      korean: 'Coreana',
      thai: 'Thailandese',
      singaporean: 'Singaporeana',
      malaysian: 'Malese',
      indonesian: 'Indonesiana',
      filipino: 'Filippina',
      indian: 'Indiana',
      pakistani: 'Pachistana',
      sri_lankan: 'Srilankese',
      'sri lankan': 'Srilankese',
      south_african: 'Sudafricana',
      'south african': 'Sudafricana',
      moroccan: 'Marocchina',
      tunisian: 'Tunisina',
      egyptian: 'Egiziana',
      algerian: 'Algerina',
      nigerian: 'Nigeriana',
      kenyan: 'Keniota',
      rwandan: 'Ruandese',
      monegasque: 'Monegasca'
    }

    const key = normalized.replace(/\s+/g, '_')
    return map[key] || map[normalized] || value
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
        const limit = 100
        let offset = 0
        let total = null

        const raceMap = new Map()

        const mergeArrayUnique = (existing = [], incoming = []) => {
          const out = [...existing]
          const seen = new Set(out.map(item => `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`))
          incoming.forEach(item => {
            const key = `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`
            if (!seen.has(key)) {
              out.push(item)
              seen.add(key)
            }
          })
          return out
        }

        while (total == null || offset < total) {
          const data = await fetchFromJolpica(`${endpoint}?limit=${limit}&offset=${offset}`)
          const races = data?.MRData?.RaceTable?.Races || []
          total = Number(data?.MRData?.total || 0)

          if (!races.length) break

          races.forEach(race => {
            const raceKey = `${race?.season || ''}-${race?.round || ''}`
            const prev = raceMap.get(raceKey)
            if (!prev) {
              raceMap.set(raceKey, race)
              return
            }

            raceMap.set(raceKey, {
              ...prev,
              ...race,
              Results: mergeArrayUnique(prev.Results || [], race.Results || []),
              QualifyingResults: mergeArrayUnique(prev.QualifyingResults || [], race.QualifyingResults || [])
            })
          })

          offset += limit
        }

        const mergedRaces = Array.from(raceMap.values()).sort((a, b) => Number(a?.round || 0) - Number(b?.round || 0))
        return { MRData: { RaceTable: { Races: mergedRaces } } }
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

    // Laps e pitstops rimossi - API Jolpica non supporta questi endpoint
    const lapsData = { MRData: { RaceTable: { Races: [] } } }
    const pitstopsData = { MRData: { RaceTable: { Races: [] } } }

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
      nationality: translateNationalityToItalian(driver.nationality),
      apiDriverId: driver.driverId,
      stats: calculateDriverStats(driver.driverId, results, qualifying, status)
    }))

    const constructorsWithNationality = (constructorsData?.MRData?.ConstructorTable?.Constructors || [])
      .map(constructor => ({
        ...constructor,
        nationality: translateNationalityToItalian(constructor.nationality)
      }))

    setStatistiche({
      drivers: driversWithStats,
      constructors: constructorsWithNationality,
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
        const limit = 100
        let offset = 0
        let total = null

        const raceMap = new Map()

        const mergeArrayUnique = (existing = [], incoming = []) => {
          const out = [...existing]
          const seen = new Set(out.map(item => `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`))
          incoming.forEach(item => {
            const key = `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`
            if (!seen.has(key)) {
              out.push(item)
              seen.add(key)
            }
          })
          return out
        }

        while (total == null || offset < total) {
          const data = await fetchFromJolpica(`${endpoint}?limit=${limit}&offset=${offset}`)
          const races = data?.MRData?.RaceTable?.Races || []
          total = Number(data?.MRData?.total || 0)

          if (!races.length) break

          races.forEach(race => {
            const raceKey = `${race?.season || ''}-${race?.round || ''}`
            const prev = raceMap.get(raceKey)
            if (!prev) {
              raceMap.set(raceKey, race)
              return
            }

            raceMap.set(raceKey, {
              ...prev,
              ...race,
              Results: mergeArrayUnique(prev.Results || [], race.Results || []),
              QualifyingResults: mergeArrayUnique(prev.QualifyingResults || [], race.QualifyingResults || [])
            })
          })

          offset += limit
        }

        const mergedRaces = Array.from(raceMap.values()).sort((a, b) => Number(a?.round || 0) - Number(b?.round || 0))
        return { MRData: { RaceTable: { Races: mergedRaces } } }
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
      nationality: translateNationalityToItalian(driver.nationality),
      apiDriverId: driver.driverId,
      stats: calculateDriverStats(driver.driverId, results, qualifying, status)
    }))

    const constructorsWithNationality = (constructorsData?.MRData?.ConstructorTable?.Constructors || [])
      .map(constructor => ({
        ...constructor,
        nationality: translateNationalityToItalian(constructor.nationality)
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
      constructors: constructorsWithNationality,
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

    // Recupera i dettagli gara dall'API con paginazione (risultati/qualifiche/sprint)
    const fetchAllData = async (endpoint) => {
      try {
        const limit = 100
        let offset = 0
        let total = null

        const raceMap = new Map()

        const mergeArrayUnique = (existing = [], incoming = []) => {
          const out = [...existing]
          const seen = new Set(out.map(item => `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`))
          incoming.forEach(item => {
            const key = `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`
            if (!seen.has(key)) {
              out.push(item)
              seen.add(key)
            }
          })
          return out
        }

        while (total == null || offset < total) {
          const data = await fetchFromJolpica(`${endpoint}?limit=${limit}&offset=${offset}`)
          const races = data?.MRData?.RaceTable?.Races || []
          total = Number(data?.MRData?.total || 0)

          if (!races.length) break

          races.forEach(race => {
            const raceKey = `${race?.season || ''}-${race?.round || ''}`
            const prev = raceMap.get(raceKey)
            if (!prev) {
              raceMap.set(raceKey, race)
              return
            }

            raceMap.set(raceKey, {
              ...prev,
              ...race,
              Results: mergeArrayUnique(prev.Results || [], race.Results || []),
              QualifyingResults: mergeArrayUnique(prev.QualifyingResults || [], race.QualifyingResults || []),
              SprintResults: mergeArrayUnique(prev.SprintResults || [], race.SprintResults || [])
            })
          })

          offset += limit
        }

        const mergedRaces = Array.from(raceMap.values()).sort((a, b) => Number(a?.round || 0) - Number(b?.round || 0))
        return { MRData: { RaceTable: { Races: mergedRaces } } }
      } catch (error) {
        console.error('Errore in fetchAllData per', endpoint, error)
        return { MRData: { RaceTable: { Races: [] } } }
      }
    }

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

    // Recupera risultati/qualifiche/sprint dall'API anche in modalità locale
    let apiResultsRaces = []
    let apiQualifyingRaces = []
    let apiSprintRaces = []
    try {
      const [apiResultsData, apiQualifyingData, apiSprintData] = await Promise.all([
        fetchAllData(`/${seasonYear}/results.json`),
        fetchAllData(`/${seasonYear}/qualifying.json`),
        fetchAllData(`/${seasonYear}/sprint.json`)
      ])

      apiResultsRaces = apiResultsData?.MRData?.RaceTable?.Races || []
      apiQualifyingRaces = apiQualifyingData?.MRData?.RaceTable?.Races || []
      apiSprintRaces = apiSprintData?.MRData?.RaceTable?.Races || []
    } catch (error) {
      console.error('Errore recupero dettagli gara API in modalità locale:', error)
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

      const nationality = translateNationalityToItalian(apiDriver?.nationality || '')

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
        apiDriverId: apiDriver?.driverId || null,
        givenName: pilota.nome || '',
        familyName: pilota.cognome || '',
        permanentNumber: pilota.numero?.toString() || '',
        team: pilota?.costruttore || '',
        nationality: nationality,
        dateOfBirth: apiDriver?.dateOfBirth || null,
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
      const normalizeConstructorLookup = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(f1|team|scuderia|formula|one)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const preferredApiConstructorIdByLocalName = {
        'Racing Bulls': 'rb',
        'RB': 'rb'
      }

      const preferredApiId = preferredApiConstructorIdByLocalName[costruttore.nome]
      const localNameNorm = normalizeConstructorLookup(costruttore.nome)

      const apiConstructor =
        apiConstructors.find(c => c.constructorId === preferredApiId) ||
        apiConstructors.find(c => {
          const apiNameNorm = normalizeConstructorLookup(c.name)
          return (
            apiNameNorm === localNameNorm ||
            apiNameNorm.includes(localNameNorm) ||
            localNameNorm.includes(apiNameNorm)
          )
        })

      const nationality = translateNationalityToItalian(apiConstructor?.nationality || '')

      // constructor nationality mapping attempted

      return {
        constructorId: costruttore.id?.toString() || costruttore.nome?.toLowerCase().replace(/\s/g, '_'),
        apiConstructorId: apiConstructor?.constructorId || null,
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
      results: apiResultsRaces.length > 0 ? apiResultsRaces : results,
      qualifying: apiQualifyingRaces,
      laps: [],
      pitstops: [],
      sprint: apiSprintRaces,
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

  const pastSeasons = (statistiche.seasons || [])
    .filter(season => season.season !== currentSeason)
    .sort((a, b) => b.season - a.season)
  const totalSeasonPages = Math.max(1, Math.ceil(pastSeasons.length / seasonsPerPage))
  const currentSeasonPage = Math.min(seasonCarouselPage, totalSeasonPages - 1)
  const visiblePastSeasons = pastSeasons.slice(
    currentSeasonPage * seasonsPerPage,
    currentSeasonPage * seasonsPerPage + seasonsPerPage
  )

  const normalizeDriverListKey = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const starterDriverKeys = new Set()

  ;(statistiche.driverStandings || []).forEach(standing => {
    const standingId = standing?.Driver?.driverId
    const standingGiven = standing?.Driver?.givenName
    const standingFamily = standing?.Driver?.familyName
    starterDriverKeys.add(normalizeDriverListKey(standingId))
    starterDriverKeys.add(normalizeDriverListKey(standingFamily))
    starterDriverKeys.add(normalizeDriverListKey(`${standingGiven || ''}_${standingFamily || ''}`))
  })

  ;(statistiche.results || []).forEach(race => {
    ;(race?.Results || []).forEach(res => {
      const resultId = res?.Driver?.driverId
      const resultGiven = res?.Driver?.givenName
      const resultFamily = res?.Driver?.familyName
      starterDriverKeys.add(normalizeDriverListKey(resultId))
      starterDriverKeys.add(normalizeDriverListKey(resultFamily))
      starterDriverKeys.add(normalizeDriverListKey(`${resultGiven || ''}_${resultFamily || ''}`))
    })
  })

  const isStarterDriver = (driver) => {
    const keys = [
      normalizeDriverListKey(driver?.driverId),
      normalizeDriverListKey(driver?.apiDriverId),
      normalizeDriverListKey(driver?.familyName),
      normalizeDriverListKey(`${driver?.givenName || ''}_${driver?.familyName || ''}`)
    ].filter(Boolean)
    return keys.some(key => starterDriverKeys.has(key))
  }

  const driversList = (statistiche.drivers || [])
    .slice()
    .sort((a, b) => {
      const starterDiff = Number(isStarterDriver(b)) - Number(isStarterDriver(a))
      if (starterDiff !== 0) return starterDiff
      return `${a.familyName || ''} ${a.givenName || ''}`.localeCompare(`${b.familyName || ''} ${b.givenName || ''}`)
    })
  const constructorsList = (statistiche.constructors || [])
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const seasonCircuitsList = (statistiche.circuits || [])
    .slice()
    .sort((a, b) => (a.circuitName || '').localeCompare(b.circuitName || ''))
  const seasonCalendarList = (statistiche.races || [])
    .slice()
    .sort((a, b) => Number(a.round || 0) - Number(b.round || 0))
  const mergeRaceRows = (races, primaryKey, fallbackKey = null) => {
    const list = Array.isArray(races) ? races : []
    const map = new Map()

    const mergeUnique = (existing = [], incoming = []) => {
      const out = [...existing]
      const seen = new Set(out.map(item => `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`))
      incoming.forEach(item => {
        const key = `${item?.Driver?.driverId || ''}-${item?.position || ''}-${item?.number || ''}`
        if (!seen.has(key)) {
          out.push(item)
          seen.add(key)
        }
      })
      return out
    }

    list.forEach(race => {
      const raceKey = `${race?.season || ''}-${race?.round || ''}`
      const prev = map.get(raceKey)
      if (!prev) {
        map.set(raceKey, race)
        return
      }

      const prevPrimary = prev?.[primaryKey] || []
      const racePrimary = race?.[primaryKey] || []
      const merged = mergeUnique(prevPrimary, racePrimary)

      const nextRace = {
        ...prev,
        ...race,
        [primaryKey]: merged
      }

      if (fallbackKey) {
        nextRace[fallbackKey] = merged
      }

      map.set(raceKey, nextRace)
    })

    return Array.from(map.values()).sort((a, b) => Number(a?.round || 0) - Number(b?.round || 0))
  }

  const seasonResultsList = mergeRaceRows(statistiche.results || [], 'Results')
  const seasonQualifyingList = mergeRaceRows(statistiche.qualifying || [], 'QualifyingResults', 'Qualifying')
  const seasonSprintList = mergeRaceRows(statistiche.sprint || [], 'Results')
  const resolveDriverTeamName = (driver) => {
    const directTeam = String(driver?.team || '').trim()
    if (directTeam) return directTeam

    const standingMatch = (statistiche.driverStandings || []).find(standing => {
      const standingId = String(standing?.Driver?.driverId || '').toLowerCase()
      const localId = String(driver?.driverId || '').toLowerCase()
      const apiId = String(driver?.apiDriverId || '').toLowerCase()
      return standingId === localId || (apiId && standingId === apiId)
    })

    const standingTeam = standingMatch?.Constructors?.[0]?.name
    if (standingTeam) return standingTeam

    const resultMatch = (seasonResultsList || [])
      .flatMap(race => getResultsForRace(race))
      .find(res => {
        const resultId = String(res?.Driver?.driverId || '').toLowerCase()
        const localId = String(driver?.driverId || '').toLowerCase()
        const apiId = String(driver?.apiDriverId || '').toLowerCase()
        return resultId === localId || (apiId && resultId === apiId)
      })

    return resultMatch?.Constructor?.name || '-'
  }
  const seasonSprintQualifyingList = seasonSprintList.map(race => {
    const directSprintQualifyingRows = race?.SprintQualifyingResults || race?.SprintShootoutResults || []
    const fallbackSprintRows = getResultsForRace(race)
    const sourceRows = directSprintQualifyingRows.length > 0 ? directSprintQualifyingRows : fallbackSprintRows

    const sprintQualifyingRows = (sourceRows || [])
      .filter(row => {
        const hasGrid = row?.grid !== undefined && row?.grid !== null && String(row.grid).trim() !== ''
        const hasPos = row?.position !== undefined && row?.position !== null && String(row.position).trim() !== ''
        return hasGrid || hasPos
      })
      .slice()
      .sort((a, b) => Number(a?.grid || a?.position || 999) - Number(b?.grid || b?.position || 999))

    const hasSprintSplitTimes = sprintQualifyingRows.some(row =>
      row?.SQ1 || row?.SQ2 || row?.SQ3 || row?.sq1 || row?.sq2 || row?.sq3 ||
      row?.Q1 || row?.Q2 || row?.Q3 || row?.q1 || row?.q2 || row?.q3
    )

    return {
      ...race,
      SprintQualifyingResults: sprintQualifyingRows,
      hasSprintSplitTimes
    }
  })
  const selectedConstructor = constructorsList.find(constructor => constructor.constructorId === selectedConstructorId)
  const normalizeKey = (value) => String(value || '').trim().toLowerCase()
  const normalizeConstructorKey = (value) => {
    const normalized = String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(f1|team|scuderia|formula|one)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const aliases = {
      rb: 'racing bulls',
      'rb f1': 'racing bulls',
      'racing bull': 'racing bulls',
      'red bull racing': 'red bull',
      'mercedes benz': 'mercedes',
      'aston martin aramco': 'aston martin',
      'haas f1': 'haas',
      'cadillac f1': 'cadillac'
    }

    return aliases[normalized] || normalized
  }
  const selectedConstructorMatchKeys = new Set([
    normalizeConstructorKey(selectedConstructorId),
    normalizeConstructorKey(selectedConstructor?.name),
    normalizeConstructorKey(selectedConstructor?.apiConstructorId)
  ].filter(Boolean))

  if (selectedConstructorMatchKeys.has('racing bulls')) {
    ['rb', 'alphatauri', 'toro rosso', 'toro_rosso', 'minardi'].forEach(alias => {
      selectedConstructorMatchKeys.add(normalizeConstructorKey(alias))
    })
  }

  const matchesSelectedConstructor = ({ constructorId, constructorName }) => {
    const idNorm = normalizeConstructorKey(constructorId)
    const nameNorm = normalizeConstructorKey(constructorName)

    if (
      normalizeKey(constructorId) === normalizeKey(selectedConstructorId) ||
      normalizeKey(constructorName) === normalizeKey(selectedConstructor?.name)
    ) {
      return true
    }

    if (selectedConstructorMatchKeys.has(idNorm) || selectedConstructorMatchKeys.has(nameNorm)) {
      return true
    }

    for (const key of selectedConstructorMatchKeys) {
      if (!key) continue
      if ((idNorm && (idNorm.includes(key) || key.includes(idNorm))) || (nameNorm && (nameNorm.includes(key) || key.includes(nameNorm)))) {
        return true
      }
    }

    return false
  }
  const selectedConstructorStanding = (statistiche.constructorStandings || []).find(standing => {
    const standingId = standing?.Constructor?.constructorId
    const standingName = standing?.Constructor?.name
    const selectedIdNorm = normalizeConstructorKey(selectedConstructorId)
    const selectedNameNorm = normalizeConstructorKey(selectedConstructor?.name)
    const standingIdNorm = normalizeConstructorKey(standingId)
    const standingNameNorm = normalizeConstructorKey(standingName)

    return (
      normalizeKey(standingId) === normalizeKey(selectedConstructorId) ||
      normalizeKey(standingName) === normalizeKey(selectedConstructor?.name) ||
      standingIdNorm === selectedIdNorm ||
      standingNameNorm === selectedNameNorm ||
      standingIdNorm === selectedNameNorm ||
      standingNameNorm === selectedIdNorm ||
      (standingNameNorm && selectedNameNorm && (standingNameNorm.includes(selectedNameNorm) || selectedNameNorm.includes(standingNameNorm)))
    )
  })

  const selectedConstructorResults = selectedConstructorId
    ? [
        ...(seasonResultsList || []).map(race => ({ race, eventType: 'Gara' })),
        ...(seasonSprintList || []).map(race => ({ race, eventType: 'Sprint' }))
      ]
        .flatMap(({ race, eventType }) =>
          getResultsForRace(race)
            .filter(res => {
              const constructorId = res?.Constructor?.constructorId
              const constructorName = res?.Constructor?.name
              return matchesSelectedConstructor({ constructorId, constructorName })
            })
            .map(res => ({ race, res, eventType }))
        )
        .sort((a, b) => {
          const dateA = a?.race?.date ? new Date(a.race.date).getTime() : 0
          const dateB = b?.race?.date ? new Date(b.race.date).getTime() : 0
          if (dateA !== dateB) return dateA - dateB

          const roundA = Number(a?.race?.round || 0)
          const roundB = Number(b?.race?.round || 0)
          if (roundA !== roundB) return roundA - roundB

          if (a?.eventType === b?.eventType) return 0
          return a?.eventType === 'Sprint' ? -1 : 1
        })
    : []

  const normalizeStatus = (status) => String(status || '').toLowerCase()
  const isDnsStatus = (status) => {
    const s = normalizeStatus(status)
    return s === 'dns' || s.includes('did not start')
  }
  const isDsqStatus = (status) => normalizeStatus(status).includes('disqual')
  const isDnfStatus = (status) => {
    const s = normalizeStatus(status)
    if (!s) return false
    if (isDnsStatus(s) || isDsqStatus(s)) return false
    return s === 'retired' ||
      s.includes('accident') ||
      s.includes('collision') ||
      s.includes('spun off') ||
      s.includes('engine') ||
      s.includes('gearbox') ||
      s.includes('transmission') ||
      s.includes('hydraulic') ||
      s.includes('electrical') ||
      s.includes('suspension') ||
      s.includes('brake') ||
      s.includes('tyre') ||
      s.includes('tire') ||
      s.includes('overheat') ||
      s.includes('mechanical') ||
      s.includes('puncture') ||
      s.includes('not classified') ||
      s.includes('+')
  }

  const selectedConstructorResultsNoSprint = selectedConstructorResults.filter(entry => entry?.eventType !== 'Sprint')

  const calculateConstructorStats = (entries) => {
    const wins = entries.filter(({ res }) => String(res?.position) === '1').length
    const podiums = entries.filter(({ res }) => ['1', '2', '3'].includes(String(res?.position))).length
    const dnf = entries.filter(({ res }) => isDnfStatus(res?.status)).length
    const dns = entries.filter(({ res }) => isDnsStatus(res?.status)).length
    const dsq = entries.filter(({ res }) => isDsqStatus(res?.status)).length
    const points = entries.reduce((sum, { res }) => sum + Number(res?.points || 0), 0)

    const bestEntry = entries.reduce((best, entry) => {
      const currentPos = Number(entry?.res?.position)
      if (!Number.isFinite(currentPos)) return best
      if (!best) return entry

      const bestPos = Number(best?.res?.position)
      if (!Number.isFinite(bestPos) || currentPos < bestPos) return entry
      if (currentPos > bestPos) return best

      const bestDate = best?.race?.date ? new Date(best.race.date).getTime() : 0
      const currentDate = entry?.race?.date ? new Date(entry.race.date).getTime() : 0
      return currentDate > bestDate ? entry : best
    }, null)

    const lastPodiumEntry = entries
      .filter(({ res }) => ['1', '2', '3'].includes(String(res?.position)))
      .reduce((latest, entry) => {
        if (!latest) return entry
        const latestDate = latest?.race?.date ? new Date(latest.race.date).getTime() : 0
        const currentDate = entry?.race?.date ? new Date(entry.race.date).getTime() : 0
        return currentDate > latestDate ? entry : latest
      }, null)

    return {
      races: entries.length,
      wins,
      podiums,
      dnf,
      dns,
      dsq,
      points,
      bestEntry,
      lastPodiumEntry
    }
  }

  const selectedConstructorStatsNoSprint = calculateConstructorStats(selectedConstructorResultsNoSprint)
  const selectedConstructorStatsWithSprint = calculateConstructorStats(selectedConstructorResults)
  const selectedConstructorSeasonBestEntryForDisplay = selectedConstructorStatsNoSprint.bestEntry || selectedConstructorStatsWithSprint.bestEntry
  const selectedConstructorSeasonPoints = selectedConstructorStanding?.points ?? selectedConstructorStatsNoSprint.points
  const selectedConstructorSeasonBestEntry = selectedConstructorStatsWithSprint.bestEntry
  const selectedConstructorSeasonLastPodiumEntry = selectedConstructorStatsWithSprint.lastPodiumEntry

  const selectedConstructorGeneralStats = careerConstructorStats || null
  const selectedConstructorGeneralBestEntry = selectedConstructorGeneralStats?.bestEntry || null
  const selectedConstructorGeneralLastPodiumEntry = selectedConstructorGeneralStats?.lastPodiumEntry || null

  const selectedConstructorSeasonInfoItems = selectedConstructor ? [
    { label: 'Gare disputate', value: selectedConstructorStatsNoSprint.races, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.races}` },
    { label: 'Vittorie', value: selectedConstructorStatsNoSprint.wins, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.wins}`, metricType: 'wins', detailEntries: getMetricEntriesForDetails(selectedConstructorResultsNoSprint, 'wins') },
    { label: 'Podi', value: selectedConstructorStatsNoSprint.podiums, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.podiums}`, metricType: 'podiums', detailEntries: getMetricEntriesForDetails(selectedConstructorResultsNoSprint, 'podiums') },
    { label: 'DNF', value: selectedConstructorStatsNoSprint.dnf, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.dnf}`, metricType: 'dnf', detailEntries: getMetricEntriesForDetails(selectedConstructorResultsNoSprint, 'dnf') },
    { label: 'DNS', value: selectedConstructorStatsNoSprint.dns, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.dns}`, metricType: 'dns', detailEntries: getMetricEntriesForDetails(selectedConstructorResultsNoSprint, 'dns') },
    { label: 'DSQ', value: selectedConstructorStatsNoSprint.dsq, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.dsq}`, metricType: 'dsq', detailEntries: getMetricEntriesForDetails(selectedConstructorResultsNoSprint, 'dsq') },
    { label: 'Punti', value: selectedConstructorSeasonPoints, secondary: `Con sprint: ${selectedConstructorStatsWithSprint.points}` },
    {
      label: 'Miglior risultato',
      value: selectedConstructorSeasonBestEntryForDisplay ? `P${selectedConstructorSeasonBestEntryForDisplay.res?.position}` : '-',
      secondary: `Con sprint: ${selectedConstructorStatsWithSprint.bestEntry ? `P${selectedConstructorStatsWithSprint.bestEntry.res?.position}` : '-'}`
    }
  ] : []

  const selectedConstructorGeneralInfoItems = selectedConstructor ? [
    { label: 'Gare disputate', value: selectedConstructorGeneralStats?.races ?? '-' },
    { label: 'Vittorie', value: selectedConstructorGeneralStats?.wins ?? '-', metricType: 'wins', detailEntries: getMetricEntriesForDetails(selectedConstructorGeneralStats?.entries || [], 'wins') },
    { label: 'Podi', value: selectedConstructorGeneralStats?.podiums ?? '-', metricType: 'podiums', detailEntries: getMetricEntriesForDetails(selectedConstructorGeneralStats?.entries || [], 'podiums') },
    { label: 'DNF', value: selectedConstructorGeneralStats?.dnf ?? '-', metricType: 'dnf', detailEntries: getMetricEntriesForDetails(selectedConstructorGeneralStats?.entries || [], 'dnf') },
    { label: 'DNS', value: selectedConstructorGeneralStats?.dns ?? '-', metricType: 'dns', detailEntries: getMetricEntriesForDetails(selectedConstructorGeneralStats?.entries || [], 'dns') },
    { label: 'DSQ', value: selectedConstructorGeneralStats?.dsq ?? '-', metricType: 'dsq', detailEntries: getMetricEntriesForDetails(selectedConstructorGeneralStats?.entries || [], 'dsq') },
    { label: 'Punti', value: selectedConstructorGeneralStats?.points ?? '-' },
    {
      label: 'Miglior risultato',
      value: selectedConstructorGeneralBestEntry ? `P${selectedConstructorGeneralBestEntry.res?.position}` : '-'
    }
  ] : []

  const selectedConstructorSeasonBestResultRaceLabel = selectedConstructorSeasonBestEntry
    ? `${selectedConstructorSeasonBestEntry.race?.raceName || '-'} • ${formatDateItalian(selectedConstructorSeasonBestEntry.race?.date)} • ${selectedConstructorSeasonBestEntry.eventType || 'Gara'}`
    : '-'

  const selectedConstructorSeasonLastPodiumLabel = selectedConstructorSeasonLastPodiumEntry
    ? `P${selectedConstructorSeasonLastPodiumEntry.res?.position} • ${selectedConstructorSeasonLastPodiumEntry.race?.raceName || '-'} • ${formatDateItalian(selectedConstructorSeasonLastPodiumEntry.race?.date)} • ${selectedConstructorSeasonLastPodiumEntry.eventType || 'Gara'}`
    : 'Nessun podio'

  const selectedConstructorGeneralLastPodiumLabel = selectedConstructorGeneralLastPodiumEntry
    ? `P${selectedConstructorGeneralLastPodiumEntry.res?.position} • ${selectedConstructorGeneralLastPodiumEntry.race?.raceName || '-'} • ${formatDateItalian(selectedConstructorGeneralLastPodiumEntry.race?.date)}`
    : 'Nessun podio'

  function getMetricEntriesForDetails(entries, metricType) {
    const list = Array.isArray(entries) ? entries : []

    const filtered = list.filter(({ res }) => {
      if (metricType === 'wins') return String(res?.position) === '1'
      if (metricType === 'podiums') return ['1', '2', '3'].includes(String(res?.position))
      if (metricType === 'dnf') return isDnfStatus(res?.status)
      if (metricType === 'dns') return isDnsStatus(res?.status)
      if (metricType === 'dsq') return isDsqStatus(res?.status)
      return false
    })

    return filtered
      .slice()
      .sort((a, b) => {
        const dateA = a?.race?.date ? new Date(a.race.date).getTime() : 0
        const dateB = b?.race?.date ? new Date(b.race.date).getTime() : 0
        if (dateA !== dateB) return dateB - dateA
        return Number(b?.race?.round || 0) - Number(a?.race?.round || 0)
      })
      .map((entry, index) => {
        const raceName = entry?.race?.raceName || '-'
        const date = formatDateItalian(entry?.race?.date)
        const eventType = entry?.eventType || ''
        const position = Number.isFinite(Number(entry?.res?.position)) ? `P${entry?.res?.position}` : null
        const status = entry?.res?.status ? String(entry.res.status) : null
        const resultText = position || status || '-'
        const driverName = `${entry?.res?.Driver?.givenName || ''} ${entry?.res?.Driver?.familyName || ''}`.trim() || entry?.res?.Driver?.driverId || '-'
        return {
          key: `${raceName}-${entry?.race?.season || ''}-${entry?.race?.round || ''}-${entry?.res?.Driver?.driverId || ''}-${index}`,
          raceName,
          date,
          eventType,
          resultText,
          driverName,
          text: `${driverName} • ${raceName} • ${date}${eventType ? ` • ${eventType}` : ''} • ${resultText}`
        }
      })
  }

  const selectedDriver = driversList.find(driver => driver.driverId === selectedDriverId)
  const normalizeDriverKey = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  const selectedDriverCandidateIds = new Set([
    String(selectedDriverId || '').toLowerCase(),
    String(selectedDriver?.apiDriverId || '').toLowerCase(),
    normalizeDriverKey(selectedDriver?.familyName),
    normalizeDriverKey(`${selectedDriver?.givenName || ''}_${selectedDriver?.familyName || ''}`),
    normalizeDriverKey(selectedDriver?.givenName)
  ].filter(Boolean))

  const matchesSelectedDriverResult = (res) => {
    const apiId = String(res?.Driver?.driverId || '').toLowerCase()
    const apiGiven = String(res?.Driver?.givenName || '')
    const apiFamily = String(res?.Driver?.familyName || '')
    const apiFullNorm = normalizeDriverKey(`${apiGiven}_${apiFamily}`)
    const apiFamilyNorm = normalizeDriverKey(apiFamily)

    if (selectedDriverCandidateIds.has(apiId)) return true
    if (selectedDriverCandidateIds.has(apiFullNorm)) return true
    if (selectedDriverCandidateIds.has(apiFamilyNorm)) return true
    return false
  }

  const selectedDriverStanding = statistiche.driverStandings?.find(
    standing => standing.Driver?.driverId === selectedDriverId
  )
  const selectedDriverResults = selectedDriverId
    ? (seasonResultsList || [])
        .flatMap(race =>
          getResultsForRace(race)
            .filter(res => matchesSelectedDriverResult(res))
            .map(res => ({ race, res }))
        )
        .sort((a, b) => Number(a.race?.round || 0) - Number(b.race?.round || 0))
    : []

  const selectedDriverDns = selectedDriverResults.filter(({ res }) => {
    const statusText = (res?.status || '').toLowerCase()
    return statusText === 'dns' || statusText.includes('did not start')
  }).length

  const selectedDriverPointsFromResults = selectedDriverResults.reduce((sum, { res }) => sum + Number(res?.points || 0), 0)
  const selectedDriverPoints = selectedDriverStanding?.points ?? selectedDriverPointsFromResults
  const selectedDriverConstructorName = selectedDriver ? resolveDriverTeamName(selectedDriver) : '-'
  const selectedDriverLastWinEntry = selectedDriverResults
    .filter(({ res }) => String(res?.position) === '1')
    .reduce((latest, entry) => {
        if (!latest) return entry

        const latestDate = latest.race?.date ? new Date(latest.race.date).getTime() : 0
        const currentDate = entry.race?.date ? new Date(entry.race.date).getTime() : 0

        if (currentDate > latestDate) return entry
        if (currentDate < latestDate) return latest

        return Number(entry.race?.round || 0) > Number(latest.race?.round || 0) ? entry : latest
      }, null)

  const selectedDriverLastWinName =
    careerLastWin?.raceName ||
    selectedDriverLastWinEntry?.race?.raceName ||
    'Mai vinta'

  const selectedDriverLastWinDate =
    careerLastWin?.date ||
    selectedDriverLastWinEntry?.race?.date ||
    null

  let selectedDriverAge = '-'
  let selectedDriverBirthDate = '-'
  if (selectedDriver?.dateOfBirth) {
    selectedDriverBirthDate = formatDateItalian(selectedDriver.dateOfBirth)
    const birthDate = new Date(selectedDriver.dateOfBirth)
    const today = new Date()
    let years = today.getFullYear() - birthDate.getFullYear()
    const hasBirthdayPassed =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
    if (!hasBirthdayPassed) years -= 1
    if (!Number.isNaN(years) && years >= 0) selectedDriverAge = `${years}`
  }

  const selectedDriverGeneralWins = careerDriverStats?.wins ?? selectedDriver?.stats?.wins ?? 0
  const selectedDriverGeneralPodiums = careerDriverStats?.podiums ?? selectedDriver?.stats?.podiums ?? 0
  const selectedDriverGeneralRaces = careerDriverStats?.races ?? '-'
  const selectedDriverGeneralFastestLaps = careerDriverStats?.fastestLaps ?? '-'
  const selectedDriverGeneralDnf = careerDriverStats?.dnf ?? selectedDriver?.stats?.dnf ?? 0
  const selectedDriverGeneralDns = careerDriverStats?.dns ?? '-'
  const selectedDriverGeneralDsq = careerDriverStats?.dsq ?? '-'
  const selectedDriverGeneralPoints = careerDriverStats?.points ?? '-'
  const selectedDriverGeneralEntries = careerDriverStats?.entries || []
  const selectedDriverSeasonWins = selectedDriverResults.length > 0
    ? selectedDriverResults.filter(({ res }) => String(res?.position) === '1').length
    : (selectedDriver?.stats?.wins ?? 0)
  const selectedDriverSeasonPodiums = selectedDriverResults.length > 0
    ? selectedDriverResults.filter(({ res }) => ['1', '2', '3'].includes(String(res?.position))).length
    : (selectedDriver?.stats?.podiums ?? 0)
  const selectedDriverSeasonDnf = selectedDriverResults.length > 0
    ? selectedDriverResults.filter(({ res }) => isDnfStatus(res?.status)).length
    : (selectedDriver?.stats?.dnf ?? 0)
  const selectedDriverSeasonDns = selectedDriverDns
  const selectedDriverSeasonDsq = selectedDriverResults.length > 0
    ? selectedDriverResults.filter(({ res }) => isDsqStatus(res?.status)).length
    : (selectedDriver?.stats?.dsq ?? 0)

  const selectedDriverSeasonLastWinName = selectedDriverLastWinEntry?.race?.raceName || 'Mai vinta'
  const selectedDriverSeasonLastWinDate = selectedDriverLastWinEntry?.race?.date || null
  let selectedDriverSeasonDaysWithoutWin = '-'
  if (selectedDriverSeasonLastWinDate) {
    const winDate = new Date(selectedDriverSeasonLastWinDate)
    const today = new Date()
    const diffTime = Math.abs(today - winDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    selectedDriverSeasonDaysWithoutWin = Number.isFinite(diffDays) ? `${diffDays}` : '-'
  } else if ((selectedDriverResults || []).length > 0 && selectedDriverSeasonWins === 0) {
    selectedDriverSeasonDaysWithoutWin = 'Mai vinto'
  }

  const selectedDriverSeasonInfoItems = selectedDriver ? [
    { label: 'Vittorie', value: selectedDriverSeasonWins, metricType: 'wins', detailEntries: getMetricEntriesForDetails(selectedDriverResults, 'wins') },
    { label: 'Podi', value: selectedDriverSeasonPodiums, metricType: 'podiums', detailEntries: getMetricEntriesForDetails(selectedDriverResults, 'podiums') },
    { label: 'DNF', value: selectedDriverSeasonDnf, metricType: 'dnf', detailEntries: getMetricEntriesForDetails(selectedDriverResults, 'dnf') },
    { label: 'DNS', value: selectedDriverSeasonDns, metricType: 'dns', detailEntries: getMetricEntriesForDetails(selectedDriverResults, 'dns') },
    { label: 'DSQ', value: selectedDriverSeasonDsq, metricType: 'dsq', detailEntries: getMetricEntriesForDetails(selectedDriverResults, 'dsq') },
    { label: 'Punti', value: selectedDriverPoints }
  ] : []

  const selectedDriverGeneralInfoItems = selectedDriver ? [
    { label: 'Gare disputate', value: selectedDriverGeneralRaces },
    { label: 'Giri veloci', value: selectedDriverGeneralFastestLaps },
    { label: 'Vittorie', value: selectedDriverGeneralWins, metricType: 'wins', detailEntries: getMetricEntriesForDetails(selectedDriverGeneralEntries, 'wins') },
    { label: 'Podi', value: selectedDriverGeneralPodiums, metricType: 'podiums', detailEntries: getMetricEntriesForDetails(selectedDriverGeneralEntries, 'podiums') },
    { label: 'DNF', value: selectedDriverGeneralDnf, metricType: 'dnf', detailEntries: getMetricEntriesForDetails(selectedDriverGeneralEntries, 'dnf') },
    { label: 'DNS', value: selectedDriverGeneralDns, metricType: 'dns', detailEntries: getMetricEntriesForDetails(selectedDriverGeneralEntries, 'dns') },
    { label: 'DSQ', value: selectedDriverGeneralDsq, metricType: 'dsq', detailEntries: getMetricEntriesForDetails(selectedDriverGeneralEntries, 'dsq') },
    { label: 'Punti', value: selectedDriverGeneralPoints }
  ] : []

  const selectedDriverFullName = `${selectedDriver?.givenName || ''} ${selectedDriver?.familyName || ''}`.trim() || '-'
  const selectedDriverAgeLabel = selectedDriverAge !== '-' ? `${selectedDriverAge} anni` : '-'
  const selectedDriverAgeWithBirthDate =
    selectedDriverBirthDate !== '-' ? `${selectedDriverAgeLabel} • ${selectedDriverBirthDate}` : selectedDriverAgeLabel

  if (selectedDriver) {
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
            onClick={() => setSelectedDriverId(null)}
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
            Piloti
          </button>
        </div>

        <div style={{
          background: 'linear-gradient(180deg, rgba(12,14,19,0.94) 0%, rgba(8,10,14,0.92) 100%)',
          border: '1px solid rgba(95, 121, 160, 0.35)',
          boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
          borderRadius: '14px',
          padding: isMobile ? '16px' : '22px',
          maxWidth: '980px',
          width: '100%',
          color: '#FFF',
          marginTop: isMobile ? '120px' : '70px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(24,35,54,0.75) 0%, rgba(16,21,30,0.72) 100%)',
            border: '1px solid rgba(138, 180, 248, 0.35)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '14px',
            marginBottom: '14px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#9EC5FF',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              fontWeight: '700',
              marginBottom: '6px'
            }}>
              Scheda pilota
            </div>
            <div style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: '800',
              color: '#FFF',
              lineHeight: 1.1,
              marginBottom: '10px'
            }}>
              {selectedDriverFullName}
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: isMobile ? '14px' : '22px',
              overflowX: 'auto',
              paddingTop: '8px',
              paddingBottom: '4px',
              borderTop: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ minWidth: isMobile ? '170px' : '220px', paddingRight: isMobile ? '0' : '12px' }}>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Team</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', lineHeight: 1.25 }}>{selectedDriverConstructorName || '-'}</div>
              </div>
              <div style={{ minWidth: isMobile ? '140px' : '180px', paddingRight: isMobile ? '0' : '12px' }}>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Nazionalità</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{selectedDriver.nationality || '-'}</div>
              </div>
              <div style={{ minWidth: isMobile ? '180px' : '230px' }}>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Età</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{selectedDriverAgeWithBirthDate}</div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: isMobile ? '14px' : '22px',
              overflowX: 'auto',
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ minWidth: isMobile ? '220px' : '320px' }}>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Ultima gara vinta</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{selectedDriverLastWinName}</div>
                {selectedDriverLastWinDate ? (
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                    {formatDateItalian(selectedDriverLastWinDate)} • P1
                  </div>
                ) : null}
              </div>
              <div style={{ minWidth: isMobile ? '210px' : '260px' }}>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Giorni da ultima vittoria</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#D8E8FF' }}>{careerDaysWithoutWin}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '12px',
              padding: '10px'
            }}>
              <div style={{ fontSize: '13px', color: '#9EC5FF', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.3px' }}>Stagione attuale</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
                gap: '10px',
                alignItems: 'start'
              }}>
                {selectedDriverSeasonInfoItems.map((item, idx) => {
                  const cardKey = `driver-season-${item.label}-${idx}`
                  const isClickable = !!item.metricType
                  const isExpanded = expandedDriverMetric === cardKey
                  return (
                    <div
                      key={cardKey}
                      onClick={() => {
                        if (!isClickable) return
                        setExpandedDriverMetric(isExpanded ? null : cardKey)
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '10px',
                        padding: '10px',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        cursor: isClickable ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#BDBDBD', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span>{item.label}</span>
                        {isClickable ? <span style={{ color: 'rgba(255,255,255,0.72)' }}>{isExpanded ? '▾' : '▸'}</span> : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF', wordBreak: 'break-word' }}>{item.value}</div>
                        {item.secondary ? (
                          <div style={{ fontSize: '15px', fontWeight: '400', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                            {item.secondary}
                          </div>
                        ) : null}
                      </div>
                      {isClickable && isExpanded ? (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                          {(item.detailEntries || []).length > 0 ? (
                            <div style={{ display: 'grid', gap: '6px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                              {(item.detailEntries || []).map(detail => (
                                <div
                                  key={detail.key}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '7px 8px'
                                  }}
                                >
                                  <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: '700', lineHeight: 1.2 }}>
                                    {detail.driverName || '-'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.78)', marginTop: '2px', lineHeight: 1.3 }}>
                                    {detail.raceName || '-'} • {detail.date || '-'}{detail.eventType ? ` • ${detail.eventType}` : ''}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#9EC5FF', marginTop: '2px', fontWeight: '700' }}>
                                    {detail.resultText || '-'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Nessuna gara trovata.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '12px',
              padding: '10px'
            }}>
              <div style={{ fontSize: '13px', color: '#9EC5FF', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.3px' }}>Dati generali</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
                gap: '10px',
                alignItems: 'start'
              }}>
                {selectedDriverGeneralInfoItems.map((item, idx) => {
                  const cardKey = `driver-general-${item.label}-${idx}`
                  const isClickable = !!item.metricType
                  const isExpanded = expandedDriverMetric === cardKey
                  return (
                    <div
                      key={cardKey}
                      onClick={() => {
                        if (!isClickable) return
                        setExpandedDriverMetric(isExpanded ? null : cardKey)
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '10px',
                        padding: '10px',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        cursor: isClickable ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#BDBDBD', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span>{item.label}</span>
                        {isClickable ? <span style={{ color: 'rgba(255,255,255,0.72)' }}>{isExpanded ? '▾' : '▸'}</span> : null}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFF', wordBreak: 'break-word' }}>{item.value}</div>
                        {item.secondary ? (
                          <div style={{ fontSize: '15px', fontWeight: '400', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
                            {item.secondary}
                          </div>
                        ) : null}
                      </div>
                      {isClickable && isExpanded ? (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                          {(item.detailEntries || []).length > 0 ? (
                            <div style={{ display: 'grid', gap: '6px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                              {(item.detailEntries || []).map(detail => (
                                <div
                                  key={detail.key}
                                  style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '7px 8px'
                                  }}
                                >
                                  <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: '700', lineHeight: 1.2 }}>
                                    {detail.driverName || '-'}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.78)', marginTop: '2px', lineHeight: 1.3 }}>
                                    {detail.raceName || '-'} • {detail.date || '-'}{detail.eventType ? ` • ${detail.eventType}` : ''}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#9EC5FF', marginTop: '2px', fontWeight: '700' }}>
                                    {detail.resultText || '-'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Nessuna gara trovata.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (selectedConstructor) {
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
            onClick={() => setSelectedConstructorId(null)}
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
            Team
          </button>
        </div>

        <div style={{
          background: 'linear-gradient(180deg, rgba(12,14,19,0.94) 0%, rgba(8,10,14,0.92) 100%)',
          border: '1px solid rgba(95, 121, 160, 0.35)',
          boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
          borderRadius: '14px',
          padding: isMobile ? '16px' : '22px',
          maxWidth: '980px',
          width: '100%',
          color: '#FFF',
          marginTop: isMobile ? '120px' : '70px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(24,35,54,0.75) 0%, rgba(16,21,30,0.72) 100%)',
            border: '1px solid rgba(138, 180, 248, 0.35)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '14px',
            marginBottom: '14px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#9EC5FF',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              fontWeight: '700',
              marginBottom: '6px'
            }}>
              Scheda scuderia
            </div>
            <div style={{
              fontSize: isMobile ? '22px' : '28px',
              fontWeight: '800',
              color: '#FFF',
              lineHeight: 1.1,
              marginBottom: '10px'
            }}>
              {selectedConstructor.name || '-'}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Nazionalità</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>{selectedConstructor.nationality || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Posizione in classifica</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>
                  <span style={{ color: selectedConstructorStanding?.position ? getPodiumPositionColor(selectedConstructorStanding.position) : '#FFF' }}>
                    {selectedConstructorStanding?.position ? `P${selectedConstructorStanding.position}` : '-'}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Ultimo podio stagione</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#D8E8FF' }}>{selectedConstructorSeasonLastPodiumLabel}</div>
              </div>
            </div>
            <div style={{
              marginTop: '10px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '2px' }}>Ultimo podio generale</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#D8E8FF' }}>{selectedConstructorGeneralLastPodiumLabel}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '12px',
              padding: '10px'
            }}>
              <div style={{ fontSize: '13px', color: '#9EC5FF', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.3px' }}>Stagione selezionata</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
                gap: '10px',
                alignItems: 'start'
              }}>
                {selectedConstructorSeasonInfoItems.map((item, idx) => {
                  const cardKey = `constructor-season-${item.label}-${idx}`
                  const isClickable = !!item.metricType
                  const isExpanded = expandedConstructorMetric === cardKey
                  return (
                    <div
                      key={cardKey}
                      onClick={() => {
                        if (!isClickable) return
                        setExpandedConstructorMetric(isExpanded ? null : cardKey)
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '10px',
                        padding: '10px',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        cursor: isClickable ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#BDBDBD', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span>{item.label}</span>
                        {isClickable ? <span style={{ color: 'rgba(255,255,255,0.72)' }}>{isExpanded ? '▾' : '▸'}</span> : null}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#FFF' }}>{item.value}</div>
                      {item.secondary ? (
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.68)', marginTop: '4px' }}>{item.secondary}</div>
                      ) : null}
                      {isClickable && isExpanded ? (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                          {(item.detailEntries || []).length > 0 ? (
                            <div style={{ display: 'grid', gap: '4px', maxHeight: '170px', overflowY: 'auto', paddingRight: '4px' }}>
                              {(item.detailEntries || []).map(detail => (
                                <div key={detail.key} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.3 }}>{detail.text}</div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Nessuna gara trovata.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', color: '#BDBDBD' }}>Miglior risultato stagione (con sprint)</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.76)', marginTop: '4px' }}>{selectedConstructorSeasonBestResultRaceLabel}</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '12px',
              padding: '10px'
            }}>
              <div style={{ fontSize: '13px', color: '#9EC5FF', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.3px' }}>Dati generali</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(2, 1fr)',
                gap: '10px',
                alignItems: 'start'
              }}>
                {selectedConstructorGeneralInfoItems.map((item, idx) => {
                  const cardKey = `constructor-general-${item.label}-${idx}`
                  const isClickable = !!item.metricType
                  const isExpanded = expandedConstructorMetric === cardKey
                  return (
                    <div
                      key={cardKey}
                      onClick={() => {
                        if (!isClickable) return
                        setExpandedConstructorMetric(isExpanded ? null : cardKey)
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '10px',
                        padding: '10px',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                        cursor: isClickable ? 'pointer' : 'default'
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#BDBDBD', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span>{item.label}</span>
                        {isClickable ? <span style={{ color: 'rgba(255,255,255,0.72)' }}>{isExpanded ? '▾' : '▸'}</span> : null}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#FFF' }}>{item.value}</div>
                      {isClickable && isExpanded ? (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                          {(item.detailEntries || []).length > 0 ? (
                            <div style={{ display: 'grid', gap: '4px', maxHeight: '170px', overflowY: 'auto', paddingRight: '4px' }}>
                              {(item.detailEntries || []).map(detail => (
                                <div key={detail.key} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.3 }}>{detail.text}</div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Nessuna gara trovata.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Modalità semplificata: manteniamo solo il selettore stagione in alto
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
        padding: isMobile ? '18px' : '22px',
        maxWidth: '1200px',
        width: '100%',
        color: '#FFF',
        marginTop: isMobile ? '120px' : '70px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'center',
          gap: '12px',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setSelectedSeason('current')}
            style={{
              padding: '10px 18px',
              background: selectedSeason === 'current' ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
              border: selectedSeason === 'current' ? '2px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '999px',
              color: '#FFF',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              minWidth: isMobile ? '100%' : '155px',
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? '320px' : 'none'
            }}
          >
            Stagione corrente
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '999px',
            padding: isMobile ? '6px 8px' : '8px 12px',
            width: isMobile ? '100%' : 'auto',
            maxWidth: isMobile ? '340px' : 'none'
          }}>
            <button
              onClick={() => setSeasonCarouselPage(prev => Math.max(0, prev - 1))}
              disabled={currentSeasonPage === 0}
              style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#FFF',
                fontSize: isMobile ? '16px' : '18px',
                lineHeight: '1',
                cursor: currentSeasonPage === 0 ? 'not-allowed' : 'pointer',
                opacity: currentSeasonPage === 0 ? 0.45 : 1
              }}
            >
              ‹
            </button>

            <div style={{ display: 'flex', gap: isMobile ? '4px' : '6px' }}>
              {visiblePastSeasons.map(season => (
                <button
                  key={season.season}
                  onClick={() => setSelectedSeason(season.season)}
                  style={{
                    padding: isMobile ? '7px 8px' : '8px 12px',
                    minWidth: isMobile ? '54px' : '64px',
                    background: selectedSeason === season.season ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
                    border: selectedSeason === season.season ? '2px solid #007AFF' : '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#FFF',
                    cursor: 'pointer',
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600'
                  }}
                >
                  {season.season}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSeasonCarouselPage(prev => Math.min(totalSeasonPages - 1, prev + 1))}
              disabled={currentSeasonPage >= totalSeasonPages - 1}
              style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '999px',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#FFF',
                fontSize: isMobile ? '16px' : '18px',
                lineHeight: '1',
                cursor: currentSeasonPage >= totalSeasonPages - 1 ? 'not-allowed' : 'pointer',
                opacity: currentSeasonPage >= totalSeasonPages - 1 ? 0.45 : 1
              }}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Piloti ({driversList.length})
          </h3>

          <div style={{
            maxHeight: isMobile ? '300px' : '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {driversList.map((driver) => {
              const teamName = resolveDriverTeamName(driver)
              return (
                <button
                  key={driver.driverId}
                  onClick={() => {
                    setSelectedDriverId(driver.driverId)
                    setSelectedConstructorId(null)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedDriverId === driver.driverId ? 'rgba(0, 122, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: selectedDriverId === driver.driverId ? '1px solid rgba(0, 122, 255, 0.7)' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: isMobile ? '10px' : '11px',
                    color: '#FFF',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>
                      {driver.givenName} {driver.familyName}
                    </span>
                    <span style={{ color: '#BDBDBD', minWidth: '70px', textAlign: 'right' }}>
                      {driver.nationality || '-'}
                    </span>
                  </div>
                  <div style={{ marginTop: '3px', fontSize: '12px', color: '#D8E8FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {teamName}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Team ({constructorsList.length})
          </h3>

          <div style={{
            maxHeight: isMobile ? '300px' : '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {constructorsList.map((constructor) => (
              <button
                key={constructor.constructorId}
                onClick={() => {
                  setSelectedConstructorId(constructor.constructorId)
                  setSelectedDriverId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: selectedConstructorId === constructor.constructorId ? 'rgba(0, 122, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                  border: selectedConstructorId === constructor.constructorId ? '1px solid rgba(0, 122, 255, 0.7)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: isMobile ? '10px' : '11px',
                  color: '#FFF',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>
                    {constructor.name}
                  </span>
                  <span style={{ color: '#BDBDBD', minWidth: '70px', textAlign: 'right' }}>
                    {constructor.nationality || '-'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Calendario stagione ({seasonCalendarList.length})
          </h3>

          <div style={{
            maxHeight: isMobile ? '300px' : '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {seasonCalendarList.map((race, idx) => (
              <div
                key={`${race.season || selectedSeason}-${race.round || idx}-${idx}`}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: isMobile ? '10px' : '11px',
                  color: '#FFF'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontWeight: '600' }}>{race.raceName || '-'}</span>
                  <span style={{ color: '#BDBDBD', whiteSpace: 'nowrap' }}>R{race.round || '-'}</span>
                </div>
                <div style={{ color: '#BDBDBD', fontSize: '13px', marginTop: '2px' }}>
                  {formatDateItalian(race.date)} • {race.Circuit?.circuitName || race.circuitName || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Circuiti stagione ({seasonCircuitsList.length})
          </h3>

          <div style={{
            maxHeight: isMobile ? '300px' : '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {seasonCircuitsList.map((circuit) => (
              <div
                key={circuit.circuitId}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: isMobile ? '10px' : '11px',
                  color: '#FFF'
                }}
              >
                <div style={{ fontWeight: '600' }}>{circuit.circuitName || '-'}</div>
                <div style={{ color: '#BDBDBD', fontSize: '13px', marginTop: '2px' }}>
                  {circuit.Location?.locality || '-'} • {circuit.Location?.country || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Risultati gare ({seasonResultsList.length})
          </h3>
          <div style={{ maxHeight: isMobile ? '300px' : '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {seasonResultsList.map((race, idx) => {
              const raceKey = `main-results-${race.season || selectedSeason}-${race.round || idx}-${idx}`
              const isOpen = selectedRace?.type === 'main-results' && selectedRace?.key === raceKey
              const raceResults = getResultsForRace(race)

              return (
                <div
                  key={raceKey}
                  onClick={() => setSelectedRace(isOpen ? null : { type: 'main-results', key: raceKey })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isOpen ? 'rgba(0, 122, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: isOpen ? '1px solid rgba(0, 122, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: isMobile ? '10px' : '11px',
                    color: '#FFF',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{race.raceName || '-'}</div>
                  <div style={{ color: '#BDBDBD', fontSize: '13px', marginTop: '2px' }}>{formatDateItalian(race.date)}</div>

                  {isOpen && (
                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Pos</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Pilota</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Team</th>
                            <th style={{ padding: '4px', textAlign: 'left' }}>Tempo/Stato</th>
                            <th style={{ padding: '4px', textAlign: 'right' }}>Punti</th>
                          </tr>
                        </thead>
                        <tbody>
                          {raceResults.map((res, i) => (
                            <tr key={`${raceKey}-res-${res.Driver?.driverId || i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <td style={{ padding: '4px', color: getPodiumPositionColor(res.position) }}>{res.position || '-'}</td>
                              <td style={{ padding: '4px' }}>{res.Driver?.givenName} {res.Driver?.familyName}</td>
                              <td style={{ padding: '4px' }}>{res.Constructor?.name || '-'}</td>
                              <td style={{ padding: '4px' }}>{res.Time?.time || res.status || '-'}</td>
                              <td style={{ padding: '4px', textAlign: 'right' }}>{res.points || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Qualifiche ({seasonQualifyingList.length})
          </h3>
          <div style={{ maxHeight: isMobile ? '300px' : '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {seasonQualifyingList.map((race, idx) => {
              const raceKey = `main-qualifying-${race.season || selectedSeason}-${race.round || idx}-${idx}`
              const isOpen = selectedRace?.type === 'main-qualifying' && selectedRace?.key === raceKey
              const qualifyingRows = race.QualifyingResults || race.Qualifying || []

              return (
                <div
                  key={raceKey}
                  onClick={() => setSelectedRace(isOpen ? null : { type: 'main-qualifying', key: raceKey })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isOpen ? 'rgba(0, 122, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: isOpen ? '1px solid rgba(0, 122, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: isMobile ? '10px' : '11px',
                    color: '#FFF',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: '600' }}>{race.raceName || '-'}</div>
                  <div style={{ color: '#BDBDBD', fontSize: '13px', marginTop: '2px' }}>{formatDateItalian(race.date)}</div>

                  {isOpen && (
                    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px' }}>
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
                          {qualifyingRows.map((q, i) => (
                            <tr key={`${raceKey}-q-${q.Driver?.driverId || i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <td style={{ padding: '4px', color: getPodiumPositionColor(q.position) }}>{q.position || '-'}</td>
                              <td style={{ padding: '4px' }}>{q.Driver?.givenName} {q.Driver?.familyName}</td>
                              <td style={{ padding: '4px' }}>{q.Q1 || q.q1 || '-'}</td>
                              <td style={{ padding: '4px' }}>{q.Q2 || q.q2 || '-'}</td>
                              <td style={{ padding: '4px' }}>{q.Q3 || q.q3 || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        background: 'rgba(10, 14, 22, 0.88)',
        border: '2px solid rgba(0, 122, 255, 0.28)',
        borderRadius: '14px',
        padding: isMobile ? '14px' : '16px',
        marginBottom: '20px',
        color: '#FFF'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <h3 style={{
            fontSize: isMobile ? '17px' : '19px',
            fontWeight: '800',
            color: '#66B2FF',
            margin: '0 0 4px 0'
          }}>
            Weekend Sprint
          </h3>
          <div style={{ fontSize: '13px', color: '#B3CDEB' }}>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '16px'
        }}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.82)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '14px',
            color: '#FFF'
          }}>
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#007AFF',
              margin: '0 0 12px 0'
            }}>
              Qualifiche sprint ({seasonSprintQualifyingList.length})
            </h3>
            <div style={{ maxHeight: isMobile ? '300px' : '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {seasonSprintQualifyingList.map((race, idx) => {
                const raceKey = `main-sprint-qualifying-${race.season || selectedSeason}-${race.round || idx}-${idx}`
                const isOpen = selectedRace?.type === 'main-sprint-qualifying' && selectedRace?.key === raceKey
                const sprintQualifyingRows = race.SprintQualifyingResults || []
                const hasSprintSplitTimes = !!race.hasSprintSplitTimes

                return (
                  <div
                    key={raceKey}
                    onClick={() => setSelectedRace(isOpen ? null : { type: 'main-sprint-qualifying', key: raceKey })}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isOpen ? 'rgba(0, 122, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: isOpen ? '1px solid rgba(0, 122, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      padding: isMobile ? '10px' : '11px',
                      color: '#FFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>{race.raceName || '-'}</div>
                    <div style={{ color: '#BDBDBD', fontSize: '13px', marginTop: '2px' }}>{formatDateItalian(race.date)}</div>

                    {isOpen && (
                      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px' }}>
                        {!hasSprintSplitTimes && sprintQualifyingRows.length > 0 && (
                          <div style={{ color: '#BDBDBD', fontSize: '12px', marginBottom: '8px' }}>
                            SQ1/SQ2/SQ3 non disponibili da API per questa gara. Mostro la griglia sprint.
                          </div>
                        )}
                        {sprintQualifyingRows.length > 0 ? (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                                <th style={{ padding: '4px', textAlign: 'left' }}>Grid</th>
                                <th style={{ padding: '4px', textAlign: 'left' }}>Pilota</th>
                                <th style={{ padding: '4px', textAlign: 'left' }}>Team</th>
                                {hasSprintSplitTimes && <th style={{ padding: '4px', textAlign: 'left' }}>SQ1</th>}
                                {hasSprintSplitTimes && <th style={{ padding: '4px', textAlign: 'left' }}>SQ2</th>}
                                {hasSprintSplitTimes && <th style={{ padding: '4px', textAlign: 'left' }}>SQ3</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {sprintQualifyingRows.map((q, i) => (
                                <tr key={`${raceKey}-sq-${q.Driver?.driverId || i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                  <td style={{ padding: '4px', color: getPodiumPositionColor(q.grid || q.position) }}>{q.grid || q.position || '-'}</td>
                                  <td style={{ padding: '4px' }}>{q.Driver?.givenName} {q.Driver?.familyName}</td>
                                  <td style={{ padding: '4px' }}>{q.Constructor?.name || '-'}</td>
                                  {hasSprintSplitTimes && <td style={{ padding: '4px' }}>{q.SQ1 || q.sq1 || q.Q1 || q.q1 || '-'}</td>}
                                  {hasSprintSplitTimes && <td style={{ padding: '4px' }}>{q.SQ2 || q.sq2 || q.Q2 || q.q2 || '-'}</td>}
                                  {hasSprintSplitTimes && <td style={{ padding: '4px' }}>{q.SQ3 || q.sq3 || q.Q3 || q.q3 || '-'}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div style={{ color: '#BDBDBD', fontSize: '12px' }}>Nessun dato griglia sprint disponibile per questa gara.</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.82)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            padding: isMobile ? '12px' : '14px',
            color: '#FFF'
          }}>
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#007AFF',
              margin: '0 0 12px 0'
            }}>
              Sprint race ({seasonSprintList.length})
            </h3>
            <div style={{ maxHeight: isMobile ? '300px' : '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {seasonSprintList.map((race, idx) => {
                const raceKey = `main-sprint-${race.season || selectedSeason}-${race.round || idx}-${idx}`
                const isOpen = selectedRace?.type === 'main-sprint' && selectedRace?.key === raceKey
                const sprintResults = getResultsForRace(race)

                return (
                  <div
                    key={raceKey}
                    onClick={() => setSelectedRace(isOpen ? null : { type: 'main-sprint', key: raceKey })}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: isOpen ? 'rgba(0, 122, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: isOpen ? '1px solid rgba(0, 122, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      padding: isMobile ? '10px' : '11px',
                      color: '#FFF',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>{race.raceName || '-'}</div>
                    <div style={{ color: '#BDBDBD', fontSize: '13px', marginTop: '2px' }}>{formatDateItalian(race.date)}</div>

                    {isOpen && (
                      <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Pos</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Pilota</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Team</th>
                              <th style={{ padding: '4px', textAlign: 'left' }}>Tempo/Stato</th>
                              <th style={{ padding: '4px', textAlign: 'right' }}>Punti</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sprintResults.map((res, i) => (
                              <tr key={`${raceKey}-s-${res.Driver?.driverId || i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <td style={{ padding: '4px', color: getPodiumPositionColor(res.position) }}>{res.position || '-'}</td>
                                <td style={{ padding: '4px' }}>{res.Driver?.givenName} {res.Driver?.familyName}</td>
                                <td style={{ padding: '4px' }}>{res.Constructor?.name || '-'}</td>
                                <td style={{ padding: '4px' }}>{res.Time?.time || res.status || '-'}</td>
                                <td style={{ padding: '4px', textAlign: 'right' }}>{res.points || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Classifica Piloti ({statistiche.driverStandings?.length || 0})
          </h3>

          <div style={{
            maxHeight: isMobile ? '300px' : '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {(statistiche.driverStandings || []).map((standing, idx) => {
              const standingDriverId = standing?.Driver?.driverId
              const standingDriverName = `${standing?.Driver?.givenName || ''} ${standing?.Driver?.familyName || ''}`.trim() || '-'

              return (
                <button
                  key={`standing-driver-${standingDriverId || idx}`}
                  onClick={() => {
                    if (standingDriverId) {
                      setSelectedDriverId(standingDriverId)
                      setSelectedConstructorId(null)
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedDriverId === standingDriverId ? 'rgba(0, 122, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: selectedDriverId === standingDriverId ? '1px solid rgba(0, 122, 255, 0.7)' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: isMobile ? '10px' : '11px',
                    color: '#FFF',
                    cursor: standingDriverId ? 'pointer' : 'default',
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr auto',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: '700', color: standing?.position ? getPodiumPositionColor(standing.position, '#9EC5FF') : '#9EC5FF' }}>{standing?.position ? `P${standing.position}` : '-'}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{standingDriverName}</span>
                  <span style={{ color: '#D8E8FF', fontWeight: '700' }}>{standing?.points ?? 0} pt</span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          background: 'rgba(0, 0, 0, 0.85)',
          border: '2px solid rgba(51, 51, 51, 0.8)',
          borderRadius: '12px',
          padding: isMobile ? '14px' : '16px',
          color: '#FFF'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#007AFF',
            margin: '0 0 12px 0'
          }}>
            Classifica Costruttori ({statistiche.constructorStandings?.length || 0})
          </h3>

          <div style={{
            maxHeight: isMobile ? '300px' : '360px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {(statistiche.constructorStandings || []).map((standing, idx) => {
              const standingConstructorId = standing?.Constructor?.constructorId
              const standingConstructorName = standing?.Constructor?.name || '-'

              return (
                <button
                  key={`standing-constructor-${standingConstructorId || idx}`}
                  onClick={() => {
                    if (standingConstructorId) {
                      setSelectedConstructorId(standingConstructorId)
                      setSelectedDriverId(null)
                    }
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedConstructorId === standingConstructorId ? 'rgba(0, 122, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: selectedConstructorId === standingConstructorId ? '1px solid rgba(0, 122, 255, 0.7)' : '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: isMobile ? '10px' : '11px',
                    color: '#FFF',
                    cursor: standingConstructorId ? 'pointer' : 'default',
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr auto',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: '700', color: standing?.position ? getPodiumPositionColor(standing.position, '#9EC5FF') : '#9EC5FF' }}>{standing?.position ? `P${standing.position}` : '-'}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{standingConstructorName}</span>
                  <span style={{ color: '#D8E8FF', fontWeight: '700' }}>{standing?.points ?? 0} pt</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>


    </div>
  )

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
                          <td style={{ padding: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', color: getPodiumPositionColor(res.position) }}>{res.position}</td>
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
                          <td style={{ padding: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold', color: getPodiumPositionColor(res.position) }}>{res.position}</td>
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
