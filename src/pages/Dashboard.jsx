import { useEffect, useState } from 'react'
import BookingCalendar from '../components/BookingCalendar'
import AddressSetup from '../components/AddressSetup'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'
const WHATSAPP = 'https://wa.me/33687207855'
const LOGO_URL = '/logo-yd.png'

const STRIPE = {
  seance_60:   'https://buy.stripe.com/28E5kCcMB9mWaR8d7M5Rm00',
  seance_50:   'https://buy.stripe.com/4gM6oG4g5dDc9N45Fk5Rm06',
  pack5_275:   'https://buy.stripe.com/4gM14m5k98iSbVcaZE5Rm01',
  pack5_250:   'https://buy.stripe.com/00waEWcMB9mW1gy5Fk5Rm07',
  pack10:      'https://buy.stripe.com/dRm9ASh2RgPo5wOaZE5Rm02',
  sport:       'https://buy.stripe.com/eVq14m13TdDc1gy0l05Rm03',
  nutrition:   'https://buy.stripe.com/fZu6oG8wlar0aR83xc5Rm04',
  sport_nutri: 'https://buy.stripe.com/00w6oGh2RdDc5wO2t85Rm05',
}

const SUBSCRIPTIONS = {
  presentiel:                 { label: 'Présentiel',                    price: null, hasPresentiel: true,  hasOnline: false },
  domicile:                   { label: 'Coaching à domicile',           price: null, hasPresentiel: false, hasOnline: false },
  sport_online:               { label: 'Sport en ligne',                price: 59,   hasPresentiel: false, hasOnline: true  },
  nutrition:                  { label: 'Nutrition',                     price: 119,  hasPresentiel: false, hasOnline: true  },
  sport_nutrition:            { label: 'Sport + Nutrition',             price: 149,  hasPresentiel: false, hasOnline: true  },
  presentiel_sport:           { label: 'Présentiel + Sport',            price: 59,   hasPresentiel: true,  hasOnline: true  },
  presentiel_nutrition:       { label: 'Présentiel + Nutrition',        price: 119,  hasPresentiel: true,  hasOnline: true  },
  presentiel_sport_nutrition: { label: 'Présentiel + Sport + Nutrition',price: 149,  hasPresentiel: true,  hasOnline: true  },
}

