import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const ONAIR_ADDRESS = 'ON AIR BNF, 93 avenue de France, Paris 13'

// Calculer le décalage horaire Paris (UTC+1 hiver, UTC+2 été)
function getParisOffsetHours(dateStr) {
  // Heure d'été (CEST) : dernier dimanche de mars → dernier dimanche d'octobre
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  
  // Dernier dimanche de mars
  const marchLast = new Date(Date.UTC(y, 2, 31))
  while (marchLast.getUTCDay() !== 0) marchLast.setUTCDate(marchLast.getUTCDate() - 1)
  
  // Dernier dimanche d'octobre
  const octLast = new Date(Date.UTC(y, 9, 31))
  while (octLast.getUTCDay() !== 0) octLast.setUTCDate(octLast.getUTCDate() - 1)
  
  // Entre dernier dim mars et dernier dim octobre → UTC+2, sinon UTC+1
  return (date >= marchLast && date < octLast) ? 2 : 1
}

const travelCache = {}
async function getTravelMinutes(origin, destination) {
  if (!origin || !destination || origin === destination) return 0
  const key = `${origin}|||${destination}`
  if (travelCache[key] !== undefined) return travelCache[key]
  try {
    const apiKey = process.env.GOOGLE_MAPS_KEY
    if (!apiKey) {
      console.error('GOOGLE_MAPS_KEY not set!')
      travelCache[key] = 20
      return 20
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${apiKey}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const data = await res.json()
    console.log('Travel:', origin, '→', destination, '=', JSON.stringify(data?.rows?.[0]?.elements?.[0]))
    const element = data?.rows?.[0]?.elements?.[0]
    if (element?.status !== 'OK') {
      console.error('Maps API error:', element?.status)
      travelCache[key] = 20
      return 20
    }
    const duration = element.duration?.value
    const mins = duration ? Math.ceil(duration / 60) : 20
    travelCache[key] = mins
    return mins
  } catch (e) {
    console.error('Travel fetch error:', e.message)
    travelCache[key] = 20
    return 20
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const { year, month, clientId } = req.query
    const now = new Date()
    const targetYear = parseInt(year) || now.getFullYear()
    const targetMonth = parseInt(month) || now.getMonth() + 1

    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0)

    // Charger horaires, settings, exceptions, réservations
    const [ohRes, stRes, bpRes, bookRes, clientRes] = await Promise.all([
      supabase.from('opening_hours').select('*').eq('is_active', true),
      supabase.from('coaching_settings').select('*').eq('id', 'admin').single(),
      supabase.from('blocked_periods').select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]),
      supabase.from('bookings')
        .select('*, profiles(coaching_type, address), time_slots(start_time, end_time)')
        .eq('status', 'confirmed'),
      clientId ? supabase.from('profiles').select('coaching_type, address').eq('id', clientId).single() : Promise.resolve({ data: null })
    ])

    const openingHours = ohRes.data || []
    const settings = stRes.data || { session_duration: 60, buffer_time: 10, slot_increment: 60 }
    const blockedPeriods = bpRes.data || []
    let confirmedBookings = bookRes.data || []
    const clientProfile = clientRes.data

    const sessionMs = (settings.session_duration || 60) * 60 * 1000
    const incrementMs = 15 * 60 * 1000 // Créneaux tous les 15 min

    // Arrondir au quart d'heure supérieur (UTC)
    function roundUpToQuarter(date) {
      const d = new Date(date)
      const min = d.getUTCMinutes()
      const remainder = min % 15
      if (remainder > 0) {
        d.setUTCMinutes(min + (15 - remainder), 0, 0)
      } else {
        d.setUTCSeconds(0, 0)
      }
      return d
    }

    // Adresse du client demandeur
    const clientAddress = clientProfile?.coaching_type === 'domicile' ? clientProfile?.address : ONAIR_ADDRESS

    // Événements Google Calendar
    let googleBusy = []
    try {
      const { data: tokenData } = await supabase
        .from('google_tokens').select('*').eq('id', 'admin').single()
      if (tokenData?.access_token) {
        const { google } = await import('googleapis')
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        )
        oauth2Client.setCredentials({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expiry_date: tokenData.expiry_date
        })
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
        const eventsRes = await calendar.events.list({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          timeMin: startDate.toISOString(),
          timeMax: new Date(targetYear, targetMonth, 1).toISOString(),
          singleEvents: true
        })

        googleBusy = (eventsRes.data.items || [])
          .filter(e => e.start?.dateTime && e.status !== 'cancelled')
          .map(e => ({
            start: new Date(e.start.dateTime),
            end: new Date(e.end.dateTime),
            location: e.location || null
          }))
      }
    } catch (e) {
      console.log('Google Calendar error:', e.message)
    }

    // Pré-calculer tous les trajets en parallèle (évite le timeout)
    if (clientAddress) {
      const uniqueLocations = new Set()
      
      // Lieux des événements Google Calendar
      for (const g of googleBusy) {
        if (g.location && g.location !== clientAddress) uniqueLocations.add(g.location)
      }
      // Lieux des réservations
      for (const b of confirmedBookings) {
        if (!b.profiles) continue
        const addr = b.profiles.coaching_type === 'domicile' ? b.profiles.address : ONAIR_ADDRESS
        if (addr && addr !== clientAddress) uniqueLocations.add(addr)
      }

      // Limiter à 8 lieux max pour éviter le timeout Vercel (10s)
      const locations = [...uniqueLocations].slice(0, 8)
      await Promise.all(locations.map(loc => getTravelMinutes(loc, clientAddress)))
      console.log('Pre-calculated travel for', locations.length, 'locations')
    }

    // Générer les créneaux
    const slots = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d)
      if (date < today) continue

      const dayOfWeek = date.getDay()
      const oh = openingHours.find(h => h.day_of_week === dayOfWeek)
      if (!oh) continue

      const dateStr = date.toISOString().split('T')[0]
      const fullBlock = blockedPeriods.find(bp => bp.date === dateStr && !bp.start_time)
      if (fullBlock) continue

      const [startH, startM] = oh.start_time.split(':').map(Number)
      const [endH, endM] = oh.end_time.split(':').map(Number)

      // Convertir les heures Paris → UTC
      // Créer une date Paris et récupérer l'offset réel
      const dateStr2 = date.toISOString().split('T')[0]
      const parisOffset = getParisOffsetHours(dateStr2)

      let slotStart = new Date(date)
      slotStart.setUTCHours(startH - parisOffset, startM, 0, 0)
      slotStart = roundUpToQuarter(slotStart)
      const dayEnd = new Date(date)
      dayEnd.setUTCHours(endH - parisOffset, endM, 0, 0)

      while (slotStart.getTime() + sessionMs <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + sessionMs)

        if (slotStart <= now) { slotStart = new Date(slotStart.getTime() + incrementMs); continue }

        // Exception partielle
        const partBlock = blockedPeriods.find(bp => {
          if (bp.date !== dateStr || !bp.start_time) return false
          const bS = new Date(dateStr + 'T' + bp.start_time)
          const bE = bp.end_time ? new Date(dateStr + 'T' + bp.end_time) : dayEnd
          return slotStart < bE && slotEnd > bS
        })
        if (partBlock) { slotStart = new Date(slotStart.getTime() + incrementMs); continue }

        // Conflit Google Calendar (utilise le cache pré-calculé)
        let gConflict = null
        let gTravelMs = 0
        for (const b of googleBusy) {
          const dynTravel = (clientAddress && b.location) ? (travelCache[`${b.location}|||${clientAddress}`] ?? 20) : 0
          const tMs = dynTravel * 60000
          const bE = new Date(b.end.getTime() + tMs)
          if (slotStart <= bE && slotEnd > new Date(b.start.getTime() - tMs)) { gConflict = b; gTravelMs = tMs; break }
        }
        if (gConflict) { slotStart = roundUpToQuarter(new Date(gConflict.end.getTime() + gTravelMs)); continue }

        // Conflit réservations (utilise le cache pré-calculé)
        let hasConflict = false
        for (const b of confirmedBookings) {
          if (!b.time_slots) continue
          const bStart = new Date(b.time_slots.start_time)
          const bEnd = new Date(b.time_slots.end_time)

          let dynamicTravel = 0
          if (clientAddress) {
            const prevAddress = b.profiles?.coaching_type === 'domicile' ? b.profiles?.address : ONAIR_ADDRESS
            if (prevAddress && prevAddress !== clientAddress) {
              dynamicTravel = travelCache[`${prevAddress}|||${clientAddress}`] ?? 20
            }
          }

          const bufMs = dynamicTravel * 60000
          const bS = new Date(bStart.getTime() - bufMs)
          const bE = new Date(bEnd.getTime() + bufMs)
          if (slotStart <= bE && slotEnd > bS) { hasConflict = true; break }
        }

        if (hasConflict) { slotStart = new Date(slotStart.getTime() + incrementMs); continue }

        // Calculer le temps de trajet depuis l'événement précédent (réservation OU Google Calendar)
        let travelMinutes = 0

        // Trouver la dernière réservation avant ce créneau
        const prevBooking = confirmedBookings
          .filter(b => b.time_slots && new Date(b.time_slots.end_time) <= slotStart)
          .sort((a, b) => new Date(b.time_slots.end_time) - new Date(a.time_slots.end_time))[0]

        // Trouver le dernier événement Google Calendar avant ce créneau
        const prevGoogle = googleBusy
          .filter(g => g.end <= slotStart)
          .sort((a, b) => b.end - a.end)[0]

        // Prendre le plus récent des deux
        let prevAddress = null
        let prevEnd = null

        if (prevBooking && prevGoogle) {
          const bookEnd = new Date(prevBooking.time_slots.end_time)
          if (bookEnd > prevGoogle.end) {
            prevAddress = prevBooking.profiles?.coaching_type === 'domicile' ? prevBooking.profiles?.address : ONAIR_ADDRESS
            prevEnd = bookEnd
          } else {
            prevAddress = prevGoogle.location
            prevEnd = prevGoogle.end
          }
        } else if (prevBooking) {
          prevAddress = prevBooking.profiles?.coaching_type === 'domicile' ? prevBooking.profiles?.address : ONAIR_ADDRESS
          prevEnd = new Date(prevBooking.time_slots.end_time)
        } else if (prevGoogle) {
          prevAddress = prevGoogle.location
          prevEnd = prevGoogle.end
        }

        if (prevAddress && clientAddress && prevAddress !== clientAddress) {
          travelMinutes = travelCache[`${prevAddress}|||${clientAddress}`] ?? 20
        }

        // Marge = temps entre fin de la séance précédente et début de ce créneau, moins le trajet
        let marginMinutes = 999
        if (prevEnd && travelMinutes > 0) {
          const gapMinutes = (slotStart - prevEnd) / 60000
          marginMinutes = Math.round(gapMinutes - travelMinutes)
        }

        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), date: dateStr, travel_minutes: travelMinutes, margin_minutes: marginMinutes })
        slotStart = new Date(slotStart.getTime() + incrementMs)
      }
    }

    return res.status(200).json({ slots })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
