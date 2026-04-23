import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// Credits per Stripe product
const CREDITS_MAP = {
  'Séance individuelle coaching sportif': { credits: 1, label: 'Séance unique' },
  'Pack 5 séances coaching sportif': { credits: 5, label: 'Pack 5 séances' },
  'Pack 10 séances — Programme SHIFT': { credits: 10, label: 'Programme SHIFT' },
  'Coaching Sport en ligne — App Harmony': { credits: 4, label: 'Coaching Sport 59€/mois' },
  'Coaching Nutrition': { credits: 0, label: 'Coaching Nutrition 119€/mois' },
  'Coaching Sport + Nutrition': { credits: 4, label: 'Sport + Nutrition 149€/mois' },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const sig = req.headers['stripe-signature']
  let event

  try {
    const body = await getRawBody(req)
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_details?.email
    if (!email) return res.status(200).json({ received: true })

    // Get product name
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] })
    const productName = lineItems.data[0]?.price?.product?.name || ''
    const { credits, label } = CREDITS_MAP[productName] || { credits: 1, label: productName }

    // Check if user exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, credits')
      .eq('email', email)
      .single()

    if (existing) {
      // Add credits to existing user
      await supabase.from('profiles').update({
        credits: (existing.credits || 0) + credits,
        offer_label: label
      }).eq('id', existing.id)
    } else {
      // Create new Supabase auth user and send magic link
      const { data: newUser } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (newUser?.user) {
        await supabase.from('profiles').insert({
          id: newUser.user.id,
          email,
          credits,
          offer_label: label,
          is_admin: false,
        })

        // Send magic link email
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: {
            redirectTo: process.env.APP_URL || 'https://app.yoanndesgrand.fr',
            data: { message: `Bienvenue ! Votre offre "${label}" a bien été enregistrée.` }
          }
        })
      }
    }
  }

  res.status(200).json({ received: true })
}

// Helper to get raw body for Stripe signature verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => resolve(Buffer.from(data)))
    req.on('error', reject)
  })
}

export const config = { api: { bodyParser: false } }
