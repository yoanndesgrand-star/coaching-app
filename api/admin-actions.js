import { createClient } from '@supabase/supabase-js'

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

function generatePassword() {
  var chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  var pw = ''
  for (var i = 0; i < 8; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length))
  return pw
}

function fmtDate(d) {
  var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]
}

function fmtTime(d) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

async function sendEmail(to, subject, html) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>', to: to, subject: subject, html: html })
    })
  } catch (e) { console.log('Email error:', e.message) }
}

async function getCalendar() {
  var { data: tokenData } = await supabase.from('google_tokens').select('*').eq('id', 'admin').single()
  if (!tokenData?.access_token) return null
  var { google } = await import('googleapis')
  var oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI)
  oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expiry_date: tokenData.expiry_date })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

// ──── BOOK FOR CLIENT ────
async function handleBook(req, res) {
  var { clientId, startTime, endTime } = req.body
  if (!clientId || !startTime || !endTime) return res.status(400).json({ error: 'Paramètres manquants' })

  var { data: profile } = await supabase.from('profiles').select('credits, full_name, email, coaching_type, address').eq('id', clientId).single()
  if (!profile) return res.status(404).json({ error: 'Client introuvable' })
  if ((profile.credits || 0) < 1) return res.status(400).json({ error: 'Ce client n\'a pas de crédits' })

  var { data: slot } = await supabase.from('time_slots').insert({ start_time: startTime, end_time: endTime, is_available: false, date: startTime.split('T')[0] }).select().single()
  var { data: booking } = await supabase.from('bookings').insert({ client_id: clientId, slot_id: slot.id, status: 'confirmed' }).select().single()
  await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', clientId)

  var eventLocation = profile.coaching_type === 'domicile' ? (profile.address || 'Domicile client') : 'ON AIR BNF, 93 avenue de France, 75013 Paris'
  try {
    var calendar = await getCalendar()
    if (calendar) {
      var gcalEvent = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: { summary: 'YD Coaching - ' + (profile.full_name || profile.email), location: eventLocation, start: { dateTime: startTime }, end: { dateTime: endTime }, description: (profile.coaching_type === 'domicile' ? '🏠 Domicile' : '🏋️ Salle') + '\n' + profile.email + '\n(Admin)' }
      })
      if (gcalEvent?.data?.id) await supabase.from('bookings').update({ google_event_id: gcalEvent.data.id }).eq('id', booking.id)
    }
  } catch (e) { console.log('GCal:', e.message) }

  var d = new Date(startTime)
  var dateStr = fmtDate(d), timeStr = fmtTime(d)
  var locStr = profile.coaching_type === 'domicile' ? '🏠 ' + (profile.address || 'À domicile') : '🏋️ ON AIR BNF'

  await sendEmail(profile.email, '✅ Séance confirmée — ' + dateStr + ' à ' + timeStr,
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séance confirmée ✅</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:6px">📅 ' + dateStr + '</div><div style="color:#7a7065;margin-bottom:6px">🕐 ' + timeStr + '</div><div style="color:#7a7065">' + locStr + '</div></div><div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px;margin-bottom:20px;color:#C4973A;font-size:13px">💳 Crédits restants : ' + (profile.credits - 1) + '</div></div></div>')

  await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '📅 Réservation — ' + (profile.full_name || profile.email),
    '<div style="font-family:Arial;padding:24px"><h2>Réservation 🎯</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + (profile.full_name || profile.email) + '</b><br>📅 ' + dateStr + '<br>🕐 ' + timeStr + '<br>' + locStr + '</div></div>')

  return res.status(200).json({ success: true, creditsLeft: profile.credits - 1 })
}

