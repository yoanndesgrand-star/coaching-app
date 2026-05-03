import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const ONAIR_ADDRESS = 'ON AIR BNF, 93 avenue de France, Paris 13'
const COACH_HOME = process.env.COACH_HOME_ADDRESS || '36 avenue du général Michel Bizot, 75012 Paris'

function getParisOffsetHours(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const marchLast = new Date(Date.UTC(y, 2, 31))
  while (marchLast.getUTCDay() !== 0) marchLast.setUTCDate(marchLast.getUTCDate() - 1)
  const octLast = new Date(Date.UTC(y, 9, 31))
  while (octLast.getUTCDay() !== 0) octLast.setUTCDate(octLast.getUTCDate() - 1)
  return (date >= marchLast && date < octLast) ? 2 : 1
}

function roundUpToQuarter(date) {
  const d = new Date(date)
  const min = d.getUTCMinutes()
  const remainder = min % 15
  if (remainder > 0) d.setUTCMinutes(min + (15 - remainder), 0, 0)
  else d.setUTCSeconds(0, 0)
  return d
}

const travelCache = {}
async function getTravelMinutes(origin, destination) {
  if (!origin || !destination || origin === destination) return 0
  const key = origin + '|||' + destination
  if (travelCache[key] !== undefined) return travelCache[key]
  try {
    const apiKey = process.env.GOOGLE_MAPS_KEY
    if (!apiKey) { travelCache[key] = 0; return 0 }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json?origins=' + encodeURIComponent(origin) + '&destinations=' + encodeURIComponent(destination) + '&mode=driving&key=' + apiKey
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const data = await res.json()
    const el = data?.rows?.[0]?.elements?.[0]
    if (el?.status !== 'OK') { travelCache[key] = 0; return 0 }
    const mins = Math.ceil(el.duration.value / 60)
    travelCache[key] = mins
    return mins
  } catch (e) {
    travelCache[key] = 0
    return 0
  }
}

