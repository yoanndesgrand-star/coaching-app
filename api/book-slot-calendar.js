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
    .from('profiles').select('credits, full_name, email, coaching_type, address').eq('id', clientId).single()

  if (!profile || (profile.credits || 0) < 1)
    return res.status(400).json({ error: 'Aucun crédit disponible' })

  // Créer le time_slot
  const { data: slot } = await supabase.from('time_slots').insert({
    start_time: startTime,
    end_time: endTime,
    is_available: false
  }).select().single()

  // Déduire crédit + créer réservation
  await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', clientId)
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

      await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: {
          summary: 'YD Coaching - ' + (profile.full_name || profile.email),
          location: eventLocation,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
          description: (profile.coaching_type === 'domicile' ? '🏠 Coaching à domicile' : '🏋️ Coaching en salle') + '\n' + profile.email
        }
      })
    }
  } catch (e) {
    console.error('Google Calendar:', e.message)
  }

  return res.status(200).json({ success: true, booking, creditsLeft: profile.credits - 1 })
}
