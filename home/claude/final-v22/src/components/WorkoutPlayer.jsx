import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/i18n'
import CircuitPlayer from './CircuitPlayer'

var GOLD = '#C4973A'

export default function WorkoutPlayer({ program, profileId, profileName, onClose }) {
  var { t } = useLang()
  var programExercises = (program.program_exercises || []).sort(function(a, b) { return a.order_index - b.order_index })

  // Preload all exercise GIFs into browser cache
  useEffect(function() {
    programExercises.forEach(function(pe) {
      var url = pe.exercises && pe.exercises.gif_url
      if (url) { var img = new Image(); img.src = url }
    })
  }, [])

  var [exercises, setExercises] = useState(function() {
    // Try to restore from localStorage
    try {
      var saved = localStorage.getItem('yd_workout_sets')
      if (saved) {
        var parsed = JSON.parse(saved)
        if (parsed && parsed.length > 0 && parsed[0].pe) return parsed
      }
    } catch(e) {}
    // Fresh init
    return programExercises.map(function(pe) {
      var sets = []
      var config = null
      try { config = pe.sets_config ? JSON.parse(pe.sets_config) : null } catch(e) {}
      var numSets = config ? config.length : (pe.sets || 3)
      for (var i = 0; i < numSets; i++) {
        var cfg = config ? config[i] : null
        sets.push({
          type: cfg ? cfg.t || 'work' : 'work',
          weight: cfg && cfg.w ? String(cfg.w) : '',
          reps: cfg && cfg.r ? String(cfg.r) : '',
          done: false
        })
      }
      return { pe: pe, ex: pe.exercises, sets: sets }
    })
  })

  var [timer, setTimer] = useState(0)
  var [timerTotal, setTimerTotal] = useState(0)
  var [timerRunning, setTimerRunning] = useState(false)
  var [prevWeights, setPrevWeights] = useState({})
  var [started, setStarted] = useState(function() {
    try { var s = localStorage.getItem('yd_workout_started'); return s ? new Date(s) : null } catch(e) { return null }
  })
  var [phase, setPhase] = useState('workout')
  var [circuitBlock, setCircuitBlock] = useState(null)
  var blocks = program.blocks || []

  // Helper: find which block an exercise belongs to
  function getExBlock(ei) {
    for (var b = 0; b < blocks.length; b++) {
      if (ei >= blocks[b].startIdx && ei <= blocks[b].endIdx && blocks[b].mode !== 'normal') return blocks[b]
    }
    return null
  }
  var [workoutModified, setWorkoutModified] = useState(false)
  var [expandedGif, setExpandedGif] = useState(null)
  var [expandedSection, setExpandedSection] = useState(null)
  var [actionMenu, setActionMenu] = useState(null) // exercise index for bottom sheet
  var [exDetailIdx, setExDetailIdx] = useState(null) // exercise index for detail page
  var [exHistory, setExHistory] = useState([]) // exercise progress history
  var [emoji, setEmoji] = useState('')
  var [endComment, setEndComment] = useState('')
  var timerRef = useRef(null)
  var timerEndRef = useRef(0)
  var audioCtx = useRef(null)

  useEffect(function() {
    if (!started) setStarted(new Date())
    try { if (!localStorage.getItem('yd_workout_started')) localStorage.setItem('yd_workout_started', new Date().toISOString()) } catch(e) {}
    loadPrevious()
    return function() { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Save exercise state on every change + when leaving app
  useEffect(function() {
    try { localStorage.setItem('yd_workout_sets', JSON.stringify(exercises)) } catch(e) {}
  }, [exercises])

  useEffect(function() {
    function saveOnHide() {
      if (document.visibilityState === 'hidden') {
        try { localStorage.setItem('yd_workout_sets', JSON.stringify(exercises)) } catch(e) {}
      }
    }
    document.addEventListener('visibilitychange', saveOnHide)
    window.addEventListener('beforeunload', function() {
      try { localStorage.setItem('yd_workout_sets', JSON.stringify(exercises)) } catch(e) {}
    })
    return function() { document.removeEventListener('visibilitychange', saveOnHide) }
  }, [exercises])

  function handleClose() {
    try { localStorage.removeItem('yd_workout_sets'); localStorage.removeItem('yd_workout_started'); localStorage.removeItem('yd_timer_end'); localStorage.removeItem('yd_timer_total') } catch(e) {}
    onClose()
  }

  async function loadPrevious() {
    try {
      var { data: logs } = await supabase.from('workout_logs').select('id').eq('client_id', profileId).order('completed_at', { ascending: false }).limit(3)
      if (!logs || !logs.length) return
      var allSets = []
      for (var li = 0; li < logs.length; li++) {
        var log = logs[li]
        var { data: sets } = await supabase.from('workout_sets').select('exercise_id, weight_kg, reps, set_number').eq('workout_log_id', log.id)
        if (sets) allSets = allSets.concat(sets)
      }
      var weights = {}
      allSets.forEach(function(s) { if (!weights[s.exercise_id]) weights[s.exercise_id] = {}; if (!weights[s.exercise_id][s.set_number]) weights[s.exercise_id][s.set_number] = { weight: s.weight_kg, reps: s.reps } })
      setPrevWeights(weights)
      setExercises(function(exs) {
        return exs.map(function(item) {
          var prev = weights[item.pe.exercise_id]
          if (!prev) return item
          return Object.assign({}, item, { sets: item.sets.map(function(set, i) { var p = prev[i + 1]; return p ? Object.assign({}, set, { weight: String(p.weight || ''), reps: String(item.pe.rep_min || p.reps || '') }) : set }) })
        })
      })
    } catch (e) {}
  }

  function playBeep() {
    try {
      // Try vibration first (Android)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300])
      // Web Audio API beeps
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      var ctx = audioCtx.current
      ctx.resume()
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = [880, 988, 1047][i]
        g.gain.value = 0.8
        o.start(ctx.currentTime + i * 0.22)
        o.stop(ctx.currentTime + i * 0.22 + 0.15)
      }
    } catch(e) {
      // Fallback: HTML5 Audio with data URI beep
      try {
        var audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdW2JjZKQg3VtcHN/iI6Sh4J5dnh/h42RjoV+eXl+hImNj4mEf3x9goeKjY2KhoJ/f4KGiYuMi4iFg4GBhIaIioqKiIaEg4OEhoeIiYmIh4aFhISFhoeIiIiIh4aFhYWGh4eIiIiHhoaFhYaGh4eHh4eHhoaGhoaHh4eHh4eHhoaGhoaGh4eHh4eHh4aG')
        audio.volume = 1.0
        audio.play().catch(function(){})
      } catch(e2) {}
    }
  }

  // Unlock audio context on first user interaction (iOS silent mode workaround)
  function unlockAudio() {
    try {
      if (!audioCtx.current) audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      audioCtx.current.resume()
      // Play silent buffer to switch iOS to media playback mode (bypasses silent switch)
      var buf = audioCtx.current.createBuffer(1, 1, 22050)
      var src = audioCtx.current.createBufferSource()
      src.buffer = buf; src.connect(audioCtx.current.destination); src.start(0)
    } catch(e) {}
  }

  function startTimer(sec) {
    if(timerRef.current) clearInterval(timerRef.current)
    var endAt = Date.now() + sec * 1000
    timerEndRef.current = endAt
    setTimerTotal(sec); setTimer(sec); setTimerRunning(true)
    try { localStorage.setItem('yd_timer_end', endAt); localStorage.setItem('yd_timer_total', sec) } catch(e) {}
    try { if(!audioCtx.current) audioCtx.current = new (window.AudioContext||window.webkitAudioContext)(); audioCtx.current.resume() } catch(e){}
    timerRef.current = setInterval(function() {
      var remaining = Math.ceil((timerEndRef.current - Date.now()) / 1000)
      if (remaining <= 3 && remaining > 0) { try{if(navigator.vibrate)navigator.vibrate(150)}catch(e){} }
      if (remaining <= 0) {
        clearInterval(timerRef.current); setTimerRunning(false); setTimer(0)
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]) } catch(e) {}
        playBeep()
        try { localStorage.removeItem('yd_timer_end'); localStorage.removeItem('yd_timer_total') } catch(e) {}
        return
      }
      setTimer(remaining)
    }, 300)
  }
  function adjustTimer(d) {
    timerEndRef.current += d * 1000
    setTimerTotal(function(t){return Math.max(0,t+d)})
    try { localStorage.setItem('yd_timer_end', timerEndRef.current) } catch(e) {}
  }
  function skipTimer() { if(timerRef.current)clearInterval(timerRef.current); setTimerRunning(false); setTimer(0); try{localStorage.removeItem('yd_timer_end');localStorage.removeItem('yd_timer_total')}catch(e){} }

  // Restore timer on mount + handle visibility change
  useEffect(function() {
    // Restore running timer
    try {
      var savedEnd = localStorage.getItem('yd_timer_end')
      if (savedEnd) {
        var remaining = Math.ceil((parseInt(savedEnd) - Date.now()) / 1000)
        if (remaining > 0) {
          var total = parseInt(localStorage.getItem('yd_timer_total')) || remaining
          timerEndRef.current = parseInt(savedEnd)
          setTimerTotal(total); setTimer(remaining); setTimerRunning(true)
          timerRef.current = setInterval(function() {
            var r = Math.ceil((timerEndRef.current - Date.now()) / 1000)
            if (r <= 0) { clearInterval(timerRef.current); setTimerRunning(false); setTimer(0); playBeep(); try{localStorage.removeItem('yd_timer_end')}catch(e){}; return }
            setTimer(r)
          }, 300)
        } else {
          localStorage.removeItem('yd_timer_end'); localStorage.removeItem('yd_timer_total')
        }
      }
    } catch(e) {}

    // Handle app coming back to foreground
    function onVisibility() {
      if (document.visibilityState === 'visible' && timerEndRef.current > 0) {
        var r = Math.ceil((timerEndRef.current - Date.now()) / 1000)
        if (r <= 0) { setTimer(0); setTimerRunning(false); playBeep(); timerEndRef.current = 0 }
        else { setTimer(r) }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return function() { document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  function validateSet(ei, si) {
    var wasDone = exercises[ei].sets[si].done
    setExercises(function(exs) { return exs.map(function(item,i){if(i!==ei)return item;return Object.assign({},item,{sets:item.sets.map(function(s,j){if(j!==si)return s;return Object.assign({},s,{done:!s.done})})})}) })
    if (!wasDone) {
      unlockAudio()
      // Use per-set rest if available from program config
      var setConfig = null
      try { var cfg = exercises[ei].pe.sets_config ? JSON.parse(exercises[ei].pe.sets_config) : null; if (cfg && cfg[si]) setConfig = cfg[si] } catch(e) {}
      var restSec = (setConfig && parseInt(setConfig.rest)) || exercises[ei].pe.rest_seconds || 90
      startTimer(restSec)
    }
  }
  function updateSet(ei,si,f,v) { setExercises(function(exs){return exs.map(function(item,i){if(i!==ei)return item;return Object.assign({},item,{sets:item.sets.map(function(s,j){if(j!==si)return s;var u=Object.assign({},s);u[f]=v;return u})})})}) }
  function addSet(ei) { setExercises(function(exs){return exs.map(function(item,i){if(i!==ei)return item;var last=item.sets[item.sets.length-1]||{};return Object.assign({},item,{sets:item.sets.concat([{type:'work',weight:last.weight||'',reps:last.reps||'',done:false}])})})}) }
  function removeSet(ei,si) { setExercises(function(exs){return exs.map(function(item,i){if(i!==ei)return item;if(item.sets.length<=1)return item;return Object.assign({},item,{sets:item.sets.filter(function(_,j){return j!==si})})})}) }
  function toggleWarmup(ei,si) { setExercises(function(exs){return exs.map(function(item,i){if(i!==ei)return item;return Object.assign({},item,{sets:item.sets.map(function(s,j){if(j!==si)return s;return Object.assign({},s,{type:s.type==='warmup'?'work':'warmup'})})})})}) }

  // Reorder exercises
  function moveExercise(ei, dir) {
    setWorkoutModified(true)
    setExercises(function(exs) {
      var arr = exs.slice(); var ni = ei + dir
      if (ni < 0 || ni >= arr.length) return arr
      var t = arr[ei]; arr[ei] = arr[ni]; arr[ni] = t; return arr
    })
  }

  // Add/remove exercises during workout
  var [showAddExWo, setShowAddExWo] = useState(false)
  var [woExList, setWoExList] = useState([])
  var [woSearch, setWoSearch] = useState('')
  var [woMuscle, setWoMuscle] = useState('')
  var [woEquip, setWoEquip] = useState('')

  function openExDetail(ei) {
    var ex = exercises[ei].ex
    if (!ex) return
    setExDetailIdx(ei)
    supabase.from('workout_set_logs').select('weight_kg,reps,created_at').eq('exercise_id', ex.id).eq('client_id', profileId).order('created_at', { ascending: false }).limit(50).then(function(r) {
      setExHistory(r.data || [])
    })
  }

  function openAddExWorkout() {
    supabase.from('exercises').select('*').order('muscle_group').order('name').then(function(r) {
      setWoExList(r.data || [])
      setShowAddExWo(true)
    })
  }

  function addExerciseToWorkout(ex) {
    setWorkoutModified(true)
    setExercises(function(exs) {
      return exs.concat([{
        pe: { exercise_id: ex.id, exercises: ex, sets: 3, rep_min: 8, rep_max: 12, rest_seconds: 90, order_index: exs.length },
        ex: ex,
        sets: [{ type: 'work', weight: '', reps: '', done: false }, { type: 'work', weight: '', reps: '', done: false }, { type: 'work', weight: '', reps: '', done: false }]
      }])
    })
    setShowAddExWo(false)
  }

  function removeExerciseFromWorkout(ei) {
    if (!confirm('⚠️ Ce programme a été conçu spécialement pour toi par ton coach.\n\nEs-tu sûr(e) de vouloir retirer cet exercice ?')) return
    setWorkoutModified(true)
    setExercises(function(exs) { return exs.filter(function(_, i) { return i !== ei }) })
  }
  // Swap exercise
  var [swapIdx, setSwapIdx] = useState(null)
  var [swapList, setSwapList] = useState([])
  var [swapAlts, setSwapAlts] = useState([])
  function openSwap(ei) {
    var muscle = (exercises[ei].ex&&exercises[ei].ex.muscle_group)
    var altIds = []
    try { altIds = exercises[ei].pe.alternative_ids ? JSON.parse(exercises[ei].pe.alternative_ids) : [] } catch(e) {}
    supabase.from('exercises').select('*').eq('muscle_group', muscle).order('name').then(function(r) {
      var all = (r.data || []).filter(function(e) { return e.id !== exercises[ei].pe.exercise_id })
      setSwapAlts(altIds)
      setSwapList(all)
      setSwapIdx(ei)
    })
  }
  function confirmSwap(newEx) {
    setWorkoutModified(true)
    setExercises(function(exs) {
      return exs.map(function(item, i) {
        if (i !== swapIdx) return item
        return Object.assign({}, item, { ex: newEx, pe: Object.assign({}, item.pe, { exercise_id: newEx.id, exercises: newEx }) })
      })
    })
    setSwapIdx(null)
  }

  // PR detection
  var [newPRs, setNewPRs] = useState([])

  var totalSets = exercises.reduce(function(s,e){return s+e.sets.length},0)
  var doneSets = exercises.reduce(function(s,e){return s+e.sets.filter(function(x){return x.done}).length},0)
  var progress = totalSets>0?(doneSets/totalSets*100):0
  var fmt = function(s){return Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60)}
  var [elapsedTick, setElapsedTick] = useState(0)
  var [woTheme, setWoTheme] = useState(function() { try { return localStorage.getItem('yd_wo_theme') || 'dark' } catch(e) { return 'dark' } })
  var isLight = woTheme === 'light'
  var T = { bg: isLight ? '#f5f3f0' : '#0a0a0a', surface: isLight ? '#fff' : '#141210', text: isLight ? '#1a1a1a' : '#f0ece4', muted: isLight ? '#888' : '#555', border: isLight ? '#e0ddd8' : '#1a1714', inputBg: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', doneBg: isLight ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.08)' }
  useEffect(function() {
    var t = setInterval(function() { setElapsedTick(function(n) { return n + 1 }) }, 1000)
    return function() { clearInterval(t) }
  }, [])

  var elapsed = started?Math.floor((new Date()-started)/60000):0

  async function saveWorkout() {
    setPhase('saving')
    var dur = started?Math.round((new Date()-started)/60000):0
    var completedAt = new Date().toISOString()

    // Collect sets data
    var allSets = []
    exercises.forEach(function(item) {
      item.sets.forEach(function(set, si) {
        if (set.done) allSets.push({ exercise_id: item.pe.exercise_id, set_number: si + 1, weight_kg: parseFloat(set.weight) || 0, reps: parseInt(set.reps) || 0, set_type: set.type || 'work' })
      })
    })

    if (!navigator.onLine) {
      // ═══ OFFLINE: queue for later sync ═══
      try {
        var queue = JSON.parse(localStorage.getItem('yd_offline_workouts') || '[]')
        queue.push({ client_id: profileId, program_id: program.id || null, program_name: program.name, duration: dur, completed_at: completedAt, emoji: emoji || null, comment: endComment.trim() || null, sets: allSets })
        localStorage.setItem('yd_offline_workouts', JSON.stringify(queue))
      } catch(e) {}
      try { localStorage.removeItem('yd_workout_sets'); localStorage.removeItem('yd_workout_started'); localStorage.removeItem('yd_timer_end'); localStorage.removeItem('yd_timer_total') } catch(e) {}
      setPhase('done')
      return
    }

    // ═══ ONLINE: save normally ═══
    try {
      var {data:log} = await supabase.from('workout_logs').insert({client_id:profileId,program_id:program.id||null,duration_minutes:dur,completed_at:completedAt,emoji:emoji||null,comment:endComment.trim()||null}).select().single()
      // Notify coach
      try { fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: 'contact@yoanndesgrand.fr', subject: '🏋️ ' + (profileName || 'Un client') + ' a terminé sa séance !', html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:20px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:18px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:24px"><div style="font-size:16px;margin-bottom:12px">🏋️ Séance terminée !</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:16px;margin-bottom:16px"><div style="font-size:18px;font-weight:bold;color:#C4973A;margin-bottom:4px">' + (profileName || 'Client') + '</div><div style="font-size:13px;color:#7a7065">' + program.name + ' · ' + dur + ' min</div>' + (emoji ? '<div style="font-size:24px;margin-top:8px">' + emoji + '</div>' : '') + (endComment.trim() ? '<div style="font-size:13px;color:#a09888;margin-top:8px;font-style:italic">"' + endComment.trim() + '"</div>' : '') + '</div><a href="https://app.yoanndesgrand.fr/admin" style="display:inline-block;padding:12px 24px;background:#C4973A;color:#000;text-decoration:none;border-radius:8px;font-weight:500">Voir le détail</a></div></div>' }) }) } catch(e) {}
      // Push notification
      try { fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push-send', userId: profileId, title: '🏋️ Séance terminée !', body: program.name + ' · ' + dur + ' min' }) }) } catch(e) {}
      if(log && allSets.length>0) await supabase.from('workout_sets').insert(allSets.map(function(s){return Object.assign({},s,{workout_log_id:log.id})}))

      // PR detection
      var prs = []
      var exBests = {}
      exercises.forEach(function(item) {
        item.sets.forEach(function(set) {
          if (set.done && set.type !== 'warmup') {
            var w = parseFloat(set.weight) || 0
            var r = parseInt(set.reps) || 0
            var key = item.pe.exercise_id
            if (!exBests[key] || w > exBests[key].w || (w === exBests[key].w && r > exBests[key].r)) {
              exBests[key] = { w: w, r: r, name: (item.ex&&item.ex.name) || '?' }
            }
          }
        })
      })
      for (var exId in exBests) {
        var best = exBests[exId]
        var { data: existing } = await supabase.from('personal_records').select('id,weight_kg,reps').eq('client_id', profileId).eq('exercise_id', exId).order('weight_kg', { ascending: false }).limit(1)
        var isNew = !existing || existing.length === 0 || best.w > existing[0].weight_kg || (best.w === existing[0].weight_kg && best.r > existing[0].reps)
        if (isNew && best.w > 0) {
          await supabase.from('personal_records').insert({ client_id: profileId, exercise_id: exId, weight_kg: best.w, reps: best.r })
          prs.push(best.name + ' — ' + best.w + 'kg × ' + best.r)
        }
      }
      setNewPRs(prs)

      // Badge check
      var { data: logCount } = await supabase.from('workout_logs').select('id', { count: 'exact' }).eq('client_id', profileId)
      var count = logCount ? logCount.length : 0
      var badges = [
        { type: 'first_workout', threshold: 1, label: '🎯 Première séance' },
        { type: '10_workouts', threshold: 10, label: '🔥 10 séances' },
        { type: '25_workouts', threshold: 25, label: '💪 25 séances' },
        { type: '50_workouts', threshold: 50, label: '🏆 50 séances' },
        { type: '100_workouts', threshold: 100, label: '👑 100 séances' }
      ]
      for (var bi = 0; bi < badges.length; bi++) {
        if (count >= badges[bi].threshold) {
          var { data: has } = await supabase.from('badges').select('id').eq('client_id', profileId).eq('badge_type', badges[bi].type)
          if (!has || has.length === 0) {
            await supabase.from('badges').insert({ client_id: profileId, badge_type: badges[bi].type })
          }
        }
      }
    }catch(e){ console.log('Save error:', e) }
    // Clear saved state
    try { localStorage.removeItem('yd_workout_sets'); localStorage.removeItem('yd_workout_started'); localStorage.removeItem('yd_timer_end'); localStorage.removeItem('yd_timer_total') } catch(e) {}
    setPhase(workoutModified ? 'save-routine' : 'done')
  }

  // ═══ SAVE ROUTINE ═══
  if (phase === 'save-routine') {
    return (<div style={S.full}><div style={{padding:'48px 24px',maxWidth:400,margin:'0 auto',textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>💾</div>
      <div style={{fontSize:18,fontWeight:500,marginBottom:8}}>Routine modifiée</div>
      <div style={{fontSize:13,color:'#7a7065',marginBottom:24}}>Tu as modifié des exercices pendant la séance. Veux-tu sauvegarder cette version ?</div>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <button onClick={async function() {
          // Save modified exercises back to program
          try {
            var sessionId = program.sessions && program.sessions[sessionIdx] && program.sessions[sessionIdx].id
            if (sessionId) {
              await supabase.from('program_exercises').delete().eq('session_id', sessionId)
              await supabase.from('program_exercises').insert(exercises.map(function(item, i) {
                return { session_id: sessionId, exercise_id: item.pe.exercise_id, sets: item.sets.length, rep_min: item.pe.rep_min || 8, rep_max: item.pe.rep_max || 12, rep_mode: item.pe.rep_mode || 'range', rest_seconds: item.pe.rest_seconds || 90, order_index: i, notes: item.pe.notes || '', superset_group: item.pe.superset_group || null, sets_config: item.sets.length > 0 ? JSON.stringify(item.sets.map(function(s) { return { t: s.type || 'work', w: '', r: '', rest: '' } })) : null }
              }))
            }
          } catch(e) { console.log('Save routine error:', e) }
          setPhase('done')
        }} style={S.btnG}>✅ Sauvegarder la routine</button>
        <button onClick={function() { setPhase('done') }} style={S.btnO}>Ignorer</button>
      </div>
    </div></div>)
  }

  // ═══ DONE ═══
  if (phase==='done'||phase==='saving') {
    var tw=exercises.reduce(function(s,item){return s+item.sets.filter(function(x){return x.done}).reduce(function(s2,set){return s2+(parseFloat(set.weight)||0)*(parseInt(set.reps)||0)},0)},0)
    return (<div style={S.full}><div style={{textAlign:'center',padding:'48px 24px'}}><div style={{fontSize:56,marginBottom:16}}>🎉</div><div style={{fontFamily:'Cormorant Garamond,serif',fontSize:28,marginBottom:8}}>Séance terminée !</div>{emoji&&<div style={{fontSize:40,marginBottom:8}}>{emoji}</div>}<div style={{display:'flex',gap:20,justifyContent:'center',margin:'24px 0'}}><div style={S.stat}><div style={{fontSize:28,fontWeight:600}}>{elapsed}</div><div style={S.statL}>min</div></div><div style={S.stat}><div style={{fontSize:28,fontWeight:600}}>{doneSets}</div><div style={S.statL}>séries</div></div><div style={S.stat}><div style={{fontSize:28,fontWeight:600,color:GOLD}}>{Math.round(tw)}</div><div style={S.statL}>kg</div></div></div>{newPRs.length>0&&<div style={{background:'rgba(74,222,128,0.08)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:12,padding:'16px',marginBottom:20,textAlign:'left'}}><div style={{fontSize:14,fontWeight:600,color:'#4ade80',marginBottom:8}}>🏆 Nouveau{newPRs.length>1?'x':''} record{newPRs.length>1?'s':''} !</div>{newPRs.map(function(pr,i){return <div key={i} style={{fontSize:13,color:'#4ade80',padding:'2px 0'}}>{pr}</div>})}</div>}{phase==='saving'?<div style={{color:'#7a7065'}}>Enregistrement...</div>:<button onClick={handleClose} style={S.btnG}>Fermer</button>}</div></div>)
  }

  // ═══ END CONFIRM ═══
  if (phase==='confirm-end') {
    return (<div style={S.full}><div style={{padding:'48px 24px',maxWidth:400,margin:'0 auto'}}><div style={{textAlign:'center',marginBottom:24}}><div style={{fontSize:18,fontWeight:500,marginBottom:8}}>Terminer la séance ?</div><div style={{fontSize:13,color:'#7a7065'}}>{doneSets}/{totalSets} séries validées · {elapsed} min</div></div><div style={{textAlign:'center',marginBottom:24}}><div style={{fontSize:13,color:'#7a7065',marginBottom:12}}>Comment tu te sens ? (1 = épuisé · 10 = au top)</div><div style={{display:'flex',gap:4,justifyContent:'center',flexWrap:'wrap'}}>{[{n:1,e:'😵'},{n:2,e:'😫'},{n:3,e:'😓'},{n:4,e:'😮‍💨'},{n:5,e:'😐'},{n:6,e:'🙂'},{n:7,e:'😊'},{n:8,e:'💪'},{n:9,e:'🔥'},{n:10,e:'🚀'}].map(function(r){var sel=emoji===String(r.n);return <button key={r.n} onClick={function(){setEmoji(String(r.n))}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'8px 6px',background:sel?'rgba(196,151,58,0.15)':'transparent',border:sel?'2px solid '+GOLD:'2px solid transparent',borderRadius:10,cursor:'pointer',minWidth:36}}><div style={{fontSize:20}}>{r.e}</div><div style={{fontSize:10,fontWeight:sel?700:400,color:sel?GOLD:'#555'}}>{r.n}</div></button>})}</div></div><textarea value={endComment} onChange={function(e){setEndComment(e.target.value)}} placeholder="Commentaire sur la séance..." style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:14,color:'#f0ece4',fontSize:13,fontFamily:'Outfit',outline:'none',minHeight:70,boxSizing:'border-box',marginBottom:20,resize:'vertical'}}/><div style={{display:'flex',flexDirection:'column',gap:10}}><button onClick={saveWorkout} style={S.btnG}>✓ Enregistrer la séance</button><button onClick={function(){setPhase('workout')}} style={S.btnO}>← Continuer</button><button onClick={handleClose} style={{...S.btnO,color:'#f87171'}}>✕ Abandonner</button></div></div></div>)
  }

  // ═══ WORKOUT ═══
  return (
    <div style={{...S.full,background:T.bg,color:T.text}}>
      {/* TOP BAR */}
      <div style={{position:'sticky',top:0,zIndex:10,background:T.bg,borderBottom:'1px solid '+T.border,backdropFilter:'blur(12px)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px'}}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:GOLD,fontFamily:'Outfit',letterSpacing:'-0.02em'}}>{elapsed}<span style={{fontSize:14,fontWeight:400,color:T.muted}}>min</span> {String(started?Math.floor(((new Date()-started)/1000)%60):0).padStart(2,'0')}<span style={{fontSize:14,fontWeight:400,color:T.muted}}>s</span></div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={function(){var next=woTheme==='dark'?'light':'dark';setWoTheme(next);try{localStorage.setItem('yd_wo_theme',next)}catch(e){}}} style={{background:'rgba(255,255,255,0.06)',border:'none',cursor:'pointer',fontSize:16,padding:'8px',borderRadius:10,width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center'}}>{isLight?'🌙':'☀️'}</button>
            <button onClick={function(){setPhase('confirm-end')}} style={{background:GOLD,color:'#000',border:'none',borderRadius:10,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',boxShadow:'0 2px 8px rgba(196,151,58,0.3)'}}>Terminer</button>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'center',gap:6,padding:'0 20px 10px',alignItems:'center'}}>
          <div style={{fontSize:14,fontWeight:600}}>{program.name}</div>
          <div style={{background:'rgba(196,151,58,0.1)',border:'1px solid rgba(196,151,58,0.2)',borderRadius:20,padding:'2px 10px',fontSize:11,color:GOLD,fontWeight:600}}>{doneSets}/{totalSets}</div>
        </div>
        {/* Progress bar */}
        <div style={{height:3,background:T.border}}><div style={{height:'100%',width:progress+'%',background:'linear-gradient(90deg, '+GOLD+', #E2B95A)',transition:'width 0.5s',borderRadius:2}}/></div>
      </div>

      {/* Circuit overlay */}
      {circuitBlock && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:200,background:'var(--bg)'}}>
        <CircuitPlayer session={{ program_exercises: exercises.slice(circuitBlock.startIdx, circuitBlock.endIdx + 1).map(function(item) { return item.pe }) }} mode={circuitBlock.mode} settings={circuitBlock.settings || {}} onClose={function() {
          // Mark all circuit exercises as done
          setExercises(function(exs) { return exs.map(function(item, i) {
            if (i >= circuitBlock.startIdx && i <= circuitBlock.endIdx) {
              return Object.assign({}, item, { sets: item.sets.map(function(s) { return Object.assign({}, s, { done: true }) }) })
            }
            return item
          })})
          setCircuitBlock(null)
        }} />
      </div>}

      <div style={{padding:'12px 16px 140px'}}>
        {exercises.map(function(item,ei){
          var block = getExBlock(ei)

          // Circuit block: show launcher on first exercise, skip others
          if (block && block.mode !== 'normal') {
            if (ei !== block.startIdx) return null // skip non-first exercises in block
            var blockExercises = exercises.slice(block.startIdx, block.endIdx + 1)
            var blockDone = blockExercises.every(function(it) { return it.sets.every(function(s) { return s.done }) })
            var modeLabels = { circuit: '🔄 Circuit', tabata: '⚡ Tabata', amrap: '💀 AMRAP', fortime: '⏱️ For Time', emom: '⏰ EMOM' }
            return <div key={ei} style={{marginBottom:12,background:blockDone?'rgba(74,222,128,0.05)':'rgba(196,151,58,0.05)',border:'1px solid',borderColor:blockDone?'rgba(74,222,128,0.2)':'rgba(196,151,58,0.2)',borderRadius:16,padding:16,opacity:blockDone?0.7:1}}>
              <div style={{fontSize:14,fontWeight:600,color:GOLD,marginBottom:4}}>{block.name || modeLabels[block.mode] || block.mode}</div>
              {block.name && <div style={{fontSize:11,color:T.muted,marginBottom:8}}>{modeLabels[block.mode]}</div>}
              {blockExercises.map(function(bex,bi) {
                return <div key={bi} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
                  {bex.ex&&bex.ex.gif_url&&<img src={bex.ex.gif_url} style={{width:28,height:28,borderRadius:6,objectFit:'cover'}}/>}
                  <div style={{fontSize:13}}>{bex.ex&&bex.ex.name||'?'}</div>
                </div>
              })}
              {!blockDone && <button onClick={function(){setCircuitBlock(block)}} style={{width:'100%',marginTop:12,padding:'14px',background:GOLD,color:'#000',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>▶ Lancer</button>}
              {blockDone && <div style={{textAlign:'center',marginTop:8,fontSize:13,color:'#4ade80'}}>✅ Terminé</div>}
            </div>
          }

          // Show block name header for normal blocks
          var blockHeader = null
          var exBlock = blocks.find(function(b) { return ei >= b.startIdx && ei <= b.endIdx })
          if (exBlock && exBlock.name && ei === exBlock.startIdx) {
            blockHeader = <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{flex:1,height:1,background:'rgba(196,151,58,0.2)'}}/>
              <div style={{fontSize:11,fontWeight:600,color:GOLD,textTransform:'uppercase',letterSpacing:'0.1em'}}>{exBlock.name}</div>
              <div style={{flex:1,height:1,background:'rgba(196,151,58,0.2)'}}/>
            </div>
          }

          var ex=item.ex,pe=item.pe,prev=prevWeights[pe.exercise_id]||{}
          var restSec=pe.rest_seconds||90
          var restMin=Math.floor(restSec/60)
          var restS=restSec%60
          var allDone=item.sets.every(function(x){return x.done})
          return (<div key={ei}>{blockHeader}<div style={{marginBottom:12,background:T.surface,border:'1px solid '+T.border,borderRadius:16,overflow:'hidden',opacity:allDone?0.7:1,transition:'opacity 0.3s'}}>
            {/* Exercise header */}
            <div style={{display:'flex',alignItems:'center',gap:14,padding:'16px 16px 12px'}}>
              {ex&&ex.gif_url?<button onClick={function(){openExDetail(ei)}} style={{background:'none',border:'none',padding:0,cursor:'pointer',flexShrink:0}}><img src={ex.gif_url} style={{width:52,height:52,borderRadius:14,objectFit:'cover',border:'2px solid rgba(196,151,58,0.3)'}}/></button>:<div onClick={function(){openExDetail(ei)}} style={{width:52,height:52,borderRadius:14,background:'rgba(196,151,58,0.08)',border:'2px solid rgba(196,151,58,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,cursor:'pointer'}}>🏋️</div>}
              <div style={{flex:1,minWidth:0}}>
                <button onClick={function(){openExDetail(ei)}} style={{background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'Outfit',textAlign:'left',width:'100%'}}>
                  <div style={{fontSize:16,fontWeight:600,color:GOLD,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ex&&ex.name||'?'}</div>
                </button>
                {item.pe.notes&&<div style={{fontSize:11,color:'#E2B95A',marginTop:2,lineHeight:1.4}}>💬 {item.pe.notes}</div>}
                <div style={{fontSize:11,color:T.muted,marginTop:3}}>⏱ {restMin>0?restMin+'min ':''}{restS>0?restS+'s':''} repos {allDone?'· ✅ Terminé':''}</div>
              </div>
              <button onClick={function(){setActionMenu(actionMenu===ei?null:ei)}} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',color:T.muted,fontSize:16,cursor:'pointer',padding:'6px',borderRadius:8,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center'}}>⋮</button>
            </div>

            {/* Notes per exercise */}
            <div style={{padding:'0 16px'}}>
              <input value={item.notes||''} onChange={function(e){setExercises(function(exs){return exs.map(function(x,i){return i===ei?Object.assign({},x,{notes:e.target.value}):x})})}} placeholder="Notes..." style={{width:'100%',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.06)',color:T.muted,fontSize:12,fontFamily:'Outfit',padding:'8px 12px',outline:'none',boxSizing:'border-box',borderRadius:8,marginBottom:8}} />
            </div>

            {/* Expanded details */}
                        {/* Action menu bottom sheet */}
            {actionMenu===ei&&(<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',zIndex:30}} onClick={function(){setActionMenu(null)}}>
              <div style={{position:'absolute',bottom:0,left:0,right:0,background:'#1a1a1a',borderRadius:'20px 20px 0 0',padding:'12px 0 max(20px, env(safe-area-inset-bottom))'}} onClick={function(e){e.stopPropagation()}}>
                <div style={{width:40,height:4,borderRadius:2,background:'#333',margin:'0 auto 16px'}}/>
                <button onClick={function(){moveExercise(ei,-1);setActionMenu(null)}} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'16px 24px',background:'none',border:'none',cursor:'pointer',fontFamily:'Outfit',fontSize:15,color:'#f0ece4',textAlign:'left'}}><span style={{fontSize:18,width:28,textAlign:'center',color:'#7a7065'}}>↕️</span>Réorganiser (monter)</button>
                <button onClick={function(){moveExercise(ei,1);setActionMenu(null)}} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'16px 24px',background:'none',border:'none',borderTop:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',fontFamily:'Outfit',fontSize:15,color:'#f0ece4',textAlign:'left'}}><span style={{fontSize:18,width:28,textAlign:'center',color:'#7a7065'}}>↕️</span>Réorganiser (descendre)</button>
                <button onClick={function(){setActionMenu(null);openSwap(ei)}} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'16px 24px',background:'none',border:'none',borderTop:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',fontFamily:'Outfit',fontSize:15,color:'#f0ece4',textAlign:'left'}}><span style={{fontSize:18,width:28,textAlign:'center',color:'#7a7065'}}>🔄</span>Remplacer l'exercice</button>
                <button onClick={function(){setActionMenu(null);var l=exercises[ei].sets.length;addSet(ei);setTimeout(function(){toggleWarmup(ei,l)},100)}} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'16px 24px',background:'none',border:'none',borderTop:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',fontFamily:'Outfit',fontSize:15,color:'#f0ece4',textAlign:'left'}}><span style={{fontSize:18,width:28,textAlign:'center',color:'#7a7065',fontWeight:700}}>W</span>Ajouter série d'échauffement</button>
                <button onClick={function(){setActionMenu(null);removeExerciseFromWorkout(ei)}} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'16px 24px',background:'none',border:'none',borderTop:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',fontFamily:'Outfit',fontSize:15,color:'#f87171',textAlign:'left'}}><span style={{fontSize:18,width:28,textAlign:'center'}}>✕</span>Retirer l'exercice</button>
              </div>
            </div>)}

            {/* Table header */}
            <div style={{display:'grid',gridTemplateColumns:'42px 1fr 1fr 1fr 40px',gap:2,padding:'0 16px',marginBottom:4}}>
              <div style={S.th}>{t('workout.series')}</div><div style={S.th}>{t('workout.previous')}</div><div style={S.th}>{t('workout.weight')}</div><div style={S.th}>{t('workout.reps')}</div><div style={S.th}></div>
            </div>

            {/* Sets */}
            <div style={{padding:'0 12px'}}>
            {item.sets.map(function(set,si){
              var ps=prev[si+1];var pt=ps?(ps.weight>0?ps.weight+'kg × '+ps.reps:ps.reps+'r'):'—'
              var dn=set.done,wu=set.type==='warmup'
              var workIdx=si+1-item.sets.slice(0,si).filter(function(x){return x.type==='warmup'}).length
              return (<div key={si} style={{display:'grid',gridTemplateColumns:'42px 1fr 1fr 1fr 40px',gap:3,padding:'5px 4px',alignItems:'center',background:dn?T.doneBg:'transparent',borderRadius:8,marginBottom:2,transition:'background 0.2s'}}>
                <button onClick={function(){toggleWarmup(ei,si)}} style={{background:'none',border:'none',fontSize:14,fontWeight:700,color:wu?'#60a5fa':dn?'#4ade80':T.muted,cursor:'pointer',fontFamily:'Outfit',padding:0,textAlign:'center'}}>{wu?'E':workIdx}</button>
                <div style={{fontSize:11,color:T.muted,textAlign:'center',overflow:'hidden',whiteSpace:'nowrap'}}>{pt}</div>
                <div style={{position:'relative'}}><input type="text" inputMode="decimal" value={set.weight} onChange={function(e){updateSet(ei,si,'weight',e.target.value)}} placeholder="0" style={{...S.ci,color:set.weight==='PDC'?GOLD:dn?'#4ade80':T.text,background:dn?T.doneBg:T.inputBg,paddingRight:ex&&ex.allow_bodyweight?28:4}}/>{ex&&ex.allow_bodyweight&&<button onClick={function(){updateSet(ei,si,'weight',set.weight==='PDC'?'':'PDC')}} style={{position:'absolute',right:3,top:'50%',transform:'translateY(-50%)',background:set.weight==='PDC'?'rgba(196,151,58,0.15)':'none',border:'none',fontSize:7,color:set.weight==='PDC'?GOLD:T.muted,cursor:'pointer',fontFamily:'Outfit',fontWeight:700,padding:'3px 4px',borderRadius:4,letterSpacing:'0.05em'}}>PDC</button>}</div>
                <input type="number" inputMode="numeric" value={set.reps} onChange={function(e){updateSet(ei,si,'reps',e.target.value)}} placeholder={pe.rep_min===pe.rep_max?''+pe.rep_min:pe.rep_min+'-'+pe.rep_max} style={{...S.ci,color:dn?'#4ade80':T.text,background:dn?T.doneBg:T.inputBg}}/>
                <button onClick={function(){validateSet(ei,si)}} style={{width:34,height:34,borderRadius:10,border:'none',background:dn?'#4ade80':T.inputBg,color:dn?'#000':T.muted,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:600,transition:'all 0.2s',boxShadow:dn?'0 2px 6px rgba(74,222,128,0.3)':'none'}}>✓</button>
              </div>)
            })}
            </div>

            {/* Add set button */}
            <button onClick={function(){addSet(ei)}} style={{width:'100%',padding:'10px',background:'rgba(255,255,255,0.02)',border:'1px dashed rgba(255,255,255,0.08)',borderRadius:10,color:'#555',fontSize:12,cursor:'pointer',fontFamily:'Outfit',margin:'8px 16px 16px',width:'calc(100% - 32px)',transition:'all 0.2s'}}>+ Ajouter une série</button>
          </div></div>)
        })}

        <button onClick={openAddExWorkout} style={{width:'100%',padding:'16px',background:'rgba(196,151,58,0.04)',border:'1px dashed rgba(196,151,58,0.2)',borderRadius:14,color:GOLD,fontSize:13,cursor:'pointer',fontFamily:'Outfit',marginTop:8,fontWeight:500,transition:'all 0.2s'}}>+ Ajouter un exercice</button>
      </div>

      {/* BOTTOM TIMER BAR */}
      {timerRunning&&(<div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:20,background:T.surface,borderTop:'1px solid '+T.border,padding:'14px 20px',paddingBottom:'max(14px, env(safe-area-inset-bottom))',boxShadow:'0 -4px 20px rgba(0,0,0,0.3)',backdropFilter:'blur(12px)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12}}>
          <button onClick={function(){adjustTimer(-15)}} style={S.timerBtn}>-15</button>
          <div style={{fontSize:36,fontWeight:700,color:GOLD,minWidth:100,textAlign:'center',fontFamily:'Outfit',letterSpacing:'-0.02em'}}>{fmt(timer)}</div>
          <button onClick={function(){adjustTimer(15)}} style={S.timerBtn}>+15</button>
          <button onClick={skipTimer} style={{...S.timerBtn,background:GOLD,color:'#000',fontWeight:600}}>Passer ›</button>
        </div>
        <div style={{marginTop:10,height:4,background:T.border,borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:(timerTotal>0?timer/timerTotal*100:0)+'%',background:'linear-gradient(90deg, '+GOLD+', #E2B95A)',borderRadius:4,transition:'width 1s linear'}}/></div>
      </div>)}

      {/* Add exercise modal */}
      {showAddExWo && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',zIndex:20,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={function(e){if(e.target===e.currentTarget){setShowAddExWo(false);setWoMuscle('');setWoEquip('')}}}>
          <div style={{background:'#1a1a1a',borderRadius:'16px 16px 0 0',padding:'20px',width:'100%',maxWidth:480,maxHeight:'70vh',overflow:'auto'}}>
            <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>Ajouter un exercice</div>
            <div style={{fontSize:11,color:'#7a7065',marginBottom:12}}>⚠️ Ton programme est conçu par ton coach — ajoute uniquement si nécessaire</div>
            <input placeholder="🔍 Rechercher..." value={woSearch} onChange={function(e){setWoSearch(e.target.value)}} style={{width:'100%',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 12px',color:'#f0ece4',fontSize:13,fontFamily:'Outfit',outline:'none',boxSizing:'border-box',marginBottom:6}} autoFocus/>
            <div style={{display:'flex',gap:4,marginBottom:10}}>
              <select value={woMuscle} onChange={function(e){setWoMuscle(e.target.value)}} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'6px',color:'#f0ece4',fontSize:10,fontFamily:'Outfit'}}><option value="">Tous les muscles</option>{(function(){var m=[];woExList.forEach(function(e){(e.muscle_group||'').split(',').forEach(function(g){g=g.trim();if(g&&m.indexOf(g)<0)m.push(g)})});m.sort();return m})().map(function(g){return <option key={g}>{g}</option>})}</select>
              <select value={woEquip} onChange={function(e){setWoEquip(e.target.value)}} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'6px',color:'#f0ece4',fontSize:10,fontFamily:'Outfit'}}><option value="">Tout l'équipement</option>{(function(){var m=[];woExList.forEach(function(e){if(e.equipment&&m.indexOf(e.equipment)<0)m.push(e.equipment)});m.sort();return m})().map(function(g){return <option key={g}>{g}</option>})}</select>
            </div>
            {woExList.filter(function(e){
              if(woMuscle&&(e.muscle_group||'').split(',').map(function(m){return m.trim()}).indexOf(woMuscle)<0)return false
              if(woEquip&&e.equipment!==woEquip)return false
              if(woSearch&&!e.name.toLowerCase().includes(woSearch.toLowerCase())&&!(e.muscle_group||'').toLowerCase().includes(woSearch.toLowerCase()))return false
              return true
            }).slice(0,20).map(function(ex){
              return <button key={ex.id} onClick={function(){addExerciseToWorkout(ex)}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:6,cursor:'pointer',marginBottom:3,fontFamily:'Outfit',color:'#f0ece4',textAlign:'left',fontSize:12}}>
                {ex.gif_url&&<img src={ex.gif_url} style={{width:28,height:28,borderRadius:4,objectFit:'cover'}}/>}
                <div style={{flex:1}}>{ex.name}</div>
                <div style={{fontSize:10,color:GOLD}}>{ex.muscle_group}</div>
              </button>
            })}
            <button onClick={function(){setShowAddExWo(false);setWoMuscle('');setWoEquip('')}} style={{width:'100%',padding:'12px',background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#7a7065',fontSize:13,cursor:'pointer',fontFamily:'Outfit',marginTop:8}}>Fermer</button>
          </div>
        </div>
      )}
      {/* Exercise detail page */}
      {exDetailIdx !== null && exercises[exDetailIdx] && (function() {
        var dex = exercises[exDetailIdx].ex
        var dpe = exercises[exDetailIdx].pe
        if (!dex) return null
        // Calculate PRs from history
        var maxWeight = 0, max1RM = 0, maxVol = '', maxVolVal = 0
        exHistory.forEach(function(h) {
          var w = parseFloat(h.weight_kg) || 0, r = parseInt(h.reps) || 0
          if (w > maxWeight) maxWeight = w
          var orm = w * (1 + r / 30)
          if (orm > max1RM) max1RM = orm
          if (w * r > maxVolVal) { maxVolVal = w * r; maxVol = w + 'kg × ' + r }
        })
        // Chart data - last 20 sessions
        var chartData = exHistory.slice(0, 20).reverse().map(function(h) { return parseFloat(h.weight_kg) || 0 })
        var chartDates = exHistory.slice(0, 20).reverse().map(function(h) { return new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) })

        return <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#121212',zIndex:40,overflow:'auto'}}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',padding:'16px 20px',borderBottom:'1px solid #2a2a2a',background:'#1a1a1a'}}>
            <button onClick={function(){setExDetailIdx(null)}} style={{background:'none',border:'none',color:GOLD,fontSize:20,cursor:'pointer',padding:'4px 8px',fontFamily:'Outfit'}}>←</button>
            <div style={{flex:1,textAlign:'center',fontSize:16,fontWeight:600,color:'#f0ece4'}}>{dex.name}</div>
            <div style={{width:36}}/>
          </div>

          {/* GIF */}
          {dex.gif_url&&<div style={{background:'#f5f5f0',padding:'24px',textAlign:'center'}}><img src={dex.gif_url} style={{maxWidth:'85%',maxHeight:280,objectFit:'contain'}}/></div>}

          {/* Info */}
          <div style={{padding:'20px'}}>
            <div style={{fontSize:24,fontWeight:700,marginBottom:8,color:'#f0ece4'}}>{dex.name}</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
              {dex.muscle_group&&dex.muscle_group.split(',').map(function(m){return <span key={m} style={{padding:'4px 10px',borderRadius:20,background:'rgba(196,151,58,0.15)',border:'1px solid rgba(196,151,58,0.3)',fontSize:11,color:GOLD}}>{m.trim()}</span>})}
              {dex.secondary_muscle&&dex.secondary_muscle.split(',').map(function(m){return <span key={m} style={{padding:'4px 10px',borderRadius:20,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',fontSize:11,color:'#aaa'}}>{m.trim()}</span>})}
              {dex.equipment&&<span style={{padding:'4px 10px',borderRadius:20,background:'rgba(96,165,250,0.1)',border:'1px solid rgba(96,165,250,0.2)',fontSize:11,color:'#60a5fa'}}>{dex.equipment}</span>}
            </div>

            {/* Progress chart */}
            {chartData.length > 1 && <div style={{marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:600,color:GOLD,marginBottom:12}}>📊 Progression</div>
              <div style={{background:'#111',borderRadius:12,padding:'16px',border:'1px solid #1a1a1a'}}>
                <div style={{display:'flex',alignItems:'flex-end',gap:3,height:100}}>
                  {chartData.map(function(v,i) {
                    var max = Math.max.apply(null, chartData) || 1
                    var h = Math.max(4, (v / max) * 90)
                    return <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                      <div style={{width:'100%',height:h,background:i===chartData.length-1?GOLD:'rgba(196,151,58,0.3)',borderRadius:3,transition:'height 0.3s'}}/>
                    </div>
                  })}
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
                  <span style={{fontSize:9,color:'#555'}}>{chartDates[0]||''}</span>
                  <span style={{fontSize:9,color:'#555'}}>{chartDates[chartDates.length-1]||''}</span>
                </div>
              </div>
            </div>}

            {/* Personal Records */}
            {maxWeight > 0 && <div style={{marginBottom:24}}>
              <div style={{fontSize:13,fontWeight:600,color:GOLD,marginBottom:12}}>🏆 Records personnels</div>
              <div style={{background:'#111',borderRadius:12,border:'1px solid #1a1a1a',overflow:'hidden'}}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#999',fontSize:13}}>Plus gros poids</span><span style={{color:GOLD,fontWeight:600,fontSize:14}}>{maxWeight}kg</span></div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid #1a1a1a'}}><span style={{color:'#999',fontSize:13}}>Meilleur 1RM</span><span style={{color:GOLD,fontWeight:600,fontSize:14}}>{Math.round(max1RM * 10) / 10}kg</span></div>
                {maxVol&&<div style={{display:'flex',justifyContent:'space-between',padding:'14px 16px'}}><span style={{color:'#999',fontSize:13}}>Meilleur volume</span><span style={{color:GOLD,fontWeight:600,fontSize:14}}>{maxVol}</span></div>}
              </div>
            </div>}

            {/* Instructions - collapsible */}
            {dex.description&&<div style={{marginBottom:12}}>
              <button onClick={function(){setExpandedSection(expandedSection==='detail_tech'?null:'detail_tech')}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',background:'#111',border:'1px solid #1a1a1a',padding:'14px 16px',cursor:'pointer',fontFamily:'Outfit',color:'#f0ece4',fontSize:14,fontWeight:500,borderRadius:12}}>
                <span>📋 Instructions</span>
                <span style={{color:'#555'}}>{expandedSection==='detail_tech'?'▲':'▼'}</span>
              </button>
              {expandedSection==='detail_tech'&&<div style={{padding:'14px 16px',background:'#111',borderRadius:'0 0 12px 12px',borderTop:'none'}}>
                {dex.description.split('\n').filter(function(l){return l.trim()}).map(function(line,i){
                  var cleaned=line.replace(/^\d+[\.\)]\s*/,'').trim()
                  return cleaned?<div key={i} style={{display:'flex',gap:10,marginBottom:8}}><div style={{width:22,height:22,borderRadius:6,background:'rgba(196,151,58,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:GOLD,flexShrink:0}}>{i+1}</div><div style={{fontSize:14,color:'#ccc',lineHeight:1.6}}>{cleaned}</div></div>:null
                })}
              </div>}
            </div>}

            {dex.tips&&<div style={{marginBottom:12}}>
              <button onClick={function(){setExpandedSection(expandedSection==='detail_tips'?null:'detail_tips')}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',background:'rgba(196,151,58,0.04)',border:'1px solid rgba(196,151,58,0.1)',padding:'14px 16px',cursor:'pointer',fontFamily:'Outfit',color:GOLD,fontSize:14,fontWeight:500,borderRadius:12}}>
                <span>💡 Conseils du coach</span>
                <span style={{color:'#555'}}>{expandedSection==='detail_tips'?'▲':'▼'}</span>
              </button>
              {expandedSection==='detail_tips'&&<div style={{padding:'14px 16px',fontSize:14,color:'#ccc',lineHeight:1.7,background:'rgba(196,151,58,0.02)',borderRadius:'0 0 12px 12px'}}>{dex.tips}</div>}
            </div>}

            {dex.video_url&&<a href={dex.video_url} target="_blank" style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',background:'#111',border:'1px solid #1a1a1a',borderRadius:12,color:GOLD,fontSize:14,textDecoration:'none',fontFamily:'Outfit'}}>▶ Voir la vidéo</a>}
          </div>
        </div>
      })()}

      {swapIdx !== null && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',zIndex:20,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={function(e){if(e.target===e.currentTarget)setSwapIdx(null)}}>
          <div style={{background:'#1a1a1a',borderRadius:'16px 16px 0 0',padding:'20px',width:'100%',maxWidth:480,maxHeight:'60vh',overflow:'auto'}}>
            <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>Remplacer l'exercice</div>
            <div style={{fontSize:11,color:'#7a7065',marginBottom:16}}>Même muscle : {(exercises[swapIdx]&&exercises[swapIdx].ex&&exercises[swapIdx].ex.muscle_group)}</div>
            {/* Coach recommended alternatives */}
            {swapAlts.length > 0 && <div style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:GOLD,marginBottom:6}}>{t('sport.recommended')}</div>
              {swapList.filter(function(ex){return swapAlts.includes(ex.id)}).map(function(ex){
                return <button key={ex.id} onClick={function(){confirmSwap(ex)}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'rgba(196,151,58,0.06)',border:'1px solid rgba(196,151,58,0.2)',borderRadius:10,cursor:'pointer',marginBottom:4,fontFamily:'Outfit',color:'#f0ece4',textAlign:'left',fontSize:13}}>
                  {ex.gif_url&&<img src={ex.gif_url} style={{width:36,height:36,borderRadius:8,objectFit:'cover'}}/>}
                  <div style={{flex:1}}><div>{ex.name}</div><div style={{fontSize:10,color:GOLD}}>{t('sport.recommended')}</div></div>
                  <span style={{color:GOLD}}>→</span>
                </button>
              })}
            </div>}
            {/* Other alternatives */}
            {swapAlts.length > 0 && swapList.filter(function(ex){return !swapAlts.includes(ex.id)}).length > 0 && <div style={{fontSize:11,color:'#555',marginBottom:6}}>Autres alternatives</div>}
            {swapList.filter(function(ex){return !swapAlts.includes(ex.id)}).map(function(ex){
              return <button key={ex.id} onClick={function(){confirmSwap(ex)}} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8,cursor:'pointer',marginBottom:4,fontFamily:'Outfit',color:'#f0ece4',textAlign:'left',fontSize:13}}>
                {ex.gif_url&&<img src={ex.gif_url} style={{width:32,height:32,borderRadius:6,objectFit:'cover'}}/>}
                <div style={{flex:1}}>{ex.name}</div>
                <span style={{color:GOLD}}>→</span>
              </button>
            })}
            {swapList.length===0&&<div style={{color:'#555',textAlign:'center',padding:20}}>Aucun exercice alternatif</div>}
            <button onClick={function(){setSwapIdx(null)}} style={{width:'100%',padding:'12px',background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#7a7065',fontSize:13,cursor:'pointer',fontFamily:'Outfit',marginTop:8}}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}

var S={
  full:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'#0a0a0a',color:'#f0ece4',zIndex:9999,fontFamily:'Outfit,sans-serif',overflow:'auto',paddingTop:'max(env(safe-area-inset-top),0px)',WebkitOverflowScrolling:'touch'},
  btnG:{background:GOLD,color:'#000',border:'none',borderRadius:10,padding:'16px',fontSize:15,fontWeight:500,cursor:'pointer',fontFamily:'Outfit',width:'100%',transition:'all 0.2s',boxShadow:'0 2px 8px rgba(196,151,58,0.25)'},
  btnO:{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'14px',fontSize:13,color:'#7a7065',cursor:'pointer',fontFamily:'Outfit',width:'100%',transition:'all 0.2s'},
  stat:{background:'rgba(255,255,255,0.04)',borderRadius:14,padding:'16px 24px',textAlign:'center',border:'1px solid rgba(255,255,255,0.06)'},
  statL:{fontSize:10,color:'#7a7065',textTransform:'uppercase',letterSpacing:'0.1em',marginTop:4,fontWeight:500},
  th:{fontSize:9,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'#555',textAlign:'center'},
  ci:{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'8px 4px',fontSize:15,fontWeight:500,textAlign:'center',fontFamily:'Outfit',outline:'none',boxSizing:'border-box',color:'#f0ece4',transition:'border-color 0.2s'},
  timerBtn:{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:10,padding:'8px 18px',fontSize:14,fontWeight:600,color:GOLD,cursor:'pointer',fontFamily:'Outfit',transition:'all 0.2s'},
  miniBtn:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:8,padding:'6px 10px',fontSize:11,color:'#888',cursor:'pointer',fontFamily:'Outfit',transition:'all 0.2s'},
  addBtn:{background:'none',border:'1px dashed rgba(255,255,255,0.08)',borderRadius:8,padding:'5px 14px',fontSize:11,color:'#555',cursor:'pointer',fontFamily:'Outfit',transition:'all 0.2s'},
}