export default function Dashboard({ profile, setProfile }) {
  const [bookings, setBookings] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [msg, setMsg] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [bookingSlot, setBookingSlot] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const sub = SUBSCRIPTIONS[profile.subscription_type] || null
  const hasPresentiel = !profile.subscription_type || sub?.hasPresentiel
  const hasOnline = sub?.hasOnline || false
  const isAbonne = hasOnline

  useEffect(() => {
    loadBookings()
    if (hasPresentiel) loadSlots()
  }, [])

  async function loadBookings() {
    const { data } = await supabase
      .from('bookings').select('*, time_slots(*)')
      .eq('client_id', profile.id).eq('status', 'confirmed')
      .order('created_at', { ascending: false })
    setBookings(data || [])
  }

  async function loadSlots() {
    setLoadingSlots(true)
    const { data } = await supabase
      .from('time_slots')
      .select('*')
      .eq('is_available', true)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(10)
    setAvailableSlots(data || [])
    setLoadingSlots(false)
  }

  async function bookSlot(slotId) {
    if (bookingSlot) return
    setBookingSlot(slotId)
    try {
      const res = await fetch('/api/book-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, clientId: profile.id })
      })
      const data = await res.json()
      if (data.success) {
        setProfile(p => ({ ...p, credits: data.creditsLeft }))
        setMsg({ type: 'success', text: 'Séance réservée ! Yoann te confirmera sous peu.' })
        loadBookings()
        loadSlots()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur lors de la réservation' })
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Erreur de connexion' })
    }
    setBookingSlot(null)
  }

  async function cancelBooking(booking) {
    if (!booking.time_slots) return
    const hoursUntil = (new Date(booking.time_slots.start_time) - new Date()) / 3600000
    if (hoursUntil < 24) { setMsg({ type: 'error', text: 'Annulation impossible moins de 24h avant la séance.' }); return }
    setCancelling(booking.id)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
    await supabase.from('time_slots').update({ is_available: true }).eq('id', booking.slot_id)
    const { data: p } = await supabase.from('profiles').update({ credits: profile.credits + 1 }).eq('id', profile.id).select().single()
    setProfile(p)
    setMsg({ type: 'success', text: 'Séance annulée, crédit restitué.' })
    loadBookings()
    loadSlots()
    setCancelling(null)
  }

  const nextBooking = bookings.find(b => b.time_slots && new Date(b.time_slots.start_time) > new Date())
  const pastBookings = bookings.filter(b => b.time_slots && new Date(b.time_slots.start_time) < new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(65vw, 65vh)', height: 'min(65vw, 65vh)',
        backgroundImage: 'url(' + LOGO_URL + ')',
        backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        opacity: 0.06, pointerEvents: 'none', zIndex: 0
      }} />

      {/* DEMANDE D'ADRESSE au premier login */}
      {!profile.address && (profile.coaching_type === 'domicile' || profile.coaching_type === 'presentiel') && (
        <AddressSetup profile={profile} onComplete={() => setProfile(p => ({ ...p, address: 'set' }))} />
      )}

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
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 12 }}>x</button>
          </div>
        )}

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: hasPresentiel ? '1fr 2fr 1fr' : '2fr 1fr', gap: 16, marginBottom: 16 }}>

          {hasPresentiel && (
            <div style={s.statCard}>
              <div style={s.statLabel}>Crédits</div>
              <div style={{ ...s.statValue, color: profile.credits > 0 ? GOLD : '#f87171' }}>{profile.credits || 0}</div>
              <div style={s.statSub}>séances disponibles</div>
            </div>
          )}

          <div style={s.statCard}>
            <div style={s.statLabel}>Prochaine séance</div>
            {nextBooking ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 500, margin: '8px 0 4px' }}>{formatDate(nextBooking.time_slots.start_time)}</div>
                <div style={s.statSub}>{formatTime(nextBooking.time_slots.start_time)} — ON AIR BNF Paris 13e</div>
                <button onClick={() => cancelBooking(nextBooking)} disabled={cancelling === nextBooking.id} style={s.btnCancel}>
                  {cancelling === nextBooking.id ? '...' : 'Annuler (si > 24h avant)'}
                </button>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--muted)', margin: '12px 0' }}>Aucune séance prévue</div>
            )}
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Mon abonnement</div>
            <div style={{ fontSize: 14, fontWeight: 500, margin: '8px 0' }}>{sub ? sub.label : '— Aucun —'}</div>
            {sub?.price && (
              <div style={{ fontSize: 26, fontWeight: 600, color: GOLD, fontFamily: 'Outfit, sans-serif', margin: '4px 0' }}>
                {sub.price}<span style={{ fontSize: 16 }}>€</span><span style={{ fontSize: 13, fontWeight: 300, color: 'var(--muted)' }}>/mois</span>
              </div>
            )}
            {sub?.price && (
              <button
                onClick={() => {
                  const text = encodeURIComponent('Bonjour Yoann, je souhaite résilier mon abonnement ' + sub.label + ' à la fin du mois. Merci.')
                  window.open(WHATSAPP + '?text=' + text, '_blank')
                }}
                style={{ ...s.btnCancel, marginTop: 12, fontSize: 11 }}
              >
                Résilier mon abonnement
              </button>
            )}
          </div>
        </div>

        {/* CALENDRIER DE RÉSERVATION */}
        {(hasPresentiel || profile.subscription_type === 'domicile') && profile.credits > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Réserver une séance</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
              Tu as {profile.credits} crédit{profile.credits > 1 ? 's' : ''} — sélectionne un jour disponible
            </div>
            <BookingCalendar
              profile={profile}
              onBooked={(creditsLeft) => {
                setProfile(p => ({ ...p, credits: creditsLeft }))
                setMsg({ type: 'success', text: 'Séance réservée ! Yoann te confirmera sous peu.' })
                loadBookings()
              }}
            />
          </div>
        )}

        {/* ZÉRO CRÉDIT */}
        {hasPresentiel && !profile.credits && (
          <div style={{ ...s.ctaBar, borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.04)', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: '#f87171' }}>Aucun crédit disponible</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Achète des séances ci-dessous pour réserver.</div>
            </div>
          </div>
        )}

        {/* ACHETER DES SÉANCES */}
        {hasPresentiel && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Acheter des séances</div>

            <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Payer sur place</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Espèces ou CB — Yoann t'ajoute le crédit après réception</div>
              </div>
              <a href={WHATSAPP + '?text=Bonjour%20Yoann%2C%20je%20souhaite%20r%C3%A9server%20une%20s%C3%A9ance%20et%20r%C3%A9gler%20sur%20place.%20Peux-tu%20m%27ajouter%20un%20cr%C3%A9dit%20%3F'} target="_blank" style={s.btnGold}>
                Contacter Yoann
              </a>
            </div>

            {isAbonne && (
              <div style={{ fontSize: 12, color: GOLD, marginBottom: 20, padding: '8px 14px', background: 'rgba(196,151,58,0.08)', borderRadius: 6, border: '1px solid rgba(196,151,58,0.2)' }}>
                Tarif abonné — séances à 50€ au lieu de 60€
              </div>
            )}

            <div style={s.offresGrid}>
              <div style={s.offreCard}>
                <div style={s.offreLabel}>A l'unité</div>
                <div style={s.offreTitle}>Séance individuelle</div>
                <div style={s.offrePrix}>
                  <span style={s.prixMain}>{isAbonne ? '50€' : '60€'}</span>
                  {isAbonne && <span style={s.prixBarre}>60€</span>}
                  <span style={s.prixPer}>/séance</span>
                </div>
                <a href={isAbonne ? STRIPE.seance_50 : STRIPE.seance_60} target="_blank" style={s.btnOffreGold}>Payer</a>
                <div style={s.offreNote}>ou espèces sur place</div>
              </div>

              <div style={s.offreCard}>
                <div style={s.offreLabel}>Pack 5 séances</div>
                <div style={s.offreTitle}>Programme Court</div>
                <div style={s.offrePrix}>
                  <span style={s.prixMain}>{isAbonne ? '250€' : '275€'}</span>
                  {isAbonne && <span style={s.prixBarre}>275€</span>}
                  <span style={s.prixPer}>{isAbonne ? '50€' : '55€'}/séance</span>
                </div>
                <div style={s.saving}>Économie {isAbonne ? '50€' : '25€'}</div>
                <a href={isAbonne ? STRIPE.pack5_250 : STRIPE.pack5_275} target="_blank" style={s.btnOffreGold}>Acheter</a>
                <div style={s.offreNote}>valable 3 mois</div>
              </div>

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
                <a href={STRIPE.pack10} target="_blank" style={s.btnOffreGold}>Acheter</a>
                <div style={s.offreNote}>valable 6 mois</div>
              </div>
            </div>
          </div>
        )}

        {/* ABONNEMENTS EN LIGNE */}
        {!hasOnline && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Coaching en ligne</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
              Programmes personnalisés — sport, nutrition ou les deux. Suivi hebdomadaire avec Yoann.
            </div>
            <div style={s.offresGrid}>
              <div style={s.offreCard}>
                <div style={s.offreLabel}>Programme</div>
                <div style={s.offreTitle}>Sport en ligne</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Programme d'entraînement 100% personnalisé + suivi hebdomadaire</div>
                <div style={s.offrePrix}>
                  <span style={s.prixMain}>59€</span>
                  <span style={s.prixPer}>/mois</span>
                </div>
                <a href={STRIPE.sport} target="_blank" style={s.btnOffreGold}>Souscrire</a>
              </div>

              <div style={s.offreCard}>
                <div style={s.offreLabel}>Programme</div>
                <div style={s.offreTitle}>Nutrition</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Plan nutritionnel personnalisé + suivi et ajustements mensuels</div>
                <div style={s.offrePrix}>
                  <span style={s.prixMain}>119€</span>
                  <span style={s.prixPer}>/mois</span>
                </div>
                <a href={STRIPE.nutrition} target="_blank" style={s.btnOffreGold}>Souscrire</a>
              </div>

              <div style={{ ...s.offreCard, borderColor: 'rgba(196,151,58,0.4)', background: 'linear-gradient(135deg, #161410 0%, var(--surface) 100%)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: GOLD, color: '#000', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 10px', borderRadius: '0 0 6px 6px' }}>
                  POPULAIRE
                </div>
                <div style={s.offreLabel}>Programme complet</div>
                <div style={s.offreTitle}>Sport + Nutrition</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Entraînement + nutrition + suivi complet</div>
                <div style={s.offrePrix}>
                  <span style={s.prixMain}>149€</span>
                  <span style={s.prixPer}>/mois</span>
                </div>
                <div style={s.saving}>Économie 29€</div>
                <a href={STRIPE.sport_nutri} target="_blank" style={s.btnOffreGold}>Souscrire</a>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16, textAlign: 'center' }}>
              Après paiement, Yoann te contacte sous 24h pour démarrer ton programme.
            </div>
          </div>
        )}

        {/* SÉANCES À VENIR */}
        {bookings.filter(b => b.time_slots && new Date(b.time_slots.start_time) > new Date()).length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Mes séances à venir</div>
            {bookings.filter(b => b.time_slots && new Date(b.time_slots.start_time) > new Date()).map(b => (
              <div key={b.id} style={{ ...s.bookingRow, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{formatDate(b.time_slots.start_time)}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTime(b.time_slots.start_time)} — ON AIR BNF Paris 13e</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 4, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Confirmé</span>
              </div>
            ))}
          </div>
        )}

        {/* HISTORIQUE */}
        {pastBookings.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Historique des séances</div>
            {pastBookings.map(b => (
              <div key={b.id} style={{ ...s.bookingRow, marginBottom: 8, opacity: 0.7 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{b.time_slots ? formatDate(b.time_slots.start_time) : 'Séance passée'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.time_slots ? formatTime(b.time_slots.start_time) + ' — ON AIR BNF' : ''}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)' }}>Passée</span>
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
            <a href={WHATSAPP + '?text=Bonjour%20Yoann%2C%20j%27ai%20une%20question.'} target="_blank" style={s.btnGold}>Envoyer un message</a>
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
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]
}

function formatTime(iso) {
  const d = new Date(iso)
  return d.getHours().toString().padStart(2,'0') + 'h' + d.getMinutes().toString().padStart(2,'0')
}

const s = {
  nav: { position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', background:'rgba(8,8,8,0.95)', backdropFilter:'blur(8px)', borderBottom:'1px solid var(--border)' },
  navLogo: { fontFamily:'Cormorant Garamond, serif', fontSize:18, fontWeight:400 },
  container: { maxWidth:900, margin:'0 auto', padding:'40px 24px' },
  msgBox: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderRadius:8, border:'1px solid', fontSize:13, marginBottom:24 },
  statCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'24px' },
  statLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)', marginBottom:8 },
  statValue: { fontFamily:'Outfit, sans-serif', fontSize:52, fontWeight:600, lineHeight:1 },
  statSub: { fontSize:12, color:'var(--muted)', marginTop:4 },
  ctaBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 28px', background:'rgba(196,151,58,0.06)', border:'1px solid rgba(196,151,58,0.2)', borderRadius:12, flexWrap:'wrap', gap:16 },
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
