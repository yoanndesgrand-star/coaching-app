import { useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [phonePrefix, setPhonePrefix] = useState('+33')
  const [coachingType, setCoachingType] = useState('')
  const [address, setAddress] = useState('')
  const [hasOnairAccess, setHasOnairAccess] = useState(false)
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou mot de passe incorrect.')
    setLoading(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true); setError('')
    if (!firstName.trim()) { setError('Merci de renseigner ton prénom.'); setLoading(false); return }
    if (!lastName.trim()) { setError('Merci de renseigner ton nom.'); setLoading(false); return }
    if (!coachingType) { setError('Merci de choisir ton type de coaching.'); setLoading(false); return }
    if (coachingType === 'presentiel' && !hasOnairAccess) { setError('Merci de confirmer ton accès à la salle ON AIR.'); setLoading(false); return }
    if (coachingType === 'domicile' && !address.trim()) { setError('Merci de renseigner ton adresse domicile.'); setLoading(false); return }
    if (phone.trim()) {
      const cleanPhone = phone.replace(/\s+/g, '')
      if (!/^\d{9,10}$/.test(cleanPhone)) { setError('Le numéro de téléphone n\'est pas valide. Entre 9 ou 10 chiffres après l\'indicatif.'); setLoading(false); return }
    }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); setLoading(false); return }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    })

    if (signupError) { setError(signupError.message); setLoading(false); return }

    if (data?.user) {
      const profileAddress = coachingType === 'presentiel'
        ? 'ON AIR BNF, 93 avenue de France, Paris 13'
        : coachingType === 'domicile'
        ? address.trim()
        : null

      const fullPhone = phone.trim() ? phonePrefix + phone.replace(/\s+/g, '').replace(/^0/, '') : ''

      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: email,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: fullPhone,
        coaching_type: coachingType,
        address: profileAddress,
        is_admin: false,
        credits: 0,
      }, { onConflict: 'id' })

      // Notifier l'admin
      try {
        await fetch('/api/notify-admin-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: `${firstName.trim()} ${lastName.trim()}`,
            clientEmail: email,
            clientPhone: fullPhone,
            coachingType: coachingType
          })
        })
      } catch(e) {}
    }

    setSuccess('Compte créé ! Tu peux maintenant te connecter.')
    setLoading(false)
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(error.message)
    else setSuccess('Un lien de réinitialisation a été envoyé à ' + email)
    setLoading(false)
  }

  function resetForm() {
    setError(''); setSuccess('')
    setFirstName(''); setLastName(''); setPhone('')
    setCoachingType(''); setAddress(''); setHasOnairAccess(false)
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={s.subtitle}>Coach Sport & Nutrition</div>

        {/* CONNEXION */}
        {mode === 'login' && (
          <>
            <h1 style={s.title}>Accède à ton<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>espace client</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} style={s.input} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={s.input} />
              <button onClick={handleLogin} disabled={loading} style={s.btn}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </div>
            <div style={s.links}>
              <button onClick={() => { setMode('forgot'); resetForm() }} style={s.linkBtn}>Mot de passe oublié ?</button>
              <button onClick={() => { setMode('signup'); resetForm() }} style={s.linkBtn}>Créer un compte</button>
            </div>
          </>
        )}

        {/* INSCRIPTION */}
        {mode === 'signup' && (
          <>
            <h1 style={s.title}>Créer mon<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>compte</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input type="text" placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} style={s.input} />
                <input type="text" placeholder="Nom" value={lastName} onChange={e => setLastName(e.target.value)} style={s.input} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <select value={phonePrefix} onChange={e => setPhonePrefix(e.target.value)} style={{ ...s.input, flex: 'none', width: 90, padding: '12px 8px' }}>
                  <option value="+33">🇫🇷 +33</option>
                  <option value="+32">🇧🇪 +32</option>
                  <option value="+41">🇨🇭 +41</option>
                  <option value="+44">🇬🇧 +44</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+39">🇮🇹 +39</option>
                  <option value="+49">🇩🇪 +49</option>
                  <option value="+212">🇲🇦 +212</option>
                  <option value="+213">🇩🇿 +213</option>
                  <option value="+216">🇹🇳 +216</option>
                </select>
                <input type="tel" placeholder="6 12 34 56 78" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...s.input, flex: 1 }} />
              </div>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} style={s.input} />
              <input type="password" placeholder="Mot de passe (8 caractères min)" value={password} onChange={e => setPassword(e.target.value)} style={s.input} />

              {/* Type de coaching */}
              <div style={s.typeLabel}>Type de coaching</div>
              <div style={s.typeGrid}>
                <button type="button" onClick={() => { setCoachingType('presentiel'); setAddress('') }} style={{ ...s.typeBtn, ...(coachingType === 'presentiel' ? s.typeBtnActive : {}) }}>
                  <span style={s.typeIcon}>🏋️</span>
                  <span style={s.typeName}>En salle</span>
                  <span style={s.typeSub}>ON AIR — Paris 13e</span>
                </button>
                <button type="button" onClick={() => { setCoachingType('domicile'); setHasOnairAccess(false) }} style={{ ...s.typeBtn, ...(coachingType === 'domicile' ? s.typeBtnActive : {}) }}>
                  <span style={s.typeIcon}>🏠</span>
                  <span style={s.typeName}>À domicile</span>
                  <span style={s.typeSub}>Yoann se déplace</span>
                </button>
                <button type="button" onClick={() => { setCoachingType('en_ligne'); setAddress(''); setHasOnairAccess(false) }} style={{ ...s.typeBtn, ...(coachingType === 'en_ligne' ? s.typeBtnActive : {}), gridColumn: 'span 2' }}>
                  <span style={s.typeIcon}>📱</span>
                  <span style={s.typeName}>En ligne</span>
                  <span style={s.typeSub}>Programme personnalisé à distance</span>
                </button>
              </div>

              {/* Confirmation ON AIR pour présentiel */}
              {coachingType === 'presentiel' && (
                <label style={s.checkRow}>
                  <input
                    type="checkbox"
                    checked={hasOnairAccess}
                    onChange={e => setHasOnairAccess(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: GOLD, flexShrink: 0, marginTop: 2 }}
                  />
                  <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                    Je confirme que mes séances auront lieu à <strong>ON AIR BNF, 93 avenue de France, Paris 13e</strong> et que j'ai accès à la salle via un abonnement ou un accès en cours de validité.
                  </span>
                </label>
              )}

              {/* Adresse domicile */}
              {coachingType === 'domicile' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ton adresse domicile</div>
                  <input
                    type="text"
                    placeholder="Ex: 39 rue Gustave Eiffel, Clichy"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    style={s.input}
                  />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Utilisée uniquement pour la gestion des déplacements de Yoann.
                  </div>
                </div>
              )}

              <button onClick={handleSignup} disabled={loading} style={s.btn}>
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
            </div>
            <div style={s.links}>
              <button onClick={() => { setMode('login'); resetForm() }} style={s.linkBtn}>← Retour à la connexion</button>
            </div>
          </>
        )}

        {/* MOT DE PASSE OUBLIÉ */}
        {mode === 'forgot' && (
          <>
            <h1 style={s.title}>Mot de passe<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>oublié</em></h1>
            <p style={s.desc}>Entre ton email pour recevoir un lien de réinitialisation.</p>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} style={s.input} />
              <button onClick={handleForgot} disabled={loading} style={s.btn}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </div>
            <div style={s.links}>
              <button onClick={() => { setMode('login'); resetForm() }} style={s.linkBtn}>← Retour à la connexion</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,151,58,0.06), transparent 60%)' },
  card: { padding: '48px 32px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 440 },
  logo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center', marginBottom: 40 },
  title: { fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, lineHeight: 1.15, marginBottom: 24, textAlign: 'center' },
  desc: { fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', width: '100%', boxSizing: 'border-box' },
  btn: { background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 8, padding: '15px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 4 },
  error: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#f87171', marginBottom: 8 },
  successBox: { background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#4ade80', marginBottom: 8 },
  links: { display: 'flex', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textDecoration: 'underline' },
  typeLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 },
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  typeBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '16px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  typeBtnActive: { borderColor: GOLD, background: 'rgba(196,151,58,0.08)' },
  typeIcon: { fontSize: 24 },
  typeName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  typeSub: { fontSize: 11, color: 'var(--muted)', textAlign: 'center' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 },
}
