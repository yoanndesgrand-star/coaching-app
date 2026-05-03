import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'
const CALENDLY_URL = 'https://calendly.com/contact-yoanndesgrand/coaching'

const STRIPE = {
  seance_60:  'https://buy.stripe.com/28E5kCcMB9mWaR8d7M5Rm00',
  seance_50:  'https://buy.stripe.com/4gM6oG4g5dDc9N45Fk5Rm06',
  pack5_275:  'https://buy.stripe.com/4gM14m5k98iSbVcaZE5Rm01',
  pack5_250:  'https://buy.stripe.com/00waEWcMB9mW1gy5Fk5Rm07',
  pack10:     'https://buy.stripe.com/dRm9ASh2RgPo5wOaZE5Rm02',
}

export default function Dashboard({ profile, setProfile }) {
  const [bookings, setBookings] = useState([])
  const [msg, setMsg] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  const isAbonne = (profile.offer_label || '').toLowerCase().includes('sport')

  useEffect(() => {
    loadBookings()

  }, [])

  async function loadBookings() {
    const { data } = await supabase
      .from('bookings').select('*, time_slots(*)')
      .eq('client_id', profile.id).eq('status', 'confirmed')
      .order('created_at', { ascending: false })
    setBookings(data || [])
  }

  async function cancelBooking(booking) {
    if (!booking.time_slots) return
    const hoursUntil = (new Date(booking.time_slots.start_time) - new Date()) / 3600000
    if (hoursUntil < 12) { setMsg({ type: 'error', text: 'Annulation impossible moins de 12h avant la séance.' }); return }
    setCancelling(booking.id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)
    const { data: p } = await supabase.from('profiles').update({ credits: profile.credits + 1 }).eq('id', profile.id).select().single()
    setProfile(p)
    setMsg({ type: 'success', text: 'Séance annulée, crédit restitué.' })
    loadBookings()
    setCancelling(null)
  }

  function openCalendly() {
    window.open(CALENDLY_URL, '_blank')
  }

  const nextBooking = bookings.find(b => b.time_slots && new Date(b.time_slots.start_time) > new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={s.nav}>
        <div style={s.navLogo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{profile.full_name || profile.email}</span>
          <button onClick={() => supabase.auth.signOut()} style={s.btnLogout}>Déconnexion</button>
        </div>
      </nav>

      <div style={s.container}>
        {msg && (
          <div style={{ ...s.msgBox, background: msg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            {msg.text}<button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 12 }}>×</button>
          </div>
        )}

        {/* STATS */}
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Crédits</div>
            <div style={{ ...s.statValue, color: profile.credits > 0 ? GOLD : '#f87171' }}>{profile.credits}</div>
            <div style={s.statSub}>séances dispo</div>
          </div>
          <div style={{ ...s.statCard, flex: 2 }}>
            <div style={s.statLabel}>Prochaine séance</div>
            {nextBooking ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 500, margin: '8px 0 4px' }}>{formatDate(nextBooking.time_slots.start_time)}</div>
                <div style={s.statSub}>{formatTime(nextBooking.time_slots.start_time)} — ON AIR BNF Paris 13e</div>
                <button onClick={() => cancelBooking(nextBooking)} disabled={cancelling === nextBooking.id} style={s.btnCancel}>
                  {cancelling === nextBooking.id ? '…' : 'Annuler (si > 12h avant)'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0' }}>Aucune séance prévue</div>
                <button onClick={openCalendly} style={s.btnGold}>📅 Réserver une séance</button>
              </>
            )}
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Mon offre</div>
            <div style={{ fontSize: 14, fontWeight: 500, margin: '8px 0' }}>{profile.offer_label || 'Coaching'}</div>
            {isAbonne && <div style={{ fontSize: 11, color: GOLD, background: 'rgba(196,151,58,0.1)', padding: '4px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4 }}>⭐ Tarif abonné</div>}
          </div>
        </div>

        {/* RÉSERVER avec crédits */}
        {(profile.credits > 0 || isAbonne) && (
          <div style={s.ctaBar}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Tu as {profile.credits} crédit{profile.credits > 1 ? 's' : ''} disponible{profile.credits > 1 ? 's' : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Réserve sur le calendrier de Yoann</div>
            </div>
            <button onClick={openCalendly} style={s.btnGold}>📅 Réserver →</button>
          </div>
        )}

        {/* OFFRES SÉANCES */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Acheter des séances</div>
          {isAbonne && (
            <div style={{ fontSize: 12, color: GOLD, marginBottom: 20, padding: '8px 14px', background: 'rgba(196,151,58,0.08)', borderRadius: 6, border: '1px solid rgba(196,151,58,0.2)' }}>
              ⭐ Tarif abonné Harmony — séances à 50€ au lieu de 60€
            </div>
          )}
          <div style={s.offresGrid}>

            {/* Séance unique */}
            <div style={s.offreCard}>
              <div style={s.offreLabel}>À l'unité</div>
              <div style={s.offreTitle}>Séance individuelle</div>
              <div style={s.offrePrix}>
                <span style={s.prixMain}>{isAbonne ? '50€' : '60€'}</span>
                {isAbonne && <span style={s.prixBarre}>60€</span>}
                <span style={s.prixPer}>/séance</span>
              </div>
              <a href={isAbonne ? STRIPE.seance_50 : STRIPE.seance_60} target="_blank" style={s.btnOffreGold}>Payer →</a>
              <div style={s.offreNote}>ou espèces sur place</div>
            </div>

            {/* Pack 5 */}
            <div style={s.offreCard}>
              <div style={s.offreLabel}>Pack 5 séances</div>
              <div style={s.offreTitle}>Programme Court</div>
              <div style={s.offrePrix}>
                <span style={s.prixMain}>{isAbonne ? '250€' : '275€'}</span>
                {isAbonne && <span style={s.prixBarre}>275€</span>}
                <span style={s.prixPer}>{isAbonne ? '50€' : '55€'}/séance</span>
              </div>
              <div style={s.saving}>Économie {isAbonne ? '50€' : '25€'}</div>
              <a href={isAbonne ? STRIPE.pack5_250 : STRIPE.pack5_275} target="_blank" style={s.btnOffreGold}>Acheter →</a>
              <div style={s.offreNote}>valable 3 mois</div>
            </div>

            {/* Pack 10 */}
            <div style={{ ...s.offreCard, borderColor: 'rgba(196,151,58,0.4)', background: 'linear-gradient(135deg, #161410 0%, var(--surface) 100%)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#000', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 10px', borderRadius: '0 0 6px 6px' }}>
                MEILLEURE OFFRE
              </div>
              <div style={s.offreLabel}>Pack 10 séances</div>
              <div style={s.offreTitle}>Programme SHIFT</div>
              <div style={s.offrePrix}>
                <span style={s.prixMain}>500€</span>
                <span style={s.prixPer}>50€/séance</span>
              </div>
              <div style={s.saving}>Économie 100€</div>
              <a href={STRIPE.pack10} target="_blank" style={s.btnOffreGold}>Acheter →</a>
              <div style={s.offreNote}>valable 6 mois</div>
            </div>

          </div>
        </div>

        {/* HISTORIQUE */}
        {bookings.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Mes séances</div>
            {bookings.map(b => (
              <div key={b.id} style={{ ...s.bookingRow, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{b.time_slots ? formatDate(b.time_slots.start_time) : 'Séance réservée'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.time_slots ? `${formatTime(b.time_slots.start_time)} — ON AIR BNF` : 'Horaire à confirmer'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Confirmé</span>
              </div>
            ))}
          </div>
        )}

        {/* CONTACT */}
        <div style={s.infoBox}>
          <div style={{ fontSize: 20 }}>💬</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Une question ?</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Contacte Yoann directement sur WhatsApp.</div>
            <a href="https://wa.me/33687207855?text=Bonjour%20Yoann%2C%20j%27ai%20une%20question." target="_blank" style={s.btnGold}>Envoyer un message</a>
          </div>
        </div>

      </div>
    </div>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function formatTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2,'0')}h${d.getMinutes().toString().padStart(2,'0')}`
}

const s = {
  nav: { position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', background:'rgba(8,8,8,0.95)', backdropFilter:'blur(8px)', borderBottom:'1px solid var(--border)' },
  navLogo: { fontFamily:'Cormorant Garamond, serif', fontSize:18, fontWeight:400 },
  container: { maxWidth:900, margin:'0 auto', padding:'40px 24px' },
  msgBox: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderRadius:8, border:'1px solid', fontSize:13, marginBottom:24 },
  statsGrid: { display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:16, marginBottom:16 },
  statCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'24px' },
  statLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 },
  statValue: { fontFamily:'Outfit, sans-serif', fontSize:52, fontWeight:600, lineHeight:1 },
  statSub: { fontSize:12, color:'var(--muted)', marginTop:4 },
  ctaBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 28px', background:'rgba(196,151,58,0.06)', border:'1px solid rgba(196,151,58,0.2)', borderRadius:12, flexWrap:'wrap', gap:16, marginBottom:16 },
  section: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'28px', marginBottom:16 },
  sectionTitle: { fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#C4973A', marginBottom:20 },
  offresGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 },
  offreCard: { background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'20px 16px', display:'flex', flexDirection:'column', gap:8 },
  offreLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)' },
  offreTitle: { fontFamily:'Cormorant Garamond, serif', fontSize:20, fontWeight:400 },
  offrePrix: { display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap' },
  prixMain: { fontSize:26, fontWeight:600, color:'#C4973A', fontFamily:'Outfit, sans-serif' },
  prixBarre: { fontSize:13, color:'var(--muted)', textDecoration:'line-through' },
  prixPer: { fontSize:12, color:'var(--muted)' },
  saving: { fontSize:11, fontWeight:600, color:'#C4973A', background:'rgba(196,151,58,0.1)', padding:'3px 8px', borderRadius:4, display:'inline-block', width:'fit-content' },
  btnOffreGold: { display:'block', textAlign:'center', background:'#C4973A', color:'#000', borderRadius:7, padding:'11px', fontSize:12, fontWeight:500, textDecoration:'none', marginTop:4 },
  offreNote: { fontSize:11, color:'var(--muted)', textAlign:'center' },
  bookingRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8 },
  infoBox: { display:'flex', gap:16, alignItems:'flex-start', padding:'24px 28px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, marginBottom:16 },
  btnGold: { background:'#C4973A', color:'#000', border:'none', borderRadius:8, padding:'12px 24px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Outfit, sans-serif', textDecoration:'none', display:'inline-block', whiteSpace:'nowrap' },
  btnCancel: { background:'transparent', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'Outfit, sans-serif', marginTop:10 },
  btnLogout: { background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'Outfit, sans-serif' },
}
