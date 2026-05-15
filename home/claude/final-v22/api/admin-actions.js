import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import Stripe from 'stripe'

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
var stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// Setup VAPID for push notifications
var VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
var VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try { webpush.setVapidDetails('mailto:contact@yoanndesgrand.fr', VAPID_PUBLIC, VAPID_PRIVATE) } catch(e) {}
}

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
  var { clientId, startTime, endTime, location: passedLocation } = req.body
  if (!clientId || !startTime || !endTime) return res.status(400).json({ error: 'Paramètres manquants' })

  var { data: profile } = await supabase.from('profiles').select('credits, full_name, email, coaching_type, address, no_credit_required').eq('id', clientId).single()
  if (!profile) return res.status(404).json({ error: 'Client introuvable' })

  var slotRes = await supabase.from('time_slots').insert({ start_time: startTime, end_time: endTime, is_available: false }).select().single()
  if (slotRes.error) return res.status(400).json({ error: 'Erreur slot: ' + slotRes.error.message })
  var slot = slotRes.data

  var coachSettings = await supabase.from('coaching_settings').select('coach_id').eq('id', 'admin').single()
  var coachId = (coachSettings.data && coachSettings.data.coach_id) || req.body.coachId || null
  var eventLocation = passedLocation || (profile.coaching_type === 'domicile' ? (profile.address || 'Domicile client') : 'ON AIR BNF, 93 avenue de France, 75013 Paris')
  var bookRes = await supabase.from('bookings').insert({ client_id: clientId, slot_id: slot.id, status: 'confirmed', location: eventLocation, coach_id: coachId || profile.coach_id }).select().single()
  if (bookRes.error) return res.status(400).json({ error: 'Erreur booking: ' + bookRes.error.message })
  var booking = bookRes.data

  var newCredits = profile.no_credit_required ? (profile.credits || 0) : (profile.credits || 0) - 1
  await supabase.from('profiles').update({ credits: newCredits }).eq('id', clientId)
  var creditsLeft = newCredits

  // Email admin when credits reach 0 or go negative
  if (!profile.no_credit_required && (profile.credits || 0) > 0 && newCredits <= 0) {
    var d = new Date(startTime)
    try {
      await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '⚠️ Crédits épuisés — ' + (profile.full_name || profile.email),
        '<div style="font-family:Arial;padding:24px"><h2>⚠️ Crédits épuisés</h2><div style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:18px"><b>' + (profile.full_name || profile.email) + '</b> a utilisé son dernier crédit.<br><br>📅 Dernière séance créditée : <b>' + fmtDate(d) + '</b> à ' + fmtTime(d) + '<br>💳 Crédits restants : <b>' + newCredits + '</b>' + (newCredits < 0 ? '<br>🔴 Ce client doit <b>' + Math.abs(newCredits) + ' séance' + (Math.abs(newCredits) > 1 ? 's' : '') + '</b>' : '') + '</div><div style="margin-top:16px;font-size:13px;color:#666">Pense à relancer ce client pour un renouvellement.</div></div>')
    } catch (e) {}
  }

  // eventLocation already defined above
  try {
    var calendar = await getCalendar()
    if (calendar) {
      var gcalEvent = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: { summary: 'YD Coaching - ' + (profile.full_name || profile.email), location: eventLocation, start: { dateTime: startTime }, end: { dateTime: endTime }, attendees: [{ email: profile.email }], description: (profile.coaching_type === 'domicile' ? '🏠 Domicile' : '🏋️ Salle') + '\n' + profile.email + '\n(Admin)' },
          sendUpdates: 'all'
      })
      if (gcalEvent && gcalEvent.data && gcalEvent.data.id) await supabase.from('bookings').update({ google_event_id: gcalEvent.data.id }).eq('id', booking.id)
    }
  } catch (e) { console.log('GCal:', e.message) }

  var d = new Date(startTime)
  var dateStr = fmtDate(d), timeStr = fmtTime(d)
  var locStr = profile.coaching_type === 'domicile' ? '🏠 ' + (profile.address || 'À domicile') : '🏋️ ON AIR BNF'

  // Google Calendar link for "Add to calendar" button
  var calStart = new Date(startTime).toISOString().replace(/[-:]/g, '').replace('.000', '')
  var calEnd = new Date(endTime).toISOString().replace(/[-:]/g, '').replace('.000', '')
  var calLocation = profile.coaching_type === 'domicile' ? (profile.address || '') : 'ON AIR BNF, 93 avenue de France, 75013 Paris'
  var gcalLink = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Coaching Yoann Desgrand') + '&dates=' + calStart + '/' + calEnd + '&location=' + encodeURIComponent(calLocation) + '&details=' + encodeURIComponent('Séance de coaching avec Yoann Desgrand')

  await sendEmail(profile.email, '✅ Séance confirmée — ' + dateStr + ' à ' + timeStr,
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séance confirmée ✅</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:6px">📅 ' + dateStr + '</div><div style="color:#7a7065;margin-bottom:6px">🕐 ' + timeStr + '</div><div style="color:#7a7065">' + locStr + '</div></div><div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px;margin-bottom:20px;color:#C4973A;font-size:13px">💳 Crédits restants : ' + creditsLeft + '</div><div style="text-align:center;margin-top:16px"><a href="' + gcalLink + '" style="display:inline-block;background:#C4973A;color:#000;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:500">📅 Ajouter à mon agenda</a></div></div></div>')

  await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '📅 Réservation — ' + (profile.full_name || profile.email),
    '<div style="font-family:Arial;padding:24px"><h2>Réservation 🎯</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + (profile.full_name || profile.email) + '</b><br>📅 ' + dateStr + '<br>🕐 ' + timeStr + '<br>' + locStr + '</div></div>')

  return res.status(200).json({ success: true, creditsLeft: profile.credits - 1 })
}

