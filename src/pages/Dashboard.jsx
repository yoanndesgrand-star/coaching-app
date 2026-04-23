import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'
const CALENDLY_URL = 'https://calendly.com/contact-yoanndesgrand/coaching'

export default function Dashboard({ profile, setProfile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => {
    loadBookings()
    // Load Calendly widget script
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  async function loadBookings() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, time_slots(*)')
      .eq('client_id', profile.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
    setBookings(data || [])
    setLoading(false)
  }

  async function cancelBooking(booking) {
    if (!booking.time_slots) return
    const slotTime = new Date(booking.time_slots.start_time)
    const hoursUntil = (slotTime - new Date()) / 1000 / 3600
    if (hoursUntil < 12) {
      setMsg({ type: 'error', text: 'Annulation impossible moins de 12h avant la séance.' })
      return
    }
    setCancelling(booking.id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)
    const { data: p } = await supabase.from('profiles')
      .update({ credits: profile.credits + 1 })
      .eq('id', profile.id)
      .select().single()
    setProfile(p)
    setMsg({ type: 'success', text: 'Séance annulée, crédit restitué.' })
    loadBookings()
    setCancelling(null)
  }

  function openCalendly() {
    if (typeof Calendly !== 'undefined') {
      Calendly.initPopupWidget({ url: CALENDLY_URL })
    } else {
      window.open(CALENDLY_URL, '_blank')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const nextBooking = bookings.find(b => b.time_slots && new Date(b.time_slots.start_time) > new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navLogo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{profile.full_name || profile.email}</span>
          <button onClick={signOut} style={s.btnLogout}>Déconnexion</button>
        </div>
      </nav>

      <div style={s.container}>

        {/* MESSAGE */}
        {msg && (
          <div style={{ ...s.msgBox, background: msg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 12, fontSize: 16 }}>×</button>
          </div>
        )}

        {/* STATS */}
        <div style={s.statsGrid}>

          {/* Crédits */}
          <div style={s.statCard}>
            <div style={s.statLabel}>Crédits restants</div>
            <div style={{ ...s.statValue, color: profile.credits > 0 ? GOLD : '#f87171' }}>
              {profile.credits}
            </div>
            <div style={s.statSub}>séance{profile.credits > 1 ? 's' : ''} disponible{profile.credits > 1 ? 's' : ''}</div>
          </div>

          {/* Prochaine séance */}
          <div style={{ ...s.statCard, flex: 2 }}>
            <div style={s.statLabel}>Prochaine séance</div>
            {nextBooking ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 500, margin: '8px 0 4px' }}>
                  {formatDate(nextBooking.time_slots.start_time)}
                </div>
                <div style={s.statSub}>{formatTime(nextBooking.time_slots.start_time)} — ON AIR BNF Paris 13e</div>
                <button onClick={() => cancelBooking(nextBooking)} disabled={cancelling === nextBooking.id} style={s.btnCancel}>
                  {cancelling === nextBooking.id ? 'Annulation…' : 'Annuler (si > 12h avant)'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0' }}>Aucune séance prévue</div>
                <button onClick={openCalendly} style={s.btnGold} disabled={profile.credits < 1}>
                  {profile.credits < 1 ? 'Pas de crédit disponible' : '📅 Réserver une séance'}
                </button>
              </>
            )}
          </div>

          {/* Offre */}
          <div style={s.statCard}>
            <div style={s.statLabel}>Mon offre</div>
            <div style={{ fontSize: 15, fontWeight: 500, margin: '8px 0' }}>{profile.offer_label || 'Coaching sportif'}</div>
            <div style={s.statSub}>ON AIR BNF — Paris 13e</div>
          </div>

        </div>

        {/* CTA RÉSERVATION */}
        {profile.credits > 0 && (
          <div style={s.ctaBar}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                Tu as {profile.credits} crédit{profile.credits > 1 ? 's' : ''} disponible{profile.credits > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Réserve ta prochaine séance directement sur le calendrier de Yoann
              </div>
            </div>
            <button onClick={openCalendly} style={s.btnGold}>
              📅 Réserver une séance →
            </button>
          </div>
        )}

        {/* HISTORIQUE */}
        {bookings.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Mes séances</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bookings.map(b => (
                <div key={b.id} style={s.bookingRow}>
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 2, fontSize: 14 }}>
                      {b.time_slots ? formatDate(b.time_slots.start_time) : 'Séance réservée'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {b.time_slots ? `${formatTime(b.time_slots.start_time)} — ON AIR BNF Paris 13e` : 'Horaire à confirmer'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ ...s.badge, color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' }}>
                      Confirmé
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INFO BOX */}
        <div style={s.infoBox}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>💬</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Une question ?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
              Contacte Yoann directement sur WhatsApp pour tout renseignement.
            </div>
            <a
              href="https://wa.me/33687207855?text=Bonjour%20Yoann%2C%20j%27ai%20une%20question%20concernant%20mon%20coaching."
              target="_blank"
              style={s.btnGold}
            >
              Envoyer un message
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`
}

const s = {
  nav: {
    position: 'sticky', top: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 32px',
    background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--border)',
  },
  navLogo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 18, fontWeight: 400 },
  container: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
  msgBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderRadius: 8, border: '1px solid',
    fontSize: 13, marginBottom: 24,
  },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 16, marginBottom: 16 },
  statCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '24px',
  },
  statLabel: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
    textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8,
  },
  statValue: {
    fontFamily: 'Cormorant Garamond, serif', fontSize: 52,
    fontWeight: 300, lineHeight: 1, color: GOLD,
  },
  statSub: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  ctaBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 28px', background: 'rgba(196,151,58,0.06)',
    border: '1px solid rgba(196,151,58,0.2)', borderRadius: 12,
    flexWrap: 'wrap', gap: 16, marginBottom: 16,
  },
  section: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '28px', marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
    textTransform: 'uppercase', color: GOLD, marginBottom: 20,
  },
  bookingRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 8,
  },
  badge: {
    display: 'inline-block', fontSize: 11, fontWeight: 500,
    padding: '3px 10px', borderRadius: 4, border: '1px solid',
  },
  infoBox: {
    display: 'flex', gap: 16, alignItems: 'flex-start',
    padding: '24px 28px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16,
  },
  btnGold: {
    background: GOLD, color: '#000', border: 'none',
    borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
    textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap',
  },
  btnCancel: {
    background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif', marginTop: 10,
  },
  btnLogout: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
    borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
  },
}
