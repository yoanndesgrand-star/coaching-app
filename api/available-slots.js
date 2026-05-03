import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    // 1. Récupérer les paramètres
    const { year, month } = req.query
    const now = new Date()
    const targetYear = parseInt(year) || now.getFullYear()
    const targetMonth = parseInt(month) || now.getMonth() + 1

    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0)

    // 2. Charger horaires, settings, exceptions, réservations existantes
    const [ohRes, stRes, bpRes, bookRes] = await Promise.all([
      supabase.from('opening_hours').select('*').eq('is_active', true),
      supabase.from('coaching_settings').select('*').eq('id', 'admin').single(),
      supabase.from('blocked_periods').select('*')
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]),
      supabase.from('bookings').select('*, time_slots(start_time, end_time)')
        .eq('status', 'confirmed')
        .gte('time_slots.start_time', startDate.toISOString())
        .lte('time_slots.start_time', endDate.toISOString() + 'Z')
    ])

    const openingHours = ohRes.data || []
    const settings = stRes.data || { session_duration: 60, buffer_time: 10 }
    const blockedPeriods = bpRes.data || []
    const confirmedBookings = bookRes.data || []

    const sessionDuration = settings.session_duration * 60 * 1000
    const bufferTime = settings.buffer_time * 60 * 1000

    // 3. Récupérer événements Google Calendar
    let googleBusyTimes = []
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
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: new Date(targetYear, targetMonth, 1).toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        })
        googleBusyTimes = (eventsRes.data.items || [])
          .filter(e => e.start?.dateTime && e.status !== 'cancelled')
          .map(e => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))
      }
    } catch (e) {
      console.error('Google Calendar fetch error:', e.message)
    }

    // 4. Générer les créneaux disponibles
    const slots = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = new Date(d)
      if (date < today) continue

      const dayOfWeek = date.getDay()
      const openingHour = openingHours.find(h => h.day_of_week === dayOfWeek)
      if (!openingHour) continue

      const dateStr = date.toISOString().split('T')[0]

      // Vérifier si la journée entière est bloquée
      const dayBlocked = blockedPeriods.find(bp => bp.date === dateStr && !bp.start_time)
      if (dayBlocked) continue

      // Générer les créneaux de la journée
      const [startH, startM] = openingHour.start_time.split(':').map(Number)
      const [endH, endM] = openingHour.end_time.split(':').map(Number)

      let slotStart = new Date(date)
      slotStart.setHours(startH, startM, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(endH, endM, 0, 0)

      while (slotStart.getTime() + sessionDuration <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + sessionDuration)

        // Pas dans le passé
        if (slotStart <= now) { slotStart = slotEnd; continue }

        // Vérifier exceptions horaires
        const partialBlock = blockedPeriods.find(bp => {
          if (bp.date !== dateStr || !bp.start_time) return false
          const bStart = new Date(dateStr + 'T' + bp.start_time)
          const bEnd = bp.end_time ? new Date(dateStr + 'T' + bp.end_time) : dayEnd
          return slotStart < bEnd && slotEnd > bStart
        })
        if (partialBlock) { slotStart = slotEnd; continue }

        // Vérifier Google Calendar (avec buffer)
        const googleConflict = googleBusyTimes.find(busy => {
          const busyStart = new Date(busy.start.getTime() - bufferTime)
          const busyEnd = new Date(busy.end.getTime() + bufferTime)
          return slotStart < busyEnd && slotEnd > busyStart
        })
        if (googleConflict) { slotStart = new Date(googleConflict.end.getTime() + bufferTime); continue }

        // Vérifier réservations existantes (avec buffer)
        const bookingConflict = confirmedBookings.find(b => {
          if (!b.time_slots) return false
          const bStart = new Date(new Date(b.time_slots.start_time).getTime() - bufferTime)
          const bEnd = new Date(new Date(b.time_slots.end_time).getTime() + bufferTime)
          return slotStart < bEnd && slotEnd > bStart
        })
        if (bookingConflict) { slotStart = new Date(new Date(bookingConflict.time_slots.end_time).getTime() + bufferTime); continue }

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          date: dateStr
        })

        slotStart = slotEnd
      }
    }

    return res.status(200).json({ slots })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