function cachedTravel(from, to) {
  if (!from || !to || from === to) return 0
  return travelCache[from + '|||' + to] || 0
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

    const [ohRes, stRes, bpRes, bookRes, clientRes] = await Promise.all([
      supabase.from('opening_hours').select('*').eq('is_active', true),
      supabase.from('coaching_settings').select('*').eq('id', 'admin').single(),
      supabase.from('blocked_periods').select('*').gte('date', startDate.toISOString().split('T')[0]).lte('date', endDate.toISOString().split('T')[0]),
      supabase.from('bookings').select('*, profiles(coaching_type, address), time_slots(start_time, end_time)').eq('status', 'confirmed'),
      clientId ? supabase.from('profiles').select('coaching_type, address').eq('id', clientId).single() : Promise.resolve({ data: null })
    ])

    const openingHours = ohRes.data || []
    const settings = stRes.data || { session_duration: 60 }
    const blockedPeriods = bpRes.data || []
    const confirmedBookings = bookRes.data || []
    const clientProfile = clientRes.data
    const sessionMs = (settings.session_duration || 60) * 60 * 1000
    const incrementMs = 15 * 60 * 1000
    const clientAddress = clientProfile?.coaching_type === 'domicile' ? clientProfile?.address : ONAIR_ADDRESS

    // Google Calendar events
    let googleBusy = []
    try {
      const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('id', 'admin').single()
      if (tokenData?.access_token) {
        const { google } = await import('googleapis')
        const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
        oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expiry_date: tokenData.expiry_date })
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
        const eventsRes = await calendar.events.list({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          timeMin: startDate.toISOString(),
          timeMax: new Date(targetYear, targetMonth, 1).toISOString(),
          singleEvents: true
        })
        googleBusy = (eventsRes.data.items || [])
          .filter(function(e) { return e.start?.dateTime && e.status !== 'cancelled' })
          .map(function(e) { return { start: new Date(e.start.dateTime), end: new Date(e.end.dateTime), location: e.location || null } })
      }
    } catch (e) {
      console.log('Google Calendar error:', e.message)
    }

    // Pre-calculate travel times in parallel
    if (clientAddress) {
      var uniqueLocs = new Set()
      googleBusy.forEach(function(g) { if (g.location && g.location !== clientAddress) uniqueLocs.add(g.location) })
      confirmedBookings.forEach(function(b) {
        if (!b.profiles) return
        var addr = b.profiles.coaching_type === 'domicile' ? b.profiles.address : ONAIR_ADDRESS
        if (addr && addr !== clientAddress) uniqueLocs.add(addr)
      })
      if (COACH_HOME !== clientAddress) uniqueLocs.add(COACH_HOME)
      var locs = Array.from(uniqueLocs).slice(0, 10)
      var promises = []
      locs.forEach(function(loc) {
        promises.push(getTravelMinutes(loc, clientAddress))
        promises.push(getTravelMinutes(clientAddress, loc))
      })
      await Promise.all(promises)
    }

    // Generate slots
    var slots = []
    var today = new Date()
    today.setHours(0, 0, 0, 0)

    for (var d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      var date = new Date(d)
      if (date < today) continue
      var dayOfWeek = date.getDay()
      var oh = openingHours.find(function(h) { return h.day_of_week === dayOfWeek })
      if (!oh) continue

      var dateStr = date.toISOString().split('T')[0]
      var fullBlock = blockedPeriods.find(function(bp) { return bp.date === dateStr && !bp.start_time })
      if (fullBlock) continue

      var parts = oh.start_time.split(':').map(Number)
      var startH = parts[0], startM = parts[1]
      parts = oh.end_time.split(':').map(Number)
      var endH = parts[0], endM = parts[1]
      var parisOffset = getParisOffsetHours(dateStr)

      var slotStart = new Date(date)
      slotStart.setUTCHours(startH - parisOffset, startM, 0, 0)
      slotStart = roundUpToQuarter(slotStart)
      var dayEnd = new Date(date)
      dayEnd.setUTCHours(endH - parisOffset, endM, 0, 0)

      while (slotStart.getTime() + sessionMs <= dayEnd.getTime()) {
        var slotEnd = new Date(slotStart.getTime() + sessionMs)

        if (slotStart <= now) { slotStart = new Date(slotStart.getTime() + incrementMs); continue }

        // Blocked period check
        var partBlock = blockedPeriods.find(function(bp) {
          if (bp.date !== dateStr || !bp.start_time) return false
          var bS = new Date(dateStr + 'T' + bp.start_time)
          var bE = bp.end_time ? new Date(dateStr + 'T' + bp.end_time) : dayEnd
          return slotStart < bE && slotEnd > bS
        })
        if (partBlock) { slotStart = new Date(slotStart.getTime() + incrementMs); continue }

        // Google Calendar conflict
        var gConflict = null
        var gTravelAfterMs = 0
        for (var gi = 0; gi < googleBusy.length; gi++) {
          var gb = googleBusy[gi]
          var tAfter = cachedTravel(gb.location, clientAddress)
          var tBefore = cachedTravel(clientAddress, gb.location)
          var bE2 = new Date(gb.end.getTime() + tAfter * 60000)
          var bS2 = new Date(gb.start.getTime() - tBefore * 60000)
          if (slotStart < bE2 && slotEnd > bS2) { gConflict = gb; gTravelAfterMs = tAfter * 60000; break }
        }
        if (gConflict) {
          var newStart = roundUpToQuarter(new Date(gConflict.end.getTime() + gTravelAfterMs))
          slotStart = newStart > slotStart ? newStart : new Date(slotStart.getTime() + incrementMs)
          continue
        }

        // Booking conflict
        var hasConflict = false
        for (var bi = 0; bi < confirmedBookings.length; bi++) {
          var bk = confirmedBookings[bi]
          if (!bk.time_slots) continue
          var bkStart = new Date(bk.time_slots.start_time)
          var bkEnd = new Date(bk.time_slots.end_time)
          var bkAddr = bk.profiles?.coaching_type === 'domicile' ? bk.profiles?.address : ONAIR_ADDRESS
          var tA = cachedTravel(bkAddr, clientAddress)
          var tB = cachedTravel(clientAddress, bkAddr)
          var bS3 = new Date(bkStart.getTime() - tB * 60000)
          var bE3 = new Date(bkEnd.getTime() + tA * 60000)
          if (slotStart < bE3 && slotEnd > bS3) { hasConflict = true; break }
        }
        if (hasConflict) { slotStart = new Date(slotStart.getTime() + incrementMs); continue }

        // Color: travel from previous event
        var travelMinutes = 0
        var prevEnd = null
        var prevAddress = null

        // Find nearest previous event (booking or Google)
        for (var pi = 0; pi < confirmedBookings.length; pi++) {
          var pb = confirmedBookings[pi]
          if (!pb.time_slots) continue
          var pEnd = new Date(pb.time_slots.end_time)
          if (pEnd <= slotStart && (!prevEnd || pEnd > prevEnd)) {
            prevEnd = pEnd
            prevAddress = pb.profiles?.coaching_type === 'domicile' ? pb.profiles?.address : ONAIR_ADDRESS
          }
        }
        for (var pgi = 0; pgi < googleBusy.length; pgi++) {
          var pg = googleBusy[pgi]
          if (pg.end <= slotStart && (!prevEnd || pg.end > prevEnd)) {
            prevEnd = pg.end
            prevAddress = pg.location
          }
        }

        // Gap > 2h or no previous event → coach is at home
        var gapHours = prevEnd ? (slotStart - prevEnd) / 3600000 : 999
        if (gapHours > 2 || !prevEnd) prevAddress = COACH_HOME

        if (prevAddress && clientAddress && prevAddress !== clientAddress) {
          travelMinutes = cachedTravel(prevAddress, clientAddress)
        }

        // Also check travel TO next event
        var nextTravelMinutes = 0
        var nextStart = null
        var nextAddress = null

        for (var ni = 0; ni < confirmedBookings.length; ni++) {
          var nb = confirmedBookings[ni]
          if (!nb.time_slots) continue
          var nStart = new Date(nb.time_slots.start_time)
          if (nStart >= slotEnd && (!nextStart || nStart < nextStart)) {
            nextStart = nStart
            nextAddress = nb.profiles?.coaching_type === 'domicile' ? nb.profiles?.address : ONAIR_ADDRESS
          }
        }
        for (var ngi = 0; ngi < googleBusy.length; ngi++) {
          var ng = googleBusy[ngi]
          if (ng.start >= slotEnd && (!nextStart || ng.start < nextStart)) {
            nextStart = ng.start
            nextAddress = ng.location
          }
        }

        // Gap to next > 2h → no penalty
        var nextGapHours = nextStart ? (nextStart - slotEnd) / 3600000 : 999
        if (nextAddress && clientAddress && nextAddress !== clientAddress && nextGapHours <= 2) {
          nextTravelMinutes = cachedTravel(clientAddress, nextAddress)
        }

        var maxTravel = Math.max(travelMinutes, nextTravelMinutes)
        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), date: dateStr, travel_minutes: maxTravel })
        slotStart = new Date(slotStart.getTime() + incrementMs)
      }
    }

    return res.status(200).json({ slots: slots })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