// ──── CANCEL BOOKING ────
async function handleCancel(req, res) {
  var { bookingId, silent } = req.body
  if (!bookingId) return res.status(400).json({ error: 'bookingId requis' })

  var { data: booking } = await supabase.from('bookings').select('*, profiles!bookings_client_id_fkey(full_name, email, coaching_type), time_slots(start_time, end_time)').eq('id', bookingId).single()
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' })

  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)

  // Delete Google Calendar event
  try {
    var gcalEventId = booking.google_event_id
    if (!gcalEventId && booking.time_slots) {
      // Check time_slots for google_event_id
      var { data: ts } = await supabase.from('time_slots').select('google_event_id').eq('id', booking.slot_id).single()
      if (ts) gcalEventId = ts.google_event_id
    }
    if (gcalEventId) {
      var cal = await getCalendar()
      if (cal) {
        // Get selected calendar
        var calendarId = 'primary'
        try {
          var { data: cs } = await supabase.from('coaching_settings').select('google_calendar_id').limit(1).single()
          if (cs && cs.google_calendar_id) calendarId = cs.google_calendar_id
        } catch(e) {}
        await cal.events.delete({ calendarId: calendarId, eventId: gcalEventId })
        console.log('Google Calendar event deleted:', gcalEventId)
      }
    }
  } catch(calErr) { console.log('Calendar delete error (non-blocking):', calErr.message) }

  var { data: p } = await supabase.from('profiles').select('credits, no_credit_required').eq('id', booking.client_id).single()
  if (p && !p.no_credit_required) await supabase.from('profiles').update({ credits: (p.credits || 0) + 1 }).eq('id', booking.client_id)
  var creditRestored = p && !p.no_credit_required

  if (booking.google_event_id) {
    try {
      var calendar = await getCalendar()
      if (calendar) await calendar.events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', eventId: booking.google_event_id })
    } catch (e) { console.log('GCal delete:', e.message) }
  }

  // Skip emails in silent mode (bulk cancel)
  if (!silent) {
    var clientName = booking.profiles?.full_name || booking.profiles?.email || 'Client'
    var clientEmail = booking.profiles?.email
    var d = booking.time_slots ? new Date(booking.time_slots.start_time) : null

    if (clientEmail && d) {
      await sendEmail(clientEmail, '❌ Séance annulée — ' + fmtDate(d),
        '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séance annulée ❌</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div>📅 ' + fmtDate(d) + '</div><div style="color:#7a7065">🕐 ' + fmtTime(d) + '</div></div>' + (creditRestored ? '<div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:14px;color:#4ade80;font-size:13px">💳 Ton crédit a été restitué.</div>' : '') + '</div></div>')
    }

    await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '❌ Annulation — ' + clientName,
      '<div style="font-family:Arial;padding:24px"><h2>Séance annulée ❌</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + clientName + '</b>' + (d ? '<br>📅 ' + fmtDate(d) + '<br>🕐 ' + fmtTime(d) : '') + (creditRestored ? '<br>💳 Crédit restitué' : '') + '</div></div>')
  }

  return res.status(200).json({ success: true })
}

