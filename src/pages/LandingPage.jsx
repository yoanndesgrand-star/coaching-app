import { useState } from 'react'
import { Link } from 'react-router-dom'

var G = '#C4973A'

var FEATURES = [
  { icon: '📅', title: 'Réservation en ligne', desc: 'Vos clients réservent 24/7. Calendrier intelligent avec gestion des trajets et créneaux automatiques.' },
  { icon: '🏋️', title: 'Programmes sportifs', desc: 'Créez des programmes avec GIFs, circuits, tabata, AMRAP, EMOM. Le client suit sa séance en autonomie.' },
  { icon: '💬', title: 'Messagerie intégrée', desc: 'Communiquez directement avec vos clients. Notifications push en temps réel.' },
  { icon: '💰', title: 'Finance & Facturation', desc: 'Suivi des revenus, génération de factures PDF, paiements par Stripe Connect.' },
  { icon: '📊', title: 'Suivi & Progression', desc: 'Graphiques de progression, records personnels, photos avant/après, bilans automatiques.' },
  { icon: '📁', title: 'Drive & Documents', desc: 'Partagez des fichiers avec vos clients. Dossiers organisés, accès sécurisé.' },
  { icon: '⏱️', title: 'Timer professionnel', desc: 'Tabata, AMRAP, EMOM, For Time, compte à rebours. Sons et vibrations intégrés.' },
  { icon: '🌐', title: 'Votre marque', desc: 'Sous-domaine personnalisé, couleurs, logo. Vos clients voient VOTRE marque, pas la nôtre.' },
]

var STEPS = [
  { n: '01', title: 'Créez votre compte', desc: 'Inscription en 2 minutes. Configurez votre branding, vos horaires et vos tarifs.' },
  { n: '02', title: 'Invitez vos clients', desc: 'Envoyez un lien. Vos clients s\'inscrivent et réservent directement depuis leur téléphone.' },
  { n: '03', title: 'Gérez tout au même endroit', desc: 'Réservations, programmes, messagerie, finance. Tout est centralisé dans une seule app.' },
]

