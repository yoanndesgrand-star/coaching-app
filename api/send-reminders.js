import { createClient } from '@supabase/supabase-js'

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  try {
    // Get settings
    var { data: settings } = await supabase.from('coaching_settings').select('*').eq('id', 'admin').single()
    var reminderHours = (settings && settings.reminder_hours) || 12
    if (reminderHours === 0) return res.status(200).json({ sent: 0, message: 'Rappels désactivés' })

    var now = new Date()
    var reminderWindow = new Date(now.getTime() + reminderHours * 3600000)
    // Already sent window: don't re-send if within 1h of the reminder time
    var alreadySentWindow = new Date(now.getTime() + (reminderHours - 1) * 3600000)

    // Get upcoming confirmed bookings within the reminder window
    var { data: bookings } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, email, coaching_type, address), time_slots(start_time, end_time)')
      .eq('status', 'confirmed')
      .eq('reminder_sent', false)
      .not('time_slots', 'is', null)

    if (!bookings || bookings.length === 0) return res.status(200).json({ sent: 0 })

    var sent = 0
    var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']

    for (var i = 0; i < bookings.length; i++) {
      var b = bookings[i]
      if (!b.time_slots || !b.profiles?.email) continue

      var startTime = new Date(b.time_slots.start_time)

      // Only send if session is within the reminder window but not already past
      if (startTime <= now || startTime > reminderWindow) continue

      var dateStr = DAYS[startTime.getDay()] + ' ' + startTime.getDate() + ' ' + MONTHS[startTime.getMonth()]
      var timeStr = startTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
      var locStr = b.profiles.coaching_type === 'domicile' ? '🏠 À domicile' : '🏋️ ON AIR BNF, Paris 13e'
      var firstName = (b.profiles.full_name || '').split(' ')[0]

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
            to: b.profiles.email,
            subject: '⏰ Rappel — Séance demain ' + dateStr,
            html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden">'
              + '<div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div>'
              + '<div style="padding:32px 28px">'
              + '<div style="font-size:18px;margin-bottom:24px">Rappel de ta séance ⏰</div>'
              + '<div style="font-size:14px;color:#7a7065;margin-bottom:20px;line-height:1.6">Bonjour ' + firstName + ', ta séance de coaching est prévue bientôt !</div>'
              + '<div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px">'
              + '<div style="font-size:16px;margin-bottom:6px">📅 ' + dateStr + '</div>'
              + '<div style="color:#7a7065;margin-bottom:6px">🕐 ' + timeStr + '</div>'
              + '<div style="color:#7a7065">' + locStr + '</div>'
              + '</div>'
              + '<div style="font-size:12px;color:#7a7065;line-height:1.8">'
              + '<b style="color:#f0ece4">Rappel :</b> L\'annulation est gratuite jusqu\'à 24h avant la séance.'
              + '</div>'
              + '</div></div>'
          })
        })

        // Mark as sent
        await supabase.from('bookings').update({ reminder_sent: true }).eq('id', b.id)
        sent++
      } catch (e) { console.log('Reminder email error:', e.message) }
    }

    return res.status(200).json({ sent: sent })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