// ──── CANCEL SUMMARY (after bulk cancel) ────
async function handleCancelSummary(req, res) {
  var { clientId, count } = req.body
  if (!clientId) return res.status(400).json({ error: 'clientId requis' })
  var { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', clientId).single()
  if (!profile) return res.status(404).json({ error: 'Client introuvable' })

  await sendEmail(profile.email, '❌ ' + count + ' séances annulées',
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séances annulées ❌</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:8px">' + count + ' séances ont été annulées</div><div style="color:#7a7065">Suite à un changement de planning, tes prochaines séances ont été annulées. Ton coach te recontactera pour reprogrammer.</div></div></div></div>')

  await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '❌ Annulation en masse — ' + (profile.full_name || profile.email),
    '<div style="font-family:Arial;padding:24px"><h2>Annulation en masse ❌</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + (profile.full_name || profile.email) + '</b><br>📊 ' + count + ' séances annulées</div></div>')

  return res.status(200).json({ success: true })
}

// ──── SEARCH FRENCH COMPANIES ────
async function handleSearchCompany(req, res) {
  var { query } = req.body
  if (!query || query.length < 3) return res.status(200).json({ results: [] })
  try {
    var url = 'https://recherche-entreprises.api.gouv.fr/search?q=' + encodeURIComponent(query) + '&per_page=5'
    var response = await fetch(url)
    var data = await response.json()
    var results = (data.results || []).map(function(r) {
      var siege = r.siege || {}
      var address = [siege.numero_voie, siege.type_voie, siege.libelle_voie, siege.code_postal, siege.libelle_commune].filter(Boolean).join(' ')
      return {
        name: r.nom_complet || r.nom_raison_sociale || '',
        siret: siege.siret || '',
        siren: r.siren || '',
        tva: r.siren ? 'FR' + (12 + 3 * (parseInt(r.siren) % 97)) % 97 + '' + r.siren : '',
        address: address,
        activity: r.activite_principale ? r.section_activite_principale : '',
        status: r.etat_administratif
      }
    })
    return res.status(200).json({ results: results })
  } catch (e) {
    return res.status(200).json({ results: [], error: e.message })
  }
}

// ──── STRIPE STATUS ────
async function handleStripeStatus(req, res) {
  var stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return res.status(200).json({ connected: false, error: 'STRIPE_SECRET_KEY non configuré dans Vercel' })

  try {
    var response = await fetch('https://api.stripe.com/v1/account', {
      headers: { 'Authorization': 'Bearer ' + stripeKey }
    })
    var account = await response.json()
    if (account.error) return res.status(200).json({ connected: false, error: account.error.message })

    return res.status(200).json({
      connected: true,
      account_id: account.id,
      business_name: account.settings?.dashboard?.display_name || account.business_profile?.name || account.email,
      email: account.email,
      country: account.country,
      currency: account.default_currency,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled
    })
  } catch (e) {
    return res.status(200).json({ connected: false, error: e.message })
  }
}

// ──── GOOGLE CALENDAR EVENTS (for finance) ────
async function handleGcalEvents(req, res) {
  var { date } = req.body
  if (!date) return res.status(400).json({ error: 'date requis' })

  try {
    var calendar = await getCalendar()
    if (!calendar) return res.status(200).json({ events: [], error: 'Google Calendar non connecté' })

    var dayStart = date + 'T00:00:00+02:00'
    var dayEnd = date + 'T23:59:59+02:00'

    var result = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeMin: dayStart,
      timeMax: dayEnd,
      singleEvents: true,
      orderBy: 'startTime'
    })

    var events = (result.data.items || []).map(function(ev) {
      var start = ev.start.dateTime || ev.start.date
      var end = ev.end.dateTime || ev.end.date
      var durationMin = Math.round((new Date(end) - new Date(start)) / 60000)
      return {
        id: ev.id,
        title: ev.summary || 'Sans titre',
        start: start,
        end: end,
        duration_minutes: durationMin,
        location: ev.location || '',
        description: ev.description || ''
      }
    })

    return res.status(200).json({ events: events })
  } catch (e) {
    return res.status(200).json({ events: [], error: e.message })
  }
}

