import { useState, useRef } from 'react'

var GOLD = '#C4973A'

// SwipeRow — swipe left to reveal actions, long press for menu
export function SwipeRow({ children, actions, onLongPress, style }) {
  var [offset, setOffset] = useState(0)
  var [swiped, setSwiped] = useState(false)
  var startX = useRef(0)
  var startY = useRef(0)
  var moving = useRef(false)
  var longTimer = useRef(null)
  var actionsWidth = (actions || []).length * 60

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    moving.current = false
    if (onLongPress) {
      longTimer.current = setTimeout(function() {
        if (!moving.current) onLongPress()
      }, 600)
    }
  }

  function onTouchMove(e) {
    var dx = e.touches[0].clientX - startX.current
    var dy = e.touches[0].clientY - startY.current
    if (Math.abs(dy) > Math.abs(dx)) { clearTimeout(longTimer.current); return }
    if (Math.abs(dx) > 10) {
      moving.current = true
      clearTimeout(longTimer.current)
    }
    if (swiped) {
      var newOff = -actionsWidth + dx
      setOffset(Math.max(-actionsWidth, Math.min(0, newOff)))
    } else {
      if (dx < -10) setOffset(Math.max(-actionsWidth, dx))
    }
  }

  function onTouchEnd() {
    clearTimeout(longTimer.current)
    if (offset < -actionsWidth / 2) {
      setOffset(-actionsWidth); setSwiped(true)
    } else {
      setOffset(0); setSwiped(false)
    }
  }

  function close() { setOffset(0); setSwiped(false) }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10, marginBottom: 6 }}>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', zIndex: 1 }}>
        {(actions || []).map(function(a, i) {
          return <button key={i} onClick={function() { close(); if (a.onClick) a.onClick() }} style={{ width: 60, border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', fontFamily: 'Outfit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2, background: a.color || '#333' }}>
            <span>{a.icon}</span>
            {a.label && <span style={{ fontSize: 8, fontWeight: 500 }}>{a.label}</span>}
          </button>
        })}
      </div>
      <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onClick={function() { if (swiped) close() }} style={Object.assign({}, style || {}, { transform: 'translateX(' + offset + 'px)', transition: moving.current ? 'none' : 'transform 0.25s ease', position: 'relative', zIndex: 2, background: 'var(--surface)' })}>
        {children}
      </div>
    </div>
  )
}

// LongPressMenu — bottom sheet menu
export function LongPressMenu({ show, title, options, onClose }) {
  if (!show) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={function(e) { e.stopPropagation() }} style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '20px', width: '100%', maxWidth: 480 }}>
        {title && <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, textAlign: 'center' }}>{title}</div>}
        {options.map(function(opt, i) {
          return <button key={i} onClick={function() { onClose(); if (opt.onClick) opt.onClick() }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 14, color: opt.danger ? '#f87171' : 'var(--text)', textAlign: 'left' }}>
            {opt.icon && <span style={{ fontSize: 18 }}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        })}
        <button onClick={onClose} style={{ width: '100%', padding: '14px', background: 'var(--surface2)', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 14, color: 'var(--muted)', marginTop: 10 }}>Annuler</button>
      </div>
    </div>
  )
}

// InfoBubble — small info button with tooltip
export function InfoBubble({ text }) {
  var [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={function(e) { e.stopPropagation(); setShow(!show) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--muted)', padding: '0 4px', fontFamily: 'Outfit' }}>ℹ️</button>
      {show && <div onClick={function() { setShow(false) }} style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#f0ece4', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, lineHeight: 1.6, width: 240, zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', marginBottom: 6 }}>
        {text}
        <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #1a1a1a' }} />
      </div>}
    </span>
  )
}

// OnboardingGuide — step-by-step first launch guide
export function OnboardingGuide({ steps, storageKey, onDone }) {
  var [step, setStep] = useState(0)
  var [dismissed, setDismissed] = useState(function() {
    try { return localStorage.getItem(storageKey) === 'done' } catch(e) { return false }
  })

  if (dismissed) return null

  function next() {
    if (step >= steps.length - 1) {
      try { localStorage.setItem(storageKey, 'done') } catch(e) {}
      setDismissed(true)
      if (onDone) onDone()
    } else {
      setStep(step + 1)
    }
  }

  function skip() {
    try { localStorage.setItem(storageKey, 'done') } catch(e) {}
    setDismissed(true)
    if (onDone) onDone()
  }

  var s = steps[step]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '32px 24px', maxWidth: 360, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{s.emoji}</div>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, marginBottom: 8 }}>{s.title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>{s.text}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {steps.map(function(_, i) { return <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? GOLD : 'var(--border)', transition: 'all 0.3s' }} /> })}
        </div>
        <button onClick={next} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '14px 32px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit', width: '100%', marginBottom: 8 }}>{step >= steps.length - 1 ? 'C\'est parti !' : 'Suivant →'}</button>
        <button onClick={skip} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>Passer</button>
      </div>
    </div>
  )
}