// ──── CANCEL BOOKING ────
async function handleCancel(req, res) {
  var { bookingId } = req.body
  if (!bookingId) return res.status(400).json({ error: 'bookingId requis' })

  var { data: booking } = await supabase.from('bookings').select('*, profiles(full_name, email), time_slots(start_time, end_time)').eq('id', bookingId).single()
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' })

  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)
  var { data: p } = await supabase.from('profiles').select('credits').eq('id', booking.client_id).single()
  if (p) await supabase.from('profiles').update({ credits: (p.credits || 0) + 1 }).eq('id', booking.client_id)

  if (booking.google_event_id) {
    try {
      var calendar = await getCalendar()
      if (calendar) await calendar.events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', eventId: booking.google_event_id })
    } catch (e) { console.log('GCal delete:', e.message) }
  }

  if (booking.profiles?.email && booking.time_slots) {
    var d = new Date(booking.time_slots.start_time)
    await sendEmail(booking.profiles.email, '❌ Séance annulée — ' + fmtDate(d),
      '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séance annulée ❌</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div>📅 ' + fmtDate(d) + '</div><div style="color:#7a7065">🕐 ' + fmtTime(d) + '</div></div><div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:14px;color:#4ade80;font-size:13px">💳 Ton crédit a été restitué.</div></div></div>')
  }

  return res.status(200).json({ success: true })
}

// ──── CREATE CLIENT ────
async function handleCreateClient(req, res) {
  var { email, fullName, phone, coachingType, address } = req.body
  if (!email || !fullName || !coachingType) return res.status(400).json({ error: 'Email, nom et type requis' })

  var { data: existing } = await supabase.from('profiles').select('id').eq('email', email).single()
  if (existing) return res.status(400).json({ error: 'Ce client existe déjà' })

  var tempPassword = generatePassword()
  var { data: authData, error: authError } = await supabase.auth.admin.createUser({ email: email, password: tempPassword, email_confirm: true })
  if (authError) return res.status(400).json({ error: authError.message })

  var userId = authData.user.id
  var profileAddress = coachingType === 'presentiel' ? 'ON AIR BNF, 93 avenue de France, Paris 13' : coachingType === 'domicile' ? (address || '') : null

  await supabase.from('profiles').upsert({ id: userId, email: email, full_name: fullName.trim(), phone: phone || null, coaching_type: coachingType, address: profileAddress, is_admin: false, credits: 0, must_change_password: true }, { onConflict: 'id' })

  var appUrl = process.env.APP_URL || 'https://app.yoanndesgrand.fr'
  var firstName = fullName.trim().split(' ')[0]

  await sendEmail(email, '🎯 Bienvenue chez Yoann Desgrand Coaching !',
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div><div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase">Coach Sport & Nutrition</div></div><div style="padding:32px 28px"><div style="font-size:20px;margin-bottom:8px">Bienvenue ' + firstName + ' ! 🎉</div><div style="font-size:14px;color:#7a7065;margin-bottom:24px;line-height:1.7">Ton espace coaching est prêt.</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:12px;color:#7a7065;margin-bottom:12px">TES IDENTIFIANTS</div><div style="margin-bottom:8px"><span style="color:#7a7065">Email :</span> <b>' + email + '</b></div><div style="margin-bottom:12px"><span style="color:#7a7065">Mot de passe :</span> <b style="color:#C4973A;font-size:18px;letter-spacing:2px">' + tempPassword + '</b></div><div style="font-size:11px;color:#f87171">⚠️ Tu devras modifier ce mot de passe à ta première connexion.</div></div><a href="' + appUrl + '" style="display:block;text-align:center;background:#C4973A;color:#000;border-radius:8px;padding:16px;font-size:15px;font-weight:500;text-decoration:none">Accéder à mon espace →</a></div></div>')

  return res.status(200).json({ success: true, userId: userId })
}

// ──── ROUTER ────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    var action = req.query.action || req.body.action
    if (action === 'book') return handleBook(req, res)
    if (action === 'cancel') return handleCancel(req, res)
    if (action === 'create-client') return handleCreateClient(req, res)
    return res.status(400).json({ error: 'Action inconnue: ' + action })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
