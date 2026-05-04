export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  var { clientName, clientEmail, clientPhone, coachingType } = req.body
  if (!clientEmail) return res.status(400).json({ error: 'Email requis' })

  var typeLabel = coachingType === 'domicile' ? '🏠 Domicile' : coachingType === 'presentiel' ? '🏋️ Salle' : '📱 En ligne'

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com',
        subject: '👤 Nouveau client inscrit — ' + (clientName || clientEmail),
        html: '<div style="font-family:Arial;padding:24px;max-width:450px">'
          + '<h2 style="margin:0 0 16px">Nouveau client inscrit 🎉</h2>'
          + '<div style="background:#f5f5f5;border-radius:10px;padding:18px">'
          + '<div style="font-weight:bold;font-size:16px;margin-bottom:8px">' + (clientName || '—') + '</div>'
          + '<div style="margin-bottom:4px">📧 ' + clientEmail + '</div>'
          + (clientPhone ? '<div style="margin-bottom:4px">📱 ' + clientPhone + '</div>' : '')
          + '<div>' + typeLabel + '</div>'
          + '</div>'
          + '<div style="margin-top:16px;font-size:13px;color:#888">Inscription via l\'application.</div>'
          + '</div>'
      })
    })
    return res.status(200).json({ sent: true })
  } catch (e) {
    return res.status(200).json({ sent: false })
  }
}
