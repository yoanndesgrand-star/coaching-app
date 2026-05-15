import { useState } from 'react'
import { supabase } from '../lib/supabase'

var GOLD = '#C4973A'

export default function Login() {
  var [email, setEmail] = useState('')
  var [password, setPassword] = useState('')
  var [firstName, setFirstName] = useState('')
  var [lastName, setLastName] = useState('')
  var [phone, setPhone] = useState('')
  var [phonePrefix, setPhonePrefix] = useState('+33')
  var [coachingType, setCoachingType] = useState('')
  var [address, setAddress] = useState('')
  var [addrSuggestions, setAddrSuggestions] = useState([])
  var [mode, setMode] = useState('login')
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState('')
  var [success, setSuccess] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    var { error } = await supabase.auth.signInWithPassword({ email: email, password: password })
    if (error) setError('Email ou mot de passe incorrect.')
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (!firstName.trim() || !lastName.trim()) { setError('Prénom et nom requis.'); setLoading(false); return }
    if (!coachingType) { setError('Choisis ton type de coaching.'); setLoading(false); return }
    if (coachingType === 'domicile' && !address.trim()) { setError('Adresse domicile requise.'); setLoading(false); return }
    if (phone.trim()) {
      var cleanPhone = phone.replace(/\s+/g, '')
      if (!/^\d{9,10}$/.test(cleanPhone)) { setError('Numéro de téléphone invalide (9-10 chiffres après l\'indicatif).'); setLoading(false); return }
    }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); setLoading(false); return }

    var { data, error: err } = await supabase.auth.signUp({ email: email, password: password })
    if (err) { setError(err.message); setLoading(false); return }
    if (data?.user) {
      var fullPhone = phone.trim() ? phonePrefix + phone.replace(/\s+/g, '').replace(/^0/, '') : ''
      var profileAddress = coachingType === 'domicile' ? address.trim() : 'ON AIR BNF, 93 avenue de France, Paris 13'
      await supabase.from('profiles').upsert({
        id: data.user.id, email: email, full_name: firstName.trim() + ' ' + lastName.trim(),
        phone: fullPhone, coaching_type: coachingType, address: profileAddress, is_admin: false, credits: 0
      }, { onConflict: 'id' })
      try {
        await fetch('/api/email?action=signup-notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: firstName.trim() + ' ' + lastName.trim(), clientEmail: email, clientPhone: fullPhone, coachingType: coachingType })
        })
      } catch(e) {}
    }
    setLoading(false)
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (!email) { setError('Entre ton email.'); setLoading(false); return }
    var { error: err } = await supabase.auth.resetPasswordForEmail(email)
    if (err) setError(err.message)
    else setSuccess('Lien de réinitialisation envoyé à ' + email)
    setLoading(false)
  }

  function resetForm() { setError(''); setSuccess(''); setFirstName(''); setLastName(''); setPhone(''); setCoachingType(''); setAddress('') }

  return (
    <div style={s.wrapper}>
      {/* Background effects */}
      <div style={s.bgGlow} />
      <div style={s.bgLogo} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
          <div style={s.subtitle}>COACH SPORT & NUTRITION</div>
          <div style={s.goldLine} />
        </div>

        {/* CONNEXION */}
        {mode === 'login' && (
          <div style={s.fadeIn}>
            <h1 style={s.title}>Accède à ton<br /><em style={{ color: GOLD, fontStyle: 'italic', fontWeight: 300 }}>espace coaching</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <div style={s.inputWrap}>
                <div style={s.inputLabel}>Email</div>
                <input type="email" placeholder="ton@email.com" value={email} onChange={function(e) { setEmail(e.target.value) }} style={s.input} />
              </div>
              <div style={s.inputWrap}>
                <div style={s.inputLabel}>Mot de passe</div>
                <input type="password" placeholder="••••••••" value={password} onChange={function(e) { setPassword(e.target.value) }} style={s.input} />
              </div>
              <button onClick={handleLogin} disabled={loading} style={s.btn}>
                {loading ? 'Connexion…' : 'Se connecter →'}
              </button>
            </div>
            <div style={s.links}>
              <button onClick={function() { setMode('forgot'); resetForm() }} style={s.linkBtn}>Mot de passe oublié ?</button>
              <button onClick={function() { setMode('signup'); resetForm() }} style={{ ...s.linkBtn, color: GOLD }}>Créer un compte</button>
            </div>
          </div>
        )}

        {/* INSCRIPTION */}
        {mode === 'signup' && (
          <div style={s.fadeIn}>
            <h1 style={s.title}>Créer mon<br /><em style={{ color: GOLD, fontStyle: 'italic', fontWeight: 300 }}>compte</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={s.inputWrap}><div style={s.inputLabel}>Prénom</div><input type="text" placeholder="Jean" value={firstName} onChange={function(e) { setFirstName(e.target.value) }} style={s.input} /></div>
                <div style={s.inputWrap}><div style={s.inputLabel}>Nom</div><input type="text" placeholder="Dupont" value={lastName} onChange={function(e) { setLastName(e.target.value) }} style={s.input} /></div>
              </div>
              <div style={s.inputWrap}>
                <div style={s.inputLabel}>Téléphone</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={phonePrefix} onChange={function(e) { setPhonePrefix(e.target.value) }} style={{ ...s.input, flex: 'none', width: 90, padding: '12px 8px' }}>
                    <option value="+33">🇫🇷 +33</option><option value="+32">🇧🇪 +32</option><option value="+41">🇨🇭 +41</option>
                    <option value="+44">🇬🇧 +44</option><option value="+1">🇺🇸 +1</option><option value="+34">🇪🇸 +34</option>
                    <option value="+39">🇮🇹 +39</option><option value="+49">🇩🇪 +49</option><option value="+212">🇲🇦 +212</option>
                    <option value="+213">🇩🇿 +213</option><option value="+216">🇹🇳 +216</option>
                  </select>
                  <input type="tel" placeholder="6 12 34 56 78" value={phone} onChange={function(e) { setPhone(e.target.value) }} style={{ ...s.input, flex: 1 }} />
                </div>
              </div>
              <div style={s.inputWrap}><div style={s.inputLabel}>Email</div><input type="email" placeholder="ton@email.com" value={email} onChange={function(e) { setEmail(e.target.value) }} style={s.input} /></div>
              <div style={s.inputWrap}><div style={s.inputLabel}>Mot de passe</div><input type="password" placeholder="8 caractères minimum" value={password} onChange={function(e) { setPassword(e.target.value) }} style={s.input} /></div>

              <div style={s.inputWrap}>
                <div style={s.inputLabel}>Type de coaching</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button type="button" onClick={function() { setCoachingType('presentiel') }} style={{ ...s.typeBtn, ...(coachingType === 'presentiel' ? s.typeBtnActive : {}) }}>
                    <div style={{ fontSize: 28 }}>🏋️</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>En salle</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>ON AIR Paris 13e</div>
                  </button>
                  <button type="button" onClick={function() { setCoachingType('domicile') }} style={{ ...s.typeBtn, ...(coachingType === 'domicile' ? s.typeBtnActive : {}) }}>
                    <div style={{ fontSize: 28 }}>🏠</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>À domicile</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Chez toi</div>
                  </button>
                </div>
              </div>

              {coachingType === 'domicile' && (
                <div style={s.inputWrap}>
                  <div style={s.inputLabel}>Adresse</div>
                  <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="Commence à taper ton adresse..." value={address} onChange={function(e) {
                      var q = e.target.value; setAddress(q)
                      if (q.length >= 4) {
                        fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(q) + '&limit=5')
                          .then(function(r) { return r.json() })
                          .then(function(data) { setAddrSuggestions((data.features || []).map(function(ft) { return ft.properties.label })) })
                          .catch(function() {})
                      } else { setAddrSuggestions([]) }
                    }} style={s.input} />
                    {addrSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0d8cc', borderRadius: 8, marginTop: 4, zIndex: 20, maxHeight: 180, overflow: 'auto' }}>
                        {addrSuggestions.map(function(sg, i) {
                          return <button key={i} onClick={function() { setAddress(sg); setAddrSuggestions([]) }} style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid #f0ece4', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#1a1814', fontFamily: 'Outfit, sans-serif' }}>{sg}</button>
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button onClick={handleSignup} disabled={loading} style={s.btn}>
                {loading ? 'Création…' : 'Créer mon compte →'}
              </button>
            </div>
            <div style={s.links}>
              <button onClick={function() { setMode('login'); resetForm() }} style={s.linkBtn}>← Retour à la connexion</button>
            </div>
          </div>
        )}

        {/* MOT DE PASSE OUBLIÉ */}
        {mode === 'forgot' && (
          <div style={s.fadeIn}>
            <h1 style={s.title}>Mot de passe<br /><em style={{ color: GOLD, fontStyle: 'italic', fontWeight: 300 }}>oublié</em></h1>
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 24 }}>Un lien de réinitialisation te sera envoyé.</p>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <div style={s.inputWrap}><div style={s.inputLabel}>Email</div><input type="email" placeholder="ton@email.com" value={email} onChange={function(e) { setEmail(e.target.value) }} style={s.input} /></div>
              <button onClick={handleForgot} disabled={loading} style={s.btn}>{loading ? 'Envoi…' : 'Envoyer le lien →'}</button>
            </div>
            <div style={s.links}>
              <button onClick={function() { setMode('login'); resetForm() }} style={s.linkBtn}>← Retour à la connexion</button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <a href="https://yoanndesgrand.fr" target="_blank" style={{ color: GOLD, fontSize: 12, textDecoration: 'none', fontFamily: 'Outfit, sans-serif' }}>Découvrir les offres → yoanndesgrand.fr</a>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>© 2026 Yoann Desgrand Coaching</div>
        </div>
      </div>

      <style>{"\
        @keyframes loginFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }\
        @keyframes shimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }\
        @keyframes pulse { 0%, 100% { opacity: 0.04; } 50% { opacity: 0.08; } }\
      "}</style>
    </div>
  )
}

var s = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' },
  bgGlow: { position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: '120vw', height: '60vh', background: 'radial-gradient(ellipse at center, rgba(196,151,58,0.08), transparent 70%)', pointerEvents: 'none', zIndex: 0 },
  bgLogo: { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70vw', height: '70vh', backgroundImage: 'url(/logo-yd.png)', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', opacity: 0.04, pointerEvents: 'none', zIndex: 0, animation: 'pulse 6s ease-in-out infinite' },
  card: { position: 'relative', zIndex: 1, padding: '48px 36px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, width: '100%', maxWidth: 440, backdropFilter: 'blur(20px)', animation: 'loginFadeIn 0.6s ease' },
  logoWrap: { textAlign: 'center', marginBottom: 36 },
  logo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 400 },
  subtitle: { fontSize: 10, fontWeight: 600, letterSpacing: '0.25em', color: 'var(--muted)', marginTop: 4 },
  goldLine: { width: 40, height: 2, background: 'linear-gradient(90deg, transparent, ' + GOLD + ', transparent)', margin: '16px auto 0', borderRadius: 2 },
  title: { fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 300, lineHeight: 1.2, marginBottom: 28, textAlign: 'center' },
  fadeIn: { animation: 'loginFadeIn 0.4s ease' },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  inputWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
  inputLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', paddingLeft: 2 },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  btn: { background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '16px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 6, transition: 'transform 0.15s, box-shadow 0.15s', letterSpacing: '0.02em' },
  error: { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#f87171', marginBottom: 4 },
  successBox: { background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#4ade80', marginBottom: 4 },
  links: { display: 'flex', justifyContent: 'space-between', marginTop: 20, flexWrap: 'wrap', gap: 8 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  typeBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 14px', background: 'var(--surface2)', border: '2px solid var(--border)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', color: 'var(--text)', transition: 'all 0.2s' },
  typeBtnActive: { borderColor: GOLD, background: 'rgba(196,151,58,0.08)', boxShadow: '0 0 20px rgba(196,151,58,0.1)' },
}