// ──── CREATE CLIENT ────
async function handleCreateClient(req, res) {
  var { email, firstName, lastName, fullName: legacyName, phone, coachingType, address, coachId, noApp } = req.body
  var fullName = firstName ? (firstName + ' ' + (lastName || '')).trim() : (legacyName || '')
  if (!fullName || !coachingType) return res.status(400).json({ error: 'Nom et type requis' })
  if (!noApp && !email) return res.status(400).json({ error: 'Email requis (ou créez sans accès app)' })

  if (email) {
    var { data: existing } = await supabase.from('profiles').select('id').eq('email', email).single()
    if (existing) return res.status(400).json({ error: 'Ce client existe déjà' })
  }

  var profileAddress = coachingType === 'domicile' ? (address || '') : (address || '')

  // Client sans accès app: create auth user with placeholder email, no invitation
  if (noApp) {
    var placeholderEmail = email || ('noapp-' + Date.now() + '@placeholder.local')
    var tempPw = generatePassword()
    var { data: noAppAuth, error: noAppErr } = await supabase.auth.admin.createUser({ email: placeholderEmail, password: tempPw, email_confirm: true })
    if (noAppErr) return res.status(400).json({ error: noAppErr.message })
    var noAppId = noAppAuth.user.id
    await supabase.from('profiles').upsert({ id: noAppId, email: email || null, full_name: fullName.trim(), phone: phone || null, coaching_type: coachingType, address: profileAddress, is_admin: false, credits: 0, coach_id: coachId || null, no_app: true }, { onConflict: 'id' })
    return res.status(200).json({ success: true, userId: noAppId })
  }

  // Client avec accès app: create auth user + send email
  var tempPassword = generatePassword()
  var { data: authData, error: authError } = await supabase.auth.admin.createUser({ email: email, password: tempPassword, email_confirm: true })
  if (authError) return res.status(400).json({ error: authError.message })

  var userId = authData.user.id

  await supabase.from('profiles').upsert({ id: userId, email: email, full_name: fullName.trim(), phone: phone || null, coaching_type: coachingType, address: profileAddress, is_admin: false, credits: 0, must_change_password: true, coach_id: coachId || null }, { onConflict: 'id' })

  var appUrl = process.env.APP_URL || 'https://app.yoanndesgrand.fr'

  await sendEmail(email, '🎯 Bienvenue chez Yoann Desgrand Coaching !',
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div><div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase">Coach Sport & Nutrition</div></div><div style="padding:32px 28px"><div style="font-size:20px;margin-bottom:8px">Bienvenue ' + firstName + ' ! 🎉</div><div style="font-size:14px;color:#7a7065;margin-bottom:24px;line-height:1.7">Ton espace coaching est prêt.</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:12px;color:#7a7065;margin-bottom:12px">TES IDENTIFIANTS</div><div style="margin-bottom:8px"><span style="color:#7a7065">Email :</span> <b>' + email + '</b></div><div style="margin-bottom:12px"><span style="color:#7a7065">Mot de passe :</span> <b style="color:#C4973A;font-size:18px;letter-spacing:2px">' + tempPassword + '</b></div><div style="font-size:11px;color:#f87171">⚠️ Tu devras modifier ce mot de passe à ta première connexion.</div></div><a href="' + appUrl + '" style="display:block;text-align:center;background:#C4973A;color:#000;border-radius:8px;padding:16px;font-size:15px;font-weight:500;text-decoration:none">Accéder à mon espace →</a></div></div>')

  return res.status(200).json({ success: true, userId: userId })
}

// ──── BOOK RECURRING ────
async function handleBookRecurring(req, res) {
  var { clientId, dayOfWeek, time, durationMonths, startDate, sessionDuration } = req.body
  if (!clientId || dayOfWeek === undefined || !time || !durationMonths || !startDate) {
    return res.status(400).json({ error: 'Paramètres manquants' })
  }

  var { data: profile } = await supabase.from('profiles').select('credits, full_name, email, coaching_type, address, no_credit_required').eq('id', clientId).single()
  if (!profile) return res.status(404).json({ error: 'Client introuvable' })

  // Calculate all dates
  var dates = []
  var start = new Date(startDate + 'T00:00:00')
  var endDate = new Date(start)
  endDate.setMonth(endDate.getMonth() + parseInt(durationMonths))

  var d = new Date(start)
  // Find first occurrence of the day
  while (d.getDay() !== parseInt(dayOfWeek)) d.setDate(d.getDate() + 1)

  while (d < endDate) {
    dates.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }

  if (dates.length === 0) return res.status(400).json({ error: 'Aucune date trouvée' })

  var dur = parseInt(sessionDuration) || 60
  var calendar = null
  var calError = null
  try { calendar = await getCalendar() } catch (e) { calError = e.message }

  var eventLocation = profile.coaching_type === 'domicile' ? (profile.address || 'Domicile client') : 'ON AIR BNF, 93 avenue de France, 75013 Paris'
  // Convert Paris time to UTC for Supabase storage
  function parisToUTC(dateStr, timeStr) {
    var testDate = new Date(dateStr + 'T12:00:00Z')
    var parisHour = parseInt(testDate.toLocaleString('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }))
    var offset = parisHour - 12 // 1 (winter) or 2 (summer)
    var h = parseInt(timeStr.split(':')[0]) - offset
    var m = parseInt(timeStr.split(':')[1])
    if (h < 0) h += 24
    return dateStr + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00.000Z'
  }

  var created = 0
  var errors = []

  for (var i = 0; i < dates.length; i++) {
    var dateObj = dates[i]
    var dateStr = dateObj.toISOString().split('T')[0]
    var startTimeUTC = parisToUTC(dateStr, time)
    var endH = parseInt(time.split(':')[0])
    var endM = parseInt(time.split(':')[1]) + dur
    endH += Math.floor(endM / 60)
    endM = endM % 60
    var endTimeUTC = parisToUTC(dateStr, (endH < 10 ? '0' : '') + endH + ':' + (endM < 10 ? '0' : '') + endM)

    try {
      var slotRes = await supabase.from('time_slots').insert({ start_time: startTimeUTC, end_time: endTimeUTC, is_available: false }).select().single()
      if (slotRes.error) { errors.push('slot: ' + slotRes.error.message); continue }
      var slot = slotRes.data

      var bookRes = await supabase.from('bookings').insert({ client_id: clientId, slot_id: slot.id, status: 'confirmed', location: eventLocation }).select().single()
      if (bookRes.error) { errors.push('booking: ' + bookRes.error.message); continue }
      created++
    } catch (e) { errors.push('loop: ' + e.message) }
  }

  // Create ONE recurring Google Calendar event (instead of N individual ones)
  if (calendar && created > 0) {
    try {
      var firstDateStr = dates[0].toISOString().split('T')[0]
      var lastDateStr = dates[dates.length - 1].toISOString().split('T')[0]
      var startLocal = firstDateStr + 'T' + time + ':00'
      var eH = parseInt(time.split(':')[0]) + Math.floor((parseInt(time.split(':')[1]) + dur) / 60)
      var eM = (parseInt(time.split(':')[1]) + dur) % 60
      var endLocal = firstDateStr + 'T' + (eH < 10 ? '0' : '') + eH + ':' + (eM < 10 ? '0' : '') + eM + ':00'
      var untilDate = lastDateStr.replace(/-/g, '') + 'T235959Z'

      var gcalEvent = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: {
          summary: 'YD Coaching - ' + (profile.full_name || profile.email),
          location: eventLocation,
          start: { dateTime: startLocal, timeZone: 'Europe/Paris' },
          end: { dateTime: endLocal, timeZone: 'Europe/Paris' },
          recurrence: ['RRULE:FREQ=WEEKLY;UNTIL=' + untilDate],
          attendees: [{ email: profile.email }],
          description: (profile.coaching_type === 'domicile' ? '🏠 Domicile' : '🏋️ Salle') + '\n' + profile.email + '\n(Récurrent — ' + created + ' séances)'
        },
        sendUpdates: 'none'
      })
      if (gcalEvent && gcalEvent.data && gcalEvent.data.id) {
        // Save event ID on all bookings for this batch
        var allBookings = await supabase.from('bookings').select('id').eq('client_id', clientId).eq('status', 'confirmed').order('created_at', { ascending: false }).limit(created)
        if (allBookings.data) {
          for (var bi = 0; bi < allBookings.data.length; bi++) {
            await supabase.from('bookings').update({ google_event_id: gcalEvent.data.id }).eq('id', allBookings.data[bi].id)
          }
        }
      }
    } catch (e) { errors.push('gcal: ' + e.message) }
  }

  // Deduct credits only if client requires credits
  if (!profile.no_credit_required) {
    var oldCredits = profile.credits || 0
    var newCredits = oldCredits - created
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', clientId)

    // Email admin if credits went to 0 or negative
    if (oldCredits > 0 && newCredits <= 0) {
      var lastCreditedIndex = Math.min(oldCredits, dates.length) - 1
      var lastCreditedDate = dates[lastCreditedIndex]
      try {
        await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '⚠️ Crédits épuisés — ' + (profile.full_name || profile.email),
          '<div style="font-family:Arial;padding:24px"><h2>⚠️ Crédits épuisés (récurrent)</h2><div style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:18px"><b>' + (profile.full_name || profile.email) + '</b> — réservation récurrente de <b>' + created + ' séances</b><br><br>💳 Crédits avant : <b>' + oldCredits + '</b><br>💳 Crédits après : <b>' + newCredits + '</b><br>📅 Dernière séance créditée : <b>' + fmtDate(lastCreditedDate) + '</b>' + (newCredits < 0 ? '<br>🔴 Ce client doit <b>' + Math.abs(newCredits) + ' séance' + (Math.abs(newCredits) > 1 ? 's' : '') + '</b>' : '') + '</div><div style="margin-top:16px;font-size:13px;color:#666">Pense à relancer ce client pour un renouvellement.</div></div>')
      } catch (e) {}
    }
  }

  // Send summary email to client
  var DAYS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']
  var dayName = DAYS_FR[parseInt(dayOfWeek)]
  var firstDate = fmtDate(dates[0])
  var lastDate = fmtDate(dates[dates.length - 1])

  var creditLine = profile.no_credit_required
    ? '💳 Paiement à la séance'
    : '💳 Crédits restants : ' + ((profile.credits || 0) - created)

  await sendEmail(profile.email, '📅 ' + created + ' séances récurrentes confirmées',
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:24px">Séances récurrentes confirmées ✅</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:16px;margin-bottom:8px">📅 Tous les ' + dayName + 's à ' + time + '</div><div style="color:#7a7065;margin-bottom:6px">Du ' + firstDate + ' au ' + lastDate + '</div><div style="color:#7a7065">' + created + ' séances au total</div></div><div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:8px;padding:14px;color:#C4973A;font-size:13px">' + creditLine + '</div></div></div>')

  // Notify admin
  await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '📅 Récurrence — ' + (profile.full_name || profile.email),
    '<div style="font-family:Arial;padding:24px"><h2>Récurrence créée 🎯</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + (profile.full_name || profile.email) + '</b><br>📅 Tous les ' + dayName + 's à ' + time + '<br>📊 ' + created + ' séances (' + durationMonths + ' mois)<br>' + creditLine + '</div></div>')

  return res.status(200).json({ success: true, count: created, errors: errors.length > 0 ? errors : undefined, calError: calError || undefined })
}

// ──── DELETE CLIENT ────
async function handleDeleteClient(req, res) {
  var { clientId } = req.body
  if (!clientId) return res.status(400).json({ error: 'clientId requis' })

  // Delete bookings and time slots
  var { data: bookings } = await supabase.from('bookings').select('slot_id').eq('client_id', clientId)
  if (bookings && bookings.length > 0) {
    var slotIds = bookings.map(function(b) { return b.slot_id }).filter(Boolean)
    await supabase.from('bookings').delete().eq('client_id', clientId)
    if (slotIds.length > 0) {
      await supabase.from('time_slots').delete().in('id', slotIds)
    }
  }

  // Delete profile
  await supabase.from('profiles').delete().eq('id', clientId)

  // Delete auth user
  try {
    await supabase.auth.admin.deleteUser(clientId)
  } catch (e) { console.log('Auth delete error:', e.message) }

  return res.status(200).json({ success: true })
}

// ──── RESCHEDULE ────
async function handleReschedule(req, res) {
  var { bookingId, newStartTime, newEndTime } = req.body
  if (!bookingId || !newStartTime || !newEndTime) return res.status(400).json({ error: 'Paramètres manquants' })

  var { data: booking } = await supabase.from('bookings').select('*, profiles!bookings_client_id_fkey(full_name, email, coaching_type, address), time_slots(start_time, end_time)').eq('id', bookingId).single()
  if (!booking) return res.status(404).json({ error: 'Réservation introuvable' })

  // Free old slot
  await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)

  // Create new slot
  var { data: newSlot, error: slotErr } = await supabase.from('time_slots').insert({ start_time: newStartTime, end_time: newEndTime, is_available: false }).select().single()
  if (slotErr || !newSlot) return res.status(400).json({ error: 'Erreur création créneau: ' + (slotErr ? slotErr.message : 'slot null') })

  // Update booking to new slot
  var { error: bookErr } = await supabase.from('bookings').update({ slot_id: newSlot.id }).eq('id', bookingId)
  if (bookErr) return res.status(400).json({ error: 'Erreur mise à jour booking: ' + bookErr.message })

  // Update Google Calendar event
  if (booking.google_event_id) {
    try {
      var calendar = await getCalendar()
      if (calendar) {
        await calendar.events.patch({
          calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
          eventId: booking.google_event_id,
          sendUpdates: 'all',
          requestBody: { start: { dateTime: newStartTime }, end: { dateTime: newEndTime } }
        })
      }
    } catch (e) { console.log('GCal reschedule:', e.message) }
  }

  // Emails
  var oldD = new Date(booking.time_slots.start_time)
  var newD = new Date(newStartTime)
  var clientName = booking.profiles?.full_name || booking.profiles?.email || 'Client'

  if (booking.profiles?.email) {
    await sendEmail(booking.profiles.email, '📅 Séance décalée — ' + fmtDate(newD),
      '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:20px">Séance décalée 📅</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:16px"><div style="color:#7a7065;text-decoration:line-through;margin-bottom:12px">❌ ' + fmtDate(oldD) + ' à ' + fmtTime(oldD) + '</div><div style="font-size:16px">✅ ' + fmtDate(newD) + '</div><div style="color:#7a7065">🕐 ' + fmtTime(newD) + '</div></div></div></div>')
  }

  await sendEmail(process.env.ADMIN_EMAIL || 'yoann.desgrand@gmail.com', '📅 Décalage — ' + clientName,
    '<div style="font-family:Arial;padding:24px"><h2>Séance décalée 📅</h2><div style="background:#f5f5f5;border-radius:10px;padding:18px"><b>' + clientName + '</b><br>❌ Avant : ' + fmtDate(oldD) + ' à ' + fmtTime(oldD) + '<br>✅ Après : ' + fmtDate(newD) + ' à ' + fmtTime(newD) + '</div></div>')

  return res.status(200).json({ success: true })
}

