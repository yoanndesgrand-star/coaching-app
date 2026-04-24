import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const CALENDLY_TOKEN = process.env.CALENDLY_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const event = req.body

  // Only handle invitee.created (new booking)
  if (event.event !== 'invitee.created') {
    return res.status(200).json({ received: true })
  }

  const invitee = event.payload?.invitee
  const email = invitee?.email

  if (!email) return res.status(200).json({ received: true })

  // Find profile by email
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, credits, offer_label')
    .eq('email', email)
    .single()

  if (!profile) return res.status(200).json({ received: true })

  // Only decrement if client has credits (not abonnés who pay per session)
  if (profile.credits > 0) {
    await supabase
      .from('profiles')
      .update({ credits: profile.credits - 1 })
      .eq('id', profile.id)
  }

  return res.status(200).json({ received: true })
}
