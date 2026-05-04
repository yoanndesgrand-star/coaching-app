import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  var { clientId, startTime, endTime } = req.body
  if (!clientId || !startTime || !endTime) return res.status(400).json({ error: 'Paramètres manquants' })

  try {
    // Get client profile
    var { data: profile } = await supabase
      .from('profiles')
      .select('credits, full_name, email, coaching_type, address')
      .eq('id', clientId)
      .single()

    if (!profile) return res.status(404).json({ error: 'Client introuvable' })
    if ((profile.credits || 0) < 1) return res.status(400).json({ error: 'Ce client n\'a pas de crédits' })

    // Create time slot
    var { data: slot } = await supabase.from('time_slots').insert({
      start_time: startTime,
      end_time: endTime,
      is_available: false,
      date: startTime.split('T')[0]
    }).select().single()

    // Create booking
    var { data: booking } = await supabase.from('bookings').insert({
      client_id: clientId,
      slot_id: slot.id,
      status: 'confirmed'
    }).select().single()

    // Deduct credit
    await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', clientId)

    // Create Google Calendar event
    var googleEventId = null
    try {
      var { data: tokenData } = await supabase.from('google_tokens').select('*').eq('id', 'admin').single()
      if (tokenData?.access_token) {
        var { google } = await import('googleapis')
        var oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
        oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expiry_date: tokenData.expiry_date })
        var calendar = google.calendar({ version: 'v3', auth: oauth2Client })
        var eventLocation = profile.coaching_type === 'domicile'
          ? (profile.address || 'Domicile client')
          : 'ON AIR BNF, 93 avenue de France, 75013 Paris'

        var gcalEvent = await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          requestBody: {
            summary: 'YD Coaching - ' + (profile.full_name || profile.email),
            location: eventLocation,
            start: { dateTime: startTime },
            end: { dateTime: endTime },
            description: (profile.coaching_type === 'domicile' ? '🏠 Coaching à domicile' : '🏋️ Coaching en salle') + '\n' + profile.email + '\n(Réservé par admin)'
          }
        })
        if (gcalEvent?.data?.id) {
          googleEventId = gcalEvent.data.id
          await supabase.from('bookings').update({ google_event_id: googleEventId }).eq('id', booking.id)
        }
      }
    } catch (e) { console.log('Google Calendar:', e.message) }

    // Send confirmation email to client
    var startDate = new Date(startTime)
    var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
    var dateStr = DAYS[startDate.getDay()] + ' ' + startDate.getDate() + ' ' + MONTHS[startDate.getMonth()]
    var timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    var locationStr = profile.coaching_type === 'domicile' ? '🏠 ' + (profile.address || 'À domicile') : '🏋️ ON AIR BNF'
    var creditsLeft = profile.credits - 1

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
          to: profile.email,
          subject: '✅ Séance confirmée — ' + dateStr + ' à ' + timeStr,
          html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:linear-gradient(135deg,#161410,#1a1814);padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia,serif;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div><div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase">Coach Sport & Nutrition</div></div><div style="padding:32px 28px"><div style="font-size:18px;font-weight:500;margin-bottom:24px">Séance confirmée ✅</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:6px">📅 ' + dateStr + '</div><div style="font-size:14px;color:#7a7065;margin-bottom:6px">🕐 ' + timeStr + '</div><div style="font-size:14px;color:#7a7065">' + locationStr + '</div></div><div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px 18px;margin-bottom:20px"><div style="font-size:13px;color:#C4973A">💳 Crédits restants : <strong>' + creditsLeft + '</strong></div></div><div style="font-size:12px;color:#7a7065;line-height:1.8"><strong style="color:#f0ece4">Conditions d\'annulation :</strong><br>• Annulation gratuite jusqu\'à 24h avant<br>• Passé ce délai, le crédit ne sera pas remboursé</div></div></div>'
        })
      })
    } catch (e) { console.log('Email error:', e.message) }

    // Notify admin
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
          subject: '📅 Réservation admin — ' + (profile.full_name || profile.email),
          html: '<div style="font-family:Arial;padding:24px"><h2>Réservation admin 🎯</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><div style="font-weight:bold;margin-bottom:6px">' + (profile.full_name || profile.email) + '</div><div>📅 ' + dateStr + '</div><div>🕐 ' + timeStr + '</div><div>' + locationStr + '</div></div><div style="font-size:13px;color:#888;margin-top:12px">Crédits restants : ' + creditsLeft + '</div></div>'
        })
      })
    } catch (e) { console.log('Admin email error:', e.message) }

    return res.status(200).json({ success: true, creditsLeft: creditsLeft })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
