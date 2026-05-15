import { useState, useEffect, useRef } from 'react'

var GOLD = '#C4973A'

var MODE_INFO = {
  circuit: { name: 'Circuit', emoji: '🔄', desc: 'Enchaîne les exercices avec les temps de travail et repos indiqués. Les exercices défilent automatiquement.' },
  tabata: { name: 'Tabata', emoji: '⚡', desc: 'Intervalles haute intensité. Par défaut 20s d\'effort / 10s de repos, 8 rounds par exercice. Donne tout pendant le travail !' },
  amrap: { name: 'AMRAP', emoji: '💀', desc: 'As Many Rounds As Possible. Fais le plus de tours possible dans le temps imparti. Note ton nombre de tours !' },
  fortime: { name: 'For Time', emoji: '⏱️', desc: 'Termine tous les exercices le plus vite possible. Le chrono tourne, à toi de battre ton record !' },
  emom: { name: 'EMOM', emoji: '⏰', desc: 'Every Minute On the Minute. Au début de chaque minute, réalise l\'exercice prescrit. Le temps restant est ton repos.' }
}

export default function CircuitPlayer({ session, mode, settings, onClose }) {
  var exercises = (session.program_exercises || []).sort(function(a, b) { return a.order_index - b.order_index })

  // Preload all exercise GIFs into browser cache
  useEffect(function() {
    exercises.forEach(function(pe) {
      var url = pe.exercises && pe.exercises.gif_url
      if (url) { var img = new Image(); img.src = url }
    })
  }, [])

  var [phase, setPhase] = useState('ready') // ready, countdown, work, rest, pause, done
  var [exIdx, setExIdx] = useState(0)
  var [round, setRound] = useState(1)
  var [totalRounds, setTotalRounds] = useState(settings.rounds || 1)
  var [timer, setTimer] = useState(0)
  var [globalTimer, setGlobalTimer] = useState(0)
  var [globalRunning, setGlobalRunning] = useState(false)
  var [amrapRounds, setAmrapRounds] = useState(0)
  var timerRef = useRef(null)
  var globalRef = useRef(null)
  var audioCtx = useRef(null)

  var currentPE = exercises[exIdx]
  var currentEx = currentPE ? currentPE.exercises : null

  // Tabata defaults
  var tabataWork = settings.tabata_work || 20
  var tabataRest = settings.tabata_rest || 10
  var tabataRounds = settings.tabata_rounds || 8

  // AMRAP/ForTime duration
  var totalDuration = settings.duration || 600 // 10 min default

  // EMOM duration per minute
  var emomMinutes = settings.emom_minutes || exercises.length

  useEffect(function() {
    return function() { clearAll() }
  }, [])

  function clearAll() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (globalRef.current) clearInterval(globalRef.current)
  }

  function playBeep(high) {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300])
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      var ctx = audioCtx.current; ctx.resume()
      var freq = high ? [1047, 1047, 1319] : [660, 660, 880]
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = freq[i]; g.gain.value = 0.8
        o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.12)
      }
    } catch(e) {}
  }

  function playTick() {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      var ctx = audioCtx.current; ctx.resume()
      var o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880; g.gain.value = 0.2
      o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.08)
    } catch(e) {}
    if (navigator.vibrate) navigator.vibrate(100)
  }

  function startCountdown(then) {
    setPhase('countdown'); setTimer(3)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(function() {
      setTimer(function(t) {
        if (t <= 1) { clearInterval(timerRef.current); playBeep(true); then(); return 0 }
        playTick(); return t - 1
      })
    }, 1000)
  }

  function runTimer(seconds, onDone) {
    setTimer(seconds)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(function() {
      setTimer(function(t) {
        if (t <= 4 && t > 1) playTick()
        if (t <= 1) { clearInterval(timerRef.current); playBeep(false); onDone(); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function startGlobalTimer() {
    setGlobalTimer(0); setGlobalRunning(true)
    if (globalRef.current) clearInterval(globalRef.current)
    globalRef.current = setInterval(function() {
      setGlobalTimer(function(t) { return t + 1 })
    }, 1000)
  }

  function startGlobalCountdown(seconds) {
    setGlobalTimer(seconds); setGlobalRunning(true)
    if (globalRef.current) clearInterval(globalRef.current)
    globalRef.current = setInterval(function() {
      setGlobalTimer(function(t) {
        if (t <= 1) { clearInterval(globalRef.current); setGlobalRunning(false); playBeep(true); setPhase('done'); try{if(navigator.vibrate)navigator.vibrate([300,100,300,100,500])}catch(e){}; return 0 }
        return t - 1
      })
    }, 1000)
  }

  var fmt = function(s) { return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60) }

  // ═══ START FUNCTIONS PER MODE ═══
  function startCircuit() {
    startCountdown(function() {
      startGlobalTimer()
      startWorkPhase(0, 1)
    })
  }

  function startWorkPhase(ei, rd) {
    setExIdx(ei); setRound(rd); setPhase('work')
    var pe = exercises[ei]
    var dur = pe ? (parseInt(pe.rep_min) || 40) : 40
    runTimer(dur, function() {
      // Rest phase
      // Rest/transition phase
      var restDur = pe ? (pe.rest_seconds || 10) : 10
      if (restDur < 5) restDur = 5 // minimum 5s for transition preview
      setPhase('rest'); try{if(navigator.vibrate)navigator.vibrate([200,100,200])}catch(e){}
      runTimer(restDur, function() {
        // Next exercise
        var nextEi = ei + 1
        if (nextEi >= exercises.length) {
          // End of round
          if (rd < totalRounds) {
            startWorkPhase(0, rd + 1)
          } else {
            clearAll(); setGlobalRunning(false); setPhase('done'); try{if(navigator.vibrate)navigator.vibrate([300,100,300,100,500])}catch(e){}
          }
        } else {
          startWorkPhase(nextEi, rd)
        }
      })
    })
  }

  function startTabata() {
    startCountdown(function() {
      startGlobalTimer()
      runTabataSet(0, 1)
    })
  }

  function runTabataSet(ei, rd) {
    setExIdx(ei); setRound(rd); setPhase('work')
    runTimer(tabataWork, function() {
      setPhase('rest'); try{if(navigator.vibrate)navigator.vibrate([200,100,200])}catch(e){}
      runTimer(tabataRest, function() {
        var nextRd = rd + 1
        if (nextRd > tabataRounds) {
          var nextEi = ei + 1
          if (nextEi >= exercises.length) {
            clearAll(); setGlobalRunning(false); setPhase('done'); try{if(navigator.vibrate)navigator.vibrate([300,100,300,100,500])}catch(e){}
          } else {
            runTabataSet(nextEi, 1)
          }
        } else {
          runTabataSet(ei, nextRd)
        }
      })
    })
  }

  function startAmrap() {
    startCountdown(function() {
      startGlobalCountdown(totalDuration)
      setExIdx(0); setRound(1); setPhase('work'); setAmrapRounds(0)
    })
  }

  function amrapNext() {
    var nextEi = exIdx + 1
    if (nextEi >= exercises.length) {
      setExIdx(0); setAmrapRounds(function(r) { return r + 1 })
    } else {
      setExIdx(nextEi)
    }
  }

  function startForTime() {
    startCountdown(function() {
      startGlobalTimer()
      setExIdx(0); setPhase('work')
    })
  }

  function forTimeNext() {
    var nextEi = exIdx + 1
    if (nextEi >= exercises.length) {
      clearAll(); setGlobalRunning(false); setPhase('done'); try{if(navigator.vibrate)navigator.vibrate([300,100,300,100,500])}catch(e){}
    } else {
      setExIdx(nextEi)
    }
  }

  function startEmom() {
    startCountdown(function() {
      startGlobalCountdown(emomMinutes * 60)
      runEmomMinute(0)
    })
  }

  function runEmomMinute(ei) {
    setExIdx(ei); setPhase('work')
    var pe = exercises[ei]
    // No auto-timer for EMOM - the global timer handles minutes
    // But we show which exercise to do
    runTimer(60, function() {
      var nextEi = (ei + 1) % exercises.length
      if (globalRunning) runEmomMinute(nextEi)
    })
  }

  function handleStart() {
    // Unlock audio
    // Unlock audio — silent buffer trick to bypass iOS silent switch
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      audioCtx.current.resume()
      var buf = audioCtx.current.createBuffer(1, 1, 22050)
      var src = audioCtx.current.createBufferSource()
      src.buffer = buf; src.connect(audioCtx.current.destination); src.start(0)
    } catch(e) {}

    if (mode === 'circuit') startCircuit()
    else if (mode === 'tabata') startTabata()
    else if (mode === 'amrap') startAmrap()
    else if (mode === 'fortime') startForTime()
    else if (mode === 'emom') startEmom()
  }

  var info = MODE_INFO[mode] || MODE_INFO.circuit

  // ═══ READY ═══
  if (phase === 'ready') {
    return (
      <div style={S.full}>
        <div style={{textAlign:'center',padding:'48px 24px'}}>
          <div style={{width:80,height:80,borderRadius:20,background:'rgba(196,151,58,0.08)',border:'1px solid rgba(196,151,58,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,margin:'0 auto 16px'}}>{info.emoji}</div>
          <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:28,marginBottom:8}}>{info.name}</div>
          <div style={{fontSize:13,color:'#7a7065',lineHeight:1.7,marginBottom:24,maxWidth:340,margin:'0 auto 24px'}}>{info.desc}</div>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:20}}>
            <div style={{background:'rgba(196,151,58,0.08)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:12,padding:'10px 16px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:GOLD}}>{exercises.length}</div><div style={{fontSize:9,color:'#7a7065',textTransform:'uppercase',letterSpacing:'0.1em'}}>exercices</div></div>
            {totalRounds > 1 && <div style={{background:'rgba(196,151,58,0.08)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:12,padding:'10px 16px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:GOLD}}>{totalRounds}</div><div style={{fontSize:9,color:'#7a7065',textTransform:'uppercase',letterSpacing:'0.1em'}}>tours</div></div>}
            {mode === 'amrap' && <div style={{background:'rgba(196,151,58,0.08)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:12,padding:'10px 16px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:GOLD}}>{fmt(totalDuration)}</div><div style={{fontSize:9,color:'#7a7065',textTransform:'uppercase',letterSpacing:'0.1em'}}>durée</div></div>}
            {mode === 'tabata' && <div style={{background:'rgba(196,151,58,0.08)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:12,padding:'10px 16px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:GOLD}}>{tabataWork}/{tabataRest}s</div><div style={{fontSize:9,color:'#7a7065',textTransform:'uppercase',letterSpacing:'0.1em'}}>work/rest</div></div>}
            {mode === 'emom' && <div style={{background:'rgba(196,151,58,0.08)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:12,padding:'10px 16px',textAlign:'center'}}><div style={{fontSize:18,fontWeight:700,color:GOLD}}>{emomMinutes}</div><div style={{fontSize:9,color:'#7a7065',textTransform:'uppercase',letterSpacing:'0.1em'}}>minutes</div></div>}
          </div>
          <div style={{marginBottom:24}}>
            {exercises.map(function(pe, i) {
              var ex = pe.exercises
              return <div key={i} style={{display:'flex',gap:12,alignItems:'center',padding:'8px 12px',maxWidth:320,margin:'0 auto',background:'rgba(255,255,255,0.02)',borderRadius:10,marginBottom:4}}>
                <div style={{fontSize:12,color:GOLD,width:22,height:22,borderRadius:6,background:'rgba(196,151,58,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,flexShrink:0}}>{i+1}</div>
                {ex && ex.gif_url && <img src={ex.gif_url} style={{width:32,height:32,borderRadius:8,objectFit:'cover'}}/>}
                <div style={{flex:1,fontSize:13,textAlign:'left',fontWeight:500}}>{ex && ex.name || '?'}</div>
                {mode === 'circuit' && <div style={{fontSize:10,color:'#555',background:'rgba(255,255,255,0.04)',padding:'2px 8px',borderRadius:6}}>{pe.rep_min||40}s</div>}
              </div>
            })}
          </div>
          <button onClick={handleStart} style={S.btnG}>▶ DÉMARRER</button>
          <button onClick={onClose} style={{...S.btnO,marginTop:12}}>← Retour</button>
        </div>
      </div>
    )
  }

  // ═══ COUNTDOWN 3-2-1 ═══
  if (phase === 'countdown') {
    return (
      <div style={S.full}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column'}}>
          <div style={{fontSize:140,fontWeight:700,color:GOLD,fontFamily:'Outfit',textShadow:'0 0 60px rgba(196,151,58,0.3)'}}>{timer}</div>
          <div style={{fontSize:14,color:'#7a7065',marginTop:16,textTransform:'uppercase',letterSpacing:'0.2em'}}>Préparez-vous</div>
        </div>
      </div>
    )
  }

  // ═══ DONE ═══
  if (phase === 'done') {
    return (
      <div style={S.full}>
        <div style={{textAlign:'center',padding:'48px 24px'}}>
          <div style={{fontSize:56,marginBottom:16}}>🎉</div>
          <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:28,marginBottom:16}}>Terminé !</div>
          {mode === 'amrap' && <div style={{fontSize:20,color:GOLD,marginBottom:16}}>{amrapRounds} tour{amrapRounds > 1 ? 's' : ''} complété{amrapRounds > 1 ? 's' : ''}</div>}
          {mode === 'fortime' && <div style={{fontSize:20,color:GOLD,marginBottom:16}}>Temps : {fmt(globalTimer)}</div>}
          <button onClick={onClose} style={S.btnG}>Fermer</button>
        </div>
      </div>
    )
  }

  // ═══ WORK / REST ═══
  var isRest = phase === 'rest'
  var ex = currentEx

  return (
    <div style={{...S.full,background:isRest?'#061a08':'#0a0a0a'}}>
      {/* Top bar */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        <button onClick={function(){clearAll();onClose()}} style={{background:'rgba(255,255,255,0.06)',border:'none',color:'#777',fontSize:12,cursor:'pointer',fontFamily:'Outfit',padding:'8px 14px',borderRadius:10}}>✕ Quitter</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:13,color:isRest?'#4ade80':GOLD,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.15em'}}>{isRest?'REPOS':info.name.toUpperCase()}</div>
          {globalRunning && <div style={{fontSize:11,color:'#555',marginTop:2}}>{fmt(globalTimer)}</div>}
        </div>
        <div style={{minWidth:70,textAlign:'right'}}>
          {mode === 'amrap' && <div style={{fontSize:15,color:GOLD,fontWeight:700}}>{amrapRounds} tours</div>}
          {(mode === 'circuit' || mode === 'tabata') && <div style={{fontSize:12,color:'#777'}}>Tour {round}/{mode==='tabata'?tabataRounds:totalRounds}</div>}
          <div style={{fontSize:10,color:'#555'}}>Exo {exIdx+1}/{exercises.length}</div>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 24px'}}>
        {/* GIF full screen */}
        {!isRest && ex && ex.gif_url && (
          <img src={ex.gif_url} style={{width:'85%',maxWidth:360,maxHeight:'40vh',objectFit:'contain',borderRadius:24,marginBottom:24,border:'1px solid rgba(196,151,58,0.15)'}}/>
        )}

        {isRest && (function(){
          var nextEi = exIdx + 1 < exercises.length ? exIdx + 1 : (round < totalRounds ? 0 : -1)
          var nextPE = nextEi >= 0 ? exercises[nextEi] : null
          var nextEx = nextPE ? nextPE.exercises : null
          return <div style={{textAlign:'center'}}>
            <div style={{fontSize:12,color:'#4ade80',textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:12,fontWeight:600}}>⏸️ Repos — Prépare-toi</div>
            {nextEx && nextEx.gif_url && <img src={nextEx.gif_url} style={{width:'80%',maxWidth:320,maxHeight:'35vh',objectFit:'contain',borderRadius:20,marginBottom:12,border:'1px solid rgba(74,222,128,0.15)'}}/>}
            {nextEx && <div>
              <div style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>Exercice suivant</div>
              <div style={{fontSize:22,fontWeight:600}}>{nextEx.name}</div>
              {nextPE.rep_min && <div style={{fontSize:14,color:GOLD,marginTop:4}}>{nextPE.rep_min}{nextPE.rep_min!==nextPE.rep_max?'-'+nextPE.rep_max:''}{mode==='circuit'||mode==='tabata'?' sec':' reps'}</div>}
            </div>}
            {!nextEx && <div style={{fontSize:22,fontWeight:500,marginTop:16}}>🏁 Dernier repos</div>}
          </div>
        })()}

        {/* Exercise name - only during work */}
        {!isRest && <div style={{fontSize:26,fontWeight:700,marginBottom:4,textAlign:'center',letterSpacing:'-0.02em'}}>{ex && ex.name || 'Exercice'}</div>}

        {/* Timer */}
        {(mode === 'circuit' || mode === 'tabata' || mode === 'emom') && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:88,fontWeight:700,fontFamily:'Outfit',color:isRest?'#4ade80':GOLD,textAlign:'center',textShadow:isRest?'0 0 40px rgba(74,222,128,0.2)':'0 0 40px rgba(196,151,58,0.2)'}}>{timer}</div>
            <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16}}>
              <button onClick={function(){setTimer(function(t){return Math.max(0,t-15)})}} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'10px 18px',color:'#f0ece4',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',transition:'all 0.2s'}}>-15</button>
              <button onClick={function(){setTimer(function(t){return t+15})}} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'10px 18px',color:'#f0ece4',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',transition:'all 0.2s'}}>+15</button>
              <button onClick={function(){setTimer(1)}} style={{background:GOLD,border:'none',borderRadius:10,padding:'10px 18px',color:'#000',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',boxShadow:'0 2px 8px rgba(196,151,58,0.3)',transition:'all 0.2s'}}>Passer ›</button>
            </div>
          </div>
        )}

        {/* AMRAP / ForTime - manual advance */}
        {mode === 'amrap' && !isRest && (
          <div>
            <div style={{fontSize:14,color:'#7a7065',marginBottom:16,textAlign:'center'}}>{currentPE && currentPE.rep_min ? currentPE.rep_min + ' reps' : 'Max reps'}</div>
            <button onClick={amrapNext} style={S.btnG}>✓ Suivant</button>
          </div>
        )}

        {mode === 'fortime' && !isRest && (
          <div>
            <div style={{fontSize:48,fontWeight:700,color:GOLD,marginBottom:16,fontFamily:'Outfit'}}>{fmt(globalTimer)}</div>
            <div style={{fontSize:14,color:'#7a7065',marginBottom:16,textAlign:'center'}}>{currentPE && currentPE.rep_min ? currentPE.rep_min + ' reps' : ''}</div>
            <button onClick={forTimeNext} style={S.btnG}>✓ Suivant</button>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{display:'flex',justifyContent:'center',gap:6,padding:'20px',flexWrap:'wrap'}}>
        {exercises.map(function(_, i) {
          var done = i < exIdx || (i === exIdx && isRest)
          var active = i === exIdx && !isRest
          return <div key={i} style={{width:active?24:8,height:8,borderRadius:4,background:done?'#4ade80':active?GOLD:'#222',transition:'all 0.3s',boxShadow:active?'0 0 8px rgba(196,151,58,0.4)':'none'}}/>
        })}
      </div>
    </div>
  )
}

var S = {
  full: {position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0a0a0a',color:'#f0ece4',zIndex:9999,fontFamily:'Outfit,sans-serif',display:'flex',flexDirection:'column',overflow:'auto',paddingTop:'max(env(safe-area-inset-top),0px)',WebkitOverflowScrolling:'touch'},
  btnG: {background:GOLD,color:'#000',border:'none',borderRadius:14,padding:'18px 40px',fontSize:16,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',display:'block',margin:'0 auto',boxShadow:'0 2px 12px rgba(196,151,58,0.3)',transition:'all 0.2s',letterSpacing:'0.02em'},
  btnO: {background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'14px',fontSize:13,color:'#7a7065',cursor:'pointer',fontFamily:'Outfit',display:'block',margin:'0 auto',width:200,transition:'all 0.2s'},
}
