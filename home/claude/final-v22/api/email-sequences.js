import { createClient } from '@supabase/supabase-js'

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
var RESEND_KEY = process.env.RESEND_API_KEY
var FROM = process.env.EMAIL_FROM || 'Yoann Desgrand <onboarding@resend.dev>'
var APP_URL = 'https://app.yoanndesgrand.fr'
var GOLD = '#C4973A'

function header() {
  return '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden">'
    + '<div style="background:#161410;padding:28px;text-align:center;border-bottom:1px solid #2a2520">'
    + '<div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div>'
    + '<div style="font-size:10px;letter-spacing:0.2em;color:#7a7065;text-transform:uppercase;margin-top:4px">Coach Sport & Nutrition</div></div>'
    + '<div style="padding:28px">'
}

function footer(profileId) {
  var unsubUrl = APP_URL + '/api/email-sequences?action=unsubscribe&id=' + (profileId || '')
  return '</div>'
    + '<div style="padding:16px 28px;border-top:1px solid #1a1714;text-align:center">'
    + '<a href="' + APP_URL + '" style="color:#C4973A;text-decoration:none;font-size:12px">Ouvrir mon espace coaching</a>'
    + '<div style="margin-top:8px"><a href="' + unsubUrl + '" style="color:#555;font-size:10px;text-decoration:none">Se désinscrire des emails</a></div>'
    + '</div></div>'
}

var SEQUENCES = [
  { key: 'welcome', delayDays: 0, subject: '👋 Bienvenue chez YD Coaching !', builder: function(name) {
    return header()
      + '<div style="font-size:20px;font-weight:500;margin-bottom:16px">Bienvenue ' + name + ' ! 👋</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Ton espace coaching personnel est prêt. Tu peux dès maintenant :</div>'
      + '<div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:16px;margin-bottom:16px">'
      + '<div style="font-size:13px;line-height:2">'
      + '📅 <strong>Réserver</strong> tes séances en ligne<br>'
      + '💬 <strong>Échanger</strong> directement avec moi via le chat<br>'
      + '📊 <strong>Suivre</strong> ta progression'
      + '</div></div>'
      + '<div style="text-align:center;margin-bottom:16px"><a href="' + APP_URL + '" style="display:inline-block;padding:14px 32px;background:#C4973A;color:#000;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Accéder à mon espace →</a></div>'
      + '<div style="font-size:13px;color:#7a7065;line-height:1.6">💡 Astuce : ajoute l\'app sur ton écran d\'accueil pour y accéder en un clic !</div>'
  }},
  { key: 'day1', delayDays: 1, subject: '🚀 Prêt(e) à commencer ?', builder: function(name) {
    return header()
      + '<div style="font-size:18px;font-weight:500;margin-bottom:16px">Salut ' + name + ' !</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Tu as créé ton compte hier — super ! 💪</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Si tu ne l\'as pas encore fait, voici ta prochaine étape :</div>'
      + '<div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">'
      + '<div style="font-size:32px;margin-bottom:8px">📅</div>'
      + '<div style="font-size:15px;font-weight:500;margin-bottom:4px">Réserve ta première séance</div>'
      + '<div style="font-size:12px;color:#7a7065">Choisis le créneau qui t\'arrange</div>'
      + '</div>'
      + '<div style="text-align:center"><a href="' + APP_URL + '" style="display:inline-block;padding:14px 32px;background:#C4973A;color:#000;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Réserver maintenant →</a></div>'
  }},
  { key: 'day4', delayDays: 4, subject: '💬 Une question ? Je suis là', builder: function(name) {
    return header()
      + '<div style="font-size:18px;font-weight:500;margin-bottom:16px">Hey ' + name + ' !</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Ça fait quelques jours que tu as rejoint le coaching. Comment ça se passe ? 🤔</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Si tu as la moindre question sur :</div>'
      + '<div style="font-size:13px;color:#b0a898;line-height:2;margin-bottom:20px;padding-left:12px">'
      + '• Ton programme d\'entraînement<br>'
      + '• La nutrition<br>'
      + '• Comment fonctionne l\'app<br>'
      + '• Quoi que ce soit d\'autre'
      + '</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">N\'hésite pas à m\'écrire directement via le chat de l\'app. Je te réponds personnellement. 💬</div>'
      + '<div style="text-align:center"><a href="' + APP_URL + '" style="display:inline-block;padding:14px 32px;background:#C4973A;color:#000;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">M\'envoyer un message →</a></div>'
  }},
  { key: 'day7', delayDays: 7, subject: '📊 Ta première semaine — on fait le point ?', builder: function(name) {
    return header()
      + '<div style="font-size:18px;font-weight:500;margin-bottom:16px">Déjà 1 semaine ' + name + ' ! 🎉</div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">La première semaine est toujours la plus importante. C\'est le moment où les bonnes habitudes se mettent en place.</div>'
      + '<div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:20px;margin-bottom:20px">'
      + '<div style="font-size:14px;font-weight:500;margin-bottom:10px">Ce que tu peux faire cette semaine :</div>'
      + '<div style="font-size:13px;color:#b0a898;line-height:2">'
      + '✅ Réserver tes séances de la semaine<br>'
      + '✅ Suivre ton programme sport<br>'
      + '✅ Me poser tes questions via le chat'
      + '</div></div>'
      + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Rappelle-toi : la régularité bat l\'intensité. Même 2 séances par semaine changent tout. 🔥</div>'
      + '<div style="text-align:center"><a href="' + APP_URL + '" style="display:inline-block;padding:14px 32px;background:#C4973A;color:#000;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Ouvrir mon espace →</a></div>'
  }}
]

