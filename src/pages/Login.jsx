import { useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [coachingType, setCoachingType] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
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
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); setLoading(false); return }

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    })

    if (signupError) { setError(signupError.message); setLoading(false); return }

    // Mettre à jour le profil avec les infos supplémentaires
    if (data?.user) {
      await supabase.from('profiles').update({
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim(),
        coaching_type: coachingType,
      }).eq('id', data.user.id)
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
    setFirstName(''); setLastName(''); setPhone(''); setCoachingType('')
  }

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={s.subtitle}>Coach Sport & Nutrition</div>

        {/* ─── CONNEXION ─── */}
        {mode === 'login' && (
          <>
            <h1 style={s.title}>Accède à ton<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>espace client</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required style={s.input} />
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

        {/* ─── INSCRIPTION ─── */}
        {mode === 'signup' && (
          <>
            <h1 style={s.title}>Créer mon<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>compte</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>

              {/* Prénom + Nom */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', boxSizing: 'border-box' }}>
                <input
                  type="text" placeholder="Prénom" value={firstName}
                  onChange={e => setFirstName(e.target.value)} required
                 style={{ ...s.input }}
                />
                <input
                  type="text" placeholder="Nom" value={lastName}
                  onChange={e => setLastName(e.target.value)} required
                  style={{ ...s.input }}
                />
              </div>

              {/* Téléphone */}
              <input
                type="tel" placeholder="Téléphone (ex: 06 12 34 56 78)" value={phone}
                onChange={e => setPhone(e.target.value)}
                style={s.input}
              />

              {/* Email */}
              <input
                type="email" placeholder="ton@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required
                style={s.input}
              />

              {/* Mot de passe */}
              <input
                type="password" placeholder="Mot de passe (8 caractères min)" value={password}
                onChange={e => setPassword(e.target.value)} required
                style={s.input}
              />

              {/* Type de coaching */}
              <div style={s.typeLabel}>Type de coaching</div>
              <div style={s.typeGrid}>
                <button
                  type="button"
                  onClick={() => setCoachingType('salle')}
                  style={{ ...s.typeBtn, ...(coachingType === 'salle' ? s.typeBtnActive : {}) }}
                >
                  <span style={s.typeIcon}>🏋️</span>
                  <span style={s.typeName}>En salle</span>
                  <span style={s.typeSub}>ON AIR Fitness — Paris</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCoachingType('domicile')}
                  style={{ ...s.typeBtn, ...(coachingType === 'domicile' ? s.typeBtnActive : {}) }}
                >
                  <span style={s.typeIcon}>🏠</span>
                  <span style={s.typeName}>À domicile</span>
                  <span style={s.typeSub}>Partout à Paris</span>
                </button>
              </div>

              <button onClick={handleSignup} disabled={loading} style={s.btn}>
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
            </div>
            <div style={s.links}>
              <button onClick={() => { setMode('login'); resetForm() }} style={s.linkBtn}>← Retour à la connexion</button>
            </div>
          </>
        )}

        {/* ─── MOT DE PASSE OUBLIÉ ─── */}
        {mode === 'forgot' && (
          <>
            <h1 style={s.title}>Mot de passe<br /><em style={{ color: GOLD, fontStyle: 'italic' }}>oublié</em></h1>
            <p style={s.desc}>Entre ton email pour recevoir un lien de réinitialisation.</p>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <div style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} />
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
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,151,58,0.06), transparent 60%)',
  },
  card: {
    padding: '48px 32px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, 
  },
  logo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center', marginBottom: 40 },
  title: { fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, lineHeight: 1.15, marginBottom: 24, textAlign: 'center' },
  desc: { fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '14px 16px',
    color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif',
    outline: 'none',
  },
  btn: {
    background: 'var(--gold)', color: '#000', border: 'none',
    borderRadius: 8, padding: '15px', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 4,
  },
  error: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#f87171', marginBottom: 8,
  },
  successBox: {
    background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
    borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#4ade80', marginBottom: 8,
  },
  links: { display: 'flex', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 8 },
  linkBtn: { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textDecoration: 'underline' },
  typeLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 4 },
  typeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  typeBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '16px 12px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
    fontFamily: 'Outfit, sans-serif',
  },
  typeBtnActive: {
    borderColor: GOLD, background: 'rgba(196,151,58,0.08)',
  },
  typeIcon: { fontSize: 24 },
  typeName: { fontSize: 13, fontWeight: 500, color: 'var(--text)' },
  typeSub: { fontSize: 11, color: 'var(--muted)', textAlign: 'center' },
}
