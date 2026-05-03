import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.status(200).end()

  try {
    const { data: tokenData } = await supabase
      .from('google_tokens').select('*').eq('id', 'admin').single()
    if (!tokenData?.access_token) return

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
    const now = new Date()
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const eventsRes = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    const events = (eventsRes.data.items || []).filter(e =>
      !e.summary?.startsWith('YD Coaching -') && e.status !== 'cancelled' && e.start?.dateTime
    )

    for (const event of events) {
      const { data: slots } = await supabase
        .from('time_slots')
        .select('*')
        .eq('is_available', true)
        .gte('start_time', event.start.dateTime)
        .lte('start_time', event.end.dateTime)

      for (const slot of (slots || [])) {
        await supabase.from('time_slots')
          .update({ is_available: false, google_event_id: event.id })
          .eq('id', slot.id)
      }
    }
  } catch (e) {
    console.error('Webhook error:', e.message)
  }
}
