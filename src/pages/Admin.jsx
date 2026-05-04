import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

var GOLD = '#C4973A'
var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

var SUBSCRIPTION_TYPES = [
  { value: 'presentiel', label: '🏋️ Présentiel seul', price: null },
  { value: 'domicile', label: '🏠 Domicile', price: null },
  { value: 'sport_online', label: '📱 Sport en ligne', price: '59€/mois' },
  { value: 'nutrition', label: '🥗 Nutrition', price: '119€/mois' },
  { value: 'sport_nutrition', label: '💪 Sport + Nutrition', price: '149€/mois' },
]

export default function Admin({ profile }) {
  var [view, setView] = useState('home')
  var [clients, setClients] = useState([])
  var [bookings, setBookings] = useState([])
  var [loading, setLoading] = useState(true)
  var [msg, setMsg] = useState(null)
  var [creditForm, setCreditForm] = useState({ clientId: '', amount: 1 })
  var [openingHours, setOpeningHours] = useState([])
  var [settings, setSettings] = useState({ session_duration: 60, buffer_time: 10 })
  var [blockedPeriods, setBlockedPeriods] = useState([])
  var [newBlock, setNewBlock] = useState({ date: '', start_time: '', end_time: '', reason: '' })
  var [savingHours, setSavingHours] = useState(false)
  var [cancelling, setCancelling] = useState(null)
  // Book for client
  var [bookForm, setBookForm] = useState({ clientId: '', date: '', time: '' })
  var [bookingClient, setBookingClient] = useState(false)
  var [showCreateClient, setShowCreateClient] = useState(false)
  var [newClient, setNewClient] = useState({ email: '', fullName: '', phone: '', coachingType: 'presentiel', address: '' })
  var [creatingClient, setCreatingClient] = useState(false)
  var [editingClient, setEditingClient] = useState(null)
  var [editClientData, setEditClientData] = useState({})
  var [savingClient, setSavingClient] = useState(false)

  useEffect(function() { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    var [c, b, oh, st, bp] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, profiles(full_name, email, coaching_type, address), time_slots(start_time, end_time)').order('created_at', { ascending: false }),
      supabase.from('opening_hours').select('*').order('day_of_week'),
      supabase.from('coaching_settings').select('*').eq('id', 'admin').single(),
      supabase.from('blocked_periods').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date'),
    ])
    setClients(c.data || [])
    setBookings(b.data || [])
    setSettings(st.data || { session_duration: 60, buffer_time: 10 })
    setBlockedPeriods(bp.data || [])
    var existing = oh.data || []
    setOpeningHours(Array.from({ length: 7 }, function(_, i) {
      var found = existing.find(function(h) { return h.day_of_week === i })
      return found || { day_of_week: i, start_time: '08:00', end_time: '20:00', is_active: false }
    }))
    setLoading(false)
  }

  async function addCredits() {
    if (!creditForm.clientId || creditForm.amount < 1) return
    var client = clients.find(function(c) { return c.id === creditForm.clientId })
    var newCredits = (client.credits || 0) + parseInt(creditForm.amount)
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', creditForm.clientId)
    setMsg({ type: 'success', text: parseInt(creditForm.amount) + ' crédit(s) ajouté(s) à ' + (client.full_name || client.email) })
    setCreditForm({ clientId: '', amount: 1 })
    loadAll()
  }

  async function updateSubscription(clientId, val) {
    await supabase.from('profiles').update({ subscription_type: val }).eq('id', clientId)
    setMsg({ type: 'success', text: 'Abonnement mis à jour.' })
    loadAll()
  }

  async function deleteClient(id, name) {
    if (!window.confirm('Supprimer ' + name + ' définitivement ?')) return
    await supabase.from('bookings').delete().eq('client_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    setMsg({ type: 'success', text: name + ' supprimé.' })
    loadAll()
  }

  async function cancelBooking(bookingId) {
    setCancelling(bookingId)
    try {
      var res = await fetch('/api/admin-actions?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingId })
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: 'Réservation annulée, crédit restitué, client notifié.' })
        loadAll()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setCancelling(null)
  }

  async function bookForClient() {
    if (!bookForm.clientId || !bookForm.date || !bookForm.time) { setMsg({ type: 'error', text: 'Remplis tous les champs.' }); return }
    setBookingClient(true)
    var startTime = bookForm.date + 'T' + bookForm.time + ':00'
    var duration = settings.session_duration || 60
    var endDate = new Date(new Date(startTime).getTime() + duration * 60000)
    var endTime = endDate.toISOString()
    try {
      var res = await fetch('/api/admin-actions?action=book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: bookForm.clientId, startTime: startTime, endTime: endTime })
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: 'Réservation créée, client notifié par email.' })
        setBookForm({ clientId: '', date: '', time: '' })
        loadAll()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setBookingClient(false)
  }

  async function saveHours() {
    setSavingHours(true)
    await supabase.from('opening_hours').delete().neq('id', 0)
    var active = openingHours.filter(function(h) { return h.is_active })
    if (active.length > 0) {
      await supabase.from('opening_hours').insert(active.map(function(h) {
        return { day_of_week: h.day_of_week, start_time: h.start_time, end_time: h.end_time, is_active: true }
      }))
    }
    await supabase.from('coaching_settings').upsert({ id: 'admin', session_duration: settings.session_duration, buffer_time: settings.buffer_time, updated_at: new Date().toISOString() })
    setMsg({ type: 'success', text: 'Horaires sauvegardés !' })
    setSavingHours(false)
  }

  async function addBlock() {
    if (!newBlock.date) return
    await supabase.from('blocked_periods').insert({ date: newBlock.date, start_time: newBlock.start_time || null, end_time: newBlock.end_time || null, reason: newBlock.reason || null })
    setNewBlock({ date: '', start_time: '', end_time: '', reason: '' })
    setMsg({ type: 'success', text: 'Période bloquée.' })
    loadAll()
  }

  var confirmedBookings = bookings.filter(function(b) { return b.status === 'confirmed' && b.time_slots })
  var upcomingBookings = confirmedBookings.filter(function(b) { return new Date(b.time_slots.start_time) > new Date() }).sort(function(a, b) { return new Date(a.time_slots.start_time) - new Date(b.time_slots.start_time) })
  var clientsWithCredits = clients.filter(function(c) { return (c.credits || 0) > 0 })

  async function createClient() {
    if (!newClient.email || !newClient.fullName || !newClient.coachingType) { setMsg({ type: 'error', text: 'Email, nom et type requis.' }); return }
    setCreatingClient(true)
    try {
      var res = await fetch('/api/admin-actions?action=create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: newClient.fullName + ' créé ! Email envoyé avec le mot de passe.' })
        setNewClient({ email: '', fullName: '', phone: '', coachingType: 'presentiel', address: '' })
        setShowCreateClient(false)
        loadAll()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setCreatingClient(false)
  }

  function formatPhone(phone) {
    if (!phone) return null
    var clean = phone.replace(/\D/g, '')
    if (clean.startsWith('0')) clean = '33' + clean.slice(1)
    if (!clean.startsWith('33') && !clean.startsWith('44') && !clean.startsWith('32') && !clean.startsWith('41')) clean = '33' + clean
    return clean
  }

  async function saveClient() {
    if (!editingClient) return
    setSavingClient(true)
    await supabase.from('profiles').update({
      full_name: editClientData.full_name || '',
      phone: editClientData.phone || '',
      email: editClientData.email || '',
      coaching_type: editClientData.coaching_type || 'presentiel',
      address: editClientData.address || ''
    }).eq('id', editingClient)
    setMsg({ type: 'success', text: 'Client mis à jour.' })
    setEditingClient(null)
    setSavingClient(false)
    loadAll()
  }

  function renderClientCard(c) {
    var waPhone = formatPhone(c.phone)
    var waLink = waPhone ? 'https://wa.me/' + waPhone : null
    var subType = SUBSCRIPTION_TYPES.find(function(st) { return st.value === c.subscription_type })
    var isEditing = editingClient === c.id

    if (isEditing) {
      return (
        <div key={c.id} style={{ ...s.clientCard, borderColor: 'rgba(196,151,58,0.4)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 14 }}>Modifier le client</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><div style={s.fieldLabel}>Nom</div><input type="text" value={editClientData.full_name || ''} onChange={function(e) { setEditClientData(function(d) { return Object.assign({}, d, { full_name: e.target.value }) }) }} style={s.input} /></div>
            <div><div style={s.fieldLabel}>Email</div><input type="email" value={editClientData.email || ''} onChange={function(e) { setEditClientData(function(d) { return Object.assign({}, d, { email: e.target.value }) }) }} style={s.input} /></div>
            <div><div style={s.fieldLabel}>Téléphone</div><input type="tel" value={editClientData.phone || ''} onChange={function(e) { setEditClientData(function(d) { return Object.assign({}, d, { phone: e.target.value }) }) }} style={s.input} /></div>
            <div><div style={s.fieldLabel}>Type</div>
              <select value={editClientData.coaching_type || ''} onChange={function(e) { setEditClientData(function(d) { return Object.assign({}, d, { coaching_type: e.target.value }) }) }} style={s.input}>
                <option value="presentiel">🏋️ Présentiel</option>
                <option value="domicile">🏠 À domicile</option>
                <option value="online">📱 En ligne</option>
              </select>
            </div>
            {editClientData.coaching_type === 'domicile' && (
              <div><div style={s.fieldLabel}>Adresse</div><input type="text" value={editClientData.address || ''} onChange={function(e) { setEditClientData(function(d) { return Object.assign({}, d, { address: e.target.value }) }) }} style={s.input} /></div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveClient} disabled={savingClient} style={{ ...s.btnGold, flex: 1 }}>{savingClient ? '...' : 'Enregistrer'}</button>
              <button onClick={function() { setEditingClient(null) }} style={{ ...s.btnNav, flex: 'none' }}>Annuler</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={c.id} style={s.clientCard}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{c.full_name || '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email}</div>
            {c.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.phone}</div>}
            {c.address && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>📍 {c.address}</div>}
          </div>
          <div style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: (c.credits || 0) > 0 ? GOLD : '#f87171', lineHeight: 1 }}>{c.credits || 0}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>crédits</div>
          </div>
        </div>
        {subType && <div style={{ fontSize: 11, color: GOLD, marginBottom: 10 }}>⭐ {subType.label}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={c.subscription_type || ''} onChange={function(e) { updateSubscription(c.id, e.target.value) }} style={{ ...s.input, fontSize: 11, padding: '6px 8px', flex: 1 }}>
            <option value="">Abo: Aucun</option>
            {SUBSCRIPTION_TYPES.map(function(st) { return <option key={st.value} value={st.value}>{st.label}</option> })}
          </select>
          <button onClick={function() { setEditingClient(c.id); setEditClientData({ full_name: c.full_name, email: c.email, phone: c.phone, coaching_type: c.coaching_type, address: c.address }) }} style={s.btnEdit}>✏️</button>
          {waLink && <a href={waLink + '?text=' + encodeURIComponent('Bonjour ' + (c.full_name || '').split(' ')[0] + ', ')} target="_blank" style={s.btnWa}>💬</a>}
          <button onClick={function() { deleteClient(c.id, c.full_name || c.email) }} style={s.btnDeleteSmall}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={s.nav}>
        <div style={s.navLogo}>Admin — Yoann <span style={{ color: GOLD }}>Desgrand</span></div>
        <div style={{ display: 'flex', gap: 12 }}>
          {view !== 'home' && <button onClick={function() { setView('home') }} style={s.btnNav}>← Accueil</button>}
          <button onClick={function() { supabase.auth.signOut() }} style={s.btnNav}>Déconnexion</button>
        </div>
      </nav>

      <div style={s.container}>
        {msg && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 8, border: '1px solid', fontSize: 13, marginBottom: 24, borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', background: msg.type === 'success' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            <span>{msg.text}</span>
            <button onClick={function() { setMsg(null) }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* HOME */}
        {view === 'home' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, marginBottom: 6 }}>Administration</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{clients.length} clients · {upcomingBookings.length} séances à venir</div>
            </div>

            <div style={s.tilesGrid}>
              <button onClick={function() { setView('book') }} style={{ ...s.tile, borderColor: 'rgba(196,151,58,0.3)' }}>
                <div style={s.tileIcon}>📅</div>
                <div style={s.tileTitle}>Réserver</div>
                <div style={s.tileSub}>Pour un client</div>
              </button>
              <button onClick={function() { setView('bookings') }} style={s.tile}>
                <div style={s.tileIcon}>📋</div>
                <div style={s.tileTitle}>Réservations</div>
                <div style={s.tileSub}>{upcomingBookings.length} à venir</div>
              </button>
              <button onClick={function() { setView('clients') }} style={s.tile}>
                <div style={s.tileIcon}>👥</div>
                <div style={s.tileTitle}>Clients</div>
                <div style={s.tileSub}>{clients.length} inscrits</div>
              </button>
              <button onClick={function() { setView('credits') }} style={s.tile}>
                <div style={s.tileIcon}>💰</div>
                <div style={s.tileTitle}>Crédits</div>
                <div style={s.tileSub}>Ajouter / gérer</div>
              </button>
              <button onClick={function() { setView('horaires') }} style={s.tile}>
                <div style={s.tileIcon}>🕐</div>
                <div style={s.tileTitle}>Horaires</div>
                <div style={s.tileSub}>Jours & heures</div>
              </button>
              <button onClick={function() { setView('exceptions') }} style={s.tile}>
                <div style={s.tileIcon}>🚫</div>
                <div style={s.tileTitle}>Exceptions</div>
                <div style={s.tileSub}>{blockedPeriods.length} bloquée{blockedPeriods.length > 1 ? 's' : ''}</div>
              </button>
            </div>

            {/* Quick: upcoming sessions */}
            {upcomingBookings.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>Prochaines séances</div>
                {upcomingBookings.slice(0, 5).map(function(b) {
                  return (
                    <div key={b.id} style={s.bookingRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{b.profiles?.full_name || b.profiles?.email || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {fmtDate(b.time_slots.start_time)} à {fmtTime(b.time_slots.start_time)}
                          {b.profiles?.coaching_type === 'domicile' ? ' · 🏠 Domicile' : ' · 🏋️ ON AIR'}
                        </div>
                      </div>
                      <button onClick={function() { if (window.confirm('Annuler cette séance ?')) cancelBooking(b.id) }} disabled={cancelling === b.id} style={s.btnDelete}>{cancelling === b.id ? '...' : 'Annuler'}</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* BOOK FOR CLIENT */}
        {view === 'book' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Réserver pour un client</div></div>
            <div style={s.card}>
              <div style={s.cardTitle}>Nouvelle réservation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={s.fieldLabel}>Client</div>
                  <select value={bookForm.clientId} onChange={function(e) { setBookForm(function(f) { return Object.assign({}, f, { clientId: e.target.value }) }) }} style={s.input}>
                    <option value="">Sélectionner un client</option>
                    {clientsWithCredits.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.credits} crédits)</option> })}
                  </select>
                  {clientsWithCredits.length === 0 && <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>Aucun client avec des crédits.</div>}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.fieldLabel}>Date</div>
                    <input type="date" value={bookForm.date} onChange={function(e) { setBookForm(function(f) { return Object.assign({}, f, { date: e.target.value }) }) }} style={s.input} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.fieldLabel}>Heure</div>
                    <input type="time" value={bookForm.time} onChange={function(e) { setBookForm(function(f) { return Object.assign({}, f, { time: e.target.value }) }) }} style={s.input} />
                  </div>
                </div>
                <button onClick={bookForClient} disabled={bookingClient} style={s.btnGold}>
                  {bookingClient ? 'Réservation en cours...' : 'Créer la réservation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BOOKINGS */}
        {view === 'bookings' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Réservations</div></div>
            <div style={s.card}>
              <div style={s.cardTitle}>À venir</div>
              {upcomingBookings.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune séance à venir.</div> : upcomingBookings.map(function(b) {
                return (
                  <div key={b.id} style={s.bookingRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{b.profiles?.full_name || b.profiles?.email || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(b.time_slots.start_time)} à {fmtTime(b.time_slots.start_time)} · {b.profiles?.coaching_type === 'domicile' ? '🏠' : '🏋️'}</div>
                    </div>
                    <button onClick={function() { if (window.confirm('Annuler cette séance ? Le client sera notifié par email.')) cancelBooking(b.id) }} disabled={cancelling === b.id} style={s.btnDelete}>{cancelling === b.id ? '...' : 'Annuler'}</button>
                  </div>
                )
              })}
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Historique</div>
              {bookings.filter(function(b) { return !b.time_slots || new Date(b.time_slots.start_time) <= new Date() || b.status !== 'confirmed' }).slice(0, 15).map(function(b) {
                return (
                  <div key={b.id} style={{ ...s.bookingRow, opacity: b.status !== 'confirmed' ? 0.5 : 0.7 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{b.profiles?.full_name || b.profiles?.email || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.time_slots ? fmtDate(b.time_slots.start_time) + ' à ' + fmtTime(b.time_slots.start_time) : '—'}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid', color: b.status === 'confirmed' ? '#4ade80' : '#f87171', borderColor: b.status === 'confirmed' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', background: b.status === 'confirmed' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)' }}>{b.status === 'confirmed' ? 'Terminé' : 'Annulé'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CLIENTS */}
        {view === 'clients' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={s.viewTitle}>Clients ({clients.length})</div>
              <button onClick={function() { setShowCreateClient(!showCreateClient) }} style={s.btnGold}>{showCreateClient ? '✕ Fermer' : '+ Créer un client'}</button>
            </div>

            {showCreateClient && (
              <div style={{ ...s.card, marginBottom: 24, borderColor: 'rgba(196,151,58,0.3)' }}>
                <div style={s.cardTitle}>Nouveau client</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Prénom Nom *</div><input type="text" value={newClient.fullName} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { fullName: e.target.value }) }) }} placeholder="Jean Dupont" style={s.input} /></div>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Email *</div><input type="email" value={newClient.email} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { email: e.target.value }) }) }} placeholder="jean@email.com" style={s.input} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Téléphone</div><input type="tel" value={newClient.phone} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { phone: e.target.value }) }) }} placeholder="06 12 34 56 78" style={s.input} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={s.fieldLabel}>Type de coaching *</div>
                      <select value={newClient.coachingType} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { coachingType: e.target.value }) }) }} style={s.input}>
                        <option value="presentiel">🏋️ Présentiel</option>
                        <option value="domicile">🏠 À domicile</option>
                        <option value="online">📱 En ligne</option>
                      </select>
                    </div>
                  </div>
                  {newClient.coachingType === 'domicile' && (
                    <div><div style={s.fieldLabel}>Adresse</div><input type="text" value={newClient.address} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { address: e.target.value }) }) }} placeholder="39 rue Gustave Eiffel, 92110 Clichy" style={s.input} /></div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>Le client recevra un email avec son mot de passe temporaire et un lien vers l'application. Il devra le modifier à sa première connexion.</div>
                  <button onClick={createClient} disabled={creatingClient} style={s.btnGold}>{creatingClient ? 'Création en cours...' : 'Créer et envoyer l\'invitation'}</button>
                </div>
              </div>
            )}

            {/* Présentiel */}
            {(function() {
              var group = clients.filter(function(c) { return c.coaching_type === 'presentiel' })
              if (group.length === 0) return null
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🏋️ Présentiel <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>({group.length})</span></div>
                  <div style={s.clientsGrid}>
                    {group.map(function(c) { return renderClientCard(c) })}
                  </div>
                </div>
              )
            })()}

            {/* Domicile */}
            {(function() {
              var group = clients.filter(function(c) { return c.coaching_type === 'domicile' })
              if (group.length === 0) return null
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>🏠 À domicile <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>({group.length})</span></div>
                  <div style={s.clientsGrid}>
                    {group.map(function(c) { return renderClientCard(c) })}
                  </div>
                </div>
              )
            })()}

            {/* Online */}
            {(function() {
              var group = clients.filter(function(c) { return c.coaching_type !== 'presentiel' && c.coaching_type !== 'domicile' })
              if (group.length === 0) return null
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>📱 En ligne <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>({group.length})</span></div>
                  <div style={s.clientsGrid}>
                    {group.map(function(c) { return renderClientCard(c) })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* CREDITS */}
        {view === 'credits' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Ajouter des crédits</div></div>
            <div style={s.card}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={creditForm.clientId} onChange={function(e) { setCreditForm(function(f) { return Object.assign({}, f, { clientId: e.target.value }) }) }} style={{ ...s.input, flex: 2 }}>
                  <option value="">Sélectionner un client</option>
                  {clients.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.credits || 0} crédits)</option> })}
                </select>
                <input type="number" min="1" max="20" value={creditForm.amount} onChange={function(e) { setCreditForm(function(f) { return Object.assign({}, f, { amount: e.target.value }) }) }} style={{ ...s.input, flex: 'none', width: 80 }} />
                <button onClick={addCredits} style={s.btnGold}>Ajouter</button>
              </div>
            </div>
          </div>
        )}

        {/* HORAIRES */}
        {view === 'horaires' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Horaires</div></div>
            <div style={s.card}>
              <div style={s.cardTitle}>Durée d'une séance</div>
              <select value={settings.session_duration} onChange={function(e) { setSettings(function(st) { return Object.assign({}, st, { session_duration: parseInt(e.target.value) }) }) }} style={{ ...s.input, width: 160 }}>
                <option value={45}>45 minutes</option>
                <option value={60}>1 heure</option>
                <option value={90}>1h30</option>
                <option value={120}>2 heures</option>
              </select>
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Jours et heures d'ouverture</div>
              {openingHours.map(function(h, i) {
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, opacity: h.is_active ? 1 : 0.5 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120, cursor: 'pointer' }}>
                      <input type="checkbox" checked={h.is_active} onChange={function(e) { setOpeningHours(function(prev) { return prev.map(function(x, j) { return j === i ? Object.assign({}, x, { is_active: e.target.checked }) : x }) }) }} style={{ width: 16, height: 16, accentColor: GOLD }} />
                      <span style={{ fontSize: 14, fontWeight: h.is_active ? 500 : 400 }}>{DAYS[h.day_of_week]}</span>
                    </label>
                    {h.is_active && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>De</span>
                        <input type="time" value={h.start_time} onChange={function(e) { setOpeningHours(function(prev) { return prev.map(function(x, j) { return j === i ? Object.assign({}, x, { start_time: e.target.value }) : x }) }) }} style={{ ...s.input, flex: 'none', width: 110, padding: '6px 10px' }} />
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>à</span>
                        <input type="time" value={h.end_time} onChange={function(e) { setOpeningHours(function(prev) { return prev.map(function(x, j) { return j === i ? Object.assign({}, x, { end_time: e.target.value }) : x }) }) }} style={{ ...s.input, flex: 'none', width: 110, padding: '6px 10px' }} />
                      </div>
                    )}
                  </div>
                )
              })}
              <button onClick={saveHours} disabled={savingHours} style={{ ...s.btnGold, marginTop: 16 }}>{savingHours ? 'Sauvegarde...' : 'Sauvegarder'}</button>
            </div>
          </div>
        )}

        {/* EXCEPTIONS */}
        {view === 'exceptions' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Exceptions</div></div>
            <div style={s.card}>
              <div style={s.cardTitle}>Bloquer une période</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div><div style={s.fieldLabel}>Date</div><input type="date" value={newBlock.date} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { date: e.target.value }) }) }} style={s.input} /></div>
                <div><div style={s.fieldLabel}>Début</div><input type="time" value={newBlock.start_time} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { start_time: e.target.value }) }) }} style={{ ...s.input, width: 110 }} /></div>
                <div><div style={s.fieldLabel}>Fin</div><input type="time" value={newBlock.end_time} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { end_time: e.target.value }) }) }} style={{ ...s.input, width: 110 }} /></div>
                <div style={{ flex: 2 }}><div style={s.fieldLabel}>Raison</div><input type="text" value={newBlock.reason} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { reason: e.target.value }) }) }} style={s.input} placeholder="Congés, formation..." /></div>
                <button onClick={addBlock} style={{ ...s.btnGold, alignSelf: 'flex-end' }}>Bloquer</button>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Périodes bloquées</div>
              {blockedPeriods.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune.</div> : blockedPeriods.map(function(bp) {
                return (
                  <div key={bp.id} style={s.bookingRow}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{new Date(bp.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{bp.start_time ? ' — ' + bp.start_time + (bp.end_time ? ' à ' + bp.end_time : '') : ''}</div>
                      {bp.reason && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{bp.reason}</div>}
                    </div>
                    <button onClick={function() { supabase.from('blocked_periods').delete().eq('id', bp.id).then(loadAll) }} style={s.btnDelete}>Supprimer</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <style>{"@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }"}</style>
    </div>
  )
}

function fmtDate(iso) {
  var d = new Date(iso)
  var DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
  return DAYS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth()+1)
}

function fmtTime(iso) {
  var d = new Date(iso)
  return d.getHours().toString().padStart(2,'0') + 'h' + d.getMinutes().toString().padStart(2,'0')
}

var s = {
  nav: { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--bg)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border)' },
  navLogo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 18 },
  btnNav: { background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  container: { maxWidth: 900, margin: '0 auto', padding: '32px 20px' },
  tilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 },
  tile: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 20px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  tileIcon: { fontSize: 32, marginBottom: 4 },
  tileTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  tileSub: { fontSize: 12, color: 'var(--muted)' },
  viewHeader: { marginBottom: 24 },
  viewTitle: { fontFamily: 'Cormorant Garamond, serif', fontSize: 26 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', marginBottom: 16 },
  cardTitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C4973A', marginBottom: 20 },
  bookingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 },
  clientCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px' },
  clientsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  btnWa: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 8, fontSize: 16, textDecoration: 'none', cursor: 'pointer', flexShrink: 0 },
  btnEdit: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.3)', borderRadius: 8, fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  btnDeleteSmall: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 8, fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  fieldLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: '100%', outline: 'none', boxSizing: 'border-box' },
  btnGold: { background: '#C4973A', color: '#000', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' },
  btnDelete: { background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
}