var INACTIVE_SUBJECT = '💪 Tu nous manques !'
function inactiveEmail(name) {
  return header()
    + '<div style="font-size:18px;font-weight:500;margin-bottom:16px">Salut ' + name + ' !</div>'
    + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Ça fait un moment qu\'on ne s\'est pas vus. Tout va bien ? 🤔</div>'
    + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">La motivation fluctue, c\'est normal. L\'important c\'est de reprendre — même doucement.</div>'
    + '<div style="background:rgba(196,151,58,0.08);border:1px solid rgba(196,151,58,0.2);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">'
    + '<div style="font-size:15px;font-weight:500;margin-bottom:6px">Réserve ta prochaine séance</div>'
    + '<div style="font-size:12px;color:#7a7065">Un créneau suffit pour relancer la machine</div>'
    + '</div>'
    + '<div style="text-align:center"><a href="' + APP_URL + '" style="display:inline-block;padding:14px 32px;background:#C4973A;color:#000;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Réserver →</a></div>'
}

function biweeklyEmail(name) {
  return header()
    + '<div style="font-size:18px;font-weight:500;margin-bottom:16px">' + name + ', des nouvelles ? 👋</div>'
    + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">Je prends de tes nouvelles ! Comment avances-tu vers tes objectifs ?</div>'
    + '<div style="font-size:14px;color:#b0a898;line-height:1.7;margin-bottom:20px">N\'hésite pas à me contacter si tu veux qu\'on adapte ton programme ou si tu as besoin de motivation. Je suis là pour ça. 💪</div>'
    + '<div style="text-align:center"><a href="' + APP_URL + '" style="display:inline-block;padding:14px 32px;background:#C4973A;color:#000;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Mon espace coaching →</a></div>'
}

async function sendEmail(to, subject, html, profileId) {
  var fullHtml = html + footer(profileId)
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: to, subject: subject, html: fullHtml })
    })
    return true
  } catch(e) { return false }
}

