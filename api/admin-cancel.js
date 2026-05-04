import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  var { bookingId } = req.body
  if (!bookingId) return res.status(400).json({ error: 'bookingId requis' })

  try {
    // Get booking details
    var { data: booking } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, email, coaching_type, address), time_slots(start_time, end_time)')
      .eq('id', bookingId)
      .single()

    if (!booking) return res.status(404).json({ error: 'Réservation introuvable' })

    // Cancel booking
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)

    // Refund credit
    var { data: profile } = await supabase.from('profiles').select('credits').eq('id', booking.client_id).single()
    if (profile) {
      await supabase.from('profiles').update({ credits: (profile.credits || 0) + 1 }).eq('id', booking.client_id)
    }

    // Delete Google Calendar event if exists
    if (booking.google_event_id) {
      try {
        var { data: tokenData } = await supabase.from('google_tokens').select('*').eq('id', 'admin').single()
        if (tokenData?.access_token) {
          var { google } = await import('googleapis')
          var oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
          oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expiry_date: tokenData.expiry_date })
          var calendar = google.calendar({ version: 'v3', auth: oauth2Client })
          await calendar.events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', eventId: booking.google_event_id })
        }
      } catch (e) { console.log('Google delete error:', e.message) }
    }

    // Send email to client
    if (booking.profiles?.email && booking.time_slots) {
      var startDate = new Date(booking.time_slots.start_time)
      var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
      var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
      var dateStr = DAYS[startDate.getDay()] + ' ' + startDate.getDate() + ' ' + MONTHS[startDate.getMonth()]
      var timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
      var name = booking.profiles.full_name || ''

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
            to: booking.profiles.email,
            subject: '❌ Séance annulée — ' + dateStr,
            html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:linear-gradient(135deg,#161410,#1a1814);padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia,serif;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div><div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase">Coach Sport & Nutrition</div></div><div style="padding:32px 28px"><div style="font-size:18px;font-weight:500;margin-bottom:24px">Séance annulée ❌</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:6px">📅 ' + dateStr + '</div><div style="font-size:14px;color:#7a7065">🕐 ' + timeStr + '</div></div><div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:14px 18px;margin-bottom:20px"><div style="font-size:13px;color:#4ade80">💳 Ton crédit a été restitué.</div></div><div style="font-size:13px;color:#7a7065">Si tu as des questions, contacte Yoann sur WhatsApp.</div></div><div style="padding:20px 28px;border-top:1px solid #2a2520;text-align:center"><div style="font-size:11px;color:#7a7065">À bientôt ' + (name ? name.split(' ')[0] : '') + ' 💪</div></div></div>'
          })
        })
      } catch (e) { console.log('Email error:', e.message) }
    }

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
