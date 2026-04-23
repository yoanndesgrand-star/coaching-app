import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const GOLD = '#C4973A'

export default function Admin({ profile }) {
  const [clients, setClients] = useState([])
  const [bookings, setBookings] = useState([])
  const [slots, setSlots] = useState([])
  const [tab, setTab] = useState('clients')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  // New slot form
  const [newSlot, setNewSlot] = useState({ date: '', time: '', duration: 60 })

  // Add credits form
  const [creditForm, setCreditForm] = useState({ clientId: '', amount: 1, label: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [c, b, s] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, profiles(full_name, email), time_slots(start_time, end_time)').order('created_at', { ascending: false }),
      supabase.from('time_slots').select('*').order('start_time', { ascending: true })
    ])
    setClients(c.data || [])
    setBookings(b.data || [])
    setSlots(s.data || [])
    setLoading(false)
  }

  async function addCredits() {
    if (!creditForm.clientId || creditForm.amount < 1) return
    const client = clients.find(c => c.id === creditForm.clientId)
    const newCredits = (client.credits || 0) + parseInt(creditForm.amount)
    const { error } = await supabase.from('profiles')
      .update({ credits: newCredits, offer_label: creditForm.label || client.offer_label })
      .eq('id', creditForm.clientId)
    if (!error) {
      setMsg({ type: 'success', text: `${parseInt(creditForm.amount)} crédit(s) ajouté(s) à ${client.full_name || client.email}` })
      setCreditForm({ clientId: '', amount: 1, label: '' })
      loadAll()
    }
  }

  async function addSlot() {
    if (!newSlot.date || !newSlot.time) return
    const start = new Date(`${newSlot.date}T${newSlot.time}`)
    const end = new Date(start.getTime() + newSlot.duration * 60000)
    const { error } = await supabase.from('time_slots').insert({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_available: true
    })
    if (!error) {
      setMsg({ type: 'success', text: `Créneau ajouté : ${start.toLocaleDateString('fr-FR')} à ${newSlot.time}` })
      setNewSlot({ date: '', time: '', duration: 60 })
      loadAll()
    }
  }

  async function deleteSlot(id) {
    await supabase.from('time_slots').delete().eq('id', id)
    loadAll()
  }

  async function signOut() { await supabase.auth.signOut() }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navLogo}>Admin — Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <button onClick={signOut} style={s.btnLogout}>Déconnexion</button>
      </nav>

      <div style={s.container}>
        {msg && (
          <div style={{ ...s.msgBox, background: msg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            {msg.text}
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}

        {/* TABS */}
        <div style={s.tabs}>
          {['clients', 'bookings', 'slots'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}>
              {{ clients: `👥 Clients (${clients.length})`, bookings: `📅 Réservations (${bookings.filter(b => b.status === 'confirmed').length})`, slots: `🕐 Créneaux (${slots.filter(s => s.is_available).length})` }[t]}
            </button>
          ))}
        </div>

        {/* CLIENTS */}
        {tab === 'clients' && (
          <div>
            {/* Add credits form */}
            <div style={s.card}>
              <div style={s.cardTitle}>Ajouter des crédits</div>
              <div style={s.formRow}>
                <select value={creditForm.clientId} onChange={e => setCreditForm(f => ({ ...f, clientId: e.target.value }))} style={s.input}>
                  <option value="">Sélectionner un client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.credits || 0} crédits)</option>)}
                </select>
                <input type="number" min="1" max="20" value={creditForm.amount} onChange={e => setCreditForm(f => ({ ...f, amount: e.target.value }))} style={{ ...s.input, width: 80 }} placeholder="Nbr" />
                <input type="text" value={creditForm.label} onChange={e => setCreditForm(f => ({ ...f, label: e.target.value }))} style={s.input} placeholder="Offre (ex: Pack 10)" />
                <button onClick={addCredits} style={s.btnGold}>Ajouter</button>
              </div>
            </div>

            {/* Clients list */}
            <div style={s.card}>
              <div style={s.cardTitle}>Tous les clients</div>
              {loading ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</div> : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Nom', 'Email', 'Offre', 'Crédits', 'Inscrit le'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => (
                      <tr key={c.id} style={s.tr}>
                        <td style={s.td}>{c.full_name || '—'}</td>
                        <td style={s.td}>{c.email}</td>
                        <td style={s.td}><span style={s.badge}>{c.offer_label || '—'}</span></td>
                        <td style={s.td}><strong style={{ color: c.credits > 0 ? GOLD : '#f87171' }}>{c.credits || 0}</strong></td>
                        <td style={s.td}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div style={s.card}>
            <div style={s.cardTitle}>Toutes les réservations</div>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Client', 'Date', 'Heure', 'Statut'].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} style={s.tr}>
                    <td style={s.td}>{b.profiles?.full_name || b.profiles?.email || '—'}</td>
                    <td style={s.td}>{b.time_slots ? new Date(b.time_slots.start_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</td>
                    <td style={s.td}>{b.time_slots ? new Date(b.time_slots.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: b.status === 'confirmed' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: b.status === 'confirmed' ? '#4ade80' : '#f87171', borderColor: b.status === 'confirmed' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)' }}>
                        {b.status === 'confirmed' ? 'Confirmé' : 'Annulé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SLOTS */}
        {tab === 'slots' && (
          <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Ajouter un créneau</div>
              <div style={s.formRow}>
                <input type="date" value={newSlot.date} onChange={e => setNewSlot(f => ({ ...f, date: e.target.value }))} style={s.input} />
                <input type="time" value={newSlot.time} onChange={e => setNewSlot(f => ({ ...f, time: e.target.value }))} style={s.input} />
                <select value={newSlot.duration} onChange={e => setNewSlot(f => ({ ...f, duration: e.target.value }))} style={s.input}>
                  <option value={60}>1h</option>
                  <option value={90}>1h30</option>
                </select>
                <button onClick={addSlot} style={s.btnGold}>Ajouter</button>
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>Créneaux à venir</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {slots.filter(sl => new Date(sl.start_time) > new Date()).map(sl => (
                  <div key={sl.id} style={s.slotRow}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{new Date(sl.start_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 12 }}>{new Date(sl.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ ...s.badge, ...(sl.is_available ? { color: '#4ade80', background: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' } : { color: '#f87171', background: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.3)' }) }}>
                        {sl.is_available ? 'Disponible' : 'Réservé'}
                      </span>
                      {sl.is_available && (
                        <button onClick={() => deleteSlot(sl.id)} style={s.btnDelete}>Supprimer</button>
                      )}
                    </div>
                  </div>
                ))}
                {slots.filter(sl => new Date(sl.start_time) > new Date()).length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>Aucun créneau à venir. Ajoute-en un ci-dessus.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  nav: {
    position: 'sticky', top: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 32px',
    background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(8px)',
    borderBottom: '1px solid var(--border)',
  },
  navLogo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 18 },
  container: { maxWidth: 1000, margin: '0 auto', padding: '32px 24px' },
  msgBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderRadius: 8, border: '1px solid',
    fontSize: 13, marginBottom: 24,
  },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    color: 'var(--muted)', borderRadius: 8, padding: '10px 20px',
    fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
    transition: 'all 0.2s',
  },
  tabActive: { borderColor: GOLD, color: GOLD, background: 'rgba(196,151,58,0.08)' },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '24px', marginBottom: 16,
  },
  cardTitle: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
    color: GOLD, marginBottom: 20,
  },
  formRow: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  input: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
    fontSize: 13, fontFamily: 'Outfit, sans-serif', flex: 1, minWidth: 120,
    outline: 'none',
  },
  btnGold: {
    background: GOLD, color: '#000', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap',
  },
  btnLogout: {
    background: 'none', border: '1px solid var(--border)', color: 'var(--muted)',
    borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
  },
  btnDelete: {
    background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171',
    borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer',
    fontFamily: 'Outfit, sans-serif',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--muted)', padding: '8px 12px', textAlign: 'left',
    borderBottom: '1px solid var(--border)',
  },
  tr: { borderBottom: '1px solid var(--dim)' },
  td: { padding: '14px 12px', fontSize: 13, color: 'var(--text)' },
  badge: {
    display: 'inline-block', fontSize: 11, fontWeight: 500,
    padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--muted)',
  },
  slotRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 8, fontSize: 13,
  },
}
