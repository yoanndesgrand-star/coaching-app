import { useState, useEffect, useRef } from 'react'

var GOLD = '#C4973A'

var MODES = [
  { k: 'countdown', l: '⏳ Compte à rebours', desc: 'Décompte simple avec presets' },
  { k: 'tabata', l: '🔥 Tabata', desc: 'Intervalles haute intensité' },
  { k: 'amrap', l: '💪 AMRAP', desc: 'Max de tours en un temps donné' },
  { k: 'emom', l: '⏰ EMOM', desc: 'Chaque minute, en minute' },
  { k: 'fortime', l: '⏱️ For Time', desc: 'Chrono ascendant' }
]

var PRESETS = [
  { label: '00:30', sec: 30 },
  { label: '00:45', sec: 45 },
  { label: '01:00', sec: 60 },
  { label: '01:30', sec: 90 },
  { label: '02:00', sec: 120 },
  { label: '03:00', sec: 180 }
]

export default function Timer() {
  var [mode, setMode] = useState('countdown')
  var [config, setConfig] = useState({ work: 40, rest: 20, rounds: 8, totalMin: 10, emomInterval: 60, forTimeCapMin: 20 })
  var [active, setActive] = useState(false)
  var [sec, setSec] = useState(0)
  var [round, setRound] = useState(0)
  var [phase, setPhase] = useState('idle')
  var [forTimeRound, setForTimeRound] = useState(0)
  var [cdSec, setCdSec] = useState(60)
  var [cdCustomMin, setCdCustomMin] = useState(1)
  var [cdCustomSec, setCdCustomSec] = useState(0)
  var intervalRef = useRef(null)
  var audioCtx = useRef(null)
  var secRef = useRef(0)
  var roundRef = useRef(0)
  var phaseRef = useRef('idle')
  var endTimeRef = useRef(null)

  useEffect(function() { return function() { if (intervalRef.current) clearInterval(intervalRef.current) } }, [])

  useEffect(function() {
    function onVis() {
      if (document.visibilityState === 'visible' && endTimeRef.current && active) {
        var remaining = Math.round((endTimeRef.current - Date.now()) / 1000)
        if (mode === 'countdown') {
          if (remaining <= 0) {
            clearInterval(intervalRef.current)
            setSec(0); secRef.current = 0
            playBeep(true)
            setPhase('done'); setActive(false)
            endTimeRef.current = null
          } else {
            setSec(remaining); secRef.current = remaining
          }
        }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return function() { document.removeEventListener('visibilitychange', onVis) }
  }, [active, mode])

  function unlockAudio() {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      audioCtx.current.resume()
      var buf = audioCtx.current.createBuffer(1, 1, 22050)
      var src = audioCtx.current.createBufferSource()
      src.buffer = buf; src.connect(audioCtx.current.destination); src.start(0)
    } catch(e) {}
  }

  function playBeep(high) {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      var ctx = audioCtx.current; ctx.resume()
      var freqs = high ? [1047, 1047, 1319] : [880, 988, 1047]
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freqs[i]; g.gain.value = 0.8
        o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.12)
      }
    } catch(e) {}
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]) } catch(e) {}
  }

  function playTick() {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      var ctx = audioCtx.current; ctx.resume()
      var o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880; g.gain.value = 0.3
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.06)
    } catch(e) {}
    try { if (navigator.vibrate) navigator.vibrate(80) } catch(e) {}
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    endTimeRef.current = null
    setActive(false); setPhase('idle'); setSec(0); setRound(0); setForTimeRound(0)
  }

  function startCountdown3(then) {
    setPhase('countdown'); setSec(3); secRef.current = 3
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(function() {
      secRef.current--; setSec(secRef.current)
      if (secRef.current > 0) playTick()
      if (secRef.current <= 0) {
        clearInterval(intervalRef.current); playBeep(true); then()
      }
    }, 1000)
  }

  function startCd(seconds) {
    unlockAudio()
    setActive(true); setCdSec(seconds); setPhase('work')
    secRef.current = seconds; setSec(seconds)
    endTimeRef.current = Date.now() + seconds * 1000
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(function() {
      secRef.current--; setSec(secRef.current)
      if (secRef.current <= 3 && secRef.current > 0) playTick()
      if (secRef.current <= 0) {
        clearInterval(intervalRef.current); playBeep(true)
        endTimeRef.current = null; setPhase('done'); setActive(false)
      }
    }, 1000)
  }

  function resetCd() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    endTimeRef.current = null; setActive(false); setPhase('idle'); setSec(0)
  }

  function start() {
    unlockAudio(); setActive(true)

    if (mode === 'tabata') {
      startCountdown3(function() {
        setPhase('work'); setRound(1); roundRef.current = 1; phaseRef.current = 'work'
        secRef.current = config.work; setSec(config.work)
        intervalRef.current = setInterval(function() {
          secRef.current--; setSec(secRef.current)
          if (secRef.current <= 3 && secRef.current > 0) playTick()
          if (secRef.current <= 0) {
            playBeep(phaseRef.current === 'rest')
            if (phaseRef.current === 'work') {
              phaseRef.current = 'rest'; setPhase('rest')
              secRef.current = config.rest; setSec(config.rest)
            } else {
              roundRef.current++; setRound(roundRef.current)
              if (roundRef.current > config.rounds) { clearInterval(intervalRef.current); setPhase('done'); setActive(false); return }
              phaseRef.current = 'work'; setPhase('work')
              secRef.current = config.work; setSec(config.work)
            }
          }
        }, 1000)
      })
    } else if (mode === 'amrap') {
      startCountdown3(function() {
        setPhase('work'); setRound(0); setForTimeRound(0)
        var totalSec = config.totalMin * 60
        secRef.current = totalSec; setSec(totalSec)
        intervalRef.current = setInterval(function() {
          secRef.current--; setSec(secRef.current)
          if (secRef.current <= 3 && secRef.current > 0) playTick()
          if (secRef.current <= 0) { clearInterval(intervalRef.current); playBeep(true); setPhase('done'); setActive(false) }
        }, 1000)
      })
    } else if (mode === 'emom') {
      startCountdown3(function() {
        setPhase('work'); setRound(1); roundRef.current = 1
        secRef.current = config.emomInterval; setSec(config.emomInterval)
        intervalRef.current = setInterval(function() {
          secRef.current--; setSec(secRef.current)
          if (secRef.current <= 3 && secRef.current > 0) playTick()
          if (secRef.current <= 0) {
            roundRef.current++; setRound(roundRef.current)
            if (roundRef.current > config.totalMin) { clearInterval(intervalRef.current); playBeep(true); setPhase('done'); setActive(false); return }
            playBeep(false); secRef.current = config.emomInterval; setSec(config.emomInterval)
          }
        }, 1000)
      })
    } else if (mode === 'fortime') {
      startCountdown3(function() {
        setPhase('work'); setForTimeRound(0); secRef.current = 0; setSec(0)
        var capSec = config.forTimeCapMin * 60
        intervalRef.current = setInterval(function() {
          secRef.current++; setSec(secRef.current)
          if (secRef.current > 0 && secRef.current % 60 === 0) playTick()
          if (capSec > 0 && secRef.current >= capSec) { clearInterval(intervalRef.current); playBeep(true); setPhase('done'); setActive(false) }
        }, 1000)
      })
    }
  }

  function finish() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    playBeep(true); setPhase('done'); setActive(false)
  }

  var minutes = Math.floor(Math.abs(sec) / 60)
  var seconds2 = Math.abs(sec) % 60
  var timeStr = String(minutes).padStart(2, '0') + ':' + String(seconds2).padStart(2, '0')

  var phaseColor = phase === 'rest' ? '#4ade80' : phase === 'work' ? (mode === 'fortime' ? GOLD : 'var(--text)') : phase === 'countdown' ? '#fb923c' : GOLD
  var phaseLabel = phase === 'countdown' ? '⏳ Prêt...' : phase === 'work' ? (mode === 'tabata' ? '🔥 EXERCICE' : mode === 'amrap' ? '💪 GO !' : mode === 'emom' ? '⏰ GO !' : '⏱️ En cours') : phase === 'rest' ? '😮‍💨 REPOS' : phase === 'done' ? '🎉 Terminé !' : ''

  /* ═══ MODE SELECTOR (shared) ═══ */
  var modeSelector = (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
      {MODES.map(function(m) {
        var selected = mode === m.k
        return <button key={m.k} onClick={function() { if (active) return; setMode(m.k); setPhase('idle'); setSec(0) }} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid', borderColor: selected ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: selected ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: selected ? GOLD : 'var(--text)', cursor: active ? 'default' : 'pointer', fontFamily: 'Outfit', fontSize: 12, fontWeight: 500, opacity: active && !selected ? 0.4 : 1, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s' }}>{m.l}</button>
      })}
    </div>
  )

  /* ═══ COUNTDOWN MODE ═══ */
  if (mode === 'countdown') {
    var progress = cdSec > 0 && active ? (sec / cdSec) : (phase === 'done' ? 0 : 1)
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>⏱️ Timer</div>
        {modeSelector}

        {/* Big display */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {(active || phase === 'done') && <div style={{ fontSize: 16, color: phase === 'done' ? '#4ade80' : GOLD, marginBottom: 8, fontWeight: 600 }}>{phase === 'done' ? '🎉 Terminé !' : '⏳ En cours...'}</div>}
          <div style={{ fontSize: 96, fontWeight: 700, fontFamily: 'Outfit', color: active ? (sec <= 5 ? '#f87171' : '#fff') : 'var(--muted)', lineHeight: 1, marginBottom: 8, transition: 'color 0.3s' }}>
            {active || phase === 'done' ? timeStr : '--:--'}
          </div>
          {active && <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (progress * 100) + '%', background: sec <= 5 ? '#f87171' : GOLD, borderRadius: 4, transition: 'width 1s linear' }} />
          </div>}
        </div>

        {/* Presets */}
        {!active && phase !== 'done' && <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {PRESETS.map(function(p) {
              return <button key={p.sec} onClick={function() { startCd(p.sec) }} style={{ padding: '28px 14px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 24, fontWeight: 600, transition: 'all 0.2s', boxShadow: 'var(--shadow)' }}>{p.label}</button>
            })}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontWeight: 500 }}>⚙️ Durée personnalisée</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><div style={S.label}>Minutes</div><input type="number" min="0" max="99" value={cdCustomMin} onChange={function(e) { setCdCustomMin(parseInt(e.target.value) || 0) }} style={S.numInput} /></div>
              <div><div style={S.label}>Secondes</div><input type="number" min="0" max="59" value={cdCustomSec} onChange={function(e) { setCdCustomSec(Math.min(59, parseInt(e.target.value) || 0)) }} style={S.numInput} /></div>
            </div>
            <button onClick={function() { var total = cdCustomMin * 60 + cdCustomSec; if (total > 0) startCd(total) }} style={S.btnStart}>▶ Démarrer</button>
          </div>
        </div>}

        {active && <div style={{ display: 'flex', gap: 10 }}><button onClick={resetCd} style={{ ...S.btnStop, flex: 1 }}>Réinitialiser</button></div>}
        {phase === 'done' && !active && <div style={{ textAlign: 'center' }}><button onClick={function() { setPhase('idle'); setSec(0) }} style={S.btnStart}>🔄 Nouveau compte à rebours</button></div>}
      </div>
    )
  }

  /* ═══ OTHER MODES ═══ */
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <button onClick={function(){ window.history.back() }} style={{background:'none',border:'none',color:'#C4973A',fontSize:13,cursor:'pointer',fontFamily:'Outfit',padding:'4px 0',marginBottom:8}}>← Retour</button>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>⏱️ Timer</div>
      {modeSelector}

      {!active && phase !== 'done' && <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px', marginBottom: 20, boxShadow: 'var(--shadow)' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>{MODES.find(function(m) { return m.k === mode }).desc}</div>
        {mode === 'tabata' && <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div><div style={S.label}>Exercice (sec)</div><input type="number" value={config.work} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { work: parseInt(e.target.value) || 20 }) }) }} style={S.numInput} /></div>
            <div><div style={S.label}>Repos (sec)</div><input type="number" value={config.rest} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { rest: parseInt(e.target.value) || 10 }) }) }} style={S.numInput} /></div>
          </div>
          <div><div style={S.label}>Nombre de tours</div><input type="number" value={config.rounds} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { rounds: parseInt(e.target.value) || 1 }) }) }} style={S.numInput} /></div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, textAlign: 'center' }}>Durée totale : {Math.floor((config.work + config.rest) * config.rounds / 60)}min {((config.work + config.rest) * config.rounds) % 60}s</div>
        </div>}
        {mode === 'amrap' && <div><div style={S.label}>Durée (minutes)</div><input type="number" value={config.totalMin} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { totalMin: parseInt(e.target.value) || 1 }) }) }} style={S.numInputBig} /></div>}
        {mode === 'emom' && <div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><div style={S.label}>Minutes totales</div><input type="number" value={config.totalMin} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { totalMin: parseInt(e.target.value) || 1 }) }) }} style={S.numInput} /></div>
          <div><div style={S.label}>Intervalle (sec)</div><input type="number" value={config.emomInterval} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { emomInterval: parseInt(e.target.value) || 60 }) }) }} style={S.numInput} /></div>
        </div></div>}
        {mode === 'fortime' && <div><div style={S.label}>Time cap (minutes) — 0 = illimité</div><input type="number" value={config.forTimeCapMin} onChange={function(e) { setConfig(function(c) { return Object.assign({}, c, { forTimeCapMin: parseInt(e.target.value) || 0 }) }) }} style={S.numInputBig} /></div>}
      </div>}

      {(active || phase === 'done') && <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
        {phaseLabel && <div style={{ fontSize: 16, color: phaseColor, marginBottom: 12, fontWeight: 600 }}>{phaseLabel}</div>}
        <div style={{ fontSize: 84, fontWeight: 700, fontFamily: 'Outfit', color: phaseColor, lineHeight: 1, marginBottom: 8 }}>{timeStr}</div>
        {mode === 'tabata' && active && phase !== 'countdown' && <div style={{ fontSize: 14, color: 'var(--muted)' }}>Tour {round}/{config.rounds}</div>}
        {mode === 'emom' && active && phase !== 'countdown' && <div style={{ fontSize: 14, color: 'var(--muted)' }}>Minute {round}/{config.totalMin}</div>}
        {mode === 'amrap' && (active || phase === 'done') && <div style={{ fontSize: 14, color: 'var(--muted)' }}>{forTimeRound} tour{forTimeRound > 1 ? 's' : ''}</div>}
        {mode === 'fortime' && (active || phase === 'done') && <div style={{ fontSize: 14, color: 'var(--muted)' }}>{forTimeRound} tour{forTimeRound > 1 ? 's' : ''}</div>}
      </div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {!active && phase !== 'done' && <button onClick={start} style={S.btnStart}>▶ Démarrer</button>}
        {active && <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={stop} style={S.btnStop}>⏹ Arrêter</button>
          {(mode === 'amrap' || mode === 'fortime') && phase === 'work' && <button onClick={function() { setForTimeRound(function(r) { return r + 1 }) }} style={S.btnRound}>+1 Tour</button>}
          {mode === 'fortime' && phase === 'work' && <button onClick={finish} style={S.btnFinish}>✓ Fini !</button>}
        </div>}
        {phase === 'done' && <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#4ade80', marginBottom: 16 }}>
            {mode === 'amrap' && forTimeRound + ' tour' + (forTimeRound > 1 ? 's' : '') + ' en ' + config.totalMin + ' min'}
            {mode === 'fortime' && forTimeRound + ' tour' + (forTimeRound > 1 ? 's' : '') + ' en ' + timeStr}
            {mode === 'tabata' && config.rounds + ' tours terminés !'}
            {mode === 'emom' && config.totalMin + ' minutes terminées !'}
          </div>
          <button onClick={function() { setPhase('idle'); setSec(0); setRound(0); setForTimeRound(0) }} style={S.btnStart}>🔄 Nouveau timer</button>
        </div>}
      </div>
    </div>
  )
}

var S = {
  label: { fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 500 },
  numInput: { width: '100%', padding: '10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2, var(--surface))', color: 'var(--text)', fontFamily: 'Outfit', fontSize: 18, textAlign: 'center', fontWeight: 600, boxSizing: 'border-box', transition: 'border-color 0.2s', outline: 'none' },
  numInputBig: { width: '100%', padding: '14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2, var(--surface))', color: 'var(--text)', fontFamily: 'Outfit', fontSize: 28, textAlign: 'center', fontWeight: 700, boxSizing: 'border-box', transition: 'border-color 0.2s', outline: 'none' },
  btnStart: { width: '100%', padding: '16px', background: GOLD, color: '#000', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(196,151,58,0.25)' },
  btnStop: { flex: 1, padding: '14px 24px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 14, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s' },
  btnRound: { flex: 1, padding: '14px 24px', background: 'rgba(196,151,58,0.1)', color: GOLD, border: '2px solid rgba(196,151,58,0.3)', borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s' },
  btnFinish: { flex: 1, padding: '14px 24px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '2px solid rgba(74,222,128,0.3)', borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', transition: 'all 0.2s' }
}