export default function LandingPage() {
  var [email, setEmail] = useState('')

  return (
    <div style={{ background: '#080706', color: '#f0ece4', fontFamily: 'Outfit, sans-serif', minHeight: '100vh', overflow: 'hidden' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(8,7,6,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(196,151,58,0.08)' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 700, color: G }}>flowly</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/login" style={{ padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#f0ece4', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>Se connecter</Link>
          <Link to="/coach-signup" style={{ padding: '10px 20px', background: G, color: '#000', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(196,151,58,0.3)', display: 'flex', alignItems: 'center' }}>Je suis coach</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: '140px 24px 80px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(196,151,58,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, color: G, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20, fontWeight: 600 }}>La plateforme tout-en-un</div>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 600, lineHeight: 1.1, marginBottom: 24, maxWidth: 700, margin: '0 auto 24px' }}>
          Gérez votre activité.<br /><span style={{ color: G }}>Simplement.</span>
        </h1>
        <p style={{ fontSize: 17, color: '#8a8075', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px' }}>
          Réservations, programmes, messagerie, paiements — tout ce dont vous avez besoin pour gérer vos clients, dans une seule application.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/coach-signup" style={{ padding: '16px 36px', background: G, color: '#000', borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textDecoration: 'none', boxShadow: '0 4px 20px rgba(196,151,58,0.3)', transition: 'all 0.2s', letterSpacing: '0.02em' }}>Je suis coach →</Link>
          <Link to="/login" style={{ padding: '16px 36px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: '#f0ece4', fontSize: 16, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s', textDecoration: 'none' }}>Se connecter</Link>
        </div>
        <div style={{ marginTop: 40, fontSize: 12, color: '#555' }}>✓ Gratuit pour commencer · ✓ Aucune carte requise · ✓ Prêt en 2 min</div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', maxWidth: 600, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color: G }}>500+</div><div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Séances gérées</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color: G }}>50+</div><div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Clients actifs</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color: G }}>4.9★</div><div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Satisfaction</div></div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: G, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 12 }}>Fonctionnalités</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 600, marginBottom: 12 }}>Tout ce dont vous avez besoin</h2>
          <p style={{ fontSize: 14, color: '#7a7065' }}>Une seule app pour remplacer vos 5 outils actuels.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {FEATURES.map(function(f, i) {
            return <div key={i} style={{ background: '#0f0e0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '28px 20px', transition: 'all 0.3s' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(196,151,58,0.08)', border: '1px solid rgba(196,151,58,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: '#7a7065', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 24px', background: '#0c0b09', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: G, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 12 }}>Comment ça marche</div>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 600 }}>Prêt en 3 étapes</h2>
          </div>
          {STEPS.map(function(s, i) {
            return <div key={i} style={{ display: 'flex', gap: 24, marginBottom: 40, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'rgba(196,151,58,0.2)', fontFamily: 'Outfit', flexShrink: 0, width: 50, lineHeight: 1 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#7a7065', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            </div>
          })}
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: '80px 24px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, color: G, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 12 }}>Tarifs</div>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 600, marginBottom: 12 }}>Commencez gratuitement</h2>
          <p style={{ fontSize: 14, color: '#7a7065' }}>Pas de surprise. Évoluez quand vous êtes prêt.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {/* FREE */}
          <div style={{ background: '#0f0e0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '32px 24px' }}>
            <div style={{ fontSize: 13, color: '#7a7065', marginBottom: 4 }}>Starter</div>
            <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>0€<span style={{ fontSize: 14, fontWeight: 400, color: '#555' }}>/mois</span></div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 20 }}>Pour démarrer</div>
            <div style={{ fontSize: 13, color: '#8a8075', lineHeight: 2 }}>
              ✓ Jusqu'à 10 clients<br/>
              ✓ Réservation en ligne<br/>
              ✓ Messagerie<br/>
              ✓ 1 programme sportif<br/>
              ✓ Votre sous-domaine
            </div>
            <Link to="/coach-signup" style={{ display: 'block', textAlign: 'center', marginTop: 24, padding: '14px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#f0ece4', fontSize: 14, textDecoration: 'none', fontFamily: 'Outfit', transition: 'all 0.2s' }}>Commencer</Link>
          </div>

          {/* PRO */}
          <div style={{ background: '#0f0e0c', border: '2px solid rgba(196,151,58,0.4)', borderRadius: 20, padding: '32px 24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: G, color: '#000', fontSize: 10, fontWeight: 700, padding: '4px 14px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Populaire</div>
            <div style={{ fontSize: 13, color: G, marginBottom: 4 }}>Pro</div>
            <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>29€<span style={{ fontSize: 14, fontWeight: 400, color: '#555' }}>/mois</span></div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 20 }}>Pour les pros</div>
            <div style={{ fontSize: 13, color: '#8a8075', lineHeight: 2 }}>
              ✓ Clients illimités<br/>
              ✓ Programmes illimités<br/>
              ✓ Finance & Facturation<br/>
              ✓ Drive & Documents<br/>
              ✓ Stripe Connect<br/>
              ✓ Export CSV<br/>
              ✓ Support prioritaire
            </div>
            <Link to="/coach-signup" style={{ display: 'block', textAlign: 'center', marginTop: 24, padding: '14px', background: G, color: '#000', borderRadius: 12, fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: 'Outfit', boxShadow: '0 2px 8px rgba(196,151,58,0.3)', transition: 'all 0.2s' }}>Essai gratuit 14 jours</Link>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '80px 24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, background: 'radial-gradient(circle, rgba(196,151,58,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 600, marginBottom: 16 }}>Prêt à simplifier votre activité ?</h2>
        <p style={{ fontSize: 15, color: '#7a7065', marginBottom: 32 }}>Rejoignez les professionnels qui gèrent tout depuis Flowly.</p>
        <Link to="/coach-signup" style={{ padding: '18px 48px', background: G, color: '#000', borderRadius: 14, fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', textDecoration: 'none', boxShadow: '0 4px 20px rgba(196,151,58,0.3)', transition: 'all 0.2s', display: 'inline-block' }}>Créer mon compte →</Link>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: G }}>flowly</div>
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#555' }}>
          <a href="#" style={{ color: '#555', textDecoration: 'none' }}>CGU</a>
          <a href="#" style={{ color: '#555', textDecoration: 'none' }}>Confidentialité</a>
          <a href="#" style={{ color: '#555', textDecoration: 'none' }}>Contact</a>
        </div>
        <div style={{ fontSize: 11, color: '#333' }}>© 2026 Flowly. Tous droits réservés.</div>
      </footer>
    </div>
  )
}
