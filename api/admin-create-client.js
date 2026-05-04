import { createClient } from '@supabase/supabase-js'

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

function generatePassword() {
  var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  var pw = ''
  for (var i = 0; i < 8; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length))
  return pw
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  var { email, fullName, phone, coachingType, address } = req.body
  if (!email || !fullName || !coachingType) return res.status(400).json({ error: 'Email, nom et type de coaching requis' })

  try {
    // Check if user already exists
    var { data: existing } = await supabase.from('profiles').select('id').eq('email', email).single()
    if (existing) return res.status(400).json({ error: 'Ce client existe déjà' })

    // Generate temp password
    var tempPassword = generatePassword()

    // Create user in Supabase Auth
    var { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true
    })

    if (authError) return res.status(400).json({ error: authError.message })

    var userId = authData.user.id
    var profileAddress = coachingType === 'presentiel'
      ? 'ON AIR BNF, 93 avenue de France, Paris 13'
      : coachingType === 'domicile'
      ? (address || '')
      : null

    // Create profile
    await supabase.from('profiles').upsert({
      id: userId,
      email: email,
      full_name: fullName.trim(),
      phone: phone || null,
      coaching_type: coachingType,
      address: profileAddress,
      is_admin: false,
      credits: 0,
      must_change_password: true
    }, { onConflict: 'id' })

    // Send welcome email
    var appUrl = process.env.APP_URL || 'https://app.yoanndesgrand.fr'
    var firstName = fullName.trim().split(' ')[0]
    var locationEmoji = coachingType === 'domicile' ? '🏠' : coachingType === 'presentiel' ? '🏋️' : '📱'
    var locationLabel = coachingType === 'domicile' ? 'À domicile' : coachingType === 'presentiel' ? 'ON AIR BNF, Paris 13e' : 'En ligne'

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
          to: email,
          subject: '🎯 Bienvenue chez Yoann Desgrand Coaching !',
          html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden">'
            + '<div style="background:linear-gradient(135deg,#161410,#1a1814);padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520">'
            + '<div style="font-family:Georgia,serif;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div>'
            + '<div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase">Coach Sport & Nutrition</div>'
            + '</div>'
            + '<div style="padding:32px 28px">'
            + '<div style="font-size:20px;font-weight:500;margin-bottom:8px">Bienvenue ' + firstName + ' ! 🎉</div>'
            + '<div style="font-size:14px;color:#7a7065;margin-bottom:24px;line-height:1.7">Ton espace coaching est prêt. Tu peux dès maintenant réserver tes séances, suivre tes crédits et gérer ton abonnement.</div>'
            + '<div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px">'
            + '<div style="font-size:12px;color:#7a7065;margin-bottom:12px">TES IDENTIFIANTS</div>'
            + '<div style="margin-bottom:8px"><span style="color:#7a7065">Email :</span> <strong>' + email + '</strong></div>'
            + '<div style="margin-bottom:12px"><span style="color:#7a7065">Mot de passe :</span> <strong style="color:#C4973A;font-size:18px;letter-spacing:2px">' + tempPassword + '</strong></div>'
            + '<div style="font-size:11px;color:#f87171">⚠️ Tu devras modifier ce mot de passe lors de ta première connexion.</div>'
            + '</div>'
            + '<div style="margin-bottom:20px">'
            + '<div style="font-size:13px;color:#7a7065;margin-bottom:4px">' + locationEmoji + ' ' + locationLabel + '</div>'
            + '</div>'
            + '<a href="' + appUrl + '" style="display:block;text-align:center;background:#C4973A;color:#000;border-radius:8px;padding:16px;font-size:15px;font-weight:500;text-decoration:none;margin-bottom:16px">Accéder à mon espace coaching →</a>'
            + '<div style="font-size:11px;color:#7a7065;text-align:center">Si tu as des questions, contacte Yoann sur WhatsApp.</div>'
            + '</div>'
            + '</div>'
        })
      })
    } catch (e) { console.log('Email error:', e.message) }

    return res.status(200).json({ success: true, userId: userId })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
