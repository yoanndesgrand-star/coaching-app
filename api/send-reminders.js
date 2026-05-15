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
      .select('*, profiles(full_name, email, phone, coaching_type, address), time_slots(start_time, end_time)')
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

        // Send WhatsApp reminder if Twilio is configured
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && b.profiles.phone) {
          try {
            var phone = b.profiles.phone.replace(/\s+/g, '')
            if (!phone.startsWith('+')) phone = '+' + phone
            var twilioSid = process.env.TWILIO_ACCOUNT_SID
            var twilioAuth = process.env.TWILIO_AUTH_TOKEN
            var twilioFrom = process.env.TWILIO_WHATSAPP_FROM || '+14155238886'
            var waMessage = '🏋️ Rappel séance\n\nBonjour ' + firstName + ', ta séance est prévue :\n\n📅 ' + dateStr + '\n🕐 ' + timeStr + '\n' + locStr + '\n\nÀ très bientôt !\n— Yoann Desgrand'

            await fetch('https://api.twilio.com/2010-04-01/Accounts/' + twilioSid + '/Messages.json', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(twilioSid + ':' + twilioAuth).toString('base64')
              },
              body: 'To=whatsapp%3A' + encodeURIComponent(phone) + '&From=whatsapp%3A' + encodeURIComponent(twilioFrom) + '&Body=' + encodeURIComponent(waMessage)
            })
          } catch (we) { console.log('WhatsApp error:', we.message) }
        }

        sent++
      } catch (e) { console.log('Reminder email error:', e.message) }
    }

    // Also trigger Google Calendar sync
    try {
      var appUrl = process.env.APP_URL || 'https://app.yoanndesgrand.fr'
      await fetch(appUrl + '/api/google-webhook', { method: 'POST' })
    } catch (e) {}

    // Check for clients with sessions today who have 0 or negative credits
    try {
      var todayStr = now.toISOString().split('T')[0]
      var { data: todayBookings } = await supabase.from('bookings')
        .select('*, profiles(full_name, email, credits, no_credit_required), time_slots(start_time)')
        .eq('status', 'confirmed')
        .gte('time_slots.start_time', todayStr + 'T00:00:00')
        .lte('time_slots.start_time', todayStr + 'T23:59:59')

      if (todayBookings) {
        var alerted = {}
        for (var tb of todayBookings) {
          if (!tb.profiles || tb.profiles.no_credit_required) continue
          if ((tb.profiles.credits || 0) > 0) continue
          if (alerted[tb.profiles.email]) continue
          alerted[tb.profiles.email] = true

          var creditCount = tb.profiles.credits || 0
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
              to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
              subject: '⚠️ Crédits épuisés — ' + (tb.profiles.full_name || tb.profiles.email) + ' a une séance aujourd\'hui',
              html: '<div style="font-family:Arial;padding:24px"><h2>⚠️ Séance aujourd\'hui sans crédit</h2><div style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:18px"><b>' + (tb.profiles.full_name || tb.profiles.email) + '</b> a une séance aujourd\'hui mais ' + (creditCount < 0 ? 'doit <b>' + Math.abs(creditCount) + ' séance' + (Math.abs(creditCount) > 1 ? 's' : '') + '</b>' : 'n\'a <b>plus de crédits</b>') + '.<br><br>💳 Crédits : <b>' + creditCount + '</b><br>📅 Séance : <b>aujourd\'hui</b></div><div style="margin-top:16px;font-size:13px;color:#666">Pense à lui demander de recharger son pack.</div></div>'
            })
          })
        }
      }
    } catch (e) { console.log('Credit alert error:', e.message) }

    // ──── RELANCE CLIENTS INACTIFS ────
    try {
      var { data: settingsR } = await supabase.from('coaching_settings').select('inactivity_weeks').eq('id', 'admin').single()
      var inactivityWeeks = (settingsR && settingsR.inactivity_weeks !== undefined) ? settingsR.inactivity_weeks : 3
      if (inactivityWeeks === 0) throw 'disabled'
      var inactivityDate = new Date(now.getTime() - inactivityWeeks * 7 * 86400000)

      // Get all clients (not admin)
      var { data: allClients } = await supabase.from('profiles').select('id, full_name, email, credits, last_relance_at').eq('is_admin', false)

      if (allClients) {
        var inactiveList = []

        for (var cl of allClients) {
          if (!cl.email) continue

          // Skip if relance sent less than 7 days ago
          if (cl.last_relance_at && (now - new Date(cl.last_relance_at)) < 7 * 86400000) continue

          // Find last confirmed booking
          var { data: lastBooking } = await supabase.from('bookings')
            .select('time_slots(start_time)')
            .eq('client_id', cl.id)
            .eq('status', 'confirmed')
            .not('time_slots', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)

          var lastSession = lastBooking && lastBooking[0] && lastBooking[0].time_slots ? new Date(lastBooking[0].time_slots.start_time) : null

          // Check if inactive (last session older than threshold OR no session at all with 0 credits)
          if (lastSession && lastSession < inactivityDate && lastSession < now) {
            var weeksSince = Math.floor((now - lastSession) / (7 * 86400000))
            var clientFirstName = (cl.full_name || '').split(' ')[0] || 'Bonjour'

            // Send relance email to client
            try {
              await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
                body: JSON.stringify({
                  from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
                  to: cl.email,
                  subject: '💪 ' + clientFirstName + ', on se retrouve bientôt ?',
                  html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:16px">Tu nous manques ' + clientFirstName + ' ! 💪</div><div style="font-size:14px;color:#7a7065;line-height:1.7;margin-bottom:24px">Ça fait ' + weeksSince + ' semaine' + (weeksSince > 1 ? 's' : '') + ' qu\'on ne s\'est pas vu. La régularité est la clé du succès, et chaque séance compte.</div><div style="text-align:center;margin-bottom:20px"><a href="https://app.yoanndesgrand.fr" style="display:inline-block;background:#C4973A;color:#000;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:500">Réserver une séance →</a></div>' + ((cl.credits || 0) > 0 ? '<div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px;color:#C4973A;font-size:13px;text-align:center">💳 Tu as encore ' + cl.credits + ' crédit' + (cl.credits > 1 ? 's' : '') + ' disponible' + (cl.credits > 1 ? 's' : '') + '</div>' : '<div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px;color:#C4973A;font-size:13px;text-align:center">Découvre nos packs pour reprendre en beauté !</div>') + '</div></div>'
                })
              })
            } catch (re) {}

            await supabase.from('profiles').update({ last_relance_at: now.toISOString() }).eq('id', cl.id)
            inactiveList.push({ name: cl.full_name || cl.email, weeks: weeksSince, credits: cl.credits || 0 })
          }
        }

        // Send summary to admin if there are inactive clients
        if (inactiveList.length > 0) {
          var listHtml = inactiveList.map(function(c) {
            return '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee"><b>' + c.name + '</b></td><td style="padding:8px 12px;border-bottom:1px solid #eee">' + c.weeks + ' sem</td><td style="padding:8px 12px;border-bottom:1px solid #eee">' + c.credits + '</td></tr>'
          }).join('')

          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
              body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
                to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
                subject: '📩 Relance — ' + inactiveList.length + ' client' + (inactiveList.length > 1 ? 's' : '') + ' inactif' + (inactiveList.length > 1 ? 's' : '') + ' relancé' + (inactiveList.length > 1 ? 's' : ''),
                html: '<div style="font-family:Arial;padding:24px"><h2>📩 Relance automatique</h2><p>' + inactiveList.length + ' client' + (inactiveList.length > 1 ? 's' : '') + ' inactif' + (inactiveList.length > 1 ? 's' : '') + ' relancé' + (inactiveList.length > 1 ? 's' : '') + ' aujourd\'hui :</p><table style="width:100%;border-collapse:collapse"><tr style="background:#f5f5f5"><th style="padding:8px 12px;text-align:left">Client</th><th style="padding:8px 12px;text-align:left">Inactif</th><th style="padding:8px 12px;text-align:left">Crédits</th></tr>' + listHtml + '</table></div>'
              })
            })
          } catch (re) {}
        }
      }
    } catch (e) { console.log('Relance error:', e.message) }

    return res.status(200).json({ sent: sent })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
