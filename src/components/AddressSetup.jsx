import { useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'

export default function AddressSetup({ profile, onComplete }) {
  const [address, setAddress] = useState('')
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const isDomicile = profile.coaching_type === 'domicile'

  async function save() {
    if (!isDomicile && !hasAccess) return
    setLoading(true)
    if (isDomicile) {
      await supabase.from('profiles').update({ address: address.trim() }).eq('id', profile.id)
    } else {
      await supabase.from('profiles').update({ address: 'ON AIR BNF, 93 avenue de France, Paris 13' }).eq('id', profile.id)
    }
    setLoading(false)
    onComplete()
  }

  if (isDomicile) {
    return (
      <div style={s.overlay}>
        <div style={s.card}>
          <div style={s.logo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
          <div style={s.title}>Ton adresse domicile</div>
          <div style={s.desc}>
            Pour organiser au mieux les déplacements entre les séances, entre ton adresse complète.
          </div>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Ex: 39 rue Gustave Eiffel, Clichy"
            style={s.input}
          />
          <button onClick={save} disabled={loading || !address.trim()} style={{ ...s.btn, opacity: !address.trim() ? 0.5 : 1 }}>
            {loading ? '...' : 'Enregistrer mon adresse'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>
            Cette adresse est utilisée uniquement pour la gestion des séances et n'est pas partagée.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.logo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={s.title}>Bienvenue !</div>
        <div style={s.desc}>Tes séances de coaching en salle se déroulent à :</div>

        <div style={s.addressBox}>
          📍 <strong>ON AIR BNF</strong><br />
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>93 avenue de France, Paris 13e</span>
        </div>

        <label style={s.checkRow}>
          <input
            type="checkbox"
            checked={hasAccess}
            onChange={e => setHasAccess(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: GOLD, flexShrink: 0, marginTop: 2 }}
          />
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            Je confirme avoir accès à la salle ON AIR BNF via un abonnement ou un accès en vigueur.
          </span>
        </label>

        <button onClick={save} disabled={loading || !hasAccess} style={{ ...s.btn, opacity: !hasAccess ? 0.5 : 1 }}>
          {loading ? '...' : 'Confirmer'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>
          Sans accès à la salle, les séances ne pourront pas avoir lieu.
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '48px 40px', maxWidth: 440, width: '90%', textAlign: 'center' },
  logo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 500, marginBottom: 12 },
  desc: { fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 },
  addressBox: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, fontSize: 15, lineHeight: 1.8, textAlign: 'left' },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', marginBottom: 20, cursor: 'pointer', padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 },
  input: { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', marginBottom: 16, boxSizing: 'border-box' },
  btn: { width: '100%', background: '#C4973A', color: '#000', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
}
