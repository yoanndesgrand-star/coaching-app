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
  presentiel:                 { label: 'Présentiel' },
  domicile:                   { label: 'Coaching à domicile' },
  sport_online:               { label: 'Sport en ligne' },
  nutrition:                  { label: 'Nutrition' },
  sport_nutrition:            { label: 'Sport + Nutrition' },
}

export default function Dashboard({ profile, setProfile }) {
  const [view, setView] = useState('home')
  const [bookings, setBookings] = useState([])
  const [msg, setMsg] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [editPhone, setEditPhone] = useState(profile.phone || '')
  const [editEmail, setEditEmail] = useState(profile.email || '')
  const [editAddress, setEditAddress] = useState(profile.address || '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [shopTab, setShopTab] = useState('seances')
  const [forcePw, setForcePw] = useState('')
  const [forceConfirmPw, setForceConfirmPw] = useState('')
  const [forcePwSaving, setForcePwSaving] = useState(false)
  const [forcePwError, setForcePwError] = useState('')
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'dark')

  function setTheme(t) {
    setThemeState(t)
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('theme', t)
  }

  const sub = SUBSCRIPTIONS[profile.subscription_type] || SUBSCRIPTIONS[profile.coaching_type] || null

  useEffect(function() { loadBookings() }, [])

  async function loadBookings() {
    var { data } = await supabase.from('bookings').select('*, time_slots(*)').eq('client_id', profile.id).eq('status', 'confirmed').order('created_at', { ascending: false })
    setBookings(data || [])
  }

  async function cancelBooking(booking) {
    if (!booking.time_slots) return
    var hoursUntil = (new Date(booking.time_slots.start_time) - new Date()) / 3600000
    if (hoursUntil < 24) { setMsg({ type: 'error', text: 'Annulation impossible moins de 24h avant la séance.' }); return }
    setCancelling(booking.id)
    try {
      var res = await fetch('/api/admin-actions?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id })
      })
      var data = await res.json()
      if (data.success) {
        setProfile(function(p) { return Object.assign({}, p, { credits: (p.credits || 0) + 1 }) })
        setMsg({ type: 'success', text: 'Séance annulée, crédit restitué.' })
        loadBookings()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setCancelling(null)
  }

  var nextBooking = bookings.filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) > new Date() }).sort(function(a, b) { return new Date(a.time_slots.start_time) - new Date(b.time_slots.start_time) })[0]
  var upcomingBookings = bookings.filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) > new Date() })
  var pastBookings = bookings.filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) < new Date() })
  var locationLabel = profile.coaching_type === 'domicile' ? 'À domicile' : 'ON AIR BNF Paris 13e'
  var firstName = (profile.full_name || '').split(' ')[0] || ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(65vw, 65vh)', height: 'min(65vw, 65vh)', backgroundImage: 'url(' + LOGO_URL + ')', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', opacity: 0.06, pointerEvents: 'none', zIndex: 0 }} />

      {!profile.address && (profile.coaching_type === 'domicile' || profile.coaching_type === 'presentiel') && (
        <AddressSetup profile={profile} onComplete={function() { setProfile(function(p) { return Object.assign({}, p, { address: 'set' }) }) }} />
      )}

      {/* CHANGEMENT MOT DE PASSE OBLIGATOIRE */}
      {profile.must_change_password && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 32px', maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, marginBottom: 8 }}>Bienvenue !</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.6 }}>Pour sécuriser ton compte, choisis un nouveau mot de passe.</div>
            {forcePwError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12, padding: '10px', background: 'rgba(248,113,113,0.1)', borderRadius: 8 }}>{forcePwError}</div>}
            <div style={{ marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Nouveau mot de passe</div>
              <input type="password" value={forcePw} onChange={function(e) { setForcePw(e.target.value) }} placeholder="6 caractères minimum" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Confirmer</div>
              <input type="password" value={forceConfirmPw} onChange={function(e) { setForceConfirmPw(e.target.value) }} placeholder="Confirmer le mot de passe" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={async function() {
              setForcePwError('')
              if (forcePw.length < 6) { setForcePwError('Le mot de passe doit faire au moins 6 caractères.'); return }
              if (forcePw !== forceConfirmPw) { setForcePwError('Les mots de passe ne correspondent pas.'); return }
              setForcePwSaving(true)
              var res = await supabase.auth.updateUser({ password: forcePw })
              if (res.error) { setForcePwError(res.error.message); setForcePwSaving(false); return }
              await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id)
              setProfile(function(p) { return Object.assign({}, p, { must_change_password: false }) })
              setForcePwSaving(false)
            }} disabled={forcePwSaving} style={{ width: '100%', background: GOLD, color: '#000', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              {forcePwSaving ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </div>
        </div>
      )}

      <nav style={s.nav}>
        <div style={s.navLogo}>Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {view !== 'home' && <button onClick={function() { setView('home') }} style={s.btnNav}>← Accueil</button>}
          <button onClick={function() { supabase.auth.signOut() }} style={s.btnNav}>Déconnexion</button>
        </div>
      </nav>

      {msg && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 8, border: '1px solid', fontSize: 13, borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', background: msg.type === 'success' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            <span>{msg.text}</span>
            <button onClick={function() { setMsg(null) }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        </div>
      )}

      <div style={s.container}>

        {view === 'home' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, marginBottom: 6 }}>
                {firstName ? ('Bonjour ' + firstName) : 'Bienvenue'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {nextBooking ? 'Prochaine séance : ' + formatDate(nextBooking.time_slots.start_time) + ' à ' + formatTime(nextBooking.time_slots.start_time) : 'Aucune séance prévue'}
              </div>
            </div>

            <div style={s.tilesGrid}>
              <button onClick={function() { setView('booking') }} style={s.tile}>
                <div style={s.tileIcon}>📅</div>
                <div style={s.tileTitle}>Réserver</div>
                <div style={s.tileSub}>{(profile.credits || 0)} crédit{(profile.credits || 0) > 1 ? 's' : ''}</div>
              </button>
              <button onClick={function() { setView('account') }} style={s.tile}>
                <div style={s.tileIcon}>👤</div>
                <div style={s.tileTitle}>Mon compte</div>
                <div style={s.tileSub}>{upcomingBookings.length} séance{upcomingBookings.length > 1 ? 's' : ''} à venir</div>
              </button>
              <button onClick={function() { setView('shop') }} style={s.tile}>
                <div style={s.tileIcon}>🛒</div>
                <div style={s.tileTitle}>Acheter</div>
                <div style={s.tileSub}>Séances & abonnements</div>
              </button>
              <button onClick={function() { setView('settings') }} style={s.tile}>
                <div style={s.tileIcon}>⚙️</div>
                <div style={s.tileTitle}>Paramètres</div>
                <div style={s.tileSub}>Profil & infos</div>
              </button>
              <a href={WHATSAPP + '?text=Bonjour%20Yoann%2C%20j%27ai%20une%20question.'} target="_blank" style={{ ...s.tile, textDecoration: 'none', color: 'var(--text)' }}>
                <div style={s.tileIcon}>💬</div>
                <div style={s.tileTitle}>Contact</div>
                <div style={s.tileSub}>WhatsApp</div>
              </a>
            </div>

            {nextBooking && (
              <div style={s.nextCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={s.nextDate}>
                    <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{new Date(nextBooking.time_slots.start_time).getDate()}</div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)' }}>{['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][new Date(nextBooking.time_slots.start_time).getMonth()]}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{formatTime(nextBooking.time_slots.start_time)} — {locationLabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{formatDate(nextBooking.time_slots.start_time)}</div>
                  </div>
                </div>
                {(new Date(nextBooking.time_slots.start_time) - new Date()) / 3600000 >= 24 ? (
                  <button onClick={function() { cancelBooking(nextBooking) }} disabled={cancelling === nextBooking.id} style={s.btnCancel}>{cancelling === nextBooking.id ? '...' : 'Annuler'}</button>
                ) : (
                  <a href={WHATSAPP + '?text=' + encodeURIComponent('Bonjour Yoann, je ne pourrai pas être présent(e) à ma séance du ' + formatDate(nextBooking.time_slots.start_time) + '. Raison : ')} target="_blank" style={{ textDecoration: 'none' }}><button style={s.btnCancel}>Contacter</button></a>
                )}
              </div>
            )}

          </div>
        )}

        {view === 'booking' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}>
              <div style={s.viewTitle}>Réserver une séance</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{profile.credits || 0} crédit{(profile.credits || 0) > 1 ? 's' : ''} disponible{(profile.credits || 0) > 1 ? 's' : ''}</div>
            </div>
            {(profile.credits || 0) > 0 || profile.no_credit_required ? (
              <BookingCalendar profile={profile} onBooked={function(creditsLeft) { setProfile(function(p) { return Object.assign({}, p, { credits: creditsLeft }) }); loadBookings() }} />
            ) : (
              <div style={s.emptyCard}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Aucun crédit</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Achète des séances pour pouvoir réserver.</div>
                <button onClick={function() { setView('shop') }} style={s.btnGold}>Acheter des séances</button>
              </div>
            )}
          </div>
        )}

        {view === 'account' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Mon compte</div></div>
            <div style={s.statsRow}>
              <div style={s.statCard}><div style={s.statLabel}>Crédits</div><div style={{ fontFamily: 'Outfit', fontSize: 40, fontWeight: 600, color: GOLD, marginTop: 8 }}>{profile.credits || 0}</div></div>
              <div style={s.statCard}><div style={s.statLabel}>Abonnement</div><div style={{ fontSize: 15, fontWeight: 500, marginTop: 8 }}>{sub ? sub.label : '— Aucun —'}</div></div>
              <div style={s.statCard}><div style={s.statLabel}>Lieu</div><div style={{ fontSize: 13, marginTop: 8, color: 'var(--muted)' }}>{locationLabel}</div></div>
            </div>
            {upcomingBookings.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Séances à venir</div>
                {upcomingBookings.map(function(b) { return (
                  <div key={b.id} style={s.bookingRow}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(b.time_slots.start_time)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTime(b.time_slots.start_time)} — {locationLabel}</div>
                    </div>
                    {(new Date(b.time_slots.start_time) - new Date()) / 3600000 >= 24 ? (
                      <button onClick={function() { cancelBooking(b) }} disabled={cancelling === b.id} style={s.btnCancel}>{cancelling === b.id ? '...' : 'Annuler'}</button>
                    ) : (
                      <a href={WHATSAPP + '?text=' + encodeURIComponent('Bonjour Yoann, concernant ma séance du ' + formatDate(b.time_slots.start_time) + '...')} target="_blank" style={{ textDecoration: 'none' }}><button style={s.btnCancel}>Contacter</button></a>
                    )}
                  </div>
                ) })}
              </div>
            )}
            {pastBookings.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Historique</div>
                {pastBookings.slice(0, 5).map(function(b) { return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, opacity: 0.5 }}>
                    <div><div style={{ fontSize: 13 }}>{formatDate(b.time_slots.start_time)}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTime(b.time_slots.start_time)}</div></div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Terminée</span>
                  </div>
                ) })}
              </div>
            )}
          </div>
        )}

        {view === 'shop' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Acheter & Souscrire</div></div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <button onClick={function() { setShopTab('seances') }} style={{ ...s.shopTabBtn, ...(shopTab === 'seances' ? { borderColor: GOLD, color: GOLD, background: 'rgba(196,151,58,0.08)' } : {}) }}>🏋️ Séances de coaching</button>
              <button onClick={function() { setShopTab('abonnements') }} style={{ ...s.shopTabBtn, ...(shopTab === 'abonnements' ? { borderColor: GOLD, color: GOLD, background: 'rgba(196,151,58,0.08)' } : {}) }}>📱 Abonnements en ligne</button>
            </div>

            {/* Current subscription banner */}
            {sub && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 10, marginBottom: 20 }}>
                <div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Mon abonnement actuel</div><div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>⭐ {sub.label}</div></div>
                <div style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>{profile.credits || 0} crédits</div>
              </div>
            )}

            {/* SÉANCES */}
            {shopTab === 'seances' && (
              <div>
                <div style={s.contactBar}>
                  <div><div style={{ fontSize: 14, fontWeight: 500 }}>Payer sur place</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Espèces ou CB</div></div>
                  <a href={WHATSAPP + '?text=Bonjour%20Yoann%2C%20je%20souhaite%20acheter%20des%20séances.'} target="_blank" style={s.btnGoldSmall}>Contacter</a>
                </div>
                <div style={s.shopGrid}>
                  <div style={s.shopCard}>
                    <div style={s.shopLabel}>À l'unité</div>
                    <div style={s.shopTitle}>Séance individuelle</div>
                    <div style={s.shopPrice}>{profile.coaching_type === 'domicile' ? '60€' : '50€'}<span style={s.shopPer}>/séance</span></div>
                    <a href={profile.coaching_type === 'domicile' ? STRIPE.seance_60 : STRIPE.seance_50} target="_blank" style={s.btnShop}>Payer</a>
                  </div>
                  <div style={s.shopCard}>
                    <div style={s.shopLabel}>Pack 5</div>
                    <div style={s.shopTitle}>Programme Court</div>
                    <div style={s.shopPrice}>{profile.coaching_type === 'domicile' ? '275€' : '250€'}<span style={s.shopPer}> {profile.coaching_type === 'domicile' ? '55€' : '50€'}/séance</span></div>
                    <div style={s.shopSaving}>Économie {profile.coaching_type === 'domicile' ? '25€' : '50€'}</div>
                    <a href={profile.coaching_type === 'domicile' ? STRIPE.pack5_275 : STRIPE.pack5_250} target="_blank" style={s.btnShop}>Payer</a>
                  </div>
                  <div style={{ ...s.shopCard, borderColor: GOLD, position: 'relative' }}>
                    <div style={s.shopBest}>Meilleure offre</div>
                    <div style={s.shopLabel}>Pack 10</div>
                    <div style={s.shopTitle}>Programme SHIFT</div>
                    <div style={s.shopPrice}>500€<span style={s.shopPer}> 50€/séance</span></div>
                    <div style={s.shopSaving}>Économie 100€</div>
                    <a href={STRIPE.pack10} target="_blank" style={s.btnShop}>Payer</a>
                  </div>
                </div>
              </div>
            )}

            {/* ABONNEMENTS */}
            {shopTab === 'abonnements' && (
              <div>
                <div style={s.shopGrid}>
                  <div style={s.shopCard}>
                    <div style={s.shopLabel}>Sport</div>
                    <div style={s.shopTitle}>Programme Sport en ligne</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>Programme d'entraînement personnalisé accessible depuis ton téléphone.</div>
                    <div style={s.shopPrice}>59€<span style={s.shopPer}>/mois</span></div>
                    <a href={STRIPE.sport} target="_blank" style={s.btnShop}>Souscrire</a>
                  </div>
                  <div style={s.shopCard}>
                    <div style={s.shopLabel}>Nutrition</div>
                    <div style={s.shopTitle}>Suivi Nutritionnel</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>Plan alimentaire personnalisé avec suivi hebdomadaire.</div>
                    <div style={s.shopPrice}>119€<span style={s.shopPer}>/mois</span></div>
                    <a href={STRIPE.nutrition} target="_blank" style={s.btnShop}>Souscrire</a>
                  </div>
                  <div style={{ ...s.shopCard, borderColor: GOLD, position: 'relative' }}>
                    <div style={s.shopBest}>Meilleure offre</div>
                    <div style={s.shopLabel}>Sport + Nutrition</div>
                    <div style={s.shopTitle}>Programme Complet</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>Sport en ligne + suivi nutritionnel combinés.</div>
                    <div style={s.shopPrice}>149€<span style={s.shopPer}>/mois</span></div>
                    <div style={s.shopSaving}>Économie 29€/mois</div>
                    <a href={STRIPE.sport_nutri} target="_blank" style={s.btnShop}>Souscrire</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Mes paramètres</div></div>
            <div style={s.settingsCard}>
              <div style={s.settingsField}><div style={s.settingsLabel}>Nom</div><div style={{ fontSize: 15, padding: '12px 0' }}>{profile.full_name || '—'}</div></div>
              <div style={s.settingsField}><div style={s.settingsLabel}>Email</div><input type="email" value={editEmail} onChange={function(e) { setEditEmail(e.target.value) }} style={s.settingsInput} /><div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Un email de confirmation sera envoyé.</div></div>
              <div style={s.settingsField}><div style={s.settingsLabel}>Téléphone</div><input type="tel" value={editPhone} onChange={function(e) { setEditPhone(e.target.value) }} placeholder="06 12 34 56 78" style={s.settingsInput} /></div>
              {profile.coaching_type === 'domicile' && (
                <div style={s.settingsField}><div style={s.settingsLabel}>Adresse domicile</div><input type="text" value={editAddress} onChange={function(e) { setEditAddress(e.target.value) }} placeholder="Ex: 39 rue Gustave Eiffel, Clichy" style={s.settingsInput} /><div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Pour calculer les temps de trajet.</div></div>
              )}
              {profile.coaching_type === 'presentiel' && (
                <div style={s.settingsField}><div style={s.settingsLabel}>Lieu</div><div style={{ fontSize: 13, padding: '12px 0', color: 'var(--muted)' }}>📍 ON AIR BNF — 93 av. de France, Paris 13e</div></div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0', paddingTop: 20 }}>
                <div style={s.settingsField}>
                  <div style={s.settingsLabel}>Apparence</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={function() { setTheme('dark') }} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: theme === 'dark' ? 'rgba(196,151,58,0.15)' : 'var(--surface)', borderColor: theme === 'dark' ? 'rgba(196,151,58,0.4)' : 'var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>🌙 Sombre</button>
                    <button onClick={function() { setTheme('light') }} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: theme === 'light' ? 'rgba(196,151,58,0.15)' : 'var(--surface)', borderColor: theme === 'light' ? 'rgba(196,151,58,0.4)' : 'var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>☀️ Clair</button>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0', paddingTop: 20 }}>
                <div style={s.settingsField}><div style={s.settingsLabel}>Nouveau mot de passe</div><input type="password" value={newPassword} onChange={function(e) { setNewPassword(e.target.value) }} placeholder="Laisser vide pour ne pas changer" style={s.settingsInput} /></div>
                <div style={s.settingsField}><div style={s.settingsLabel}>Confirmer le mot de passe</div><input type="password" value={confirmPassword} onChange={function(e) { setConfirmPassword(e.target.value) }} placeholder="Confirmer le nouveau mot de passe" style={s.settingsInput} /></div>
              </div>
              <button onClick={async function() {
                setSavingSettings(true)
                var updates = { phone: editPhone.trim() }
                if (profile.coaching_type === 'domicile') updates.address = editAddress.trim()
                await supabase.from('profiles').update(updates).eq('id', profile.id)
                setProfile(function(p) { return Object.assign({}, p, updates) })
                if (editEmail.trim() !== profile.email) {
                  var res1 = await supabase.auth.updateUser({ email: editEmail.trim() })
                  if (res1.error) setMsg({ type: 'error', text: 'Erreur email : ' + res1.error.message })
                  else setMsg({ type: 'success', text: 'Confirmation envoyée à ' + editEmail.trim() })
                }
                if (newPassword) {
                  if (newPassword.length < 6) {
                    setMsg({ type: 'error', text: 'Le mot de passe doit faire au moins 6 caractères.' })
                    setSavingSettings(false); return
                  }
                  if (newPassword !== confirmPassword) {
                    setMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
                    setSavingSettings(false); return
                  }
                  var res2 = await supabase.auth.updateUser({ password: newPassword })
                  if (res2.error) { setMsg({ type: 'error', text: 'Erreur mot de passe : ' + res2.error.message }); setSavingSettings(false); return }
                  setNewPassword(''); setConfirmPassword('')
                  setMsg({ type: 'success', text: 'Mot de passe mis à jour.' })
                }
                if (!msg) setMsg({ type: 'success', text: 'Paramètres mis à jour.' })
                setSavingSettings(false); setView('home')
              }} disabled={savingSettings} style={{ ...s.btnGold, width: '100%', marginTop: 8, textAlign: 'center' }}>
                {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

      </div>
      <style>{"@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }"}</style>
    </div>
  )
}

function formatDate(iso) {
  var d = new Date(iso)
  var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]
}

