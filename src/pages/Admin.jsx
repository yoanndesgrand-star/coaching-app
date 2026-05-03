import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const SUBSCRIPTION_TYPES = [
  { value: 'presentiel',              label: '🏋️ Présentiel seul',              price: null },
  { value: 'domicile',                label: '🏠 Coaching à domicile',           price: null },
  { value: 'sport_online',            label: '📱 Sport en ligne',                price: '59€/mois' },
  { value: 'nutrition',               label: '🥗 Nutrition',                     price: '119€/mois' },
  { value: 'sport_nutrition',         label: '💪 Sport + Nutrition',             price: '149€/mois' },
  { value: 'presentiel_sport',        label: '🏋️📱 Présentiel + Sport',          price: 'crédits + 59€/mois' },
  { value: 'presentiel_nutrition',    label: '🏋️🥗 Présentiel + Nutrition',      price: 'crédits + 119€/mois' },
  { value: 'presentiel_sport_nutrition', label: '🏋️💪 Présentiel + Sport + Nutrition', price: 'crédits + 149€/mois' },
]

export default function Admin({ profile }) {
  const [clients, setClients] = useState([])
  const [bookings, setBookings] = useState([])
  const [tab, setTab] = useState('clients')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)
  const [creditForm, setCreditForm] = useState({ clientId: '', amount: 1 })

  // Horaires
  const [openingHours, setOpeningHours] = useState([])
  const [settings, setSettings] = useState({ session_duration: 60, buffer_time: 10 })
  const [blockedPeriods, setBlockedPeriods] = useState([])
  const [newBlock, setNewBlock] = useState({ date: '', start_time: '', end_time: '', reason: '' })
  const [savingHours, setSavingHours] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [c, b, oh, st, bp] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, profiles(full_name, email), time_slots(start_time, end_time)').order('created_at', { ascending: false }),
      supabase.from('opening_hours').select('*').order('day_of_week'),
      supabase.from('coaching_settings').select('*').eq('id', 'admin').single(),
      supabase.from('blocked_periods').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date'),
    ])
    setClients(c.data || [])
    setBookings(b.data || [])
    setSettings(st.data || { session_duration: 60, buffer_time: 10 })
    setBlockedPeriods(bp.data || [])

    // Initialiser les horaires pour les 7 jours
    const existing = oh.data || []
    const full = Array.from({ length: 7 }, (_, i) => {
      const found = existing.find(h => h.day_of_week === i)
      return found || { day_of_week: i, start_time: '08:00', end_time: '20:00', is_active: false }
    })
    setOpeningHours(full)
    setLoading(false)
  }

  function updateHour(dayIndex, field, value) {
    setOpeningHours(prev => prev.map((h, i) => i === dayIndex ? { ...h, [field]: value } : h))
  }

  async function saveHours() {
    setSavingHours(true)
    // Supprimer existants et réinsérer
    await supabase.from('opening_hours').delete().neq('id', 0)
    const active = openingHours.filter(h => h.is_active)
    if (active.length > 0) {
      await supabase.from('opening_hours').insert(
        active.map(h => ({ day_of_week: h.day_of_week, start_time: h.start_time, end_time: h.end_time, is_active: true }))
      )
    }
    await supabase.from('coaching_settings').upsert({
      id: 'admin',
      session_duration: settings.session_duration,
      buffer_time: settings.buffer_time,
      updated_at: new Date().toISOString()
    })
    setMsg({ type: 'success', text: 'Horaires sauvegardés !' })
    setSavingHours(false)
  }

  async function addBlock() {
    if (!newBlock.date) return
    await supabase.from('blocked_periods').insert({
      date: newBlock.date,
      start_time: newBlock.start_time || null,
      end_time: newBlock.end_time || null,
      reason: newBlock.reason || null
    })
    setNewBlock({ date: '', start_time: '', end_time: '', reason: '' })
    setMsg({ type: 'success', text: 'Période bloquée ajoutée.' })
    loadAll()
  }

  async function deleteBlock(id) {
    await supabase.from('blocked_periods').delete().eq('id', id)
    loadAll()
  }

  async function addCredits() {
    if (!creditForm.clientId || creditForm.amount < 1) return
    const client = clients.find(c => c.id === creditForm.clientId)
    const newCredits = (client.credits || 0) + parseInt(creditForm.amount)
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', creditForm.clientId)
    setMsg({ type: 'success', text: `${parseInt(creditForm.amount)} crédit(s) ajouté(s) à ${client.full_name || client.email}` })
    setCreditForm({ clientId: '', amount: 1 })
    loadAll()
  }

  async function updateSubscription(clientId, subscriptionType) {
    await supabase.from('profiles').update({ subscription_type: subscriptionType }).eq('id', clientId)
    setMsg({ type: 'success', text: 'Abonnement mis à jour.' })
    loadAll()
  }

  async function deleteClient(id, name) {
    if (!window.confirm('Supprimer ' + name + ' définitivement ?')) return
    await supabase.from('bookings').delete().eq('client_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    setMsg({ type: 'success', text: name + ' a été supprimé.' })
    loadAll()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={s.nav}>
        <div style={s.navLogo}>Admin — Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <button onClick={() => supabase.auth.signOut()} style={s.btnLogout}>Déconnexion</button>
      </nav>

      <div style={s.container}>
        {msg && (
          <div style={{ ...s.msgBox, background: msg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}

        <div style={s.tabs}>
          {['clients', 'bookings', 'horaires', 'exceptions'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}>
              {{ clients: `👥 Clients (${clients.length})`, bookings: `📅 Réservations`, horaires: `🕐 Horaires`, exceptions: `🚫 Exceptions` }[t]}
            </button>
          ))}
        </div>

        {/* CLIENTS */}
        {tab === 'clients' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Ajouter des crédits</div>
              <div style={s.formRow}>
                <select value={creditForm.clientId} onChange={e => setCreditForm(f => ({ ...f, clientId: e.target.value }))} style={s.input}>
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.credits || 0} crédits)</option>)}
                </select>
                <input type="number" min="1" max="20" value={creditForm.amount} onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))} style={{ ...s.input, flex: 'none', width: 80 }} />
                <button onClick={addCredits} style={s.btnGold}>Ajouter</button>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>Tous les clients</div>
              {loading ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {clients.map(c => {
                    const sub = SUBSCRIPTION_TYPES.find(s => s.value === c.subscription_type)
                    return (
                      <div key={c.id} style={s.clientRow}>
                        <div style={s.clientInfo}>
                          <div style={s.clientName}>{c.full_name || '—'}</div>
                          <div style={s.clientEmail}>{c.email}</div>
                          {c.phone && <div style={s.clientEmail}>{c.phone}</div>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {c.coaching_type === 'salle' ? '🏋️ Salle' : c.coaching_type === 'domicile' ? '🏠 Domicile' : '—'}
                        </div>
                        <div style={{ minWidth: 240 }}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Abonnement</div>
                          <select value={c.subscription_type || ''} onChange={e => updateSubscription(c.id, e.target.value)} style={{ ...s.input, fontSize: 12, padding: '8px 10px' }}>
                            <option value="">— Aucun —</option>
                            {SUBSCRIPTION_TYPES.map(st => (
                              <option key={st.value} value={st.value}>{st.label}{st.price ? ' — ' + st.price : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Crédits</div>
                          <strong style={{ color: c.credits > 0 ? GOLD : '#f87171', fontSize: 22 }}>{c.credits || 0}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                          <div style={{ marginBottom: 4 }}>Inscrit le</div>
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </div>
                        <button onClick={() => deleteClient(c.id, c.full_name || c.email)} style={s.btnDelete}>Supprimer</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RÉSERVATIONS */}
        {tab === 'bookings' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Toutes les réservations</div>
            <table style={s.table}>
              <thead>
                <tr>{['Client', 'Date', 'Heure', 'Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} style={s.tr}>
                    <td style={s.td}>{b.profiles?.full_name || b.profiles?.email || '—'}</td>
                    <td style={s.td}>{b.time_slots ? new Date(b.time_slots.start_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</td>
                    <td style={s.td}>{b.time_slots ? new Date(b.time_slots.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(b.status === 'confirmed' ? { color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' } : { color: '#f87171', background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)' }) }}>
                        {b.status === 'confirmed' ? 'Confirmé' : 'Annulé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* HORAIRES */}
        {tab === 'horaires' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Paramètres des séances</div>
              <div style={s.formRow}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Durée d'une séance</div>
                  <select value={settings.session_duration} onChange={e => setSettings(st => ({ ...st, session_duration: parseInt(e.target.value) }))} style={{ ...s.input, flex: 'none', width: 140 }}>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2 heures</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Délai entre séances</div>
                  <select value={settings.buffer_time} onChange={e => setSettings(st => ({ ...st, buffer_time: parseInt(e.target.value) }))} style={{ ...s.input, flex: 'none', width: 140 }}>
                    <option value={0}>Aucun</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>Jours et heures d'ouverture</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {openingHours.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, opacity: h.is_active ? 1 : 0.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={h.is_active}
                        onChange={e => updateHour(i, 'is_active', e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: GOLD }}
                      />
                      <span style={{ fontSize: 14, fontWeight: h.is_active ? 500 : 400 }}>{DAYS[h.day_of_week]}</span>
                    </label>
                    {h.is_active && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>De</span>
                          <input
                            type="time"
                            value={h.start_time}
                            onChange={e => updateHour(i, 'start_time', e.target.value)}
                            style={{ ...s.input, flex: 'none', width: 110, padding: '6px 10px' }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>à</span>
                          <input
                            type="time"
                            value={h.end_time}
                            onChange={e => updateHour(i, 'end_time', e.target.value)}
                            style={{ ...s.input, flex: 'none', width: 110, padding: '6px 10px' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={saveHours} disabled={savingHours} style={{ ...s.btnGold, marginTop: 20 }}>
                {savingHours ? 'Sauvegarde...' : 'Sauvegarder les horaires'}
              </button>
            </div>
          </div>
        )}

        {/* EXCEPTIONS */}
        {tab === 'exceptions' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Ajouter une période indisponible</div>
              <div style={s.formRow}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Date</div>
                  <input type="date" value={newBlock.date} onChange={e => setNewBlock(b => ({ ...b, date: e.target.value }))} style={s.input} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Début (optionnel)</div>
                  <input type="time" value={newBlock.start_time} onChange={e => setNewBlock(b => ({ ...b, start_time: e.target.value }))} style={{ ...s.input, width: 110 }} placeholder="Journée entière" />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Fin (optionnel)</div>
                  <input type="time" value={newBlock.end_time} onChange={e => setNewBlock(b => ({ ...b, end_time: e.target.value }))} style={{ ...s.input, width: 110 }} />
                </div>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Raison (optionnel)</div>
                  <input type="text" value={newBlock.reason} onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))} style={s.input} placeholder="Ex: Congés, formation..." />
                </div>
                <button onClick={addBlock} style={{ ...s.btnGold, alignSelf: 'flex-end' }}>Bloquer</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Si tu ne mets pas d'heure de début/fin, toute la journée est bloquée.
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>Périodes bloquées à venir</div>
              {blockedPeriods.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune exception planifiée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blockedPeriods.map(bp => (
                    <div key={bp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8 }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {new Date(bp.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          {bp.start_time && ' — ' + bp.start_time + (bp.end_time ? ' à ' + bp.end_time : '')}
                        </div>
                        {bp.reason && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{bp.reason}</div>}
                      </div>
                      <button onClick={() => deleteBlock(bp.id)} style={s.btnDelete}>Supprimer</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const s = {
  nav: { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border)' },
  navLogo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 18 },
  container: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px' },
  msgBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 8, border: '1px solid', fontSize: 13, marginBottom: 24 },
  tabs: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  tab: { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  tabActive: { borderColor: '#C4973A', color: '#C4973A', background: 'rgba(196,151,58,0.08)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C4973A', marginBottom: 20 },
  formRow: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1, minWidth: 120, outline: 'none' },
  btnGold: { background: '#C4973A', color: '#000', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' },
  btnLogout: { background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  btnDelete: { background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  clientRow: { display: 'flex', alignItems: 'center', gap: 20, padding: '20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' },
  clientInfo: { flex: 1, minWidth: 160 },
  clientName: { fontSize: 14, fontWeight: 500, marginBottom: 4 },
  clientEmail: { fontSize: 12, color: 'var(--muted)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)' },
  tr: { borderBottom: '1px solid var(--dim)' },
  td: { padding: '14px 12px', fontSize: 13 },
  badge: { display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)' },
}
