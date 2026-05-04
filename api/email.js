export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  var action = req.query.action || req.body.action || 'confirmation'

  var NUTRITION_QUESTIONNAIRE = 'https://portal.diet-cloud.com/f/d26d4c3f-598d-4a20-8d0d-ebc124784882'

  var SUB_LABELS = {
    sport_online: '📱 Programme Sport en ligne',
    nutrition: '🥗 Suivi Nutritionnel',
    sport_nutrition: '💪 Sport + Nutrition',
    presentiel_sport: '🏋️ Présentiel + Sport',
    presentiel_nutrition: '🏋️ Présentiel + Nutrition',
    presentiel_sport_nutrition: '🏋️ Présentiel + Sport + Nutrition'
  }

  // ──── SUBSCRIPTION EMAIL ────
  if (action === 'subscription') {
    var { clientEmail, clientName, subscriptionType } = req.body
    if (!clientEmail || !subscriptionType) return res.status(400).json({ error: 'Paramètres manquants' })

    var subLabel = SUB_LABELS[subscriptionType] || subscriptionType
    var firstName = (clientName || '').split(' ')[0]
    var hasNutrition = subscriptionType.includes('nutrition') || subscriptionType === 'nutrition'
    var hasSport = subscriptionType.includes('sport')

    // Email to client
    var nutritionBlock = hasNutrition
      ? '<div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:10px;padding:20px;margin-bottom:20px">'
        + '<div style="font-size:15px;font-weight:500;margin-bottom:10px">🥗 Questionnaire Nutritionnel</div>'
        + '<div style="font-size:13px;color:#7a7065;margin-bottom:14px;line-height:1.6">Pour préparer ton plan alimentaire personnalisé, merci de remplir ce questionnaire. Il me permettra de mieux comprendre tes habitudes, tes objectifs et tes éventuelles restrictions.</div>'
        + '<a href="' + NUTRITION_QUESTIONNAIRE + '" style="display:block;text-align:center;background:#C4973A;color:#000;border-radius:8px;padding:14px;font-size:14px;font-weight:500;text-decoration:none">Remplir le questionnaire →</a>'
        + '</div>'
      : ''

    var sportBlock = hasSport
      ? '<div style="background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:10px;padding:20px;margin-bottom:20px">'
        + '<div style="font-size:15px;font-weight:500;margin-bottom:8px">🏋️ Programme Sport</div>'
        + '<div style="font-size:13px;color:#7a7065;line-height:1.6">Ton programme d\'entraînement personnalisé sera disponible prochainement. Yoann te contactera pour finaliser les détails.</div>'
        + '</div>'
      : ''

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
          to: clientEmail,
          subject: '⭐ Ton abonnement ' + subLabel + ' est activé !',
          html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden">'
            + '<div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div><div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase">Coach Sport & Nutrition</div></div>'
            + '<div style="padding:32px 28px">'
            + '<div style="font-size:20px;font-weight:500;margin-bottom:8px">Abonnement activé ⭐</div>'
            + '<div style="font-size:14px;color:#7a7065;margin-bottom:24px;line-height:1.6">Bonjour ' + firstName + ', ton abonnement <strong style="color:#f0ece4">' + subLabel + '</strong> est maintenant actif !</div>'
            + nutritionBlock
            + sportBlock
            + '<div style="font-size:12px;color:#7a7065;line-height:1.8">Pour toute question, contacte Yoann directement sur WhatsApp.</div>'
            + '</div></div>'
        })
      })
    } catch (e) { console.log('Sub email error:', e.message) }

    // Notify admin
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
          subject: '⭐ Nouvel abonnement — ' + (clientName || clientEmail),
          html: '<div style="font-family:Arial;padding:24px"><h2>Nouvel abonnement ⭐</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + (clientName || '—') + '</b><br>📧 ' + clientEmail + '<br>' + subLabel + '</div></div>'
        })
      })
    } catch (e) {}

    return res.status(200).json({ sent: true })
  }

  if (action === 'signup-notify') {
    var { clientName, clientEmail, clientPhone, coachingType } = req.body
    var typeLabel = coachingType === 'domicile' ? '🏠 Domicile' : coachingType === 'presentiel' ? '🏋️ Salle' : '📱 En ligne'
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
          to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
          subject: '👤 Nouveau client — ' + (clientName || clientEmail),
          html: '<div style="font-family:Arial;padding:24px;max-width:450px"><h2>Nouveau client 🎉</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + (clientName || '—') + '</b><br>📧 ' + (clientEmail || '') + (clientPhone ? '<br>📱 ' + clientPhone : '') + '<br>' + typeLabel + '</div></div>'
        })
      })
    } catch (e) { console.log('Email error:', e.message) }
    return res.status(200).json({ sent: true })
  }

  // Default: booking confirmation
  var { email, fullName, date, time, location, creditsLeft, coachingType: ct } = req.body
  if (!email || !date || !time) return res.status(400).json({ error: 'Paramètres manquants' })

  var locEmoji = ct === 'domicile' ? '🏠' : '🏋️'
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
        to: email,
        subject: '✅ Séance confirmée — ' + date + ' à ' + time,
        html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séance confirmée ✅</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:6px">📅 ' + date + '</div><div style="color:#7a7065;margin-bottom:6px">🕐 ' + time + '</div><div style="color:#7a7065">' + locEmoji + ' ' + (location || '') + '</div></div><div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px;color:#C4973A;font-size:13px">💳 Crédits restants : <b>' + (creditsLeft || 0) + '</b></div><div style="margin-top:20px;font-size:12px;color:#7a7065;line-height:1.8"><b style="color:#f0ece4">Conditions d\'annulation :</b><br>• Gratuite jusqu\'à 24h avant<br>• Passé ce délai, le crédit ne sera pas remboursé</div></div><div style="padding:20px 28px;border-top:1px solid #2a2520;text-align:center;font-size:11px;color:#7a7065">À bientôt ' + ((fullName || '').split(' ')[0]) + ' 💪</div></div>'
      })
    })
    return res.status(200).json({ sent: true })
  } catch (e) {
    return res.status(200).json({ sent: false, error: e.message })
  }
}
// update