// ──── RESEND INVITE ────
async function handleResendInvite(req, res) {
  var { clientId } = req.body
  if (!clientId) return res.status(400).json({ error: 'clientId requis' })

  var { data: profile } = await supabase.from('profiles').select('*').eq('id', clientId).single()
  if (!profile) return res.status(404).json({ error: 'Client introuvable' })

  // Generate new temporary password
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  var tempPass = ''
  for (var i = 0; i < 10; i++) tempPass += chars[Math.floor(Math.random() * chars.length)]

  // Update auth user password
  var { error: authErr } = await supabase.auth.admin.updateUserById(clientId, { password: tempPass, email: profile.email })
  if (authErr) return res.status(500).json({ error: 'Erreur auth: ' + authErr.message })

  // Mark must_change_password
  await supabase.from('profiles').update({ must_change_password: true }).eq('id', clientId)

  // Send welcome email
  var firstName = (profile.full_name || '').split(' ')[0] || 'Bonjour'
  await sendEmail(profile.email, '🔑 Ton accès coaching — Yoann Desgrand',
    '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:32px 28px"><div style="font-size:18px;margin-bottom:16px">Bienvenue ' + firstName + ' ! 👋</div><div style="font-size:14px;color:#7a7065;margin-bottom:24px;line-height:1.7">Ton espace coaching est prêt. Connecte-toi pour réserver tes séances.</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px"><div style="font-size:13px;color:#7a7065;margin-bottom:6px">📧 Email</div><div style="font-size:16px;margin-bottom:14px">' + profile.email + '</div><div style="font-size:13px;color:#7a7065;margin-bottom:6px">🔑 Mot de passe temporaire</div><div style="font-size:20px;font-family:monospace;letter-spacing:2px;color:#C4973A">' + tempPass + '</div></div><div style="text-align:center;margin-bottom:16px"><a href="https://app.yoanndesgrand.fr" style="display:inline-block;background:#C4973A;color:#000;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:500">Se connecter →</a></div><div style="font-size:12px;color:#7a7065;text-align:center">Tu devras changer ton mot de passe à la première connexion.</div></div></div>')

  return res.status(200).json({ success: true })
}

