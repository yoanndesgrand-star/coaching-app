import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'

var GOLD = '#C4973A'

export default function ProgressionChart({ clientId, exercises }) {
  var [selectedExercise, setSelectedExercise] = useState('')
  var [history, setHistory] = useState([])
  var [loading, setLoading] = useState(false)

  useEffect(function() { if (selectedExercise) loadHistory() }, [selectedExercise])

  async function loadHistory() {
    setLoading(true)
    var { data: sets } = await supabase
      .from('workout_sets')
      .select('weight_kg, reps, set_number, set_type, workout_logs!inner(completed_at, client_id)')
      .eq('exercise_id', selectedExercise)
      .eq('workout_logs.client_id', clientId)
      .order('workout_logs(completed_at)', { ascending: true })

    if (!sets || sets.length === 0) { setHistory([]); setLoading(false); return }

    // Group by session date
    var sessions = {}
    sets.forEach(function(s) {
      var date = new Date(s.workout_logs.completed_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      var fullDate = new Date(s.workout_logs.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      if (!sessions[date]) sessions[date] = { date: date, fullDate: fullDate, sets: [], maxWeight: 0, totalVolume: 0, maxReps: 0 }
      sessions[date].sets.push(s)
      if (s.weight_kg > sessions[date].maxWeight) sessions[date].maxWeight = s.weight_kg
      if (s.reps > sessions[date].maxReps) sessions[date].maxReps = s.reps
      sessions[date].totalVolume += (s.weight_kg || 0) * (s.reps || 0)
    })

    setHistory(Object.values(sessions))
    setLoading(false)
  }

  var exerciseName = ''
  if (selectedExercise && exercises) {
    var ex = exercises.find(function(e) { return e.id === selectedExercise })
    if (ex) exerciseName = ex.name
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>📈 Progression</div>
        <select value={selectedExercise} onChange={function(e) { setSelectedExercise(e.target.value) }} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'Outfit', fontSize: 13 }}>
          <option value="">Choisir un exercice...</option>
          {(exercises || []).map(function(ex) {
            return <option key={ex.id} value={ex.id}>{ex.name} — {ex.muscle_group}</option>
          })}
        </select>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Chargement...</div>}

      {!loading && selectedExercise && history.length === 0 && (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>Aucune donnée pour cet exercice.</div>
      )}

      {!loading && history.length > 0 && (
        <div>
          {/* Chart */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 8px 8px 0', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8, paddingLeft: 16 }}>{exerciseName} — Charge max (kg)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#7a7065', fontSize: 10 }} />
                <YAxis tick={{ fill: '#7a7065', fontSize: 10 }} width={35} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12, fontFamily: 'Outfit' }}
                  labelStyle={{ color: GOLD }}
                  formatter={function(value, name) { return [value + (name === 'totalVolume' ? ' kg·reps' : ' kg'), name === 'maxWeight' ? 'Charge max' : 'Volume total'] }}
                />
                <Line type="monotone" dataKey="maxWeight" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD, r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="totalVolume" stroke="#4ade80" strokeWidth={1} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}><div style={{ width: 12, height: 2, background: GOLD }} /> Charge max</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}><div style={{ width: 12, height: 2, background: '#4ade80', borderTop: '1px dashed #4ade80' }} /> Volume</div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: GOLD }}>{Math.max.apply(null, history.map(function(h) { return h.maxWeight }))} kg</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Record</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{history.length}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Séances</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: (function() { if (history.length < 2) return 'var(--text)'; var diff = history[history.length-1].maxWeight - history[0].maxWeight; return diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : 'var(--text)' })() }}>
                {history.length >= 2 ? (function() { var diff = history[history.length-1].maxWeight - history[0].maxWeight; return (diff > 0 ? '+' : '') + diff + ' kg' })() : '—'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>Progression</div>
            </div>
          </div>

          {/* Detailed table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ fontSize: 12, fontWeight: 500, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>Historique détaillé</div>
            {history.slice().reverse().map(function(session, si) {
              return (
                <div key={si} style={{ borderBottom: si < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(196,151,58,0.03)' }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{session.fullDate}</div>
                    <div style={{ fontSize: 11, color: GOLD }}>{session.maxWeight} kg max</div>
                  </div>
                  <div style={{ padding: '4px 14px 8px' }}>
                    <div style={{ display: 'flex', gap: 4, fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
                      <div style={{ width: 40 }}>Série</div>
                      <div style={{ flex: 1 }}>Poids</div>
                      <div style={{ flex: 1 }}>Reps</div>
                      <div style={{ flex: 1, textAlign: 'right' }}>Volume</div>
                    </div>
                    {session.sets.map(function(set, i) {
                      return (
                        <div key={i} style={{ display: 'flex', gap: 4, fontSize: 12, padding: '3px 0' }}>
                          <div style={{ width: 40, color: 'var(--muted)' }}>{set.set_type === 'warmup' ? 'E' : set.set_number}</div>
                          <div style={{ flex: 1 }}>{set.weight_kg} kg</div>
                          <div style={{ flex: 1 }}>{set.reps} reps</div>
                          <div style={{ flex: 1, textAlign: 'right', color: 'var(--muted)' }}>{(set.weight_kg * set.reps).toFixed(0)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
