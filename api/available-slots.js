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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${process.env.GOOGLE_MAPS_KEY}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const data = await res.json()
    const duration = data?.rows?.[0]?.elements?.[0]?.duration?.value
    const mins = duration ? Math.ceil(duration / 60) : 15
    travelCache[key] = mins
    return mins
  } catch (e) {
    travelCache[key] = 15
    return 15
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
    const bufferMinutes = settings.buffer_time || 10
    const incrementMs = (settings.slot_increment || 60) * 60 * 1000

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
          singleEvents: true,
          showDeleted: true
        })

        const allEvents = eventsRes.data.items || []

        // Sync : détecter les événements supprimés → annuler les réservations correspondantes
        const cancelledGcalEvents = allEvents.filter(e => e.status === 'cancelled' && e.id)
        const cancelledBookingIds = new Set()
        for (const event of cancelledGcalEvents) {
          const { data: bookingToCancel } = await supabase
            .from('bookings')
            .select('id, client_id, slot_id')
            .eq('google_event_id', event.id)
            .eq('status', 'confirmed')
            .single()

          if (bookingToCancel) {
            await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingToCancel.id)
            await supabase.from('time_slots').update({ is_available: true }).eq('id', bookingToCancel.slot_id)
            const { data: p } = await supabase.from('profiles').select('credits').eq('id', bookingToCancel.client_id).single()
            if (p) await supabase.from('profiles').update({ credits: (p.credits || 0) + 1 }).eq('id', bookingToCancel.client_id)
            cancelledBookingIds.add(bookingToCancel.id)
            console.log('Auto-cancelled booking', bookingToCancel.id, 'from deleted Google event', event.id)
          }
        }

        // Retirer les réservations annulées de la liste
        if (cancelledBookingIds.size > 0) {
          confirmedBookings = confirmedBookings.filter(b => !cancelledBookingIds.has(b.id))
        }

        googleBusy = allEvents
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

        // Conflit Google Calendar
        // Conflit Google Calendar avec calcul de trajet si location disponible
        let gConflict = null
        let gBufferMs = bufferMinutes * 60000
        for (const b of googleBusy) {
          let dynBuffer = bufferMinutes
          if (clientAddress && b.location) {
            try {
              const travel = await getTravelMinutes(b.location, clientAddress)
              dynBuffer = travel + bufferMinutes
            } catch(e) {}
          }
          const bMs = dynBuffer * 60000
          const bS = new Date(b.start.getTime() - bMs)
          const bE = new Date(b.end.getTime() + bMs)
          if (slotStart < bE && slotEnd > bS) { gConflict = b; gBufferMs = bMs; break }
        }
        if (gConflict) { slotStart = new Date(gConflict.end.getTime() + gBufferMs); continue }

        // Conflit réservations avec calcul de trajet
        let hasConflict = false
        for (const b of confirmedBookings) {
          if (!b.time_slots) continue
          const bStart = new Date(b.time_slots.start_time)
          const bEnd = new Date(b.time_slots.end_time)

          // Calculer le tampon dynamique selon les types de coaching
          let dynamicBuffer = bufferMinutes
          if (clientAddress) {
            const prevAddress = b.profiles?.coaching_type === 'domicile' ? b.profiles?.address : ONAIR_ADDRESS
            const nextAddress = clientAddress

            if (prevAddress && nextAddress && prevAddress !== nextAddress) {
              try {
                const travelMins = await getTravelMinutes(prevAddress, nextAddress)
                dynamicBuffer = travelMins + bufferMinutes
              } catch (e) {}
            }
          }

          const bufMs = dynamicBuffer * 60000
          const bS = new Date(bStart.getTime() - bufMs)
          const bE = new Date(bEnd.getTime() + bufMs)
          if (slotStart < bE && slotEnd > bS) { hasConflict = true; break }
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
          try { travelMinutes = await getTravelMinutes(prevAddress, clientAddress) } catch(e) {}
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
