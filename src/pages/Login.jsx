import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); setLoading(false); return }
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    if (error) setError(error.message)
    else setSuccess('Compte créé ! Tu peux maintenant te connecter.')
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

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>Yoann <span style={{ color: 'var(--gold)' }}>Desgrand</span></div>
        <div style={s.subtitle}>Coach Muscu & Nutrition</div>

        {mode === 'login' && (
          <>
            <h1 style={s.title}>Accède à ton<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>espace client</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <form onSubmit={handleLogin} style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} required style={s.input} />
              <button type="submit" disabled={loading} style={s.btn}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
            <div style={s.links}>
              <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} style={s.linkBtn}>Mot de passe oublié ?</button>
              <button onClick={() => { setMode('signup'); setError(''); setSuccess('') }} style={s.linkBtn}>Créer un compte</button>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <>
            <h1 style={s.title}>Créer mon<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>compte</em></h1>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <form onSubmit={handleSignup} style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} />
              <input type="password" placeholder="Mot de passe (8 caractères min)" value={password} onChange={e => setPassword(e.target.value)} required style={s.input} />
              <button type="submit" disabled={loading} style={s.btn}>
                {loading ? 'Création…' : 'Créer mon compte'}
              </button>
            </form>
            <div style={s.links}>
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={s.linkBtn}>← Retour à la connexion</button>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h1 style={s.title}>Mot de passe<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>oublié</em></h1>
            <p style={s.desc}>Entre ton email pour recevoir un lien de réinitialisation.</p>
            {error && <div style={s.error}>{error}</div>}
            {success && <div style={s.successBox}>{success}</div>}
            <form onSubmit={handleForgot} style={s.form}>
              <input type="email" placeholder="ton@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={s.input} />
              <button type="submit" disabled={loading} style={s.btn}>
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
            <div style={s.links}>
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={s.linkBtn}>← Retour à la connexion</button>
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
    width: '100%', maxWidth: 440,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '48px 40px',
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
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
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
}
