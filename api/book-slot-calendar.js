import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { clientId, startTime, endTime } = req.body
  if (!clientId || !startTime || !endTime) return res.status(400).json({ error: 'Paramètres manquants' })

  // Vérifier crédits + infos coaching
  const { data: profile } = await supabase
    .from('profiles').select('credits, full_name, email, coaching_type, address, no_credit_required').eq('id', clientId).single()

  if (!profile || (!profile.no_credit_required && (profile.credits || 0) < 1))
    return res.status(400).json({ error: 'Aucun crédit disponible' })

  // Créer le time_slot
  const { data: slot } = await supabase.from('time_slots').insert({
    start_time: startTime,
    end_time: endTime,
    is_available: false
  }).select().single()

  // Déduire crédit + créer réservation
  const newCredits = profile.no_credit_required ? (profile.credits || 0) : (profile.credits || 0) - 1
  await supabase.from('profiles').update({ credits: newCredits }).eq('id', clientId)
  const { data: booking } = await supabase.from('bookings').insert({
    client_id: clientId,
    slot_id: slot.id,
    status: 'confirmed'
  }).select().single()

  // Créer événement Google Calendar
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
      const eventLocation = profile.coaching_type === 'domicile'
            ? (profile.address || 'Domicile client')
            : 'ON AIR BNF, 93 avenue de France, 75013 Paris'

      const gcalEvent = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: {
          summary: 'YD Coaching - ' + (profile.full_name || profile.email),
          location: eventLocation,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
          description: (profile.coaching_type === 'domicile' ? '🏠 Coaching à domicile' : '🏋️ Coaching en salle') + '\n' + profile.email
        }
      })

      // Stocker l'ID Google Calendar dans la réservation
      if (gcalEvent?.data?.id) {
        await supabase.from('bookings').update({ google_event_id: gcalEvent.data.id }).eq('id', booking.id)
      }
    }
  } catch (e) {
    console.error('Google Calendar:', e.message)
  }

  // Notifier Yoann par email
  try {
    const startDate = new Date(startTime)
    const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
    const dateStr = DAYS[startDate.getDay()] + ' ' + startDate.getDate() + ' ' + MONTHS[startDate.getMonth()]
    const timeStr = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    const locationStr = profile.coaching_type === 'domicile' ? ('🏠 ' + (profile.address || 'Domicile')) : '🏋️ ON AIR BNF'

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
        subject: `📅 Nouvelle réservation — ${profile.full_name || profile.email}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 450px; padding: 24px;">
            <h2 style="margin: 0 0 16px;">Nouvelle réservation 🎯</h2>
            <div style="background: #f5f5f5; border-radius: 10px; padding: 18px; margin-bottom: 16px;">
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px;">${profile.full_name || profile.email}</div>
              <div style="margin-bottom: 4px;">📅 ${dateStr}</div>
              <div style="margin-bottom: 4px;">🕐 ${timeStr}</div>
              <div>${locationStr}</div>
            </div>
            <div style="font-size: 13px; color: #888;">Crédits restants du client : ${newCredits}</div>
          </div>
        `
      })
    })
  } catch (e) {
    console.error('Admin notification:', e.message)
  }

  return res.status(200).json({ success: true, booking, creditsLeft: newCredits })
}