function formatTime(iso) {
  var d = new Date(iso)
  return d.getHours().toString().padStart(2,'0') + 'h' + d.getMinutes().toString().padStart(2,'0')
}

var s = {
  nav: { position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', background:'var(--bg)', backdropFilter:'blur(8px)', borderBottom:'1px solid var(--border)' },
  navLogo: { fontFamily:'Cormorant Garamond, serif', fontSize:18, fontWeight:400 },
  btnNav: { background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'Outfit, sans-serif' },
  container: { maxWidth:900, margin:'0 auto', padding:'32px 20px', position:'relative', zIndex:1 },
  tilesGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:14, marginBottom:24 },
  tile: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 20px', cursor:'pointer', fontFamily:'Outfit, sans-serif', textAlign:'center', transition:'all 0.2s', display:'flex', flexDirection:'column', alignItems:'center', gap:6 },
  tileIcon: { fontSize:32, marginBottom:4 },
  tileTitle: { fontSize:15, fontWeight:500, color:'var(--text)' },
  tileSub: { fontSize:12, color:'var(--muted)' },
  nextCard: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', background:'rgba(196,151,58,0.06)', border:'1px solid rgba(196,151,58,0.2)', borderRadius:12, marginBottom:16 },
  nextDate: { width:48, height:48, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  contactBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, marginBottom:16 },
  viewHeader: { marginBottom:24 },
  viewTitle: { fontFamily:'Cormorant Garamond, serif', fontSize:26, marginBottom:4 },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20 },
  statCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'20px' },
  statLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)' },
  section: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'24px', marginBottom:16 },
  sectionTitle: { fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#C4973A', marginBottom:16 },
  bookingRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, marginBottom:8 },
  emptyCard: { textAlign:'center', padding:'48px 24px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16 },
  shopGrid: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginTop:16 },
  shopTabBtn: { flex:1, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:8, padding:'12px 16px', fontSize:13, cursor:'pointer', fontFamily:'Outfit, sans-serif', transition:'all 0.2s' },
  shopCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'24px 18px', display:'flex', flexDirection:'column', gap:8 },
  shopLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)' },
  shopTitle: { fontFamily:'Cormorant Garamond, serif', fontSize:19 },
  shopPrice: { fontSize:24, fontWeight:600, color:'#C4973A', fontFamily:'Outfit, sans-serif' },
  shopPer: { fontSize:12, color:'var(--muted)', fontWeight:400 },
  shopSaving: { fontSize:11, fontWeight:600, color:'#C4973A', background:'rgba(196,151,58,0.1)', padding:'3px 8px', borderRadius:4, width:'fit-content' },
  shopBest: { position:'absolute', top:-10, right:16, background:'#C4973A', color:'#000', fontSize:10, fontWeight:600, padding:'4px 10px', borderRadius:4, textTransform:'uppercase' },
  btnShop: { display:'block', textAlign:'center', background:'#C4973A', color:'#000', borderRadius:8, padding:'12px', fontSize:13, fontWeight:500, textDecoration:'none', marginTop:'auto' },
  settingsCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'32px 28px' },
  settingsField: { marginBottom:20 },
  settingsLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:6 },
  settingsInput: { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', color:'var(--text)', fontSize:14, fontFamily:'Outfit, sans-serif', outline:'none', boxSizing:'border-box' },
  btnGold: { background:'#C4973A', color:'#000', border:'none', borderRadius:8, padding:'13px 24px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Outfit, sans-serif', textDecoration:'none', display:'inline-block' },
  btnGoldSmall: { background:'#C4973A', color:'#000', border:'none', borderRadius:8, padding:'10px 18px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'Outfit, sans-serif', textDecoration:'none', whiteSpace:'nowrap' },
  btnCancel: { background:'transparent', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'Outfit, sans-serif' },
}
