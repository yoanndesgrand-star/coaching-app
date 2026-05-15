import { useState, useEffect } from 'react'

var GOLD = '#C4973A'

export default function Discovery() {
  var [step, setStep] = useState('intro')
  var [coachingMode, setCoachingMode] = useState(null)
  var [onlineFormat, setOnlineFormat] = useState(null)
  var [slots, setSlots] = useState([])
  var [loading, setLoading] = useState(false)
  var [month, setMonth] = useState(new Date().getMonth() + 1)
  var [year, setYear] = useState(new Date().getFullYear())
  var [selectedDate, setSelectedDate] = useState(null)
  var [selectedSlot, setSelectedSlot] = useState(null)
  var [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', phonePrefix: '+33', message: '' })
  var [booking, setBooking] = useState(false)
  var [done, setDone] = useState(false)
  var [error, setError] = useState('')

  useEffect(function() { if (step === 'calendar') loadSlots() }, [month, year, step])

  async function loadSlots() {
    setLoading(true)
    try {
      var res = await fetch('/api/available-slots?year=' + year + '&month=' + month + '&discovery=true')
      var data = await res.json()
      setSlots(data.slots || [])
    } catch (e) { setSlots([]) }
    setLoading(false)
  }

  async function bookDiscovery() {
    if (!selectedSlot || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('Prénom, nom et email sont requis.'); return
    }
    if (form.phone.trim()) {
      var cleanPhone = form.phone.replace(/\s+/g, '')
      if (!/^\d{9,10}$/.test(cleanPhone)) { setError('Numéro de téléphone invalide.'); return }
    }
    setBooking(true); setError('')
    var fullPhone = form.phone.trim() ? form.phonePrefix + form.phone.replace(/\s+/g, '').replace(/^0/, '') : ''
    var fullName = form.firstName.trim() + ' ' + form.lastName.trim()
    var locationLabel = coachingMode === 'salle' ? 'ON AIR BNF, 93 avenue de France, 75013 Paris' : (onlineFormat === 'visio' ? 'Visioconférence' : 'Appel téléphonique')
    try {
      var res = await fetch('/api/discovery-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email: form.email.trim(),
          phone: fullPhone,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          mode: coachingMode,
          format: onlineFormat,
          location: locationLabel,
          message: form.message.trim()
        })
      })
      var data = await res.json()
      if (data.success) setDone(true)
      else setError(data.error || 'Erreur lors de la réservation.')
    } catch (e) { setError('Erreur de connexion.') }
    setBooking(false)
  }

  var days = []
  var seen = {}
  slots.forEach(function(sl) { if (!seen[sl.date]) { seen[sl.date] = true; days.push(sl.date) } })
  var MONTHS = ['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  var DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

  // ═══ CONFIRMATION ═══
  if (done) return (
    <div style={s.wrapper}><div style={s.card}>
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, marginBottom: 12 }}>Séance confirmée !</div>
        <div style={{ fontSize: 14, color: '#7a7065', lineHeight: 1.7 }}>Tu vas recevoir un email de confirmation avec tous les détails.</div>
        {coachingMode === 'salle' && <div style={{ marginTop: 16, fontSize: 13, color: '#7a7065' }}>📍 ON AIR BNF — 93 av. de France, Paris 13e</div>}
        {coachingMode === 'online' && <div style={{ marginTop: 16, fontSize: 13, color: '#7a7065' }}>{onlineFormat === 'visio' ? '📹 Lien visio envoyé par email' : '📞 Yoann t\'appellera au numéro indiqué'}</div>}
        <div style={{ marginTop: 24, fontSize: 13, color: '#7a7065' }}>À très bientôt ! 💪</div>
      </div>
    </div></div>
  )

  return (
    <div style={s.wrapper}><div style={s.card}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22 }}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#7a7065', textTransform: 'uppercase', marginTop: 4 }}>SÉANCE DÉCOUVERTE GRATUITE</div>
        <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, transparent, ' + GOLD + ', transparent)', margin: '12px auto 0', borderRadius: 2 }} />
      </div>

      {/* ═══ STEP: INTRO ═══ */}
      {step === 'intro' && (
        <div style={s.fadeIn}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, marginBottom: 12 }}>Ta première séance est <em style={{ color: GOLD, fontStyle: 'italic' }}>offerte</em></div>
            <div style={{ fontSize: 13, color: '#7a7065', lineHeight: 1.8 }}>
              Cette séance de 45 minutes est l'occasion de faire connaissance et de définir ensemble tes objectifs. Au programme :
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {[
              { icon: '📋', text: 'Bilan complet de ta condition physique actuelle' },
              { icon: '🎯', text: 'Définition de tes objectifs (perte de poids, prise de muscle, tonus...)' },
              { icon: '🏋️', text: 'Mini-séance pour découvrir ma méthode de travail' },
              { icon: '📊', text: 'Présentation du programme adapté à tes besoins' },
              { icon: '💬', text: 'Tes questions, mes réponses — sans engagement' }
            ].map(function(item, i) {
              return <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: '#f9f7f4', borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 13, color: '#1a1814' }}>{item.text}</span>
              </div>
            })}
          </div>
          <div style={{ background: 'rgba(196,151,58,0.08)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 10, padding: '14px 18px', textAlign: 'center', marginBottom: 20, fontSize: 13, color: GOLD }}>
            🆓 Gratuite et sans engagement — aucune CB requise
          </div>
          <button onClick={function() { setStep('choose') }} style={s.btn}>Choisir mon format →</button>
        </div>
      )}

      {/* ═══ STEP: CHOOSE FORMAT ═══ */}
      {step === 'choose' && (
        <div style={s.fadeIn}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 6 }}>Comment souhaites-tu faire ta séance ?</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <button onClick={function() { setCoachingMode('salle'); setStep('calendar') }} style={s.choiceBtn}>
              <div style={{ fontSize: 32 }}>🏋️</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>En salle</div>
                <div style={{ fontSize: 12, color: '#7a7065' }}>ON AIR BNF — 93 av. de France, Paris 13e</div>
              </div>
            </button>
            <button onClick={function() { setCoachingMode('online'); setStep('online-format') }} style={s.choiceBtn}>
              <div style={{ fontSize: 32 }}>📱</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>En ligne</div>
                <div style={{ fontSize: 12, color: '#7a7065' }}>Visioconférence ou appel téléphonique</div>
              </div>
            </button>
          </div>
          <button onClick={function() { setStep('intro') }} style={s.backBtn}>← Retour</button>
        </div>
      )}

      {/* ═══ STEP: ONLINE FORMAT ═══ */}
      {step === 'online-format' && (
        <div style={s.fadeIn}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, marginBottom: 6 }}>Quel format préfères-tu ?</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <button onClick={function() { setOnlineFormat('visio'); setStep('calendar') }} style={s.choiceBtn}>
              <div style={{ fontSize: 32 }}>📹</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Visioconférence</div>
                <div style={{ fontSize: 12, color: '#7a7065' }}>Un lien te sera envoyé par email</div>
              </div>
            </button>
            <button onClick={function() { setOnlineFormat('appel'); setStep('calendar') }} style={s.choiceBtn}>
              <div style={{ fontSize: 32 }}>📞</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Appel téléphonique</div>
                <div style={{ fontSize: 12, color: '#7a7065' }}>Yoann t'appellera au numéro indiqué</div>
              </div>
            </button>
          </div>
          <button onClick={function() { setStep('choose') }} style={s.backBtn}>← Retour</button>
        </div>
      )}

      {/* ═══ STEP: CALENDAR ═══ */}
      {step === 'calendar' && (
        <div style={s.fadeIn}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: GOLD, fontWeight: 500 }}>
              {coachingMode === 'salle' ? '🏋️ En salle — ON AIR Paris 13e' : onlineFormat === 'visio' ? '📹 Visioconférence' : '📞 Appel téléphonique'}
            </div>
          </div>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={function() { var m = month - 1, y = year; if (m < 1) { m = 12; y-- } setMonth(m); setYear(y); setSelectedDate(null) }} style={s.navBtn}>←</button>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{MONTHS[month]} {year}</div>
            <button onClick={function() { var m = month + 1, y = year; if (m > 12) { m = 1; y++ } setMonth(m); setYear(y); setSelectedDate(null) }} style={s.navBtn}>→</button>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: 30, color: '#7a7065' }}>Chargement des créneaux...</div> : (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {days.map(function(day) {
                  var d = new Date(day + 'T12:00:00')
                  var isSelected = selectedDate === day
                  return <button key={day} onClick={function() { setSelectedDate(day); setSelectedSlot(null) }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid', borderColor: isSelected ? GOLD : '#e0d8cc', background: isSelected ? 'rgba(196,151,58,0.12)' : '#fff', color: '#1a1814', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>{DAYS_SHORT[d.getDay()]} {d.getDate()}</button>
                })}
                {days.length === 0 && <div style={{ color: '#7a7065', fontSize: 13 }}>Aucun créneau disponible ce mois.</div>}
              </div>
              {selectedDate && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {slots.filter(function(sl) { return sl.date === selectedDate }).map(function(sl) {
                    var t = new Date(sl.start)
                    var timeStr = t.getHours().toString().padStart(2,'0') + 'h' + t.getMinutes().toString().padStart(2,'0')
                    var isSelected = selectedSlot && selectedSlot.start === sl.start
                    return <button key={sl.start} onClick={function() { setSelectedSlot(sl); setStep('form') }} style={{ background: isSelected ? GOLD : 'rgba(74,222,128,0.1)', color: isSelected ? '#000' : '#22c55e', border: '1px solid', borderColor: isSelected ? GOLD : 'rgba(74,222,128,0.3)', borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>{timeStr}</button>
                  })}
                </div>
              )}
            </div>
          )}
          <button onClick={function() { setStep(coachingMode === 'online' ? 'online-format' : 'choose') }} style={s.backBtn}>← Retour</button>
        </div>
      )}

      {/* ═══ STEP: FORM ═══ */}
      {step === 'form' && selectedSlot && (
        <div style={s.fadeIn}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: GOLD, fontWeight: 500, marginBottom: 6 }}>
              {coachingMode === 'salle' ? '🏋️ En salle' : onlineFormat === 'visio' ? '📹 Visio' : '📞 Appel'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              📅 {DAYS_SHORT[new Date(selectedSlot.start).getDay()]} {new Date(selectedSlot.start).getDate()} {MONTHS[new Date(selectedSlot.start).getMonth() + 1]} à {new Date(selectedSlot.start).getHours().toString().padStart(2,'0')}h{new Date(selectedSlot.start).getMinutes().toString().padStart(2,'0')}
            </div>
          </div>

          {error && <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><div style={s.label}>Prénom *</div><input type="text" placeholder="Jean" value={form.firstName} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { firstName: e.target.value }) }) }} style={s.input} /></div>
              <div><div style={s.label}>Nom *</div><input type="text" placeholder="Dupont" value={form.lastName} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { lastName: e.target.value }) }) }} style={s.input} /></div>
            </div>
            <div><div style={s.label}>Email *</div><input type="email" placeholder="ton@email.com" value={form.email} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { email: e.target.value }) }) }} style={s.input} /></div>
            <div>
              <div style={s.label}>Téléphone {coachingMode === 'online' && onlineFormat === 'appel' ? '*' : ''}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={form.phonePrefix} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { phonePrefix: e.target.value }) }) }} style={{ ...s.input, flex: 'none', width: 90, padding: '12px 8px' }}>
                  <option value="+33">🇫🇷 +33</option><option value="+32">🇧🇪 +32</option><option value="+41">🇨🇭 +41</option><option value="+44">🇬🇧 +44</option>
                </select>
                <input type="tel" placeholder="6 12 34 56 78" value={form.phone} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { phone: e.target.value }) }) }} style={{ ...s.input, flex: 1 }} />
              </div>
            </div>
            <div><div style={s.label}>Un message ? (optionnel)</div><textarea placeholder="Tes objectifs, questions, informations utiles..." value={form.message} onChange={function(e) { setForm(function(f) { return Object.assign({}, f, { message: e.target.value }) }) }} style={{ ...s.input, minHeight: 70, resize: 'vertical' }} /></div>

            <div style={{ fontSize: 12, color: '#7a7065', textAlign: 'center' }}>
              {coachingMode === 'salle' ? '📍 ON AIR BNF — 93 av. de France, Paris 13e' : onlineFormat === 'visio' ? '📹 Lien visio envoyé après confirmation' : '📞 Yoann t\'appellera au numéro indiqué'}
            </div>
            <button onClick={bookDiscovery} disabled={booking} style={s.btn}>{booking ? 'Réservation en cours...' : 'Confirmer ma séance découverte →'}</button>
          </div>
          <button onClick={function() { setStep('calendar') }} style={{ ...s.backBtn, marginTop: 12 }}>← Modifier le créneau</button>
        </div>
      )}

    </div></div>
  )
}

