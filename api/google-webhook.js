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
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
    const now = new Date()
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // 1. Récupérer les événements annulés/supprimés récemment (dernière heure)
    const recentlyUpdated = new Date(now.getTime() - 60 * 60 * 1000)
    
    const cancelledRes = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      showDeleted: true,
      updatedMin: recentlyUpdated.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    const cancelledEvents = (cancelledRes.data.items || []).filter(e =>
      e.status === 'cancelled' && e.id
    )

    // Pour chaque événement annulé, vérifier s'il correspond à une réservation
    for (const event of cancelledEvents) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, client_id, slot_id, status')
        .eq('google_event_id', event.id)
        .eq('status', 'confirmed')
        .single()

      if (booking) {
        // Annuler la réservation
        await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)
        // Restituer le crédit
        const { data: p } = await supabase.from('profiles').select('credits').eq('id', booking.client_id).single()
        if (p) await supabase.from('profiles').update({ credits: (p.credits || 0) + 1 }).eq('id', booking.client_id)
        
        console.log('Booking cancelled via Google Calendar:', booking.id, 'Event:', event.id)
      }
    }

    // 2. Sync des événements non-coaching pour bloquer les créneaux (logique existante)
    const eventsRes = await calendar.events.list({
      calendarId,
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
