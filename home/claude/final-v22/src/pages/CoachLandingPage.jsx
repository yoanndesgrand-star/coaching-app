import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function CoachLandingPage({ coachBrand, coachId }) {
  var [offers, setOffers] = useState([])
  var [locations, setLocations] = useState([])
  var G = coachBrand.color || '#C4973A'

  useEffect(function() {
    if (!coachId) return
    supabase.from('coach_offers').select('*').eq('coach_id', coachId).eq('is_active', true).order('sort_order').then(function(r) { setOffers(r.data || []) })
    supabase.from('coach_locations').select('*').eq('coach_id', coachId).eq('is_active', true).then(function(r) { setLocations(r.data || []) })
  }, [coachId])

  var name = coachBrand.name || 'Coach'
  var specialty = coachBrand.specialty || ''
  var logo = coachBrand.logo
  var noise = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")"

  return (
    <div style={{ background: '#080808', backgroundImage: noise, color: '#f0ece4', fontFamily: 'Outfit, sans-serif', minHeight: '100vh' }}>

      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'linear-gradient(to bottom, rgba(8,8,8,0.95), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {logo && <img src={logo} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />}
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 300 }}>{name.split(' ')[0]} <span style={{ color: G }}>{name.split(' ').slice(1).join(' ')}</span></div>
        </div>
        <Link to="/login" style={{ background: G, color: '#000', padding: '10px 22px', borderRadius: 6, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: 'Outfit' }}>Mon espace client</Link>
      </nav>

      <section style={{ position: 'relative', overflow: 'hidden', padding: '160px 24px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 120, background: 'linear-gradient(to bottom, transparent, ' + G + ')' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.25em', color: G }}>{specialty || 'Coach'}</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, ' + G + '40, transparent)' }} />
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(42px, 8vw, 72px)', fontWeight: 300, lineHeight: 1.05, marginBottom: 24, maxWidth: 700 }}>
            Votre <em style={{ fontStyle: 'italic', color: G }}>transformation</em> commence ici
          </h1>
          <p style={{ fontSize: 16, color: '#7a7065', lineHeight: 1.7, maxWidth: 500, marginBottom: 40 }}>
            Un accompagnement personnalisé pour atteindre vos objectifs sportifs et nutritionnels. Programme sur-mesure, suivi en temps réel.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
            {['Programme personnalisé', 'Suivi en temps réel', 'Messagerie directe'].map(function(b) {
              return <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#7a7065' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: G }} />{b}
              </span>
            })}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/login" style={{ background: G, color: '#000', padding: '16px 36px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', fontFamily: 'Outfit' }}>Réserver ma séance →</Link>
            {coachBrand.whatsapp && <a href={'https://wa.me/' + coachBrand.whatsapp.replace(/\+/g, '')} target="_blank" style={{ padding: '16px 36px', borderRadius: 8, fontSize: 15, textDecoration: 'none', fontFamily: 'Outfit', border: '1px solid #222', color: '#7a7065' }}>Me contacter</a>}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 48 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.25em', color: G }}>Services</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '🏋️', title: 'Coaching sur-mesure', desc: 'Programmes adaptés à votre niveau et vos objectifs. Chaque séance est unique.' },
            { icon: '📊', title: 'Suivi & progression', desc: 'Visualisez vos progrès en temps réel. Poids, reps, photos avant/après.' },
            { icon: '📱', title: 'Application mobile', desc: 'Votre programme accessible partout. Vidéos, exercices, timer intégré.' },
            { icon: '💬', title: 'Accompagnement', desc: 'Messagerie directe avec votre coach. Questions, ajustements, motivation.' }
          ].map(function(s, i) {
            return <div key={i} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '32px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 16 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: '#7a7065', lineHeight: 1.7 }}>{s.desc}</div>
            </div>
          })}
        </div>
      </section>

      {locations.length > 0 && <section style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.25em', color: G }}>Lieux</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {locations.map(function(loc) {
            return <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📍</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{loc.name}</div>
                <div style={{ fontSize: 12, color: '#7a7065' }}>{loc.address}</div>
              </div>
            </div>
          })}
        </div>
      </section>}

      {offers.length > 0 && <section style={{ padding: '100px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.25em', color: G }}>Tarifs</span>
          <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
        </div>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 300, marginBottom: 48 }}>Choisissez votre <em style={{ fontStyle: 'italic', color: G }}>formule</em></h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {offers.map(function(offer) {
            var featured = offer.badge
            return <div key={offer.id} style={{ background: '#111', border: featured ? '1px solid ' + G + '40' : '1px solid #1a1a1a', borderRadius: 20, padding: '36px 28px', position: 'relative' }}>
              {offer.badge && <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: G, fontWeight: 600 }}>{offer.badge}</div>}
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#555', marginBottom: 8 }}>{offer.type === 'single' ? 'Séance' : offer.type === 'pack' ? 'Pack' : 'Abonnement'}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 400, marginBottom: 16 }}>{offer.name}</div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 48, fontWeight: 300, color: G }}>{offer.price}</span>
                <span style={{ fontSize: 16, color: '#555' }}>€</span>
                {offer.original_price && <span style={{ fontSize: 16, color: '#555', textDecoration: 'line-through', marginLeft: 12 }}>{offer.original_price}€</span>}
              </div>
              {offer.description && <div style={{ fontSize: 13, color: '#7a7065', marginBottom: 16, lineHeight: 1.6 }}>{offer.description}</div>}
              <div style={{ fontSize: 12, color: '#555', marginBottom: 24, paddingTop: 16, borderTop: '1px solid #1a1a1a' }}>
                {offer.type === 'pack' ? '✓ ' + offer.credits + ' séances · ' + Math.round(offer.price / offer.credits) + '€/séance' : offer.type === 'subscription' ? '✓ ' + offer.sessions_per_week + 'x par semaine' : '✓ ' + offer.credits + ' séance' + (offer.credits > 1 ? 's' : '')}
              </div>
              <Link to="/login" style={{ display: 'block', textAlign: 'center', padding: '14px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: 'Outfit', border: featured ? 'none' : '1px solid #333', background: featured ? G : 'transparent', color: featured ? '#000' : '#7a7065' }}>Choisir cette formule</Link>
            </div>
          })}
        </div>
      </section>}

      <section style={{ position: 'relative', padding: '100px 24px', textAlign: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, ' + G + '08 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 300, marginBottom: 16 }}>Prêt à <em style={{ fontStyle: 'italic', color: G }}>commencer</em> ?</h2>
          <p style={{ fontSize: 14, color: '#7a7065', marginBottom: 32, lineHeight: 1.7 }}>Réservez votre première séance et commencez votre transformation dès aujourd'hui.</p>
          <Link to="/login" style={{ display: 'inline-block', background: G, color: '#000', padding: '16px 48px', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none', fontFamily: 'Outfit' }}>Réserver ma séance →</Link>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 24 }}>
            {coachBrand.whatsapp && <a href={'https://wa.me/' + coachBrand.whatsapp.replace(/\+/g, '')} target="_blank" style={{ color: '#7a7065', fontSize: 12, textDecoration: 'none' }}>💬 WhatsApp</a>}
            {coachBrand.reviewUrl && <a href={coachBrand.reviewUrl} target="_blank" style={{ color: '#7a7065', fontSize: 12, textDecoration: 'none' }}>⭐ Avis Google</a>}
          </div>
        </div>
      </section>

      <footer style={{ padding: '24px 40px', borderTop: '1px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#333' }}>© 2026 {name}</div>
        <div style={{ fontSize: 10, color: '#222' }}>Propulsé par Flowly</div>
      </footer>
    </div>
  )
}
