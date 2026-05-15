import { useState, useEffect } from 'react'

const GOLD = '#C4973A'
const TABS = [
  { id: 'history', label: '📊 Historique', icon: '📊' },
  { id: 'info', label: '👤 Infos', icon: '👤' },
  { id: 'body', label: '📏 Corps', icon: '📏' },
  { id: 'manage', label: '⚙️ Gestion', icon: '⚙️' },
  { id: 'progress', label: '📈 Progression', icon: '📈' },
]

var ACTIVITY_LEVELS = [
  { v: 'sedentary', l: 'Sédentaire', f: 1.2, d: 'Peu ou pas d\'exercice' },
  { v: 'light', l: 'Légèrement actif', f: 1.375, d: '1-3 jours/semaine' },
  { v: 'moderate', l: 'Modérément actif', f: 1.55, d: '3-5 jours/semaine' },
  { v: 'active', l: 'Actif', f: 1.725, d: '6-7 jours/semaine' },
  { v: 'very_active', l: 'Très actif', f: 1.9, d: '2x/jour ou travail physique' },
]

function fmtDate(d) { if (!d) return '—'; var dt = new Date(d); return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) }
function fmtTime(d) { if (!d) return ''; var dt = new Date(d); return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
function daysSince(d) { if (!d) return null; return Math.floor((Date.now() - new Date(d).getTime()) / 86400000) }

export default function ClientProfile({ client, supabase, onClose, onUpdate }) {
  var [tab, setTab] = useState('history')
  var [bookings, setBookings] = useState([])
  var [workoutLogs, setWorkoutLogs] = useState([])
  var [bodyData, setBodyData] = useState([])
  var [prs, setPrs] = useState([])
  var [editInfo, setEditInfo] = useState(null)
  var [bodyForm, setBodyForm] = useState({})
  var [saving, setSaving] = useState(false)
  var [msg, setMsg] = useState('')

  var c = client
  var ma = {}; try { ma = typeof c.module_access === 'string' ? JSON.parse(c.module_access) : (c.module_access || {}) } catch(e) {}

  useEffect(function() { loadData() }, [c.id])

  async function loadData() {
    var [bk, wl, bd, pr] = await Promise.all([
      supabase.from('bookings').select('*, time_slots(start_time, end_time)').eq('client_id', c.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('workout_logs').select('*').eq('user_id', c.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('body_measurements').select('*').eq('client_id', c.id).order('date', { ascending: false }).limit(20),
      supabase.from('personal_records').select('*, exercises(name)').eq('client_id', c.id).order('created_at', { ascending: false }).limit(20),
    ])
    setBookings(bk.data || [])
    setWorkoutLogs(wl.data || [])
    setBodyData(bd.data || [])
    setPrs(pr.data || [])
  }

  async function saveInfo() {
    if (!editInfo) return
    setSaving(true)
    await supabase.from('profiles').update(editInfo).eq('id', c.id)
    setSaving(false)
    setEditInfo(null)
    setMsg('✅ Informations mises à jour')
    setTimeout(function() { setMsg('') }, 2000)
    if (onUpdate) onUpdate()
  }

  async function saveBody() {
    if (!bodyForm.weight && !bodyForm.waist) return
    await supabase.from('body_measurements').insert({ client_id: c.id, date: new Date().toISOString().split('T')[0], weight: bodyForm.weight || null, waist: bodyForm.waist || null, hips: bodyForm.hips || null, chest: bodyForm.chest || null, arms: bodyForm.arms || null, thighs: bodyForm.thighs || null })
    setBodyForm({})
    setMsg('📏 Mensurations enregistrées')
    setTimeout(function() { setMsg('') }, 2000)
    loadData()
  }

  async function toggleAccess(key) {
    var newMa = Object.assign({}, ma, { [key]: !ma[key] })
    await supabase.from('profiles').update({ module_access: JSON.stringify(newMa) }).eq('id', c.id)
    if (onUpdate) onUpdate()
  }

  async function updateCredits(delta) {
    await supabase.from('profiles').update({ credits: (c.credits || 0) + delta }).eq('id', c.id)
    if (onUpdate) onUpdate()
  }

  // BMR & TDEE calculation (Harris-Benedict)
  var latestBody = bodyData[0] || {}
  var weight = latestBody.weight || c.weight || 0
  var height = c.height || 170 // default 170cm
  var age = c.birth_date ? Math.floor((Date.now() - new Date(c.birth_date).getTime()) / (365.25 * 86400000)) : 30
  var gender = c.gender || 'male'
  var bmr = gender === 'female' ? 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age) : 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
  var actLevel = ACTIVITY_LEVELS.find(function(a) { return a.v === (c.activity_level || 'moderate') }) || ACTIVITY_LEVELS[2]
  var tdee = Math.round(bmr * actLevel.f)
  var bmi = weight && height ? (weight / ((height / 100) * (height / 100))).toFixed(1) : null

  var S = {
    card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 10 },
    label: { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 },
    value: { fontSize: 14, fontWeight: 500, color: 'var(--text)' },
    input: { width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', boxSizing: 'border-box' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' },
  }

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, paddingTop: 8 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit', padding: 0 }}>← Retour</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{c.full_name || '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email} {c.last_seen ? '· Vu ' + fmtDate(c.last_seen) : '· Jamais connecté'}</div>
        </div>
      </div>

      {msg && <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, fontSize: 12, color: '#4ade80', marginBottom: 10, textAlign: 'center' }}>{msg}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        {TABS.map(function(t) {
          var isActive = tab === t.id
          return <button key={t.id} onClick={function() { setTab(t.id) }} style={{ padding: '8px 14px', borderRadius: 20, border: isActive ? '2px solid ' + GOLD : '1px solid var(--border)', background: isActive ? 'rgba(196,151,58,0.08)' : 'transparent', color: isActive ? GOLD : 'var(--muted)', fontSize: 11, fontWeight: isActive ? 700 : 400, cursor: 'pointer', fontFamily: 'Outfit', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{t.label}</button>
        })}
      </div>

      {/* ═══ HISTORIQUE ═══ */}
      {tab === 'history' && <div>
        <div style={S.card}>
          <div style={S.label}>Dernière connexion</div>
          <div style={S.value}>{c.last_seen ? fmtDate(c.last_seen) + ' à ' + fmtTime(c.last_seen) + ' (' + daysSince(c.last_seen) + 'j)' : 'Jamais connecté'}</div>
        </div>

        <div style={S.label}>Réservations récentes</div>
        {bookings.length === 0 && <div style={{ ...S.card, color: 'var(--muted)', fontSize: 12 }}>Aucune réservation</div>}
        {bookings.slice(0, 5).map(function(b) {
          var st = b.time_slots || {}
          return <div key={b.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(st.start_time)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtTime(st.start_time)} {b.location ? '· ' + b.location.substring(0, 30) : ''}</div>
            </div>
            <div style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: b.status === 'confirmed' ? 'rgba(74,222,128,0.1)' : b.status === 'cancelled' ? 'rgba(248,113,113,0.1)' : 'rgba(196,151,58,0.1)', color: b.status === 'confirmed' ? '#4ade80' : b.status === 'cancelled' ? '#f87171' : GOLD }}>{b.status === 'confirmed' ? '✅' : b.status === 'cancelled' ? '❌' : '⏳'} {b.status}</div>
          </div>
        })}

        <div style={{ ...S.label, marginTop: 12 }}>Dernières séances</div>
        {workoutLogs.length === 0 && <div style={{ ...S.card, color: 'var(--muted)', fontSize: 12 }}>Aucune séance enregistrée</div>}
        {workoutLogs.slice(0, 5).map(function(wl) {
          return <div key={wl.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{wl.program_name || 'Séance'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(wl.created_at)}</div>
            </div>
            <div style={{ fontSize: 11, color: GOLD }}>{wl.duration_minutes ? wl.duration_minutes + ' min' : ''}</div>
          </div>
        })}
      </div>}

      {/* ═══ INFORMATIONS ═══ */}
      {tab === 'info' && <div>
        {!editInfo ? <div>
          {[
            { l: 'Nom complet', v: c.full_name },
            { l: 'Email', v: c.email },
            { l: 'Téléphone', v: c.phone || '—' },
            { l: 'Date de naissance', v: c.birth_date ? fmtDate(c.birth_date) + ' (' + age + ' ans)' : '—' },
            { l: 'Adresse', v: c.address || '—' },
            { l: 'Type de coaching', v: c.coaching_type === 'domicile' ? '🏠 Domicile' : c.coaching_type === 'online' ? '📱 En ligne' : '🏋️ Présentiel' },
            { l: 'Sexe', v: c.gender === 'female' ? '♀ Femme' : c.gender === 'male' ? '♂ Homme' : '—' },
            { l: 'Inscrit le', v: fmtDate(c.created_at) },
          ].map(function(f) {
            return <div key={f.l} style={S.row}><div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.l}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.v}</div></div>
          })}
          <button onClick={function() { setEditInfo({ full_name: c.full_name || '', email: c.email || '', phone: c.phone || '', birth_date: c.birth_date || '', address: c.address || '', coaching_type: c.coaching_type || 'presentiel', gender: c.gender || '', height: c.height || '' }) }} style={{ width: '100%', marginTop: 12, padding: '10px', background: GOLD, color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>✏️ Modifier</button>
        </div> : <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ gridColumn: 'span 2' }}><div style={S.label}>Nom</div><input value={editInfo.full_name} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { full_name: e.target.value }) }) }} style={S.input} /></div>
            <div><div style={S.label}>Email</div><input value={editInfo.email} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { email: e.target.value }) }) }} style={S.input} /></div>
            <div><div style={S.label}>Téléphone</div><input value={editInfo.phone} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { phone: e.target.value }) }) }} style={S.input} /></div>
            <div><div style={S.label}>Date naissance</div><input type="date" value={editInfo.birth_date} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { birth_date: e.target.value }) }) }} style={S.input} /></div>
            <div><div style={S.label}>Sexe</div><select value={editInfo.gender} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { gender: e.target.value }) }) }} style={S.input}><option value="">—</option><option value="male">♂ Homme</option><option value="female">♀ Femme</option></select></div>
            <div><div style={S.label}>Taille (cm)</div><input type="number" value={editInfo.height} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { height: parseInt(e.target.value) || '' }) }) }} style={S.input} /></div>
            <div><div style={S.label}>Type</div><select value={editInfo.coaching_type} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { coaching_type: e.target.value }) }) }} style={S.input}><option value="presentiel">🏋️ Présentiel</option><option value="domicile">🏠 Domicile</option><option value="online">📱 En ligne</option></select></div>
            <div style={{ gridColumn: 'span 2' }}><div style={S.label}>Adresse</div><input value={editInfo.address} onChange={function(e) { setEditInfo(function(d) { return Object.assign({}, d, { address: e.target.value }) }) }} style={S.input} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveInfo} disabled={saving} style={{ flex: 1, padding: '10px', background: GOLD, color: '#000', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>{saving ? '...' : '💾 Enregistrer'}</button>
            <button onClick={function() { setEditInfo(null) }} style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>Annuler</button>
          </div>
        </div>}
      </div>}

      {/* ═══ CORPS & SANTÉ ═══ */}
      {tab === 'body' && <div>
        {/* Stats cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ ...S.card, textAlign: 'center' }}><div style={S.label}>Poids</div><div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{weight || '—'}</div><div style={{ fontSize: 9, color: 'var(--muted)' }}>kg</div></div>
          <div style={{ ...S.card, textAlign: 'center' }}><div style={S.label}>Taille</div><div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{c.height || '—'}</div><div style={{ fontSize: 9, color: 'var(--muted)' }}>cm</div></div>
          <div style={{ ...S.card, textAlign: 'center' }}><div style={S.label}>IMC</div><div style={{ fontSize: 22, fontWeight: 700, color: bmi && bmi < 18.5 ? '#60a5fa' : bmi && bmi < 25 ? '#4ade80' : bmi && bmi < 30 ? '#fbbf24' : '#f87171' }}>{bmi || '—'}</div><div style={{ fontSize: 9, color: 'var(--muted)' }}>{bmi ? (bmi < 18.5 ? 'Maigreur' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Surpoids' : 'Obésité') : ''}</div></div>
        </div>

        {/* Activity level */}
        <div style={S.card}>
          <div style={S.label}>Niveau d'activité</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {ACTIVITY_LEVELS.map(function(al) {
              var isActive = (c.activity_level || 'moderate') === al.v
              return <button key={al.v} onClick={async function() {
                await supabase.from('profiles').update({ activity_level: al.v }).eq('id', c.id)
                if (onUpdate) onUpdate()
              }} style={{ padding: '6px 10px', borderRadius: 8, border: isActive ? '2px solid ' + GOLD : '1px solid var(--border)', background: isActive ? 'rgba(196,151,58,0.08)' : 'transparent', color: isActive ? GOLD : 'var(--muted)', fontSize: 10, cursor: 'pointer', fontFamily: 'Outfit' }}>{al.l}</button>
            })}
          </div>
        </div>

        {/* BMR & TDEE */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div style={{ ...S.card, textAlign: 'center' }}><div style={S.label}>Métabolisme de base</div><div style={{ fontSize: 24, fontWeight: 700, color: GOLD }}>{weight ? Math.round(bmr) : '—'}</div><div style={{ fontSize: 9, color: 'var(--muted)' }}>kcal/jour (BMR)</div></div>
          <div style={{ ...S.card, textAlign: 'center' }}><div style={S.label}>Dépense journalière</div><div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80' }}>{weight ? tdee : '—'}</div><div style={{ fontSize: 9, color: 'var(--muted)' }}>kcal/jour (TDEE)</div></div>
        </div>

        {/* Body measurements form */}
        <div style={S.card}>
          <div style={S.label}>Nouvelles mensurations</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
            {[{ k: 'weight', l: '⚖️ Poids (kg)' }, { k: 'waist', l: '📐 Taille (cm)' }, { k: 'hips', l: '🍑 Hanches' }, { k: 'chest', l: '💪 Poitrine' }, { k: 'arms', l: '💪 Bras' }, { k: 'thighs', l: '🦵 Cuisses' }].map(function(f) {
              return <div key={f.k}><div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>{f.l}</div><input inputMode="decimal" value={bodyForm[f.k] || ''} onChange={function(e) { setBodyForm(function(b) { var n = {}; for (var x in b) n[x] = b[x]; n[f.k] = e.target.value; return n }) }} placeholder="—" style={{ ...S.input, textAlign: 'center', fontSize: 12, padding: '6px' }} /></div>
            })}
          </div>
          <button onClick={saveBody} style={{ width: '100%', marginTop: 8, padding: '8px', background: GOLD, color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>📏 Enregistrer</button>
        </div>

        {/* History */}
        {bodyData.length > 0 && <div>
          <div style={{ ...S.label, marginTop: 8 }}>Historique</div>
          {bodyData.slice(0, 5).map(function(bd) {
            return <div key={bd.id} style={{ ...S.card, display: 'flex', gap: 12, fontSize: 11 }}>
              <div style={{ color: 'var(--muted)', minWidth: 70 }}>{fmtDate(bd.date)}</div>
              {bd.weight && <div>⚖️ {bd.weight}kg</div>}
              {bd.waist && <div>📐 {bd.waist}cm</div>}
              {bd.hips && <div>🍑 {bd.hips}</div>}
              {bd.chest && <div>💪 {bd.chest}</div>}
              {bd.arms && <div>💪 {bd.arms}</div>}
              {bd.thighs && <div>🦵 {bd.thighs}</div>}
            </div>
          })}
        </div>}
      </div>}

      {/* ═══ GESTION ═══ */}
      {tab === 'manage' && <div>
        {/* Credits */}
        <div style={S.card}>
          <div style={S.label}>Crédits de séance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <button onClick={function() { updateCredits(-1) }} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)', color: '#f87171', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>−</button>
            <div style={{ fontSize: 32, fontWeight: 800, color: GOLD, minWidth: 50, textAlign: 'center' }}>{c.credits || 0}</div>
            <button onClick={function() { updateCredits(1) }} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.06)', color: '#4ade80', fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>+</button>
            <button onClick={function() { updateCredits(5) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(196,151,58,0.3)', background: 'rgba(196,151,58,0.06)', color: GOLD, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>+5</button>
            <button onClick={function() { updateCredits(10) }} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(196,151,58,0.3)', background: 'rgba(196,151,58,0.06)', color: GOLD, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>+10</button>
          </div>
        </div>

        {/* Module access */}
        <div style={S.card}>
          <div style={S.label}>Accès aux modules</div>
          {[
            { key: 'reservation', label: '📅 Réservation' },
            { key: 'sport', label: '🏋️ Sport & Programmes' },
            { key: 'nutrition', label: '🥗 Nutrition' },
          ].map(function(mod) {
            var isOn = ma[mod.key] !== false
            return <button key={mod.key} onClick={function() { toggleAccess(mod.key) }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 13, color: 'var(--text)', textAlign: 'left' }}>
              <div style={{ width: 40, height: 22, borderRadius: 11, background: isOn ? '#4ade80' : '#555', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}><div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff', position: 'absolute', top: 2, left: isOn ? 20 : 2, transition: 'all 0.2s' }} /></div>
              <span>{mod.label}</span>
            </button>
          })}
        </div>

        {/* Notes */}
        <div style={S.card}>
          <div style={S.label}>Notes coach</div>
          <textarea value={c.coach_notes || ''} onChange={async function(e) {
            await supabase.from('profiles').update({ coach_notes: e.target.value }).eq('id', c.id)
          }} placeholder="Notes privées sur le client..." rows={4} style={{ ...S.input, resize: 'vertical', fontSize: 12 }} />
        </div>
      </div>}

      {/* ═══ PROGRESSION ═══ */}
      {tab === 'progress' && <div>
        <div style={S.label}>Records personnels</div>
        {prs.length === 0 && <div style={{ ...S.card, color: 'var(--muted)', fontSize: 12 }}>Aucun record enregistré</div>}
        {prs.slice(0, 10).map(function(pr) {
          return <div key={pr.id} style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{pr.exercises ? pr.exercises.name : '?'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(pr.created_at)}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>{pr.weight}kg × {pr.reps}</div>
          </div>
        })}

        <div style={{ ...S.label, marginTop: 12 }}>Séances réalisées</div>
        <div style={{ ...S.card, textAlign: 'center' }}>
          <div style={{ fontSize: 42, fontWeight: 800, color: GOLD }}>{workoutLogs.length}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>séances enregistrées</div>
        </div>
      </div>}
    </div>
  )
}
