import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const ONAIR_ADDRESS = 'ON AIR BNF, 93 avenue de France, Paris 13'

async function getTravelMinutes(origin, destination) {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${process.env.GOOGLE_MAPS_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    const duration = data?.rows?.[0]?.elements?.[0]?.duration?.value
    return duration ? Math.ceil(duration / 60) : 15
  } catch (e) {
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
    const confirmedBookings = bookRes.data || []
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

      let slotStart = new Date(date)
      slotStart.setHours(startH, startM, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(endH, endM, 0, 0)

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

        // Calculer le temps de trajet depuis la séance précédente pour coloriser
        let travelMinutes = 0
        const prevBooking = confirmedBookings
          .filter(b => b.time_slots && new Date(b.time_slots.end_time) <= slotStart)
          .sort((a, b) => new Date(b.time_slots.end_time) - new Date(a.time_slots.end_time))[0]

        if (prevBooking && clientAddress) {
          const prevAddress = prevBooking.profiles?.coaching_type === 'domicile' ? prevBooking.profiles?.address : ONAIR_ADDRESS
          if (prevAddress && prevAddress !== clientAddress) {
            try { travelMinutes = await getTravelMinutes(prevAddress, clientAddress) } catch(e) {}
          }
        }

        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), date: dateStr, travel_minutes: travelMinutes })
        slotStart = new Date(slotStart.getTime() + incrementMs)
      }
    }

    return res.status(200).json({ slots })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