export default async function handler(req, res) {
  var action = req.query.action || req.body?.action

  // ═══ UNSUBSCRIBE ═══
  if (action === 'unsubscribe') {
    var id = req.query.id
    if (id) {
      await supabase.from('profiles').update({ unsubscribed: true }).eq('id', id)
    }
    return res.status(200).send('<html><body style="font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#080808;color:#f0ece4"><div style="text-align:center"><div style="font-size:24px;margin-bottom:12px">✅</div><div style="font-size:18px;margin-bottom:8px">Désinscription confirmée</div><div style="font-size:14px;color:#7a7065">Tu ne recevras plus d\'emails automatiques.</div></div></body></html>')
  }

  // ═══ WELCOME (called from App.jsx on first signup) ═══
  if (action === 'welcome') {
    var { email, name, profileId: pid } = req.body
    if (!email) return res.status(400).json({ error: 'email requis' })
    var firstName = (name || '').split(' ')[0] || 'là'
    var seq = SEQUENCES[0]
    var sent = await sendEmail(email, seq.subject, seq.builder(firstName), pid)
    if (sent && pid) {
      await supabase.from('email_sequences').insert({ profile_id: pid, sequence_key: 'welcome' })
    }
    return res.status(200).json({ sent: sent })
  }

  // ═══ PROCESS SEQUENCES (daily cron) ═══
  if (action === 'process' || req.method === 'GET') {
    var results = { sent: 0, skipped: 0, errors: 0 }

    // Get all non-admin, non-unsubscribed clients
    var { data: profiles } = await supabase.from('profiles').select('id, email, full_name, created_at, last_seen, unsubscribed').eq('is_admin', false)
    if (!profiles) return res.status(200).json(results)

    var activeProfiles = profiles.filter(function(p) { return !p.unsubscribed && p.email })

    // Get all sent sequences
    var { data: sentSeqs } = await supabase.from('email_sequences').select('profile_id, sequence_key, sent_at')
    var sentMap = {}
    ;(sentSeqs || []).forEach(function(s) {
      if (!sentMap[s.profile_id]) sentMap[s.profile_id] = {}
      sentMap[s.profile_id][s.sequence_key] = s.sent_at
    })

    var now = Date.now()

    for (var i = 0; i < activeProfiles.length; i++) {
      var p = activeProfiles[i]
      var firstName = (p.full_name || '').split(' ')[0] || 'là'
      var daysSinceCreated = (now - new Date(p.created_at).getTime()) / 86400000
      var pSent = sentMap[p.id] || {}

      // ── Onboarding sequences (J+1, J+4, J+7) ──
      for (var si = 1; si < SEQUENCES.length; si++) {
        var seq = SEQUENCES[si]
        if (!pSent[seq.key] && daysSinceCreated >= seq.delayDays) {
          var ok = await sendEmail(p.email, seq.subject, seq.builder(firstName), p.id)
          if (ok) {
            await supabase.from('email_sequences').insert({ profile_id: p.id, sequence_key: seq.key })
            results.sent++
          } else results.errors++
          break // Max 1 email par client par run
        }
      }

      // ── Biweekly (every 15 days after day 7, for 1 year) ──
      if (daysSinceCreated >= 22 && daysSinceCreated <= 365) {
        var lastBiweekly = pSent['biweekly'] ? new Date(pSent['biweekly']).getTime() : 0
        var daysSinceLastBW = lastBiweekly ? (now - lastBiweekly) / 86400000 : 999
        if (daysSinceLastBW >= 15) {
          // Only send if client hasn't been active recently
          var lastActive = p.last_seen ? new Date(p.last_seen).getTime() : 0
          var daysSinceActive = lastActive ? (now - lastActive) / 86400000 : 999
          if (daysSinceActive >= 7) {
            var ok2 = await sendEmail(p.email, '👋 ' + firstName + ', des nouvelles ?', biweeklyEmail(firstName), p.id)
            if (ok2) {
              await supabase.from('email_sequences').upsert({ profile_id: p.id, sequence_key: 'biweekly', sent_at: new Date().toISOString() }, { onConflict: 'profile_id,sequence_key' })
              results.sent++
            }
          }
        }
      }

      // ── Inactive relance (7 days without activity) ──
      if (daysSinceCreated > 14) { // Only after onboarding sequence
        var lastSeen = p.last_seen ? new Date(p.last_seen).getTime() : 0
        var daysSinceLastSeen = lastSeen ? (now - lastSeen) / 86400000 : 999
        var lastInactive = pSent['inactive'] ? new Date(pSent['inactive']).getTime() : 0
        var daysSinceLastInactive = lastInactive ? (now - lastInactive) / 86400000 : 999

        if (daysSinceLastSeen >= 7 && daysSinceLastSeen < 90 && daysSinceLastInactive >= 14) {
          var ok3 = await sendEmail(p.email, INACTIVE_SUBJECT, inactiveEmail(firstName), p.id)
          if (ok3) {
            await supabase.from('email_sequences').upsert({ profile_id: p.id, sequence_key: 'inactive', sent_at: new Date().toISOString() }, { onConflict: 'profile_id,sequence_key' })
            results.sent++
          }
        }
      }
    }

    // === SUBSCRIPTION BILLING REMINDERS ===
    var today = new Date()
    var todayDay = today.getDate()
    var { data: dueSubs } = await supabase.from('client_subscriptions').select('*, profiles:client_id(full_name, email), coaches:coach_id(full_name, email)').eq('is_active', true).eq('billing_day', todayDay)
    if (dueSubs && dueSubs.length > 0) {
      // Group by coach
      var coachSubs = {}
      dueSubs.forEach(function(sub) {
        var cEmail = sub.coaches?.email
        if (!cEmail) return
        if (!coachSubs[cEmail]) coachSubs[cEmail] = { name: sub.coaches?.full_name, subs: [] }
        coachSubs[cEmail].subs.push(sub)
      })

      for (var coachEmail in coachSubs) {
        var coach = coachSubs[coachEmail]
        var total = 0
        var lines = coach.subs.map(function(sub) {
          total += parseFloat(sub.amount) || 0
          return '<tr><td style="padding:8px 16px;border-bottom:1px solid #1a1a1a">' + (sub.profiles?.full_name || 'Client') + '</td><td style="padding:8px 16px;border-bottom:1px solid #1a1a1a">' + sub.offer_name + '</td><td style="padding:8px 16px;border-bottom:1px solid #1a1a1a;text-align:right;color:#C4973A;font-weight:600">' + sub.amount + '€</td></tr>'
        }).join('')

        var emailHtml = '<div style="font-family:Outfit,sans-serif;background:#080808;color:#f0ece4;padding:40px 20px">' +
          '<div style="max-width:500px;margin:0 auto">' +
          '<h2 style="color:#C4973A;margin-bottom:24px">💳 Prélèvements à effectuer</h2>' +
          '<p style="color:#7a7065;margin-bottom:20px">Bonjour ' + coach.name + ', voici les prélèvements du jour :</p>' +
          '<table style="width:100%;border-collapse:collapse;background:#111;border-radius:12px;overflow:hidden">' +
          '<thead><tr style="background:#161616"><th style="padding:10px 16px;text-align:left;color:#7a7065;font-size:12px">Client</th><th style="padding:10px 16px;text-align:left;color:#7a7065;font-size:12px">Offre</th><th style="padding:10px 16px;text-align:right;color:#7a7065;font-size:12px">Montant</th></tr></thead>' +
          '<tbody>' + lines + '</tbody>' +
          '<tfoot><tr style="background:#161616"><td colspan="2" style="padding:10px 16px;font-weight:600">Total</td><td style="padding:10px 16px;text-align:right;color:#C4973A;font-weight:700;font-size:18px">' + total + '€</td></tr></tfoot>' +
          '</table>' +
          '<p style="color:#7a7065;margin-top:20px;font-size:13px">Effectuez les prélèvements sur votre plateforme de paiement (CESU, virement, etc.)</p>' +
          '</div></div>'

        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'Coaching App <notifications@yoanndesgrand.fr>', to: coachEmail, subject: '💳 ' + coach.subs.length + ' prélèvement(s) à effectuer — ' + total + '€', html: emailHtml })
          })
          results.push({ type: 'billing_reminder', coach: coachEmail, count: coach.subs.length, total: total })
        } catch(e) { results.push({ type: 'billing_reminder_error', error: e.message }) }
      }
    }

    return res.status(200).json(results)
  }

  return res.status(400).json({ error: 'action inconnue' })
}
