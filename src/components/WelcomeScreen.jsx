import { useState } from 'react'

var GOLD = '#C4973A'

export default function WelcomeScreen({ name, onDismiss }) {
  var [step, setStep] = useState(0)
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  var isAndroid = /Android/.test(navigator.userAgent)
  var isMobile = isIOS || isAndroid

  var steps = isIOS ? [
    { icon: '👆', title: 'Appuie sur le bouton partager', desc: 'En bas de Safari (le carré avec la flèche vers le haut)', visual: 'share-ios' },
    { icon: '➕', title: 'Sur l\'écran d\'accueil', desc: 'Fais défiler et appuie sur "Sur l\'écran d\'accueil"', visual: 'add-ios' },
    { icon: '✅', title: 'Appuie sur Ajouter', desc: 'L\'app apparaît sur ton écran comme une vraie application !', visual: 'done' }
  ] : isAndroid ? [
    { icon: '⋮', title: 'Ouvre le menu', desc: 'Appuie sur les 3 points en haut à droite de Chrome', visual: 'menu-android' },
    { icon: '📲', title: 'Installer l\'application', desc: 'Appuie sur "Installer l\'application" ou "Ajouter à l\'écran d\'accueil"', visual: 'install-android' },
    { icon: '✅', title: 'C\'est installé !', desc: 'L\'app est maintenant sur ton écran d\'accueil !', visual: 'done' }
  ] : [
    { icon: '💻', title: 'Tu es sur ordinateur', desc: 'Pour la meilleure expérience, ouvre l\'app depuis ton téléphone et ajoute-la à ton écran d\'accueil.', visual: 'desktop' }
  ]

  // Welcome screen (step 0)
  if (step === 0) {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, marginBottom: 4 }}>
            Bienvenue{name ? ' ' + name.split(' ')[0] : ''} !
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
            Pour une meilleure expérience, installe l'app sur ton écran d'accueil.
          </div>

          {isMobile && <button onClick={function() { setStep(1) }} style={S.btnGold}>
            📲 Comment faire ?
          </button>}

          <button onClick={function() { onDismiss() }} style={S.btnSkip}>
            {isMobile ? 'Plus tard' : 'C\'est noté !'}
          </button>
        </div>
      </div>
    )
  }

  // Instruction steps
  var currentStep = steps[step - 1]
  if (!currentStep) { onDismiss(); return null }
  var isLast = step >= steps.length

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
          {steps.map(function(_, i) {
            return <div key={i} style={{ width: i === step - 1 ? 24 : 8, height: 8, borderRadius: 4, background: i === step - 1 ? GOLD : 'var(--border)', transition: 'all 0.3s ease' }} />
          })}
        </div>

        {/* Visual illustration */}
        <div style={S.visualBox}>
          {currentStep.visual === 'share-ios' && <ShareIOSVisual />}
          {currentStep.visual === 'add-ios' && <AddIOSVisual />}
          {currentStep.visual === 'menu-android' && <MenuAndroidVisual />}
          {currentStep.visual === 'install-android' && <InstallAndroidVisual />}
          {currentStep.visual === 'done' && <DoneVisual />}
          {currentStep.visual === 'desktop' && <DesktopVisual />}
        </div>

        <div style={{ fontSize: 36, marginBottom: 8 }}>{currentStep.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{currentStep.title}</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 24 }}>{currentStep.desc}</div>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {step > 1 && <button onClick={function() { setStep(step - 1) }} style={S.btnBack}>←</button>}
          {!isLast ? (
            <button onClick={function() { setStep(step + 1) }} style={{ ...S.btnGold, flex: 1 }}>Suivant →</button>
          ) : (
            <button onClick={function() { onDismiss() }} style={{ ...S.btnGold, flex: 1 }}>✓ C'est fait !</button>
          )}
        </div>
        <button onClick={function() { onDismiss() }} style={S.btnSkip}>Passer</button>
      </div>
    </div>
  )
}

// === VISUAL ILLUSTRATIONS ===

