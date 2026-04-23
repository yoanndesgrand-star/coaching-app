import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>Yoann <span style={{ color: 'var(--gold)' }}>Desgrand</span></div>
        <div style={{ fontSize: 48, textAlign: 'center', margin: '24px 0' }}>✅</div>
        <h2 style={{ ...s.title, fontSize: 28 }}>Mot de passe mis à jour !</h2>
        <p style={s.desc}>Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>
        <a href="/" style={s.btn}>Accéder à mon espace →</a>
      </div>
    </div>
  )

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <div style={s.logo}>Yoann <span style={{ color: 'var(--gold)' }}>Desgrand</span></div>
        <div style={s.subtitle}>Coach Muscu & Nutrition</div>
        <h1 style={s.title}>Nouveau<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>mot de passe</em></h1>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleReset} style={s.form}>
          <input type="password" placeholder="Nouveau mot de passe (8 car. min)" value={password} onChange={e => setPassword(e.target.value)} required style={s.input} />
          <input type="password" placeholder="Confirmer le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} required style={s.input} />
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Mise à jour…' : 'Enregistrer mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,151,58,0.06), transparent 60%)' },
  card: { width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 40px' },
  logo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center', marginBottom: 40 },
  title: { fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, lineHeight: 1.15, marginBottom: 24, textAlign: 'center' },
  desc: { fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none' },
  btn: { display: 'block', textAlign: 'center', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 8, padding: '15px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textDecoration: 'none' },
  error: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#f87171', marginBottom: 8 },
}
