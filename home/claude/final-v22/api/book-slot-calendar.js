import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      var clientId = req.query.clientId || req.query.client_id
      if (!clientId) return res.status(200).json({ bookings: [] })
      var { data } = await supabase.from('bookings').select('*, time_slots(*)').eq('client_id', clientId).eq('status', 'confirmed').order('created_at', { ascending: false }).limit(20)
      return res.status(200).json({ bookings: data || [] })
    } catch(e) {
      return res.status(200).json({ bookings: [] })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  try {
    var { clientId, startTime, endTime, location: bookingLocation } = req.body
    if (!clientId || !startTime) {
      return res.status(400).json({ error: 'Données manquantes' })
    }
    if (!endTime) {
      endTime = new Date(new Date(startTime).getTime() + 3600000).toISOString()
    }

    // Get client profile
    var { data: profile } = await supabase.from('profiles').select('credits, no_credit_required, coach_id, full_name, address, coaching_type, email').eq('id', clientId).single()
    if (!profile) return res.status(400).json({ error: 'Client non trouvé' })

    var coachId = profile.coach_id
    if (!coachId) return res.status(400).json({ error: 'Coach non assigné' })

    // Check credits
    if (!profile.no_credit_required && (profile.credits || 0) <= 0) {
      return res.status(400).json({ error: 'Pas de crédits disponibles' })
    }

    // Check double booking
    var { data: existing } = await supabase.from('time_slots')
      .select('id, bookings(id, status)')
      .eq('coach_id', coachId)
      .lt('start_time', endTime)
      .gt('end_time', startTime)
    
    var hasConflict = (existing || []).some(function(ts) {
      return ts.bookings && ts.bookings.some(function(b) { return b.status === 'confirmed' })
    })

    if (hasConflict) {
      return res.status(400).json({ error: "Ce créneau n'est plus disponible" })
    }

    // 1. Create time_slot
    var { data: slot, error: slotError } = await supabase.from('time_slots').insert({
      coach_id: coachId,
      start_time: startTime,
      end_time: endTime,
      is_available: false
    }).select().single()

    if (slotError) return res.status(400).json({ error: 'Erreur créneau: ' + slotError.message })

    // 2. Create booking
    var { data: booking, error: bookError } = await supabase.from('bookings').insert({
      client_id: clientId,
      slot_id: slot.id,
      status: 'confirmed',
      coach_id: coachId,
      location: bookingLocation || (profile.coaching_type === 'domicile' ? profile.address : null)
    }).select().single()

    if (bookError) {
      await supabase.from('time_slots').delete().eq('id', slot.id)
      return res.status(400).json({ error: 'Erreur booking: ' + bookError.message })
    }

    // 3. Deduct credit
    if (!profile.no_credit_required) {
      await supabase.from('profiles').update({ credits: (profile.credits || 1) - 1 }).eq('id', clientId)
    }

    // 4. Google Calendar
    try {
      var { data: tokens } = await supabase.from('google_tokens').select('*').eq('coach_id', coachId).single()
      if (!tokens) {
        // Fallback: try id='admin' (legacy)
        var { data: tokens2 } = await supabase.from('google_tokens').select('*').eq('id', 'admin').single()
        tokens = tokens2
      }
      if (tokens) {
        // Get selected calendar
        var calendarId = 'primary'
        try {
          var { data: cs } = await supabase.from('coaching_settings').select('google_calendar_id').eq('coach_id', coachId).single()
          if (cs && cs.google_calendar_id) calendarId = cs.google_calendar_id
          if (calendarId === 'primary') {
            // Fallback: try by id='admin'
            var { data: cs2 } = await supabase.from('coaching_settings').select('google_calendar_id').eq('id', 'admin').single()
            if (cs2 && cs2.google_calendar_id) calendarId = cs2.google_calendar_id
          }
        } catch(e) {}

        var accessToken = tokens.access_token
        if (new Date(tokens.expires_at) < new Date()) {
          var tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: tokens.refresh_token, grant_type: 'refresh_token' })
          })
          var tokenData = await tokenRes.json()
          accessToken = tokenData.access_token
          await supabase.from('google_tokens').update({ access_token: accessToken, expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString() }).eq('coach_id', coachId)
        }

        var location = profile.coaching_type === 'domicile' ? profile.address : ''
        if (profile.coaching_type === 'presentiel') {
          var { data: locs } = await supabase.from('coach_locations').select('address').eq('coach_id', coachId).limit(1)
          if (locs && locs.length > 0) location = locs[0].address
        }

        var calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary: '🏋️ ' + (profile.full_name || 'Client'), start: { dateTime: startTime, timeZone: 'Europe/Paris' }, end: { dateTime: endTime, timeZone: 'Europe/Paris' }, location: location || '', description: 'Séance de coaching' })
        })
        var calData = await calRes.json()
        if (calData.id) await supabase.from('bookings').update({ google_event_id: calData.id }).eq('id', booking.id)
        else console.log('Calendar event not created:', calData.error || calData)
      } else {
      }
    } catch (calError) { console.log('Calendar error:', calError.message) }

    // 5. Email notification to coach
    try {
      var { data: coachProfile } = await supabase.from('profiles').select('email, full_name').eq('id', coachId).single()
      if (coachProfile && coachProfile.email) {
        var bookDate = new Date(startTime)
        var dateStr = bookDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        var timeStr = bookDate.getHours().toString().padStart(2,'0') + 'h' + bookDate.getMinutes().toString().padStart(2,'0')
        var loc = profile.coaching_type === 'domicile' ? (profile.address || 'À domicile') : 'En salle'
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Coaching App <notifications@yoanndesgrand.fr>', to: coachProfile.email, subject: '📅 Nouvelle réservation — ' + (profile.full_name || 'Client') + ' le ' + dateStr, html: '<div style="font-family:Outfit,sans-serif;background:#080808;color:#f0ece4;padding:40px 20px"><div style="max-width:500px;margin:0 auto"><h2 style="color:#C4973A">📅 Nouvelle réservation</h2><div style="background:#111;border:1px solid #1a1a1a;border-radius:12px;padding:20px;margin:20px 0"><div style="font-size:18px;font-weight:600;margin-bottom:8px">' + (profile.full_name || 'Client') + '</div><div style="color:#7a7065;margin-bottom:4px">📅 ' + dateStr + ' à ' + timeStr + '</div><div style="color:#7a7065">📍 ' + loc + '</div></div></div></div>' })
        })
      }
    } catch(emailErr) { console.log('Coach email error:', emailErr.message) }

    return res.status(200).json({ success: true, booking: booking, creditsLeft: profile.no_credit_required ? 999 : (profile.credits || 1) - 1 })

  } catch (e) {
    console.error('Book slot error:', e)
    return res.status(500).json({ error: e.message })
  }
}
