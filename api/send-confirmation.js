export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, fullName, date, time, location, creditsLeft, coachingType } = req.body
  if (!email || !date || !time) return res.status(400).json({ error: 'Paramètres manquants' })

  const locationEmoji = coachingType === 'domicile' ? '🏠' : '🏋️'
  const locationLabel = coachingType === 'domicile' ? 'À domicile' : 'En salle'

  const html = `
  <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #080808; color: #f0ece4; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #161410, #1a1814); padding: 32px 28px; text-align: center; border-bottom: 1px solid #2a2520;">
      <div style="font-family: Georgia, serif; font-size: 22px; margin-bottom: 4px;">Yoann <span style="color: #C4973A;">Desgrand</span></div>
      <div style="font-size: 10px; letter-spacing: 0.2em; color: #7a7065; text-transform: uppercase;">Coach Sport & Nutrition</div>
    </div>
    <div style="padding: 32px 28px;">
      <div style="font-size: 18px; font-weight: 500; margin-bottom: 24px;">Séance confirmée ✅</div>
      <div style="background: #141210; border: 1px solid #2a2520; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
        <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">📅 ${date}</div>
        <div style="font-size: 14px; color: #7a7065; margin-bottom: 6px;">🕐 ${time}</div>
        <div style="font-size: 14px; color: #7a7065;">${locationEmoji} ${location}</div>
      </div>
      <div style="background: rgba(196,151,58,0.08); border: 1px solid rgba(196,151,58,0.2); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 13px; color: #C4973A;">💳 Crédits restants : <strong>${creditsLeft}</strong> séance${creditsLeft > 1 ? 's' : ''}</div>
      </div>
      <div style="font-size: 12px; color: #7a7065; line-height: 1.8;">
        <strong style="color: #f0ece4;">Conditions d'annulation :</strong><br>
        • Annulation gratuite jusqu'à 24h avant la séance<br>
        • Passé ce délai, la séance est due et le crédit ne sera pas remboursé
      </div>
    </div>
    <div style="padding: 20px 28px; border-top: 1px solid #2a2520; text-align: center;">
      <div style="font-size: 11px; color: #7a7065;">À bientôt ${fullName ? fullName.split(' ')[0] : ''} 💪</div>
    </div>
  </div>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
        to: email,
        subject: `✅ Séance confirmée — ${date} à ${time}`,
        html
      })
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Resend error:', err)
      return res.status(200).json({ sent: false, error: err })
    }

    return res.status(200).json({ sent: true })
  } catch (e) {
    console.error('Email error:', e.message)
    return res.status(200).json({ sent: false, error: e.message })
  }
}