function ShareIOSVisual() {
  return (
    <div style={S.phoneMock}>
      <div style={S.phoneBar}>
        <div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.3)' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>app.yoanndesgrand.fr</div>
      <div style={S.phoneBottom}>
        <div style={{ fontSize: 12, opacity: 0.4 }}>◁</div>
        <div style={{ animation: 'pulseGlow 1.5s ease infinite', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 3v9M8 7l4-4 4 4" /></svg>
          <div style={{ fontSize: 8, color: '#007AFF', marginTop: 2, fontWeight: 600 }}>ICI</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.4 }}>▷</div>
      </div>
    </div>
  )
}

function AddIOSVisual() {
  return (
    <div style={S.phoneMock}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>Partager</div>
      </div>
      <div style={{ padding: '8px 12px', flex: 1 }}>
        <div style={{ ...S.menuItem, opacity: 0.4 }}>📋 Copier</div>
        <div style={{ ...S.menuItem, opacity: 0.4 }}>📧 Envoyer par mail</div>
        <div style={{ ...S.menuItem, animation: 'pulseGlow 1.5s ease infinite', background: 'rgba(0,122,255,0.15)', borderRadius: 8 }}>
          <span>➕</span> <span style={{ color: '#007AFF', fontWeight: 600 }}>Sur l'écran d'accueil</span>
        </div>
      </div>
    </div>
  )
}

function MenuAndroidVisual() {
  return (
    <div style={S.phoneMock}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>app.yoanndesgrand.fr</div>
        <div style={{ animation: 'pulseGlow 1.5s ease infinite', fontSize: 18, color: '#fff', letterSpacing: 1 }}>⋮</div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Appuie sur les 3 points ↗</div>
      </div>
    </div>
  )
}

function InstallAndroidVisual() {
  return (
    <div style={S.phoneMock}>
      <div style={{ padding: '8px 12px', flex: 1 }}>
        <div style={{ ...S.menuItem, opacity: 0.4 }}>⭐ Favoris</div>
        <div style={{ ...S.menuItem, opacity: 0.4 }}>📥 Téléchargements</div>
        <div style={{ ...S.menuItem, animation: 'pulseGlow 1.5s ease infinite', background: 'rgba(74,222,128,0.15)', borderRadius: 8 }}>
          <span>📲</span> <span style={{ color: '#4ade80', fontWeight: 600 }}>Installer l'application</span>
        </div>
        <div style={{ ...S.menuItem, opacity: 0.4 }}>🏠 Écran d'accueil</div>
      </div>
    </div>
  )
}

function DoneVisual() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '20px 0' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #1a1510, #2a2015)', border: '1px solid rgba(196,151,58,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', animation: 'scaleIn 0.5s ease' }}>
        <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 16, color: GOLD, fontWeight: 700 }}>YD</span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', maxWidth: 120 }}>Ton app coaching est sur ton écran d'accueil !</div>
    </div>
  )
}

function DesktopVisual() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 48 }}>📱</div>
    </div>
  )
}

// === STYLES ===
var S = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.4s ease' },
  card: { background: 'var(--surface, #141210)', border: '1px solid var(--border, #2a2520)', borderRadius: 20, padding: '32px 24px', maxWidth: 360, width: '100%', textAlign: 'center', animation: 'scaleIn 0.4s ease', color: 'var(--text, #f0ece4)' },
  btnGold: { width: '100%', padding: '14px', background: GOLD, color: '#000', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(196,151,58,0.25)' },
  btnSkip: { width: '100%', padding: '10px', background: 'none', border: 'none', color: 'var(--muted, #7a7065)', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', marginTop: 8 },
  btnBack: { padding: '14px 18px', background: 'var(--surface2, rgba(255,255,255,0.05))', color: 'var(--text, #f0ece4)', border: '1px solid var(--border, #2a2520)', borderRadius: 12, fontSize: 15, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  phoneMock: { width: 180, height: 200, margin: '0 auto 16px', background: '#1a1a1a', borderRadius: 16, border: '2px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontSize: 12, color: '#fff' },
  phoneBar: { padding: '8px 0', display: 'flex', justifyContent: 'center' },
  phoneBottom: { padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  menuItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  visualBox: { marginBottom: 8 }
}