// Add animation
if (typeof document !== 'undefined' && !document.getElementById('discovery-style')) {
  var styleEl = document.createElement('style')
  styleEl.id = 'discovery-style'
  styleEl.textContent = '@keyframes discoveryFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }'
  document.head.appendChild(styleEl)
}

var s = {
  wrapper: { padding: 20, display: 'flex', justifyContent: 'center' },
  card: { background: '#fff', border: '1px solid #e0d8cc', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 480, fontFamily: 'Outfit, sans-serif', color: '#1a1814' },
  fadeIn: { animation: 'discoveryFadeIn 0.3s ease' },
  navBtn: { background: 'none', border: '1px solid #e0d8cc', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 14, fontFamily: 'Outfit, sans-serif', color: '#1a1814' },
  label: { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a7065', marginBottom: 4 },
  input: { width: '100%', background: '#f5f2ed', border: '1px solid #e0d8cc', borderRadius: 10, padding: '12px 14px', color: '#1a1814', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', boxSizing: 'border-box' },
  btn: { background: '#C4973A', color: '#000', border: 'none', borderRadius: 10, padding: '16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', width: '100%' },
  backBtn: { background: 'none', border: 'none', color: '#7a7065', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', display: 'block', margin: '0 auto' },
  choiceBtn: { display: 'flex', alignItems: 'center', gap: 16, padding: '20px', background: '#f9f7f4', border: '2px solid #e0d8cc', borderRadius: 14, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', color: '#1a1814', textAlign: 'left', transition: 'all 0.2s', width: '100%' },
}
