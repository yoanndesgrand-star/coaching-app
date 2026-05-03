import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  const { code } = req.query
  if (!code) return res.status(400).send('No code')

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )

  try {
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    await supabase.from('google_tokens').upsert({
      id: 'admin',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      updated_at: new Date().toISOString()
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const watchRes = await calendar.events.watch({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      requestBody: {
        id: 'yd-coaching-' + Date.now(),
        type: 'web_hook',
        address: 'https://app.yoanndesgrand.fr/api/google-webhook'
      }
    })

    await supabase.from('google_tokens').update({
      webhook_channel_id: watchRes.data.id,
      webhook_resource_id: watchRes.data.resourceId
    }).eq('id', 'admin')

    res.redirect('https://app.yoanndesgrand.fr/?google=connected')
  } catch (e) {
    console.error(e)
    res.status(500).send('Erreur OAuth: ' + e.message)
  }
}