// ──── PAYMENTS HISTORY ────
async function handlePayments(req, res) {
  try {
    var stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) return res.status(400).json({ error: 'Stripe non configuré' })

    // Fetch charges (most common) + checkout sessions
    var [chargesRes, sessionsRes] = await Promise.all([
      fetch('https://api.stripe.com/v1/charges?limit=100', { headers: { 'Authorization': 'Bearer ' + stripeKey } }),
      fetch('https://api.stripe.com/v1/checkout/sessions?limit=100', { headers: { 'Authorization': 'Bearer ' + stripeKey } })
    ])
    var charges = await chargesRes.json()
    var sessions = await sessionsRes.json()

    var payments = []

    // From charges
    if (charges.data) {
      charges.data.forEach(function(c) {
        payments.push({
          amount: c.amount || 0,
          status: c.status === 'succeeded' ? 'complete' : c.status,
          customer_email: c.billing_details?.email || c.receipt_email || '',
          customer_name: c.billing_details?.name || '',
          description: c.description || 'Paiement',
          created: c.created
        })
      })
    }

    // From checkout sessions (if no charges found)
    if (payments.length === 0 && sessions.data) {
      sessions.data.forEach(function(s) {
        payments.push({
          amount: s.amount_total || 0,
          status: s.status,
          customer_email: s.customer_details?.email || '',
          customer_name: s.customer_details?.name || '',
          description: s.line_items?.data?.[0]?.description || 'Checkout',
          created: s.created
        })
      })
    }

    payments.sort(function(a, b) { return b.created - a.created })
    return res.status(200).json({ payments: payments })
  } catch (e) {
    console.error('Stripe error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}

// ──── ROUTER ────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    var action = req.query.action || req.body.action
    if (action === 'book') return handleBook(req, res)
    if (action === 'book-recurring') return handleBookRecurring(req, res)
    if (action === 'cancel') return handleCancel(req, res)
    if (action === 'cancel-summary') return handleCancelSummary(req, res)
    if (action === 'gcal-events') return handleGcalEvents(req, res)
    if (action === 'stripe-status') return handleStripeStatus(req, res)
    if (action === 'search-company') return handleSearchCompany(req, res)
    if (action === 'gcal-status') {
      try {
        var cal = await getCalendar()
        if (!cal) return res.status(200).json({ connected: false, error: 'Tokens manquants. Reconnectez Google Calendar.' })
        var list = await cal.calendarList.list({ maxResults: 1 })
        return res.status(200).json({ connected: true, email: list.data.items?.[0]?.id || 'Connecté' })
      } catch(e) { return res.status(200).json({ connected: false, error: e.message }) }
    }
    if (action === 'list-calendars') {
      try {
        var cal = await getCalendar()
        if (!cal) return res.status(200).json({ calendars: [] })
        var list = await cal.calendarList.list({ maxResults: 20 })
        var calendars = (list.data.items || []).filter(function(c) { return c.accessRole === 'owner' || c.accessRole === 'writer' }).map(function(c) { return { id: c.id, summary: c.summary, backgroundColor: c.backgroundColor } })
        return res.status(200).json({ calendars: calendars })
      } catch(e) { return res.status(200).json({ calendars: [], error: e.message }) }
    }
    if (action === 'gmaps-status') {
      var mapsKey = process.env.GOOGLE_MAPS_KEY || 'AIzaSyDAukkz4vFXT9PnTqjInGL2HxjcWS_Ebf8'
      if (!mapsKey) return res.status(200).json({ connected: false, error: 'GOOGLE_MAPS_KEY non configurée dans Vercel' })
      try {
        var testRes = await fetch('https://maps.googleapis.com/maps/api/distancematrix/json?origins=Paris&destinations=Lyon&key=' + mapsKey)
        var testData = await testRes.json()
        if (testData.status === 'OK') return res.status(200).json({ connected: true, key: mapsKey.slice(0, 8) + '...', test: testData.rows?.[0]?.elements?.[0]?.duration?.text || 'OK' })
        else return res.status(200).json({ connected: false, error: 'Clé invalide ou API désactivée : ' + (testData.error_message || testData.status) })
      } catch(e) { return res.status(200).json({ connected: false, error: e.message }) }
    }
    if (action === 'create-client') return handleCreateClient(req, res)
    if (action === 'delete-client') return handleDeleteClient(req, res)
    if (action === 'payments') return handlePayments(req, res)
    if (action === 'resend-invite') return handleResendInvite(req, res)
    if (action === 'reschedule') return handleReschedule(req, res)

    // ═══ SYNC GROUP CLASS TO GOOGLE CALENDAR ═══
    if (action === 'sync-gcal-event') {
      var { bookingId, title, location, startTime: evStart, endTime: evEnd } = req.body
      if (!bookingId || !evStart || !evEnd) return res.status(400).json({ error: 'Paramètres manquants' })
      try {
        var calendar = await getCalendar()
        if (!calendar) return res.status(200).json({ success: true, calError: 'Google Calendar non connecté' })
        var { data: cs } = await supabase.from('coaching_settings').select('google_calendar_id').limit(1).single()
        var calId = (cs && cs.google_calendar_id) || 'primary'
        var gcalEvent = await calendar.events.insert({
          calendarId: calId,
          requestBody: { summary: title || 'Cours collectif', location: location || '', start: { dateTime: evStart }, end: { dateTime: evEnd }, description: '🏢 Cours en salle' }
        })
        if (gcalEvent && gcalEvent.data && gcalEvent.data.id) {
          await supabase.from('bookings').update({ google_event_id: gcalEvent.data.id }).eq('id', bookingId)
        }
        return res.status(200).json({ success: true })
      } catch (e) { return res.status(200).json({ success: true, calError: e.message }) }
    }

    // ═══ PUSH NOTIFICATIONS ═══
    if (action === 'push-subscribe') {
      var { userId: pushUserId, subscription } = req.body
      if (!pushUserId || !subscription) return res.status(400).json({ error: 'Missing data' })
      await supabase.from('push_subscriptions').upsert({ user_id: pushUserId, endpoint: subscription.endpoint, keys_p256dh: subscription.keys.p256dh, keys_auth: subscription.keys.auth }, { onConflict: 'user_id,endpoint' })
      return res.status(200).json({ ok: true })
    }
    if (action === 'push-send') {
      var { userId: targetId, title: pushTitle, body: pushBody, url: pushUrl } = req.body
      if (!targetId) return res.status(400).json({ error: 'targetId required' })
      var { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', targetId)
      if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 })
      var sent = 0
      for (var pi = 0; pi < subs.length; pi++) {
        try {
          await webpush.sendNotification({ endpoint: subs[pi].endpoint, keys: { p256dh: subs[pi].keys_p256dh, auth: subs[pi].keys_auth } }, JSON.stringify({ title: pushTitle || 'YD Coaching', body: pushBody || 'Notification', url: pushUrl || '/', tag: 'message' }))
          sent++
        } catch (pe) { if (pe.statusCode === 410 || pe.statusCode === 404) await supabase.from('push_subscriptions').delete().eq('id', subs[pi].id) }
      }
      return res.status(200).json({ sent: sent })
    }
    if (action === 'vapid-key') {
      return res.status(200).json({ publicKey: VAPID_PUBLIC || '' })
    }

    // ═══ STRIPE CONNECT ═══
    if (action === 'stripe-connect-create') {
      if (!stripe) return res.status(500).json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to environment.' })
      var { coachId, email, coachName } = req.body || {}
      if (!coachId) return res.status(400).json({ error: 'coachId required' })

      // Check if coach already has a Stripe account
      var { data: coach } = await supabase.from('profiles').select('stripe_account_id').eq('id', coachId).single()
      var accountId = coach?.stripe_account_id

      if (!accountId) {
        // Create Express account
        var account = await stripe.accounts.create({
          type: 'express',
          email: email || undefined,
          metadata: { coach_id: coachId },
          business_profile: { name: coachName || undefined },
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } }
        })
        accountId = account.id
        await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', coachId)
      }

      // Generate onboarding link
      var origin = req.headers.origin || req.headers.referer || 'https://app.yoanndesgrand.fr'
      var accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: origin + '/admin?stripe=refresh',
        return_url: origin + '/admin?stripe=success',
        type: 'account_onboarding'
      })

      return res.status(200).json({ url: accountLink.url, accountId: accountId })
    }

    if (action === 'stripe-connect-status') {
      if (!stripe) return res.status(200).json({ connected: false, error: 'Stripe not configured' })
      var { coachId: statusCoachId } = req.body || {}
      if (!statusCoachId) return res.status(400).json({ error: 'coachId required' })

      var { data: statusCoach } = await supabase.from('profiles').select('stripe_account_id').eq('id', statusCoachId).single()
      if (!statusCoach?.stripe_account_id) return res.status(200).json({ connected: false })

      try {
        var account = await stripe.accounts.retrieve(statusCoach.stripe_account_id)
        var updates = {
          stripe_onboarding_complete: account.details_submitted,
          stripe_charges_enabled: account.charges_enabled,
          stripe_payouts_enabled: account.payouts_enabled
        }
        await supabase.from('profiles').update(updates).eq('id', statusCoachId)

        return res.status(200).json({
          connected: true,
          accountId: statusCoach.stripe_account_id,
          detailsSubmitted: account.details_submitted,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          email: account.email
        })
      } catch (e) {
        return res.status(200).json({ connected: false, error: e.message })
      }
    }

    if (action === 'stripe-connect-dashboard') {
      if (!stripe) return res.status(500).json({ error: 'Stripe not configured' })
      var { coachId: dashCoachId } = req.body || {}
      if (!dashCoachId) return res.status(400).json({ error: 'coachId required' })

      var { data: dashCoach } = await supabase.from('profiles').select('stripe_account_id').eq('id', dashCoachId).single()
      if (!dashCoach?.stripe_account_id) return res.status(400).json({ error: 'No Stripe account' })

      var loginLink = await stripe.accounts.createLoginLink(dashCoach.stripe_account_id)
      return res.status(200).json({ url: loginLink.url })
    }

    if (action === 'stripe-connect-disconnect') {
      var { coachId: discoCoachId } = req.body || {}
      if (!discoCoachId) return res.status(400).json({ error: 'coachId required' })
      await supabase.from('profiles').update({
        stripe_account_id: null,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false
      }).eq('id', discoCoachId)
      return res.status(200).json({ ok: true })
    }

    if (action === 'stripe-create-checkout') {
      if (!stripe) return res.status(500).json({ error: 'Stripe not configured' })
      var { coachId: checkoutCoachId, amount, clientEmail, description, sessionPrice, credits } = req.body || {}
      if (!checkoutCoachId || !amount) return res.status(400).json({ error: 'coachId and amount required' })

      // Get coach's Stripe account
      var { data: checkoutCoach } = await supabase.from('profiles').select('stripe_account_id').eq('id', checkoutCoachId).single()
      if (!checkoutCoach?.stripe_account_id) return res.status(400).json({ error: 'Coach has no Stripe account' })

      // Get platform fee settings
      var { data: feeSettings } = await supabase.from('coaching_settings').select('platform_fee_type, platform_fee_value').eq('coach_id', checkoutCoachId).single()
      var feeType = feeSettings?.platform_fee_type || 'percent'
      var feeValue = feeSettings?.platform_fee_value || 10
      var applicationFee = 0
      if (feeType === 'percent') applicationFee = Math.round(amount * feeValue / 100)
      else if (feeType === 'fixed') applicationFee = feeValue * 100 // Convert to cents

      var origin = req.headers.origin || 'https://app.yoanndesgrand.fr'
      var session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price_data: { currency: 'eur', product_data: { name: description || 'Séance de coaching' }, unit_amount: amount }, quantity: 1 }],
        customer_email: clientEmail || undefined,
        payment_intent_data: {
          application_fee_amount: applicationFee > 0 ? applicationFee : undefined,
          transfer_data: { destination: checkoutCoach.stripe_account_id }
        },
        success_url: origin + '/?payment=success',
        cancel_url: origin + '/?payment=cancel',
        metadata: { coach_id: checkoutCoachId, credits: credits || '0' }
      })

      return res.status(200).json({ url: session.url, sessionId: session.id })
    }

    return res.status(400).json({ error: 'Action inconnue: ' + action })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message })
  }
}
