import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logo}>Yoann <span style={{ color: 'var(--gold)' }}>Desgrand</span></div>
        <div style={styles.subtitle}>Coach Muscu & Nutrition</div>

        {!sent ? (
          <>
            <h1 style={styles.title}>Accède à ton<br /><em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>espace client</em></h1>
            <p style={styles.desc}>Entre ton adresse email pour recevoir un lien de connexion. Aucun mot de passe requis.</p>

            <form onSubmit={handleLogin} style={styles.form}>
              <input
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={styles.input}
              />
              {error && <div style={styles.error}>{error}</div>}
              <button type="submit" disabled={loading} style={styles.btn}>
                {loading ? 'Envoi…' : 'Recevoir mon lien de connexion'}
              </button>
            </form>

            <p style={styles.hint}>Tu n'as pas encore de compte ? <a href="https://yoanndesgrand.fr" style={{ color: 'var(--gold)', textDecoration: 'none' }}>Voir les offres</a></p>
          </>
        ) : (
          <div style={styles.sentBox}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <h2 style={styles.sentTitle}>Vérifie ta boîte mail</h2>
            <p style={styles.sentDesc}>Un lien de connexion a été envoyé à <strong style={{ color: 'var(--text)' }}>{email}</strong>. Clique dessus pour accéder à ton espace.</p>
            <button onClick={() => setSent(false)} style={styles.btnGhost}>← Modifier l'email</button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
    background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(196,151,58,0.06), transparent 60%)',
  },
  card: {
    width: '100%', maxWidth: 440,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16, padding: '48px 40px',
  },
  logo: {
    fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400,
    marginBottom: 4, textAlign: 'center',
  },
  subtitle: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
    color: 'var(--muted)', textAlign: 'center', marginBottom: 40,
  },
  title: {
    fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300,
    lineHeight: 1.15, marginBottom: 14, textAlign: 'center',
  },
  desc: { fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 32, lineHeight: 1.6 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '14px 16px',
    color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif',
    outline: 'none', transition: 'border-color 0.2s',
  },
  btn: {
    background: 'var(--gold)', color: '#000', border: 'none',
    borderRadius: 8, padding: '15px', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
    transition: 'background 0.2s',
  },
  btnGhost: {
    background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '12px 24px', fontSize: 13,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 16,
  },
  error: {
    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
    borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--error)',
  },
  hint: { fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 20 },
  sentBox: { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  sentTitle: {
    fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, marginBottom: 12,
  },
  sentDesc: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 },
}
