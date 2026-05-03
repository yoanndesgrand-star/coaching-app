import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { slotId, clientId } = req.body
  if (!slotId || !clientId) return res.status(400).json({ error: 'Paramètres manquants' })

  const { data: slot } = await supabase
    .from('time_slots').select('*').eq('id', slotId).eq('is_available', true).single()

  if (!slot) return res.status(400).json({ error: 'Créneau non disponible' })

  const { data: profile } = await supabase
    .from('profiles').select('credits, full_name, email').eq('id', clientId).single()

  if (!profile || (profile.credits || 0) < 1)
    return res.status(400).json({ error: 'Aucun crédit disponible' })

  await Promise.all([
    supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', clientId),
    supabase.from('time_slots').update({ is_available: false }).eq('id', slotId),
  ])

  const { data: booking } = await supabase.from('bookings')
    .insert({ client_id: clientId, slot_id: slotId, status: 'confirmed' })
    .select().single()

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
      const event = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `YD Coaching - ${profile.full_name || profile.email}`,
          start: { dateTime: slot.start_time },
          end: { dateTime: slot.end_time },
          description: `Réservé via app — ${profile.email}`
        }
      })
      await supabase.from('time_slots')
        .update({ google_event_id: event.data.id }).eq('id', slotId)
    }
  } catch (e) {
    console.error('Google Calendar:', e.message)
  }

  return res.status(200).json({ success: true, booking, creditsLeft: profile.credits - 1 })
}
