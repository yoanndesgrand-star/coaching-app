import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'
const GOLD_LIGHT = '#E2B95A'

export default function Dashboard({ profile, setProfile }) {
  const [slots, setSlots] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [cancelling, setCancelling] = useState(null)
  const [msg, setMsg] = useState(null)
  const [view, setView] = useState('dashboard') // 'dashboard' | 'book'
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [slotsRes, bookingsRes] = await Promise.all([
      supabase.from('time_slots').select('*').eq('is_available', true).gte('start_time', new Date().toISOString()).order('start_time'),
      supabase.from('bookings').select('*, time_slots(*)').eq('client_id', profile.id).eq('status', 'confirmed').order('time_slots(start_time)')
    ])
    setSlots(slotsRes.data || [])
    setBookings(bookingsRes.data || [])
    setLoading(false)
  }

  async function bookSlot(slot) {
    if (profile.credits < 1) { setMsg({ type: 'error', text: 'Tu n\'as plus de crédit disponible.' }); return }
    setBooking(true)
    const { error } = await supabase.from('bookings').insert({ client_id: profile.id, slot_id: slot.id })
    if (!error) {
      await supabase.from('time_slots').update({ is_available: false }).eq('id', slot.id)
      const { data: p } = await supabase.from('profiles').update({ credits: profile.credits - 1 }).eq('id', profile.id).select().single()
      setProfile(p)
      setMsg({ type: 'success', text: `Séance réservée le ${formatDate(slot.start_time)} ✓` })
      setView('dashboard')
      loadData()
    } else {
      setMsg({ type: 'error', text: 'Erreur lors de la réservation.' })
    }
    setBooking(false)
  }

  async function cancelBooking(booking) {
    const slotTime = new Date(booking.time_slots.start_time)
    const hoursUntil = (slotTime - new Date()) / 1000 / 3600
    if (hoursUntil < 12) { setMsg({ type: 'error', text: 'Annulation impossible moins de 12h avant la séance.' }); return }
    setCancelling(booking.id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)
    const { data: p } = await supabase.from('profiles').update({ credits: profile.credits + 1 }).eq('id', profile.id).select().single()
    setProfile(p)
    setMsg({ type: 'success', text: 'Séance annulée, crédit restitué.' })
    loadData()
    setCancelling(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Calendar helpers
  function getWeekDays() {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7)
    monday.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  function slotsForDay(day) {
    return slots.filter(s => {
      const d = new Date(s.start_time)
      return d.toDateString() === day.toDateString()
    })
  }

  const nextBooking = bookings.find(b => new Date(b.time_slots.start_time) > new Date())
  const weekDays = getWeekDays()
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']

  return (
    <div style={s.wrapper}>
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

        {view === 'dashboard' && (
          <>
            {/* STATS */}
            <div style={s.statsGrid}>
              <div style={s.statCard}>
                <div style={s.statLabel}>Crédits restants</div>
                <div style={{ ...s.statValue, color: profile.credits > 0 ? GOLD : '#f87171' }}>{profile.credits}</div>
                <div style={s.statSub}>séance{profile.credits > 1 ? 's' : ''} disponible{profile.credits > 1 ? 's' : ''}</div>
              </div>

              <div style={{ ...s.statCard, flex: 2 }}>
                <div style={s.statLabel}>Prochaine séance</div>
                {nextBooking ? (
                  <>
                    <div style={{ ...s.statValue, fontSize: 24 }}>{formatDate(nextBooking.time_slots.start_time)}</div>
                    <div style={s.statSub}>{formatTime(nextBooking.time_slots.start_time)} — ON AIR BNF Paris 13e</div>
                    <button
                      onClick={() => cancelBooking(nextBooking)}
                      disabled={cancelling === nextBooking.id}
                      style={s.btnCancel}
                    >
                      {cancelling === nextBooking.id ? 'Annulation…' : 'Annuler (si > 12h avant)'}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0' }}>Aucune séance prévue</div>
                    <button onClick={() => setView('book')} style={s.btnGold} disabled={profile.credits < 1}>
                      {profile.credits < 1 ? 'Pas de crédit disponible' : 'Réserver une séance →'}
                    </button>
                  </>
                )}
              </div>

              <div style={s.statCard}>
                <div style={s.statLabel}>Offre</div>
                <div style={{ fontSize: 15, fontWeight: 500, margin: '8px 0' }}>{profile.offer_label || 'Coaching sportif'}</div>
                <div style={s.statSub}>ON AIR BNF — Paris 13e</div>
              </div>
            </div>

            {/* PROCHAINES RÉSERVATIONS */}
            {bookings.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Mes séances réservées</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bookings.map(b => (
                    <div key={b.id} style={s.bookingRow}>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 2 }}>{formatDate(b.time_slots.start_time)}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTime(b.time_slots.start_time)} — ON AIR BNF Paris 13e</div>
                      </div>
                      <button
                        onClick={() => cancelBooking(b)}
                        disabled={cancelling === b.id || (new Date(b.time_slots.start_time) - new Date()) / 3600000 < 12}
                        style={s.btnCancelSmall}
                      >
                        {cancelling === b.id ? '…' : 'Annuler'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA BOOK */}
            {profile.credits > 0 && (
              <div style={s.ctaBar}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>Tu as {profile.credits} crédit{profile.credits > 1 ? 's' : ''} à utiliser</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Réserve ta prochaine séance dès maintenant</div>
                </div>
                <button onClick={() => setView('book')} style={s.btnGold}>Réserver une séance →</button>
              </div>
            )}
          </>
        )}

        {view === 'book' && (
          <div style={s.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
              <button onClick={() => setView('dashboard')} style={s.btnBack}>← Retour</button>
              <div style={s.sectionTitle}>Choisir un créneau</div>
            </div>

            {/* Week nav */}
            <div style={s.weekNav}>
              <button onClick={() => setWeekOffset(w => w - 1)} style={s.weekBtn} disabled={weekOffset <= 0}>←</button>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>
                {weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()]} — {weekDays[6].getDate()} {MONTHS[weekDays[6].getMonth()]}
              </span>
              <button onClick={() => setWeekOffset(w => w + 1)} style={s.weekBtn}>→</button>
            </div>

            {/* Calendar grid */}
            <div style={s.calGrid}>
              {weekDays.map((day, i) => {
                const daySlots = slotsForDay(day)
                const isToday = day.toDateString() === new Date().toDateString()
                const isPast = day < new Date() && !isToday
                return (
                  <div key={i} style={{ ...s.calDay, opacity: isPast ? 0.4 : 1 }}>
                    <div style={{ ...s.calDayHeader, color: isToday ? GOLD : 'var(--muted)' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{DAYS[i]}</span>
                      <span style={{ fontSize: 22, fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>{day.getDate()}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {daySlots.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center', padding: '8px 0' }}>—</div>
                      ) : daySlots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => !isPast && bookSlot(slot)}
                          disabled={booking || isPast}
                          style={s.slotBtn}
                        >
                          {formatTime(slot.start_time)}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {slots.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)', fontSize: 13 }}>
                Aucun créneau disponible pour le moment.<br />Contacte Yoann sur WhatsApp pour convenir d'un horaire.
                <br /><br />
                <a href="https://wa.me/33687207855" target="_blank" style={{ color: GOLD, textDecoration: 'none', fontSize: 13 }}>💬 Envoyer un message</a>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  const DAYS_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const MONTHS_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${DAYS_FULL[d.getDay()]} ${d.getDate()} ${MONTHS_FULL[d.getMonth()]}`
}

function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`
}

const s = {
  wrapper: { minHeight: '100vh', background: 'var(--bg)' },
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
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 16, marginBottom: 24 },
  statCard: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '24px',
  },
  statLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 },
  statValue: { fontFamily: 'Cormorant Garamond, serif', fontSize: 52, fontWeight: 300, lineHeight: 1, color: GOLD },
  statSub: { fontSize: 12, color: 'var(--muted)', marginTop: 4 },
  section: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px', marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: GOLD, marginBottom: 20 },
  bookingRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13,
  },
  ctaBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '24px 28px', background: 'rgba(196,151,58,0.06)',
    border: '1px solid rgba(196,151,58,0.2)', borderRadius: 12, flexWrap: 'wrap', gap: 16,
  },
  btnGold: {
    background: GOLD, color: '#000', border: 'none',
    borderRadius: 8, padding: '13px 28px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
  },
  btnCancel: {
    background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '8px 14px', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif', marginTop: 10,
  },
  btnCancelSmall: {
    background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
  },
  btnBack: {
    background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
  },
  btnLogout: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
    borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
  },
  weekNav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, padding: '12px 0',
  },
  weekBtn: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 6, padding: '8px 16px', fontSize: 14,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
  },
  calGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8,
  },
  calDay: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '12px 8px',
  },
  calDayHeader: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    marginBottom: 10, gap: 2,
  },
  slotBtn: {
    background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.3)',
    color: GOLD, borderRadius: 6, padding: '8px 4px', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', width: '100%', fontFamily: 'Outfit, sans-serif',
    transition: 'all 0.15s',
  },
}
