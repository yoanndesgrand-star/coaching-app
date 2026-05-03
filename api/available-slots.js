import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const { year, month } = req.query
    const now = new Date()
    const targetYear = parseInt(year) || now.getFullYear()
    const targetMonth = parseInt(month) || now.getMonth() + 1

    const startDate = new Date(targetYear, targetMonth - 1, 1)
    const endDate = new Date(targetYear, targetMonth, 0)

    // Charger horaires actifs
    const { data: openingHours, error: ohError } = await supabase
      .from('opening_hours').select('*').eq('is_active', true)

    if (ohError) return res.status(500).json({ error: ohError.message })
    if (!openingHours || openingHours.length === 0)
      return res.status(200).json({ slots: [], debug: 'no opening hours' })

    // Charger settings
    const { data: settingsData } = await supabase
      .from('coaching_settings').select('*').eq('id', 'admin').single()
    const sessionMinutes = settingsData?.session_duration || 60
    const bufferMinutes = settingsData?.buffer_time || 10
    const sessionMs = sessionMinutes * 60 * 1000
    const bufferMs = bufferMinutes * 60 * 1000

    // Charger exceptions
    const { data: blockedPeriods } = await supabase
      .from('blocked_periods').select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])

    // Charger réservations confirmées
    const { data: confirmedBookings } = await supabase
      .from('bookings')
      .select('*, time_slots(start_time, end_time)')
      .eq('status', 'confirmed')

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
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: new Date(targetYear, targetMonth, 1).toISOString(),
          singleEvents: true
        })
        googleBusy = (eventsRes.data.items || [])
          .filter(e => e.start?.dateTime && e.status !== 'cancelled')
          .map(e => ({ start: new Date(e.start.dateTime), end: new Date(e.end.dateTime) }))
      }
    } catch (e) {
      console.log('Google error (non-blocking):', e.message)
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

      // Journée entière bloquée ?
      const fullBlock = (blockedPeriods || []).find(bp => bp.date === dateStr && !bp.start_time)
      if (fullBlock) continue

      const [startH, startM] = oh.start_time.split(':').map(Number)
      const [endH, endM] = oh.end_time.split(':').map(Number)

      let slotStart = new Date(date)
      slotStart.setHours(startH, startM, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(endH, endM, 0, 0)

      while (slotStart.getTime() + sessionMs <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + sessionMs)

        // Passé ?
        if (slotStart <= now) { slotStart = slotEnd; continue }

        // Exception partielle ?
        const partBlock = (blockedPeriods || []).find(bp => {
          if (bp.date !== dateStr || !bp.start_time) return false
          const bS = new Date(dateStr + 'T' + bp.start_time)
          const bE = bp.end_time ? new Date(dateStr + 'T' + bp.end_time) : dayEnd
          return slotStart < bE && slotEnd > bS
        })
        if (partBlock) { slotStart = slotEnd; continue }

        // Conflit Google Calendar ?
        const gConflict = googleBusy.find(b => {
          const bS = new Date(b.start.getTime() - bufferMs)
          const bE = new Date(b.end.getTime() + bufferMs)
          return slotStart < bE && slotEnd > bS
        })
        if (gConflict) { slotStart = new Date(gConflict.end.getTime() + bufferMs); continue }

        // Conflit réservation existante ?
        const bConflict = (confirmedBookings || []).find(b => {
          if (!b.time_slots) return false
          const bS = new Date(new Date(b.time_slots.start_time).getTime() - bufferMs)
          const bE = new Date(new Date(b.time_slots.end_time).getTime() + bufferMs)
          return slotStart < bE && slotEnd > bS
        })
        if (bConflict) { slotStart = new Date(new Date(bConflict.time_slots.end_time).getTime() + bufferMs); continue }

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
