import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/i18n'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import Programs from './Programs'
import Timer from '../components/Timer'
import PhotoGallery from '../components/PhotoGallery'
import AddressInput from '../components/AddressInput'
import ClientProfile from '../components/ClientProfile'
import WorkoutPlayer from '../components/WorkoutPlayer'

var GOLD = '#C4973A'
var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

var SUBSCRIPTION_TYPES = [
  { value: 'sport_online', label: '📱 Sport en ligne', price: '59€/mois' },
  { value: 'nutrition', label: '🥗 Nutrition', price: '119€/mois' },
  { value: 'sport_nutrition', label: '💪 Sport + Nutrition', price: '149€/mois' },
]

var DOMICILE_SUBS = [
  { value: '3m_1x', label: '3 mois · 1x/sem', amount: 152, sessions: 12 },
  { value: '3m_2x', label: '3 mois · 2x/sem', amount: 296, sessions: 24 },
  { value: '3m_3x', label: '3 mois · 3x/sem', amount: 432, sessions: 36 },
  { value: '6m_1x', label: '6 mois · 1x/sem', amount: 140, sessions: 24 },
  { value: '6m_2x', label: '6 mois · 2x/sem', amount: 272, sessions: 48 },
  { value: '6m_3x', label: '6 mois · 3x/sem', amount: 396, sessions: 72 },
  { value: '12m_1x', label: '12 mois · 1x/sem', amount: 125, sessions: 47 },
  { value: '12m_2x', label: '12 mois · 2x/sem', amount: 247, sessions: 94 },
  { value: '12m_3x', label: '12 mois · 3x/sem', amount: 364, sessions: 141 },
]

export default function Admin({ profile, setProfile, coachBrand, setCoachBrand }) {
  var { t, lang, setLang } = useLang()
  var [view, setView] = useState('home')
  var [viewAnim, setViewAnim] = useState('fadeIn 0.4s ease')

  // ─── CSV EXPORT ───
  function exportCSV(filename, headers, rows) {
    var csv = '\uFEFF' + headers.join(';') + '\n' + rows.map(function(r) { return r.map(function(c) { return '"' + String(c || '').replace(/"/g, '""') + '"' }).join(';') }).join('\n')
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    var url = URL.createObjectURL(blob)
    var a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function exportClients() {
    exportCSV('clients_' + new Date().toISOString().split('T')[0] + '.csv',
      ['Nom', 'Email', 'Téléphone', 'Type', 'Adresse', 'Crédits', 'Mode paiement', 'Inscrit le', 'Dernière connexion', 'Code parrainage'],
      clients.map(function(c) { return [c.full_name, c.email, c.phone, c.coaching_type, c.address, c.credits, c.no_credit_required ? 'Séance' : 'Crédits', c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '', c.last_seen ? new Date(c.last_seen).toLocaleDateString('fr-FR') : '', c.referral_code] })
    )
    setMsg({ type: 'success', text: '📥 ' + clients.length + ' clients exportés !' })
  }

  function exportBookings() {
    var data = confirmedBookings.map(function(b) {
      return [b.profiles?.full_name || b.notes || '—', b.profiles?.email || '', b.time_slots ? new Date(b.time_slots.start_time).toLocaleDateString('fr-FR') : '', b.time_slots ? new Date(b.time_slots.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '', b.time_slots ? new Date(b.time_slots.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '', b.status, b.profiles?.coaching_type || '', b.profiles?.address || '']
    })
    exportCSV('seances_' + new Date().toISOString().split('T')[0] + '.csv',
      ['Client', 'Email', 'Date', 'Début', 'Fin', 'Statut', 'Type', 'Adresse'], data
    )
    setMsg({ type: 'success', text: '📥 ' + data.length + ' séances exportées !' })
  }

  function exportFinance() {
    var data = (financeEntries || []).map(function(f) {
      return [f.date, f.type === 'coaching' ? 'Coaching' : f.type === 'group_class' ? 'Cours collectif' : f.type, f.client_name || '', f.amount || 0, f.payment_method === 'cb' ? 'CB' : f.payment_method === 'virement' ? 'Virement' : f.payment_method === 'especes' ? 'Espèces' : f.payment_method || '', f.class_type || '', f.duration_minutes || '', f.notes || '']
    })
    exportCSV('revenus_' + new Date().toISOString().split('T')[0] + '.csv',
      ['Date', 'Type', 'Client', 'Montant (€)', 'Paiement', 'Cours', 'Durée (min)', 'Notes'], data
    )
    setMsg({ type: 'success', text: '📥 ' + data.length + ' entrées exportées !' })
  }

  var [programsEditing, setProgramsEditing] = useState(false)
  var [pendingNav, setPendingNav] = useState(null)
  function navigateTo(target) {
    // Check if Programs is editing before navigating away
    if (programsEditing && (view === 'programs' || view === 'live-training') && target !== 'programs' && target !== 'live-training') {
      setPendingNav(target)
      return
    }
    if (target === 'home') setViewAnim('slideInLeft 0.35s ease')
    else if (view === 'home') setViewAnim('slideInRight 0.35s ease')
    else setViewAnim('scaleIn 0.3s ease')
    setView(target)
  }
  var [clients, setClients] = useState([])
  var [bookings, setBookings] = useState([])
  var [loading, setLoading] = useState(true)
  var [msg, setMsg] = useState(null)
  useEffect(function() { if (msg) { var t = setTimeout(function() { setMsg(null) }, 4000); return function() { clearTimeout(t) } } }, [msg])
  var [creditForm, setCreditForm] = useState({ clientId: '', amount: 1 })
  var [openingHours, setOpeningHours] = useState([])
  var [settings, setSettings] = useState({ session_duration: 60, buffer_time: 10 })
  var [blockedPeriods, setBlockedPeriods] = useState([])
  var [newBlock, setNewBlock] = useState({ mode: 'day', date: '', endDate: '', start_time: '', end_time: '', reason: '' })
  var [savingHours, setSavingHours] = useState(false)
  var [cancelling, setCancelling] = useState(null)
  var [selectedBookings, setSelectedBookings] = useState({})
  var [financeTab, setFinanceTab] = useState('journal')
  var [financeDate, setFinanceDate] = useState(null)
  var [financeEntries, setFinanceEntries] = useState([])
  var [fochClients, setFochClients] = useState([])
  var [customClassTypes, setCustomClassTypes] = useState([])
  var [financeAddType, setFinanceAddType] = useState('coaching')
  var [financeLocName, setFinanceLocName] = useState('')
  var [financeDuration, setFinanceDuration] = useState('')
  var [financeTime, setFinanceTime] = useState('')
  var [financeClientName, setFinanceClientName] = useState('')
  var [financeAmount, setFinanceAmount] = useState('')
  var [financePayMethod, setFinancePayMethod] = useState('cb')
  var [financeClassType, setFinanceClassType] = useState('')
  var [financeMonth, setFinanceMonth] = useState(new Date().getMonth())
  var [financeYear, setFinanceYear] = useState(new Date().getFullYear())
  var [bookTab, setBookTab] = useState('reserver')
  var [settingsTab, setSettingsTab] = useState('seances')
  var [coachLocations, setCoachLocations] = useState([])
  var [locationRequests, setLocationRequests] = useState([])
  var [newLocation, setNewLocation] = useState({ name: '', address: '', billable: false })
  var [coachOffers, setCoachOffers] = useState([])
  var [offerForm, setOfferForm] = useState({ name: '', type: 'single', price: '', credits: 1, description: '', billing_period: 'monthly', sessions_per_week: 1, original_price: '', badge: '' })
  var [clientSearch, setClientSearch] = useState('')
  var [clientTab, setClientTab] = useState('all')
  var [clientSubscriptions, setClientSubscriptions] = useState([])

  async function loadClientSubscriptions() {
    var { data } = await supabase.from('client_subscriptions').select('*').eq('coach_id', profile.id)
    setClientSubscriptions(data || [])
  }
  var [gcalStatus, setGcalStatus] = useState(null)
  var [gcalCalendars, setGcalCalendars] = useState(null)
  var [gmapsStatus, setGmapsStatus] = useState(null)
  var [stripeStatus, setStripeStatus] = useState(null)
  var [allCoaches, setAllCoaches] = useState([])
  var [coachStats, setCoachStats] = useState({})
  var [conversations, setConversations] = useState([])
  var [chatMessages, setChatMessages] = useState([])
  var [activeConvo, setActiveConvo] = useState(null)
  var [msgText, setMsgText] = useState('')
  var [unreadCount, setUnreadCount] = useState(0)
  var [sendingMsg, setSendingMsg] = useState(false)
  var [invoiceSettings, setInvoiceSettings] = useState({})
  var [savedCompanies, setSavedCompanies] = useState([])
  var [clientNotes, setClientNotes] = useState([])
  var [clientPhotos, setClientPhotos] = useState([])
  var [selectedClientId, setSelectedClientId] = useState(null)
  var [noteText, setNoteText] = useState('')
  var [noteCategory, setNoteCategory] = useState('session')
  var [gcalEvents, setGcalEvents] = useState([])
  var [gcalLoading, setGcalLoading] = useState(false)

  async function loadGcalForDate(date) {
    setGcalLoading(true)
    try {
      var res = await fetch('/api/admin-actions?action=gcal-events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: date }) })
      var data = await res.json()
      setGcalEvents(data.events || [])
    } catch(e) { setGcalEvents([]) }
    setGcalLoading(false)
  }
  var [payments, setPayments] = useState([])
  var [loadingPayments, setLoadingPayments] = useState(false)
  var [coachClient, setCoachClient] = useState(null)
  var [driveFolders, setDriveFolders] = useState([])
  var [activeDriveFolder, setActiveDriveFolder] = useState(null)
  var [driveUploading, setDriveUploading] = useState(false)
  var [shareModal, setShareModal] = useState(null)
  var [shareSelected, setShareSelected] = useState({})
  var [rescheduling, setRescheduling] = useState(null)
  var [rescheduleSlots, setRescheduleSlots] = useState([])
  var [rescheduleMonth, setRescheduleMonth] = useState(new Date().getMonth() + 1)
  var [rescheduleYear, setRescheduleYear] = useState(new Date().getFullYear())
  var [reminderDelay, setReminderDelay] = useState(settings.reminder_hours || 12)
  var [bufferMode, setBufferMode] = useState(settings.buffer_mode || 'travel')
  // Book for client
  var [bookForm, setBookForm] = useState({ clientId: '', date: '', time: '' })
  var [bookingClient, setBookingClient] = useState(false)
  var [adminSlots, setAdminSlots] = useState([])
  var [adminSlotsLoading, setAdminSlotsLoading] = useState(false)
  var [adminMonth, setAdminMonth] = useState(new Date().getMonth() + 1)
  var [adminYear, setAdminYear] = useState(new Date().getFullYear())
  var [adminSelectedDate, setAdminSelectedDate] = useState(null)
  var [recurForm, setRecurForm] = useState({ clientId: '', dayOfWeek: '1', time: '09:00', duration: '3', startDate: '' })
  var [bookingRecur, setBookingRecur] = useState(false)
  var [showCreateClient, setShowCreateClient] = useState(false)
  var [newClient, setNewClient] = useState({ email: '', firstName: '', lastName: '', phone: '', coachingType: 'presentiel', address: '', noApp: false })
  var [creatingClient, setCreatingClient] = useState(false)
  var [editingClient, setEditingClient] = useState(null)
  var [editClientData, setEditClientData] = useState({})
  var [selectedClient, setSelectedClient] = useState(null)
  var [savingClient, setSavingClient] = useState(false)

  useEffect(function() { loadAll(); loadLocations(); loadOffers(); loadClientSubscriptions(); fetch('/api/send-reminders').catch(function(){}); fetch('/api/google-webhook', { method: 'POST' }).catch(function(){}); fetch('/api/email-sequences?action=process').catch(function(){})
    // Check Stripe Connect redirect
    var urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('stripe') === 'success') {
      setView('settings')
      fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stripe-connect-status', coachId: profile.id }) }).then(function(r) { return r.json() }).then(function(data) { setStripeStatus(data); setMsg({ type: 'success', text: '✅ Compte Stripe connecté avec succès !' }) }).catch(function(){})
      window.history.replaceState({}, '', window.location.pathname)
    }
    // Real-time: notify when client finishes a workout
    var workoutChannel = supabase.channel('admin-workouts').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workout_logs' }, function(payload) {
      var log = payload.new
      var client = clients.length > 0 ? clients.find(function(c) { return c.id === log.client_id }) : null
      var name = client ? (client.full_name || client.email) : 'Un client'
      setMsg({ type: 'success', text: '🏋️ ' + name + ' a terminé sa séance !' + (log.emoji ? ' ' + log.emoji : '') })
      // Play notification sound
      try { var ctx = new (window.AudioContext || window.webkitAudioContext)(); var o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.value = 880; g.gain.value = 0.5; o.start(); o.stop(ctx.currentTime + 0.2) } catch(e) {}
    }).subscribe()
    return function() { supabase.removeChannel(workoutChannel) }
  }, [])

  async function loadAll() {
    setLoading(true)
    var threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    var [c, b, oh, st, bp] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,phone,coaching_type,address,credits,no_credit_required,beta_features,is_admin,created_at,domicile_sub_type,domicile_sub_start,domicile_sub_amount,last_relance_at,last_seen,referral_code,module_access').eq('is_admin', false).eq('coach_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('bookings').select('*, profiles!bookings_client_id_fkey(full_name, email, coaching_type, address, no_credit_required, credits), time_slots(start_time, end_time)').eq('coach_id', profile.id).gte('created_at', threeMonthsAgo.toISOString()).order('created_at', { ascending: false }),
      supabase.from('opening_hours').select('*').eq('coach_id', profile.id).order('day_of_week'),
      supabase.from('coaching_settings').select('*').eq('coach_id', profile.id).maybeSingle(),
      supabase.from('blocked_periods').select('*').eq('coach_id', profile.id).gte('date', new Date().toISOString().split('T')[0]).order('date'),
    ])
    setClients(c.data || [])
    setBookings(b.data || [])
    // Settings: try coach_id first, then fallback to id='admin' (legacy)
    var settingsData = st.data
    if (!settingsData) {
      var legacy = await supabase.from('coaching_settings').select('*').eq('id', 'admin').maybeSingle()
      if (legacy.data) {
        settingsData = legacy.data
        // Migrate: add coach_id to legacy record
        var migr = await supabase.from('coaching_settings').update({ coach_id: profile.id }).eq('id', 'admin')
      }
    }
    if (!settingsData) {
      // No record at all, create one
      var newRec = await supabase.from('coaching_settings').insert({ coach_id: profile.id, session_duration: 60, buffer_time: 10, session_price: 50, green_max: 15, orange_max: 30, home_return_hours: 2, booking_window_weeks: 4, cancellation_hours: 24 }).select().single()
      settingsData = newRec.data || { session_duration: 60, buffer_time: 10 }
    }
    setSettings(function() {
      var s = Object.assign({}, settingsData)
      if (typeof s.loyalty_milestones === 'string') { try { s.loyalty_milestones = JSON.parse(s.loyalty_milestones) } catch(e) { s.loyalty_milestones = [] } }
      return s
    })
    setBlockedPeriods(bp.data || [])
    var existing = oh.data || []
    setOpeningHours(Array.from({ length: 7 }, function(_, i) {
      var found = existing.find(function(h) { return h.day_of_week === i })
      return found || { day_of_week: i, start_time: '08:00', end_time: '20:00', is_active: false }
    }))
    setLoading(false)
    loadFinance()
    loadConversations()
    loadInvoiceSettings()
    loadDrive()
  }

  async function loadDrive() {
    var { data: folders } = await supabase.from('drive_folders').select('*').eq('coach_id', profile.id).order('order_index')
    var { data: files } = await supabase.from('drive_files').select('*').eq('coach_id', profile.id).order('created_at', { ascending: false })
    var { data: shares } = await supabase.from('drive_folder_shares').select('*')
    var allFiles = files || []
    var allShares = shares || []
    ;(folders || []).forEach(function(f) { f.files = allFiles.filter(function(fi) { return fi.folder_id === f.id }); f.shares = allShares.filter(function(s) { return s.folder_id === f.id }) })
    setDriveFolders(folders || [])
  }

  async function loadInvoiceSettings() {
    try {
      var res = await supabase.from('invoice_settings').select('*').eq('coach_id', profile.id).single()
      if (res.data) setInvoiceSettings(res.data)
      var co = await supabase.from('client_companies').select('*').eq('coach_id', profile.id).order('name')
      setSavedCompanies(co.data || [])
    } catch(e) {}
  }

  async function loadLocations() {
    var { data: locs } = await supabase.from('coach_locations').select('*').eq('coach_id', profile.id).order('created_at')
    setCoachLocations(locs || [])
    var { data: reqs } = await supabase.from('location_requests').select('*, profiles:client_id(full_name, email)').eq('coach_id', profile.id).eq('status', 'pending').order('created_at', { ascending: false })
    setLocationRequests(reqs || [])
  }

  async function loadOffers() {
    var { data } = await supabase.from('coach_offers').select('*').eq('coach_id', profile.id).order('sort_order').order('created_at')
    setCoachOffers(data || [])
  }

  async function loadClientNotes(clientId) {
    var res = await supabase.from('coach_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setClientNotes(res.data || [])
  }

  async function loadClientPhotos(clientId) {
    var res = await supabase.from('client_photos').select('*').eq('client_id', clientId).order('taken_at', { ascending: true })
    setClientPhotos(res.data || [])
  }

  async function addNote(clientId) {
    if (!noteText.trim()) return
    await supabase.from('coach_notes').insert({ client_id: clientId, content: noteText.trim(), category: noteCategory, coach_id: profile.id })
    setNoteText('')
    loadClientNotes(clientId)
  }

  async function uploadPhoto(clientId, file, type) {
    var ext = file.name.split('.').pop()
    var path = 'photos/' + clientId + '/' + Date.now() + '.' + ext
    var up = await supabase.storage.from('uploads').upload(path, file)
    if (up.data) {
      var pub = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('client_photos').insert({ client_id: clientId, photo_url: pub.data.publicUrl, type: type, taken_at: new Date().toISOString().split('T')[0], coach_id: profile.id })
      loadClientPhotos(clientId)
    }
  }

  async function sendBilanEmail(clientId) {
    var client = clients.find(function(c) { return c.id === clientId })
    if (!client || !client.email) { setMsg({ type: 'error', text: 'Pas d\'email pour ce client' }); return }
    var now = new Date()
    var monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
    var month = now.getMonth(); var year = now.getFullYear()

    // Get session count
    var sessions = confirmedBookings.filter(function(b) { var d = new Date(b.time_slots.start_time); return b.client_id === clientId && d.getMonth() === month && d.getFullYear() === year })

    // Get PRs
    var prs = await supabase.from('personal_records').select('*, exercises(name)').eq('client_id', clientId).order('achieved_at', { ascending: false }).limit(5)

    var html = '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden">'
    html += '<div style="background:#161410;padding:32px 28px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:22px">Yoann <span style="color:#C4973A">Desgrand</span></div><div style="color:#7a7065;font-size:13px;margin-top:4px">Bilan ' + monthNames[month] + ' ' + year + '</div></div>'
    html += '<div style="padding:28px">'
    html += '<div style="font-size:18px;margin-bottom:20px">Hey ' + (client.full_name || '').split(' ')[0] + ' 💪</div>'
    html += '<div style="display:flex;gap:12px;margin-bottom:24px"><div style="flex:1;background:#141210;border:1px solid #2a2520;border-radius:10px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:bold;color:#C4973A">' + sessions.length + '</div><div style="font-size:11px;color:#7a7065">séances</div></div>'
    html += '<div style="flex:1;background:#141210;border:1px solid #2a2520;border-radius:10px;padding:16px;text-align:center"><div style="font-size:28px;font-weight:bold;color:#4ade80">' + ((prs.data || []).length) + '</div><div style="font-size:11px;color:#7a7065">records</div></div></div>'

    if (prs.data && prs.data.length > 0) {
      html += '<div style="margin-bottom:20px"><div style="font-size:14px;font-weight:bold;margin-bottom:10px">🏆 Tes records :</div>'
      prs.data.forEach(function(pr) { html += '<div style="padding:8px 0;border-bottom:1px solid #2a2520;font-size:13px">' + (pr.exercises?.name || '—') + ' — <span style="color:#C4973A;font-weight:bold">' + pr.weight_kg + 'kg × ' + pr.reps + '</span></div>' })
      html += '</div>'
    }

    html += '<div style="font-size:13px;color:#7a7065;line-height:1.6">Continue comme ça, tu fais un super travail ! On se retrouve le mois prochain pour de nouveaux objectifs. 🔥</div>'
    html += '</div><div style="padding:20px 28px;border-top:1px solid #2a2520;text-align:center"><a href="https://app.yoanndesgrand.fr" style="display:inline-block;padding:12px 24px;background:#C4973A;color:#000;text-decoration:none;border-radius:8px;font-weight:500">Ouvrir l\'app</a></div></div>'

    try {
      var resp = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: client.email, subject: '📊 Ton bilan ' + monthNames[month] + ' — YD Coaching', html: html }) })
      var result = await resp.json()
      if (result.sent) setMsg({ type: 'success', text: '📧 Bilan envoyé à ' + client.email })
      else setMsg({ type: 'error', text: 'Erreur : ' + (result.error || '') })
    } catch(e) { setMsg({ type: 'error', text: e.message }) }
  }

  async function loadFinance() {
    try {
      var [fe, fc, ct] = await Promise.all([
        supabase.from('finance_entries').select('*').eq('coach_id', profile.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('foch_clients').select('*').eq('coach_id', profile.id).order('name'),
        supabase.from('foch_class_types').select('*').eq('coach_id', profile.id).order('name')
      ])
      setFinanceEntries(fe.data || [])
      setFochClients(fc.data || [])
      setCustomClassTypes(ct.data || [])
    } catch(e) { console.log('loadFinance:', e) }
  }

  async function loadConversations() {
    try {
      var res = await supabase.from('conversations').select('*, profiles:client_id(full_name, email)').eq('coach_id', profile.id).order('last_message_at', { ascending: false })
      var convos = res.data || []
      setConversations(convos)
      // Count unread
      var unread = 0
      for (var i = 0; i < convos.length; i++) {
        var mr = await supabase.from('messages').select('id', { count: 'exact' }).eq('conversation_id', convos[i].id).is('read_at', null).neq('sender_id', profile.id)
        unread += (mr.count || 0)
      }
      setUnreadCount(unread)
    } catch(e) { console.log('loadConversations:', e) }
  }

  async function loadMessages(convoId) {
    var res = await supabase.from('messages').select('*, profiles:sender_id(full_name, email, is_admin)').eq('conversation_id', convoId).order('created_at', { ascending: true })
    setChatMessages(res.data || [])
    await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', convoId).is('read_at', null).neq('sender_id', profile.id)
    // Real-time subscription
    supabase.channel('msg-' + convoId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convoId }, function(payload) {
      if (payload.new.sender_id === profile.id) return
      setChatMessages(function(prev) { return prev.concat([payload.new]) })
      supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id)
    }).subscribe()
  }

  async function sendMessage(convoId) {
    if (!msgText.trim() && !msgFile) return
    setSendingMsg(true)
    var fileUrl = null; var fileName = null; var type = 'text'
    if (msgFile) {
      var ext = msgFile.name.split('.').pop()
      var path = 'messages/' + convoId + '/' + Date.now() + '.' + ext
      var up = await supabase.storage.from('uploads').upload(path, msgFile)
      if (up.data) {
        var pub = supabase.storage.from('uploads').getPublicUrl(path)
        fileUrl = pub.data.publicUrl
        fileName = msgFile.name
        type = msgFile.type.includes('pdf') ? 'pdf' : 'image'
      }
    }
    await supabase.from('messages').insert({ conversation_id: convoId, sender_id: profile.id, content: msgText.trim() || null, type: type, file_url: fileUrl, file_name: fileName })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convoId)
    // Send email notification
    var convo = conversations.find(function(c) { return c.id === convoId })
    if (convo && convo.profiles?.email) {
      try { fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: convo.profiles.email, subject: '💬 Nouveau message de Yoann — YD Coaching', html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:24px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:20px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:24px"><div style="font-size:16px;margin-bottom:16px">💬 Nouveau message</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:16px;margin-bottom:20px;font-size:14px;line-height:1.6">' + (msgText || '📎 Fichier envoyé') + '</div><a href="https://app.yoanndesgrand.fr" style="display:inline-block;padding:12px 24px;background:#C4973A;color:#000;text-decoration:none;border-radius:8px;font-weight:500">Répondre</a></div></div>' }) }) } catch(e) {}
      // Push notification
      try { fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push-send', userId: convo.client_id, title: '💬 ' + (coachBrand ? coachBrand.name : 'Coach'), body: msgText.trim() || '📎 Fichier envoyé', url: '/' }) }) } catch(e) {}
    }
    setMsgText(''); setMsgFile(null); loadMessages(convoId)
    setSendingMsg(false)
  }

  async function startConversation(clientId) {
    var existing = conversations.find(function(c) { return c.client_id === clientId })
    if (existing) { setActiveConvo(existing); loadMessages(existing.id); return }
    var res = await supabase.from('conversations').insert({ client_id: clientId, coach_id: profile.id }).select('*, profiles:client_id(full_name, email)').single()
    if (res.data) { setActiveConvo(res.data); loadMessages(res.data.id); loadConversations() }
  }

  var [msgFile, setMsgFile] = useState(null)

  async function generateInvoice(mode) {
    var inv = invoiceSettings || {}
    var monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    var clientName = document.getElementById('inv-client').value
    var coName = document.getElementById('inv-co-name').value || clientName
    var coSiret = document.getElementById('inv-co-siret').value
    var coTva = document.getElementById('inv-co-tva').value
    var coAddr = document.getElementById('inv-co-addr').value
    var month = parseInt(document.getElementById('inv-month').value)
    var year = parseInt(document.getElementById('inv-year').value) || new Date().getFullYear()
    var invNum = document.getElementById('inv-number').value
    var email = document.getElementById('inv-email').value
    if (!clientName && !coName) return
    var entries = financeEntries.filter(function(e) { var d = new Date(e.date + 'T12:00:00'); return d.getMonth() === month && d.getFullYear() === year && (clientName === '33Foch' ? e.type === 'group_class' : e.client_name === clientName) })
    if (entries.length === 0) { setMsg({ type: 'error', text: 'Aucune entrée ce mois.' }); return }
    var total = entries.reduce(function(sum, e) { return sum + (parseInt(e.amount) || 0) }, 0)
    var lines = []
    if (clientName === '33Foch') { var gr = {}; entries.forEach(function(e) { var ct = e.class_type || 'Cours'; if (!gr[ct]) gr[ct] = { n: 0, p: parseInt(e.amount) || 50 }; gr[ct].n++ }); Object.keys(gr).forEach(function(ct) { lines.push([ct, gr[ct].n, gr[ct].p + ' €', (gr[ct].n * gr[ct].p) + ' €']) }) }
    else { entries.forEach(function(e) { lines.push([(e.type === 'subscription' ? 'Abonnement' : 'Coaching — ' + new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR')), 1, (parseInt(e.amount) || 0) + ' €', (parseInt(e.amount) || 0) + ' €']) }) }

    // Generate PDF with jsPDF
    var doc = new jsPDF()
    var gold = [196, 151, 58]
    var gray = [120, 120, 120]

    // Header
    doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.text(inv.business_name || 'Yoann Desgrand', 14, 25)
    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(100); doc.text('Coach sportif', 14, 32)
    var yInfo = 38
    if (inv.siret) { doc.setFontSize(9); doc.text('SIRET : ' + inv.siret, 14, yInfo); yInfo += 5 }
    if (inv.tva_number) { doc.text('TVA : ' + inv.tva_number, 14, yInfo); yInfo += 5 }
    if (inv.address) { doc.text(inv.address, 14, yInfo); yInfo += 5 }
    if (inv.phone) { doc.text(inv.phone, 14, yInfo); yInfo += 5 }
    if (inv.email) { doc.text(inv.email, 14, yInfo) }

    // Invoice title
    doc.setTextColor(gold[0], gold[1], gold[2]); doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('FACTURE', 196, 25, { align: 'right' })
    doc.setTextColor(60); doc.setFontSize(12); doc.text(invNum, 196, 33, { align: 'right' })
    doc.setFontSize(10); doc.setTextColor(100); doc.text('Date : ' + new Date().toLocaleDateString('fr-FR'), 196, 40, { align: 'right' })

    // Client box
    var clientY = Math.max(yInfo, 48) + 10
    doc.setFillColor(245, 245, 245); doc.roundedRect(14, clientY, 182, coAddr ? 28 : 20, 3, 3, 'F')
    doc.setTextColor(30); doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(coName, 20, clientY + 8)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100)
    var clientInfoY = clientY + 14
    if (coSiret) { doc.text('SIRET : ' + coSiret + (coTva ? '  ·  TVA : ' + coTva : ''), 20, clientInfoY); clientInfoY += 5 }
    if (coAddr) { doc.text(coAddr, 20, clientInfoY); clientInfoY += 5 }

    // Period
    doc.setTextColor(30); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
    doc.text('Période : ' + monthNames[month] + ' ' + year, 14, clientInfoY + 8)

    // Table
    autoTable(doc, { startY: clientInfoY + 14, head: [['#', 'Description', 'Qté', 'P.U.', 'Total']], body: lines.map(function(l, i) { return [i + 1].concat(l) }), styles: { fontSize: 10, cellPadding: 4, font: 'helvetica' }, headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontStyle: 'bold', fontSize: 9 }, columnStyles: { 0: { cellWidth: 12 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, theme: 'plain', didDrawCell: function(data) { if (data.section === 'body') { doc.setDrawColor(230); doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height) } } })

    // Total
    var finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : clientInfoY + 60
    doc.setDrawColor(30); doc.line(14, finalY, 196, finalY)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(30); doc.text('Total :', 130, finalY + 10)
    doc.setTextColor(gold[0], gold[1], gold[2]); doc.text(total + ' €', 196, finalY + 10, { align: 'right' })

    // Bank details
    if (inv.iban) {
      var bankY = finalY + 22
      doc.setFillColor(245, 245, 245); doc.roundedRect(14, bankY, 182, 16, 3, 3, 'F')
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(60); doc.text('Coordonnées bancaires', 20, bankY + 6)
      doc.setFont('helvetica', 'normal'); doc.text('IBAN : ' + inv.iban + (inv.bic ? '  —  BIC : ' + inv.bic : ''), 20, bankY + 12)
    }

    // Footer
    doc.setFontSize(8); doc.setTextColor(150); doc.setFont('helvetica', 'normal')
    var footY = 275
    doc.text((inv.business_name || 'Yoann Desgrand') + ' — Coach sportif', 14, footY)
    if (inv.siret) doc.text('SIRET : ' + inv.siret, 14, footY + 4)
    doc.text(inv.legal_mention || 'TVA non applicable, art. 293 B du CGI.', 14, footY + 8)
    if (inv.terms) doc.text(inv.terms, 14, footY + 12)

    if (mode === 'send') {
      if (!email) { setMsg({ type: 'error', text: 'Renseigne l\'email.' }); return }
      // Upload PDF to storage
      var pdfBlob = doc.output('blob')
      var pdfPath = 'invoices/' + invNum.replace(/\//g, '-') + '.pdf'
      var up = await supabase.storage.from('uploads').upload(pdfPath, pdfBlob, { contentType: 'application/pdf' })
      if (up.error) { setMsg({ type: 'error', text: 'Erreur upload : ' + up.error.message }); return }
      var pub = supabase.storage.from('uploads').getPublicUrl(pdfPath)
      var pdfUrl = pub.data.publicUrl
      // Send email with PDF link
      var resp = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', to: email, subject: 'Facture ' + invNum + ' — ' + (inv.business_name || 'Yoann Desgrand'), html: '<div style="font-family:Arial;max-width:500px;margin:0 auto;background:#080808;color:#f0ece4;border-radius:12px;overflow:hidden"><div style="background:#161410;padding:24px;text-align:center;border-bottom:1px solid #2a2520"><div style="font-family:Georgia;font-size:20px">Yoann <span style="color:#C4973A">Desgrand</span></div></div><div style="padding:24px"><div style="font-size:16px;margin-bottom:16px">🧾 Facture ' + invNum + '</div><div style="background:#141210;border:1px solid #2a2520;border-radius:10px;padding:16px;margin-bottom:20px"><div style="font-size:22px;font-weight:bold;color:#C4973A;margin-bottom:4px">' + total + ' €</div><div style="font-size:13px;color:#7a7065">' + monthNames[month] + ' ' + year + '</div></div><a href="' + pdfUrl + '" style="display:inline-block;padding:14px 28px;background:#C4973A;color:#000;text-decoration:none;border-radius:8px;font-weight:500">📄 Télécharger la facture PDF</a></div></div>' }) })
      var result = await resp.json()
      if (result.sent) setMsg({ type: 'success', text: '📧 Facture envoyée à ' + email })
      else setMsg({ type: 'error', text: 'Erreur : ' + (result.error || '') })
    } else {
      doc.save('Facture-' + invNum.replace(/\//g, '-') + '.pdf')
    }

    var nextNum = (inv.next_invoice_number || 1) + 1
    supabase.from('invoice_settings').update({ next_invoice_number: nextNum }).eq('coach_id', profile.id)
    setInvoiceSettings(function(st) { return Object.assign({}, st, { next_invoice_number: nextNum }) })
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

  async function addCreditsToClient(clientId, amount) {
    var client = clients.find(function(c) { return c.id === clientId })
    if (!client) return
    var newCredits = (client.credits || 0) + parseInt(amount)
    await supabase.from('profiles').update({ credits: newCredits }).eq('id', clientId)
    setMsg({ type: 'success', text: amount + ' crédit(s) ajouté(s).' })
    loadAll()
  }

  async function toggleNoCredit(clientId, current) {
    await supabase.from('profiles').update({ no_credit_required: !current }).eq('id', clientId)
    setMsg({ type: 'success', text: !current ? '💳 Client en paiement à la séance — réservations sans déduction de crédits.' : 'Client en mode crédits — les crédits seront déduits à chaque réservation.' })
    loadAll()
  }

  async function updateSubscription(clientId, val) {
    await supabase.from('profiles').update({ subscription_type: val }).eq('id', clientId)
    var client = clients.find(function(c) { return c.id === clientId })
    if (client && val) {
      try {
        await fetch('/api/email?action=subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientEmail: client.email, clientName: client.full_name, subscriptionType: val })
        })
      } catch (e) {}
    }
    setMsg({ type: 'success', text: 'Abonnement mis à jour.' + (val && (val.includes('nutrition') || val === 'nutrition') ? ' Email avec questionnaire envoyé.' : '') })
    loadAll()
  }

  async function updateCoachingType(clientId, val) {
    var updates = { coaching_type: val }
    if (val === 'presentiel' || val === 'hybride') updates.address = 'ON AIR BNF, 93 avenue de France, Paris 13'
    await supabase.from('profiles').update(updates).eq('id', clientId)
    setMsg({ type: 'success', text: 'Type de coaching mis à jour.' })
    loadAll()
  }

  async function updateDomicileSub(clientId, subValue) {
    var sub = DOMICILE_SUBS.find(function(s) { return s.value === subValue })
    var updates = { domicile_sub_type: subValue || null, domicile_sub_amount: sub ? sub.amount : null }
    if (sub && !clients.find(function(c) { return c.id === clientId })?.domicile_sub_start) {
      updates.domicile_sub_start = new Date().toISOString().split('T')[0]
    }
    if (sub) updates.credits = sub.sessions
    await supabase.from('profiles').update(updates).eq('id', clientId)
    setMsg({ type: 'success', text: sub ? 'Abonnement domicile activé — ' + sub.sessions + ' séances créditées.' : 'Abonnement domicile retiré.' })
    loadAll()
  }

  async function updateDomicileStart(clientId, date) {
    await supabase.from('profiles').update({ domicile_sub_start: date }).eq('id', clientId)
    loadAll()
  }

  async function startReschedule(booking) {
    setRescheduling(booking)
    setRescheduleMonth(new Date().getMonth() + 1)
    setRescheduleYear(new Date().getFullYear())
    loadRescheduleSlots(new Date().getMonth() + 1, new Date().getFullYear(), booking.client_id)
  }

  async function loadRescheduleSlots(m, y, clientId) {
    var excludeId = rescheduling ? rescheduling.id : ''
    var locParam = rescheduling && rescheduling.location ? '&location=' + encodeURIComponent(rescheduling.location) : ''
    var res = await fetch('/api/available-slots?year=' + y + '&month=' + m + '&clientId=' + (clientId || '') + '&admin=true&excludeBooking=' + excludeId + locParam)
    var data = await res.json()
    setRescheduleSlots(data.slots || [])
  }

  async function confirmReschedule(slot) {
    if (!rescheduling) return
    setMsg({ type: 'success', text: 'Décalage en cours...' })
    try {
      var res = await fetch('/api/admin-actions?action=reschedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: rescheduling.id, newStartTime: slot.start, newEndTime: slot.end })
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: 'Séance décalée ! Client et Google Calendar mis à jour.' })
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setRescheduling(null)
    await loadAll()
  }

  async function resendInvite(client) {
    if (!confirm('Renvoyer l\'invitation à ' + (client.full_name || client.email) + ' (' + client.email + ') ?')) return
    setMsg({ type: 'success', text: 'Envoi en cours...' })
    try {
      var res = await fetch('/api/admin-actions?action=resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id })
      })
      var data = await res.json()
      if (data.success) setMsg({ type: 'success', text: 'Invitation renvoyée à ' + client.email + ' avec un nouveau mot de passe.' })
      else setMsg({ type: 'error', text: data.error || 'Erreur' })
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
  }

  async function deleteClient(id, name) {
    if (!window.confirm('Supprimer ' + name + ' définitivement ?')) return
    try {
      var res = await fetch('/api/admin-actions?action=delete-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id })
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: name + ' supprimé définitivement.' })
        loadAll()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
  }

  async function cancelBooking(bookingId, silent) {
    setCancelling(bookingId)
    try {
      // Delete associated finance entry
      await supabase.from('finance_entries').delete().eq('booking_id', bookingId)
      // Also try matching by booking notes for group classes
      var bk = bookings.find(function(b) { return b.id === bookingId })
      if (bk && bk.notes && bk.time_slots) {
        var bkDate = bk.time_slots.start_time.split('T')[0]
        await supabase.from('finance_entries').delete().eq('coach_id', profile.id).eq('date', bkDate).eq('type', 'group_class').like('class_type', '%' + (bk.notes.replace('📋 ', '').split(' · ')[0] || '') + '%')
      }
      var res = await fetch('/api/admin-actions?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingId, silent: silent || false })
      })
      var data = await res.json()
      if (data.success) {
        if (!silent) setMsg({ type: 'success', text: 'Réservation annulée, client notifié. Entrée finance supprimée.' })
        await loadAll(); await loadFinance()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setCancelling(null)
  }

  async function cancelAllFutureBookings(clientId) {
    var clientName = (clients.find(function(c) { return c.id === clientId }) || {}).full_name || 'Client'
    var futureBookings = bookings.filter(function(b) { return b.client_id === clientId && b.status === 'confirmed' && new Date(b.time_slots.start_time) > new Date() })
    if (futureBookings.length === 0) { setMsg({ type: 'error', text: 'Aucune séance future à annuler.' }); return }
    if (!confirm('Annuler ' + futureBookings.length + ' séances futures de ' + clientName + ' ?\n\nUn seul email récapitulatif sera envoyé (pas 1 par séance).')) return
    setMsg({ type: 'success', text: 'Annulation en cours... ' + futureBookings.length + ' séances' })
    for (var i = 0; i < futureBookings.length; i++) {
      await cancelBooking(futureBookings[i].id, true)
    }
    // Send ONE summary email
    try {
      await fetch('/api/admin-actions?action=cancel-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId, count: futureBookings.length })
      })
    } catch (e) {}
    setMsg({ type: 'success', text: futureBookings.length + ' séances annulées. ' + clientName + ' a reçu un seul email récapitulatif.' })
    loadAll()
  }

  async function cancelSelectedBookings() {
    var ids = Object.keys(selectedBookings).filter(function(k) { return selectedBookings[k] })
    if (ids.length === 0) return
    if (!confirm('Annuler ' + ids.length + ' séance(s) sélectionnée(s) ?\n\nUn seul email récapitulatif sera envoyé par client.')) return
    setMsg({ type: 'success', text: 'Annulation de ' + ids.length + ' séances...' })
    var clientIds = {}
    for (var i = 0; i < ids.length; i++) {
      var b = bookings.find(function(bk) { return bk.id === ids[i] })
      if (b) clientIds[b.client_id] = (clientIds[b.client_id] || 0) + 1
      await cancelBooking(ids[i], true)
    }
    for (var cid in clientIds) {
      try { await fetch('/api/admin-actions?action=cancel-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: cid, count: clientIds[cid] }) }) } catch (e) {}
    }
    setSelectedBookings({})
    setMsg({ type: 'success', text: ids.length + ' séances annulées.' })
    loadAll()
  }

  async function bookForClient() {
    if (!bookForm.clientId || !bookForm.startTime) { setMsg({ type: 'error', text: 'Sélectionne un client et un créneau.' }); return }
    setBookingClient(true)
    var slot = adminSlots.find(function(s) { return s.start === bookForm.startTime })
    var startTime = bookForm.startTime
    var endTime = slot ? slot.end : new Date(new Date(startTime).getTime() + (settings.session_duration || 60) * 60000).toISOString()
    try {
      var res = await fetch('/api/admin-actions?action=book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: bookForm.clientId, startTime: startTime, endTime: endTime, location: bookForm.location || null })
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: 'Réservation créée, client notifié par email.' })
        setBookForm({ clientId: bookForm.clientId, startTime: '' })
        loadAdminSlots(bookForm.clientId, adminYear, adminMonth)
        loadAll()
      } else { setMsg({ type: 'error', text: data.error || 'Erreur' }) }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setBookingClient(false)
  }

  async function loadAdminSlots(clientId, year, month, loc) {
    if (!clientId) { setAdminSlots([]); return }
    setAdminSlotsLoading(true)
    try {
      var locParam = (loc || bookForm.location) ? '&location=' + encodeURIComponent(loc || bookForm.location) : ''
      var res = await fetch('/api/available-slots?year=' + year + '&month=' + month + '&clientId=' + clientId + '&admin=true' + locParam)
      var data = await res.json()
      setAdminSlots(data.slots || [])
    } catch (e) { setAdminSlots([]) }
    setAdminSlotsLoading(false)
  }

  function getSlotColor(slot) {
    var c = slot.color || 'green'
    if (c === 'green') return { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', text: '#4ade80' }
    if (c === 'orange') return { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' }
    return { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', text: '#f87171' }
  }

  async function bookRecurring() {
    if (!recurForm.clientId || !recurForm.time || !recurForm.startDate) { setMsg({ type: 'error', text: 'Remplis tous les champs.' }); return }
    setBookingRecur(true)
    try {
      var res = await fetch('/api/admin-actions?action=book-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: recurForm.clientId,
          dayOfWeek: parseInt(recurForm.dayOfWeek),
          time: recurForm.time,
          durationMonths: parseInt(recurForm.duration),
          startDate: recurForm.startDate,
          sessionDuration: settings.session_duration || 60
        })
      })
      var data = await res.json()
      if (data.success) {
        var errMsg = data.errors ? '\n⚠️ Erreurs : ' + data.errors.join(', ') : ''
        if (data.calError) errMsg += '\n📅 Google Calendar : ' + data.calError
        setMsg({ type: data.count > 0 ? 'success' : 'error', text: data.count + ' séances créées sur ' + recurForm.duration + ' mois.' + errMsg })
        setRecurForm({ clientId: '', dayOfWeek: '1', time: '09:00', duration: '3', startDate: '' })
        loadAll()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setBookingRecur(false)
  }

  async function loadPayments() {
    setLoadingPayments(true)
    try {
      var res = await fetch('/api/admin-actions?action=payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      var data = await res.json()
      setPayments(data.payments || [])
    } catch (e) { setPayments([]) }
    setLoadingPayments(false)
  }

  async function saveHours() {
    setSavingHours(true)
    await supabase.from('opening_hours').delete().eq('coach_id', profile.id)
    var active = openingHours.filter(function(h) { return h.is_active })
    if (active.length > 0) {
      await supabase.from('opening_hours').insert(active.map(function(h) {
        return { day_of_week: h.day_of_week, start_time: h.start_time, end_time: h.end_time, is_active: true, coach_id: profile.id }
      }))
    }
    await supabase.from('coaching_settings').upsert({ id: settings.id || 'admin', coach_id: profile.id, session_duration: settings.session_duration, buffer_time: settings.buffer_time, buffer_mode: bufferMode, buffer_adjustment: settings.buffer_adjustment || 0, session_price: settings.session_price || 50, reminder_hours: reminderDelay, booking_window_weeks: settings.booking_window_weeks || 4, discovery_window_weeks: settings.discovery_window_weeks || 2, inactivity_weeks: settings.inactivity_weeks || 3, coach_home_address: settings.coach_home_address || '', green_max: settings.green_max || 15, orange_max: settings.orange_max || 30, home_return_hours: settings.home_return_hours || 2, hide_red_slots: settings.hide_red_slots || false, travel_mode: settings.travel_mode || 'driving', cancellation_hours: settings.cancellation_hours || 24, google_calendar_id: settings.google_calendar_id || 'primary', loyalty_enabled: settings.loyalty_enabled || false, loyalty_milestones: settings.loyalty_milestones ? JSON.stringify(settings.loyalty_milestones) : null, updated_at: new Date().toISOString() })
    setMsg({ type: 'success', text: 'Paramètres sauvegardés !' })
    setSavingHours(false)
  }

  async function addBlock() {
    if (!newBlock.date) return
    var dates = []
    if (newBlock.mode === 'range' && newBlock.endDate) {
      var d = new Date(newBlock.date + 'T12:00:00')
      var end = new Date(newBlock.endDate + 'T12:00:00')
      while (d <= end) {
        dates.push(d.toISOString().split('T')[0])
        d.setDate(d.getDate() + 1)
      }
    } else {
      dates.push(newBlock.date)
    }
    var inserts = dates.map(function(date) {
      return {
        date: date,
        start_time: newBlock.mode === 'partial' ? (newBlock.start_time || null) : null,
        end_time: newBlock.mode === 'partial' ? (newBlock.end_time || null) : null,
        reason: newBlock.reason || null,
        coach_id: profile.id
      }
    })
    await supabase.from('blocked_periods').insert(inserts)
    setNewBlock({ mode: 'day', date: '', endDate: '', start_time: '', end_time: '', reason: '' })
    setMsg({ type: 'success', text: dates.length + ' jour' + (dates.length > 1 ? 's' : '') + ' bloqué' + (dates.length > 1 ? 's' : '') + '.' })
    loadAll()
  }

  // Normalize bookings: group classes have start_time/end_time directly, not via time_slots
  var normalizedBookings = bookings.map(function(b) {
    if (b.status === 'confirmed' && !b.time_slots && b.start_time) {
      return Object.assign({}, b, { time_slots: { start_time: b.start_time, end_time: b.end_time } })
    }
    return b
  })
  var confirmedBookings = normalizedBookings.filter(function(b) { return b.status === 'confirmed' && b.time_slots })
  var upcomingBookings = confirmedBookings.filter(function(b) { return new Date(b.time_slots.start_time) > new Date() }).sort(function(a, b) { return new Date(a.time_slots.start_time) - new Date(b.time_slots.start_time) })
  var todayStr = new Date().toISOString().split('T')[0]
  var todayBookings = confirmedBookings.filter(function(b) { return b.time_slots && b.time_slots.start_time && b.time_slots.start_time.startsWith(todayStr) }).sort(function(a, b) { return new Date(a.time_slots.start_time) - new Date(b.time_slots.start_time) })
  var sortedClients = clients.slice().sort(function(a, b) { return (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '') })
  var clientsWithCredits = clients.filter(function(c) { return (c.credits || 0) > 0 })

  async function createClient() {
    if (!newClient.firstName || !newClient.coachingType) { setMsg({ type: 'error', text: 'Prénom et type requis.' }); return }
    if (!newClient.noApp && !newClient.email) { setMsg({ type: 'error', text: 'Email requis (ou cochez "Sans accès app").' }); return }
    setCreatingClient(true)
    try {
      var res = await fetch('/api/admin-actions?action=create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, newClient, { coachId: profile.id }))
      })
      var data = await res.json()
      if (data.success) {
        setMsg({ type: 'success', text: newClient.firstName + ' ' + newClient.lastName + (newClient.noApp ? ' créé (sans accès app).' : ' créé ! Email envoyé.') })
        setNewClient({ email: '', firstName: '', lastName: '', phone: '', coachingType: 'presentiel', address: '', noApp: false })
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
      address: editClientData.address || '',
      module_access: JSON.stringify({
        reservation: editClientData.access_reservation !== false,
        sport: editClientData.access_sport !== false,
        nutrition: editClientData.access_nutrition !== false
      })
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

    // Initials avatar
    var initials = (c.full_name || '?').split(' ').map(function(n) { return n[0] || '' }).join('').toUpperCase().slice(0, 2)
    var colors = ['#C4973A', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#34d399', '#f87171']
    var colorIndex = (c.full_name || '').length % colors.length
    var avatarColor = colors[colorIndex]

    // Activity dot - based on last connection
    var activityDot = !c.last_seen ? '#f87171' : (Date.now() - new Date(c.last_seen).getTime() > 7 * 86400000) ? '#fb923c' : '#4ade80'
    var daysSinceLogin = c.last_seen ? Math.round((Date.now() - new Date(c.last_seen).getTime()) / 86400000) : null
    var activityLabel = !c.last_seen ? 'Jamais connecté' : daysSinceLogin === 0 ? 'Connecté aujourd\'hui' : 'Connecté il y a ' + daysSinceLogin + 'j'

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
                <option value="hybride">🔄 Hybride (salle + en ligne)</option>
              </select>
            </div>
            {editClientData.coaching_type === 'domicile' && (
              <div><div style={s.fieldLabel}>Adresse</div><input type="text" value={editClientData.address || ''} onChange={function(e) { setEditClientData(function(d) { return Object.assign({}, d, { address: e.target.value }) }) }} style={s.input} /></div>
            )}
            <div style={{ marginTop: 12, padding: '12px', background: 'rgba(196,151,58,0.04)', border: '1px solid rgba(196,151,58,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: GOLD, marginBottom: 8 }}>Accès aux modules</div>
              {[
                { key: 'access_reservation', label: '📅 Réservation', icon: '📅' },
                { key: 'access_sport', label: '🏋️ Sport & Programmes', icon: '🏋️' },
                { key: 'access_nutrition', label: '🥗 Nutrition', icon: '🥗' },
              ].map(function(mod) {
                var isOn = editClientData[mod.key] !== false
                return <button key={mod.key} onClick={function() { setEditClientData(function(d) { return Object.assign({}, d, { [mod.key]: !isOn }) }) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: isOn ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.04)', border: isOn ? '1px solid rgba(74,222,128,0.2)' : '1px solid rgba(248,113,113,0.15)', borderRadius: 8, marginBottom: 4, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12, color: 'var(--text)', textAlign: 'left' }}>
                  <div style={{ width: 36, height: 20, borderRadius: 10, background: isOn ? '#4ade80' : '#555', position: 'relative', transition: 'all 0.2s' }}><div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: isOn ? 18 : 2, transition: 'all 0.2s' }} /></div>
                  <span>{mod.label}</span>
                </button>
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>{c.avatar_url ? <img src={c.avatar_url} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 42, height: 42, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#000' }}>{initials}</div>}<div title={activityLabel} style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: '50%', background: activityDot, border: '2px solid var(--surface)' }} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2, cursor: 'pointer', color: GOLD }} onClick={function() { setSelectedClient(c) }}>{c.full_name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email}</div>
              {c.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.phone}</div>}
              {c.address && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>📍 {c.address}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: c.no_credit_required ? '#4ade80' : (c.credits || 0) > 0 ? GOLD : (c.credits || 0) < 0 ? '#f87171' : 'var(--muted)', lineHeight: 1 }}>{c.no_credit_required ? '∞' : (c.credits || 0)}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{c.no_credit_required ? 'à la séance' : 'crédits'}</div>
            {!c.no_credit_required && (c.credits || 0) < 0 && <div style={{ fontSize: 9, color: '#f87171', marginTop: 2 }}>doit {Math.abs(c.credits)}</div>}
          </div>
        </div>
        {subType && <div style={{ fontSize: 11, color: GOLD, marginBottom: 10 }}>⭐ {subType.label}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <button onClick={function() { addCreditsToClient(c.id, -1) }} style={{ ...s.btnEdit, width: 28, height: 28, fontSize: 12, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>-1</button>
          <button onClick={function() { addCreditsToClient(c.id, 1) }} style={{ ...s.btnEdit, width: 28, height: 28, fontSize: 12 }}>+1</button>
          <button onClick={function() { addCreditsToClient(c.id, 5) }} style={{ ...s.btnEdit, width: 28, height: 28, fontSize: 12 }}>+5</button>
          <button onClick={function() { addCreditsToClient(c.id, 10) }} style={{ ...s.btnEdit, width: 32, height: 28, fontSize: 12 }}>+10</button>
          <label title="Permet de réserver des séances (y compris récurrentes) sans déduire de crédits. Idéal pour les clients qui paient à la séance." style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', cursor: 'pointer', fontSize: 11, color: c.no_credit_required ? '#4ade80' : 'var(--muted)' }}>
            <input type="checkbox" checked={c.no_credit_required || false} onChange={function() { toggleNoCredit(c.id, c.no_credit_required) }} style={{ accentColor: GOLD }} />
            {c.no_credit_required ? '💳 Paiement à la séance' : 'Paiement à la séance'}
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <select value={c.coaching_type || ''} onChange={function(e) { updateCoachingType(c.id, e.target.value) }} style={{ ...s.input, fontSize: 11, padding: '6px 8px', flex: 1 }}>
            <option value="presentiel">🏋️ Présentiel</option>
            <option value="domicile">🏠 Domicile</option>
            <option value="online">📱 En ligne</option>
                <option value="hybride">🔄 Hybride (salle + en ligne)</option>
          </select>
          <select value={c.subscription_type || ''} onChange={function(e) { updateSubscription(c.id, e.target.value) }} style={{ ...s.input, fontSize: 11, padding: '6px 8px', flex: 1 }}>
            <option value="">Abo: Aucun</option>
            {SUBSCRIPTION_TYPES.map(function(st) { return <option key={st.value} value={st.value}>{st.label}</option> })}
          </select>
        </div>
        {/* Abonnement domicile */}
        {c.coaching_type === 'domicile' && (
          <div style={{ background: 'rgba(196,151,58,0.04)', border: '1px solid rgba(196,151,58,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD, marginBottom: 8 }}>Abonnement domicile</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <select value={c.domicile_sub_type || ''} onChange={function(e) { updateDomicileSub(c.id, e.target.value) }} style={{ ...s.input, fontSize: 10, padding: '5px 6px', flex: 1 }}>
                <option value="">Pas d'abonnement</option>
                <option disabled>── 3 mois ──</option>
                {DOMICILE_SUBS.filter(function(d) { return d.value.startsWith('3m') }).map(function(d) { return <option key={d.value} value={d.value}>{d.label} · {d.amount}€/mois</option> })}
                <option disabled>── 6 mois ──</option>
                {DOMICILE_SUBS.filter(function(d) { return d.value.startsWith('6m') }).map(function(d) { return <option key={d.value} value={d.value}>{d.label} · {d.amount}€/mois</option> })}
                <option disabled>── 12 mois ──</option>
                {DOMICILE_SUBS.filter(function(d) { return d.value.startsWith('12m') }).map(function(d) { return <option key={d.value} value={d.value}>{d.label} · {d.amount}€/mois</option> })}
              </select>
            </div>
            {c.domicile_sub_type && (function() {
              var sub = DOMICILE_SUBS.find(function(d) { return d.value === c.domicile_sub_type })
              return (
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Début :</div>
                    <input type="date" value={c.domicile_sub_start || ''} onChange={function(e) { updateDomicileStart(c.id, e.target.value) }} style={{ ...s.input, fontSize: 10, padding: '4px 6px', width: 130 }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                    {sub ? sub.amount + '€/mois · ' + sub.sessions + ' séances au total' : ''}
                    {c.credits != null && <span style={{ color: (c.credits || 0) > 0 ? '#4ade80' : '#f87171', fontWeight: 500 }}> · {c.credits} restante{(c.credits || 0) !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={function() { var ma = {}; try { ma = typeof c.module_access === 'string' ? JSON.parse(c.module_access) : (c.module_access || {}) } catch(e) {} setEditingClient(c.id); setEditClientData({ full_name: c.full_name, email: c.email, phone: c.phone, coaching_type: c.coaching_type, address: c.address, access_reservation: ma.reservation !== false, access_sport: ma.sport !== false, access_nutrition: ma.nutrition !== false }) }} style={s.btnEdit}>✏️</button>
          <button onClick={function() { setSelectedClientId(c.id); loadClientNotes(c.id); loadClientPhotos(c.id); navigateTo('client-detail') }} style={s.btnEdit}>📋</button>
          {c.beta_features && <button onClick={function() { setCoachClient(c) }} style={{ ...s.btnEdit, background: 'rgba(196,151,58,0.1)', borderColor: 'rgba(196,151,58,0.3)' }}>🏋️</button>}
          <button onClick={function() { resendInvite(c) }} style={{ ...s.btnEdit, fontSize: 10 }} title="Renvoyer l'invitation">📩</button>
          <button onClick={function() { cancelAllFutureBookings(c.id) }} style={{ ...s.btnEdit, fontSize: 10 }} title="Annuler toutes les séances futures">🗑️📅</button>
          {waLink && <a href={waLink + '?text=' + encodeURIComponent('Bonjour ' + (c.full_name || '').split(' ')[0] + ', ')} target="_blank" style={s.btnWa}>💬</a>}
          <button onClick={function() { deleteClient(c.id, c.full_name || c.email) }} style={s.btnDeleteSmall}>✕</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <nav style={s.nav}>
        <div style={s.navLogo}>{coachBrand && coachBrand.logo && <img src={coachBrand.logo} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', marginRight: 8, verticalAlign: 'middle' }} />}Admin — <span style={{ color: coachBrand ? coachBrand.color : GOLD }}>{coachBrand ? coachBrand.name : 'Coach'}</span></div>
        <div style={{ display: 'flex', gap: 12 }}>
          {view !== 'home' && <button onClick={function() { navigateTo('home') }} style={s.btnNav}>{t('nav.backHome')}</button>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={function() { var cur = document.documentElement.getAttribute('data-theme'); if (cur === 'light') { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('theme', 'dark') } else { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('theme', 'light') } }} style={{ ...s.btnNav, fontSize: 16, padding: '6px 10px' }}>{document.documentElement.getAttribute('data-theme') === 'light' ? '🌙' : '☀️'}</button>
            <button onClick={function() { supabase.auth.signOut() }} style={s.btnNav}>{t('nav.logout')}</button>
          </div>
        </div>
      </nav>

      <div style={s.container}>
        {msg && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 999, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderRadius: 12, border: '1px solid', fontSize: 13, maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', background: msg.type === 'success' ? '#0a2a15' : '#2a0a0a', color: msg.type === 'success' ? '#4ade80' : '#f87171', animation: 'fadeIn 0.3s ease' }}>
            <span>{msg.type === 'success' ? '✅' : '❌'} {msg.text}</span>
            <button onClick={function() { setMsg(null) }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* HOME */}
        {view === 'home' && (
          <div style={{ animation: viewAnim }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, marginBottom: 6 }}>Administration</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{clients.length} clients · {upcomingBookings.length} séances à venir</div>
            </div>

            {/* STATS CARDS */}
            {(function() {
              var now = new Date()
              var thisMonth = now.getMonth()
              var thisYear = now.getFullYear()
              var sessionsThisMonth = confirmedBookings.filter(function(b) {
                if (!b.time_slots) return false
                var d = new Date(b.time_slots.start_time)
                return d.getMonth() === thisMonth && d.getFullYear() === thisYear
              })
              var completedThisMonth = sessionsThisMonth.filter(function(b) { return new Date(b.time_slots.start_time) < now })
              var mKey = thisYear + '-' + String(thisMonth + 1).padStart(2, '0')
              var revenue = (financeEntries || []).filter(function(f) { return f.date && f.date.startsWith(mKey) }).reduce(function(sum, f) { return sum + (f.amount || 0) }, 0)
              if (revenue === 0) revenue = completedThisMonth.length * (settings.session_price || 60)
              var newClientsThisMonth = clients.filter(function(c) { return c.created_at && new Date(c.created_at).getMonth() === thisMonth && new Date(c.created_at).getFullYear() === thisYear })
              var activeClients = clients.filter(function(c) { return (c.credits || 0) > 0 || c.no_credit_required })
              return (
                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  <div style={s.statMini}>
                    <div style={s.statMiniValue}>{completedThisMonth.length}</div>
                    <div style={s.statMiniLabel}>Séances ce mois</div>
                  </div>
                  <div style={s.statMini}>
                    <div style={{ ...s.statMiniValue, color: GOLD }}>{revenue}€</div>
                    <div style={s.statMiniLabel}>Revenus estimés</div>
                  </div>
                  <div style={s.statMini}>
                    <div style={s.statMiniValue}>{activeClients.length}</div>
                    <div style={s.statMiniLabel}>Clients actifs</div>
                  </div>
                  <div style={s.statMini}>
                    <div style={{ ...s.statMiniValue, color: '#4ade80' }}>+{newClientsThisMonth.length}</div>
                    <div style={s.statMiniLabel}>Nouveaux ce mois</div>
                  </div>
                </div>
              )
            })()}

            {/* CHARTS */}
            {(function() {
              var now = new Date()
              var months = []
              for (var mi = 5; mi >= 0; mi--) {
                var d = new Date(now.getFullYear(), now.getMonth() - mi, 1)
                var mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
                var mLabel = d.toLocaleDateString('fr-FR', { month: 'short' })
                var mSessions = confirmedBookings.filter(function(b) {
                  if (!b.time_slots) return false
                  var bd = new Date(b.time_slots.start_time)
                  return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear() && bd < now
                }).length
                var mRevenue = (financeEntries || []).filter(function(f) {
                  return f.date && f.date.startsWith(mKey)
                }).reduce(function(sum, f) { return sum + (f.amount || 0) }, 0)
                if (mRevenue === 0) mRevenue = mSessions * (settings.session_price || 60)
                var mClients = clients.filter(function(c) {
                  return c.created_at && new Date(c.created_at) <= new Date(d.getFullYear(), d.getMonth() + 1, 0)
                }).length
                months.push({ name: mLabel, sessions: mSessions, revenus: mRevenue, clients: mClients })
              }
              var tooltipStyle = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, fontFamily: 'Outfit' }, labelStyle: { fontWeight: 600 } }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={s.card}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>💰 Revenus (6 mois)</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={35} />
                        <Tooltip {...tooltipStyle} formatter={function(v) { return v + '€' }} />
                        <Bar dataKey="revenus" fill="#C4973A" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={s.card}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>📈 Séances & Clients</div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={25} />
                        <Tooltip {...tooltipStyle} />
                        <Line type="monotone" dataKey="sessions" stroke="#C4973A" strokeWidth={2} dot={{ fill: '#C4973A', r: 3 }} name="Séances" />
                        <Line type="monotone" dataKey="clients" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 3 }} name="Clients" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            <div className="tiles-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <button onClick={function() { navigateTo('book') }} className="tile-hover" style={{ ...s.tile, borderColor: 'rgba(196,151,58,0.3)' }}>
                <div style={s.tileIcon}>📅</div>
                <div style={s.tileTitle}>Réservation</div>
                <div style={s.tileSub}>{todayBookings.length} aujourd'hui · {upcomingBookings.length} à venir</div>
              </button>
              <button onClick={function() { navigateTo('clients') }} className="tile-hover" style={s.tile}>
                <div style={s.tileIcon}>👥</div>
                <div style={s.tileTitle}>Clients</div>
                <div style={s.tileSub}>{clients.length} inscrits</div>
              </button>
              <button onClick={function() { navigateTo('finance') }} className="tile-hover" style={s.tile}>
                <div style={s.tileIcon}>💰</div>
                <div style={s.tileTitle}>Finance</div>
                <div style={s.tileSub}>Revenus & factures</div>
              </button>
              <button onClick={function() { navigateTo('messaging') }} className="tile-hover" style={{ ...s.tile, position: 'relative' }}>
                <div style={s.tileIcon}>💬</div>
                <div style={s.tileTitle}>Messages</div>
                <div style={s.tileSub}>{unreadCount > 0 ? unreadCount + ' non lu' + (unreadCount > 1 ? 's' : '') : 'Conversations'}</div>
                {unreadCount > 0 && <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</div>}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <button onClick={function() { navigateTo('programs') }} className="tile-hover" style={s.tile}>
                <div style={s.tileIcon}>🏋️</div>
                <div style={s.tileTitle}>Sport</div>
                <div style={s.tileSub}>{clients.filter(function(c) { return c.beta_features }).length} clients</div>
              </button>
              <button onClick={function() { navigateTo('drive') }} className="tile-hover" style={s.tile}>
                <div style={s.tileIcon}>📁</div>
                <div style={s.tileTitle}>Drive</div>
                <div style={s.tileSub}>Fichiers partagés</div>
              </button>
            </div>
            <button onClick={function() { navigateTo('settings') }} className="tile-hover" style={{ ...s.tile, width: '100%', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>⚙️</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Paramètres</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Horaires, tampons, rappels</div>
                </div>
              </div>
            </button>

            {/* Quick: today's sessions */}
            {todayBookings.length > 0 && (
              <div style={s.card}>
                <div style={s.cardTitle}>Séances du jour</div>
                {todayBookings.map(function(b) {
                  return (
                    <div key={b.id} style={s.bookingRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{b.profiles?.full_name || b.profiles?.email || b.notes || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {fmtTime(b.time_slots.start_time)}
                          {b.profiles?.coaching_type === 'domicile' ? ' · 🏠 Domicile' : ' · 🏋️ ON AIR'}
                        </div>
                      </div>
                      <button onClick={function() { startReschedule(b) }} style={s.btnEdit}>📅</button><button onClick={function() { if (window.confirm('Annuler cette séance ?')) cancelBooking(b.id) }} disabled={cancelling === b.id} style={s.btnDelete}>{cancelling === b.id ? '...' : 'Annuler'}</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Séances à valider */}
            {(function() {
              var validatedIds = {}
              ;(financeEntries || []).forEach(function(e) { if (e.booking_id) validatedIds[e.booking_id] = true })
              var threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
              var toValidate = confirmedBookings.filter(function(b) {
                if (!b.time_slots || !b.time_slots.start_time) return false
                if (b.status !== 'confirmed') return false
                var bTime = new Date(b.time_slots.start_time)
                return bTime < new Date() && bTime > threeDaysAgo && !validatedIds[b.id]
              }).sort(function(a, b) { return new Date(b.time_slots.start_time) - new Date(a.time_slots.start_time) })
              if (toValidate.length === 0) return null
              return <div style={{ ...s.card, borderColor: 'rgba(251,191,36,0.3)' }}>
                <div style={{ ...s.cardTitle, color: '#fbbf24' }}>⏳ Séances à valider ({toValidate.length})</div>
                {toValidate.map(function(b) {
                  var cName = b.profiles?.full_name || b.notes || '—'
                  var price = settings.session_price || 50
                  return <div key={b.id} style={{ ...s.bookingRow, background: 'rgba(251,191,36,0.03)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{cName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(b.time_slots.start_time)} à {fmtTime(b.time_slots.start_time)}</div>
                    </div>
                    <button onClick={async function() {
                      await supabase.from('finance_entries').insert({ coach_id: profile.id, date: b.time_slots.start_time.split('T')[0], type: b.profiles ? 'coaching' : 'group_class', client_name: cName, amount: price, payment_method: 'cb', duration_minutes: settings.session_duration || 60, booking_id: b.id })
                      setMsg({ type: 'success', text: '✅ Séance validée !' }); loadFinance()
                    }} style={{ padding: '6px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12, color: '#4ade80', fontWeight: 500 }}>✅ Réalisée</button>
                    <button onClick={async function() {
                      if (!window.confirm('Marquer comme non réalisée ? Le crédit sera restitué.')) return
                      if (b.client_id) await supabase.from('profiles').update({ credits: (b.profiles?.credits || 0) + 1 }).eq('id', b.client_id)
                      await supabase.from('bookings').update({ status: 'no-show' }).eq('id', b.id)
                      setMsg({ type: 'success', text: 'Séance marquée non réalisée, crédit restitué.' }); loadAll()
                    }} style={{ padding: '6px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12, color: '#f87171' }}>❌</button>
                  </div>
                })}
              </div>
            })()}

            {todayBookings.length === 0 && (
              <div style={{ ...s.card, textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucune séance aujourd'hui 😌</div>
            )}
          </div>
        )}

        {/* BOOK FOR CLIENT */}
        {view === 'book' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Réservation</div><button onClick={exportBookings} style={{ ...s.btnGold, fontSize: 11, padding: '6px 12px' }}>📥 CSV</button></div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
              <button onClick={function() { setBookTab('reserver') }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: bookTab === 'reserver' ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: bookTab === 'reserver' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12 }}>📅 Réserver</button>
              <button onClick={function() { setBookTab('cours') }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: bookTab === 'cours' ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: bookTab === 'cours' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12 }}>🏢 Cours</button>
              <button onClick={function() { setBookTab('avenir') }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: bookTab === 'avenir' ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: bookTab === 'avenir' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12 }}>📋 À venir ({upcomingBookings.length})</button>
              <button onClick={function() { setBookTab('recurrence') }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: bookTab === 'recurrence' ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: bookTab === 'recurrence' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12 }}>🔄 Récurrence</button>
            </div>

            {/* TAB: COURS */}
            {bookTab === 'cours' && <div>
              <div style={s.card}>
                <div style={s.cardTitle}>🏢 Ajouter un cours en salle</div>
                {coachLocations.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', padding: 16, textAlign: 'center' }}>Ajoutez d'abord une salle dans Paramètres → Profil → Mes salles</div>}
                {coachLocations.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={s.fieldLabel}>Salle</div>
                    <select id="cours_loc" onChange={function(e) { document.getElementById('cours_type').value = '' }} style={s.input}>
                      <option value="">Choisir une salle...</option>
                      {coachLocations.map(function(loc) { return <option key={loc.id} value={loc.id}>{loc.name} — {loc.address}</option> })}
                    </select>
                  </div>
                  <div>
                    <div style={s.fieldLabel}>Cours</div>
                    <select id="cours_type" onChange={function(e) { var ct = (customClassTypes||[]).find(function(c){return c.id===e.target.value}); if(ct){document.getElementById('cours_dur').value=ct.duration_minutes;document.getElementById('cours_price').value=ct.price} }} style={s.input}>
                      <option value="">Choisir un cours...</option>
                      {(customClassTypes||[]).filter(function(ct) { var locEl = document.getElementById('cours_loc'); return !locEl || !locEl.value || ct.location_id === locEl.value }).map(function(ct) { return <option key={ct.id} value={ct.id}>{ct.name} ({ct.duration_minutes}min · {ct.price}€)</option> })}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><div style={s.fieldLabel}>Date</div><input id="cours_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} style={s.input} /></div>
                    <div><div style={s.fieldLabel}>Heure</div><input id="cours_time" type="time" defaultValue="10:00" style={s.input} /></div>
                    <div><div style={s.fieldLabel}>Durée (min)</div><input id="cours_dur" type="number" defaultValue="45" style={s.input} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><div style={s.fieldLabel}>Prix (€)</div><input id="cours_price" type="number" defaultValue="50" style={s.input} /></div>
                    <div><div style={s.fieldLabel}>Paiement</div><select id="cours_pay" style={s.input}><option value="cb">💳 CB</option><option value="virement">🏦 Virement</option><option value="especes">💵 Espèces</option></select></div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input id="cours_recur" type="checkbox" style={{ accentColor: GOLD, width: 18, height: 18 }} />
                    <span>🔄 Récurrent chaque semaine (même jour, même heure)</span>
                  </label>
                  <button onClick={async function() {
                    var locId = document.getElementById('cours_loc').value
                    var typeId = document.getElementById('cours_type').value
                    var date = document.getElementById('cours_date').value
                    var time = document.getElementById('cours_time').value
                    var dur = parseInt(document.getElementById('cours_dur').value) || 45
                    var price = parseInt(document.getElementById('cours_price').value) || 0
                    var pay = document.getElementById('cours_pay').value
                    var recur = document.getElementById('cours_recur').checked
                    if (!locId || !date || !time) { setMsg({ type: 'error', text: 'Salle, date et heure requis' }); return }
                    var loc = coachLocations.find(function(l) { return l.id === locId })
                    var ct = (customClassTypes||[]).find(function(c) { return c.id === typeId })
                    var coursName = ct ? ct.name : 'Cours'
                    var startDt = new Date(date + 'T' + time)
                    var endDt = new Date(startDt.getTime() + dur * 60000)

                    // Create time slot + booking (same pattern as regular bookings)
                    var slotRes = await supabase.from('time_slots').insert({ start_time: startDt.toISOString(), end_time: endDt.toISOString(), is_available: false }).select().single()
                    var bookRes = { data: null }
                    if (slotRes.data) {
                      bookRes = await supabase.from('bookings').insert({ coach_id: profile.id, slot_id: slotRes.data.id, status: 'confirmed', notes: '📋 ' + coursName + ' · ' + (loc ? loc.name : ''), location: loc ? loc.address : null }).select().single()
                    }

                    // Sync to Google Calendar
                    if (bookRes.data) {
                      fetch('/api/admin-actions?action=sync-gcal-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: bookRes.data.id, title: '🏢 ' + coursName + (loc ? ' · ' + loc.name : ''), location: loc ? loc.address : '', startTime: startDt.toISOString(), endTime: endDt.toISOString() }) }).catch(function(){})
                    }

                    // Create finance entry
                    if (price > 0) await supabase.from('finance_entries').insert({ coach_id: profile.id, date: date, type: 'group_class', client_name: loc ? loc.name : 'Salle', amount: price, payment_method: pay, class_type: coursName, duration_minutes: dur, booking_id: bookRes.data ? bookRes.data.id : null })

                    // Recurring: create for next 12 weeks
                    if (recur) {
                      for (var w = 1; w <= 12; w++) {
                        var nextDate = new Date(startDt.getTime() + w * 7 * 24 * 60 * 60 * 1000)
                        var nd = nextDate.toISOString().split('T')[0]
                        var ns = new Date(nd + 'T' + time)
                        var ne = new Date(ns.getTime() + dur * 60000)
                        var recSlotRes = await supabase.from('time_slots').insert({ start_time: ns.toISOString(), end_time: ne.toISOString(), is_available: false }).select().single()
                        if (recSlotRes.data) {
                          var recBookRes = await supabase.from('bookings').insert({ coach_id: profile.id, slot_id: recSlotRes.data.id, status: 'confirmed', notes: '📋 ' + coursName + ' · ' + (loc ? loc.name : ''), location: loc ? loc.address : null }).select().single()
                          if (recBookRes.data) {
                            fetch('/api/admin-actions?action=sync-gcal-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId: recBookRes.data.id, title: '🏢 ' + coursName + (loc ? ' · ' + loc.name : ''), location: loc ? loc.address : '', startTime: ns.toISOString(), endTime: ne.toISOString() }) }).catch(function(){})
                          }
                        }
                        if (price > 0) await supabase.from('finance_entries').insert({ coach_id: profile.id, date: nd, type: 'group_class', client_name: loc ? loc.name : 'Salle', amount: price, payment_method: pay, class_type: coursName, duration_minutes: dur, booking_id: recBookRes.data ? recBookRes.data.id : null })
                      }
                    }

                    setMsg({ type: 'success', text: '✅ ' + coursName + ' ajouté' + (recur ? ' (12 semaines)' : '') })
                    loadAll(); loadFinance()
                  }} style={{ ...s.btnGold, width: '100%' }}>📅 Ajouter au planning</button>
                </div>}
              </div>
            </div>}

            {bookTab === 'reserver' && <div>
            <div style={s.card}>
              <div style={s.cardTitle}>Nouvelle réservation</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={s.fieldLabel}>Client</div>
                  <select value={bookForm.clientId} onChange={function(e) {
                    var cid = e.target.value
                    setBookForm({ clientId: cid, startTime: '', location: '' })
                    setAdminSelectedDate(null)
                    if (cid) loadAdminSlots(cid, adminYear, adminMonth)
                    else setAdminSlots([])
                  }} style={s.input}>
                    <option value="">Sélectionner un client</option>
                    {sortedClients.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.no_credit_required ? '∞' : (c.credits || 0)} crédits)</option> })}
                  </select>
                </div>

                {/* Location selector for présentiel clients */}
                {bookForm.clientId && (function() {
                  var cl = clients.find(function(c) { return c.id === bookForm.clientId })
                  if (cl && cl.coaching_type !== 'domicile' && coachLocations.length > 0) {
                    return <div>
                      <div style={s.fieldLabel}>📍 Lieu de la séance</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {coachLocations.map(function(loc) {
                          var sel = bookForm.location === loc.address
                          return <button key={loc.id} onClick={function() { setBookForm(function(f) { return Object.assign({}, f, { location: loc.address }) }); loadAdminSlots(bookForm.clientId, adminYear, adminMonth, loc.address) }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: sel ? GOLD : 'var(--text)' }}>{loc.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{loc.address}</div>
                          </button>
                        })}
                      </div>
                    </div>
                  }
                  return null
                })()}

                {bookForm.clientId && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <button onClick={function() { var m = adminMonth - 1; var y = adminYear; if (m < 1) { m = 12; y-- } setAdminMonth(m); setAdminYear(y); loadAdminSlots(bookForm.clientId, y, m) }} style={s.btnNav}>←</button>
                      <div style={{ fontWeight: 500 }}>{['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][adminMonth]} {adminYear}</div>
                      <button onClick={function() { var m = adminMonth + 1; var y = adminYear; if (m > 12) { m = 1; y++ } setAdminMonth(m); setAdminYear(y); loadAdminSlots(bookForm.clientId, y, m) }} style={s.btnNav}>→</button>
                    </div>

                    {adminSlotsLoading ? (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Chargement...</div>
                    ) : (
                      <div>
                        {/* Days with slots */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                          {(function() {
                            var days = []
                            var seen = {}
                            adminSlots.forEach(function(sl) { if (!seen[sl.date]) { seen[sl.date] = true; days.push(sl.date) } })
                            return days.map(function(day) {
                              var d = new Date(day + 'T12:00:00')
                              var DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
                              var isSelected = adminSelectedDate === day
                              return <button key={day} onClick={function() { setAdminSelectedDate(day) }} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid', borderColor: isSelected ? GOLD : 'var(--border)', background: isSelected ? 'rgba(196,151,58,0.15)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>{DAYS_SHORT[d.getDay()]} {d.getDate()}</button>
                            })
                          })()}
                        </div>

                        {/* Slots for selected day */}
                        {adminSelectedDate && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                            {adminSlots.filter(function(sl) { return sl.date === adminSelectedDate }).map(function(sl) {
                              var color = getSlotColor(sl)
                              var t = new Date(sl.start)
                              var timeStr = t.getHours().toString().padStart(2,'0') + 'h' + t.getMinutes().toString().padStart(2,'0')
                              var isSelected = bookForm.startTime === sl.start
                              return <button key={sl.start} onClick={function() { setBookForm(function(f) { return Object.assign({}, f, { startTime: sl.start }) }) }} style={{ background: isSelected ? GOLD : color.bg, color: isSelected ? '#000' : color.text, border: '1px solid ' + (isSelected ? GOLD : color.border), borderRadius: 8, padding: '12px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>{timeStr}</button>
                            })}
                          </div>
                        )}

                        {adminSlots.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Aucun créneau disponible ce mois.</div>}
                      </div>
                    )}
                  </div>
                )}

                {bookForm.startTime && (
                  <button onClick={bookForClient} disabled={bookingClient} style={s.btnGold}>
                    {bookingClient ? 'Réservation en cours...' : 'Confirmer la réservation'}
                  </button>
                )}
              </div>
            </div>
            </div>}

            {/* TAB: À VENIR */}
            {bookTab === 'avenir' && <div>
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={s.cardTitle}>Séances à venir</div>
                  {Object.keys(selectedBookings).filter(function(k) { return selectedBookings[k] }).length > 0 && <button onClick={cancelSelectedBookings} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit' }}>❌ Annuler {Object.keys(selectedBookings).filter(function(k) { return selectedBookings[k] }).length}</button>}
                </div>
                {upcomingBookings.length > 1 && <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)', cursor: 'pointer', marginBottom: 10 }}><input type="checkbox" checked={upcomingBookings.every(function(b) { return selectedBookings[b.id] })} onChange={function() { var all = upcomingBookings.every(function(b) { return selectedBookings[b.id] }); var next = Object.assign({}, selectedBookings); upcomingBookings.forEach(function(b) { next[b.id] = !all }); setSelectedBookings(next) }} style={{ accentColor: '#C4973A' }} /> Tout sélectionner ({upcomingBookings.length})</label>}
                {upcomingBookings.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Aucune séance à venir</div>}
                {upcomingBookings.map(function(b) {
                  return <div key={b.id} style={s.bookingRow}>
                    <input type="checkbox" checked={selectedBookings[b.id] || false} onChange={function() { setSelectedBookings(function(ss) { var n = Object.assign({}, ss); n[b.id] = !n[b.id]; return n }) }} style={{ accentColor: '#C4973A', marginRight: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{b.profiles?.full_name || b.notes || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(b.time_slots.start_time)} à {fmtTime(b.time_slots.start_time)} · {b.profiles?.coaching_type === 'domicile' ? '🏠' : '🏋️'}</div>
                    </div>
                    <button onClick={function() { startReschedule(b) }} style={s.btnEdit}>📅</button>
                    <button onClick={function() { if (confirm('Annuler cette séance ?')) cancelBooking(b.id) }} disabled={cancelling === b.id} style={s.btnDelete}>{cancelling === b.id ? '...' : '✕'}</button>
                  </div>
                })}
              </div>
            </div>}

            {/* TAB: RÉCURRENCE */}
            {bookTab === 'recurrence' && <div>
            <div style={{ ...s.card, borderColor: 'rgba(196,151,58,0.3)' }}>
              <div style={s.cardTitle}>📅 Réservation récurrente</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={s.fieldLabel}>Client</div>
                  <select value={recurForm.clientId} onChange={function(e) { setRecurForm(function(f) { return Object.assign({}, f, { clientId: e.target.value }) }) }} style={s.input}>
                    <option value="">Sélectionner un client</option>
                    {sortedClients.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.no_credit_required ? '💳 à la séance' : (c.credits || 0) + ' crédits'})</option> })}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.fieldLabel}>Jour</div>
                    <select value={recurForm.dayOfWeek} onChange={function(e) { setRecurForm(function(f) { return Object.assign({}, f, { dayOfWeek: e.target.value }) }) }} style={s.input}>
                      <option value="1">Lundi</option>
                      <option value="2">Mardi</option>
                      <option value="3">Mercredi</option>
                      <option value="4">Jeudi</option>
                      <option value="5">Vendredi</option>
                      <option value="6">Samedi</option>
                      <option value="0">Dimanche</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.fieldLabel}>Heure</div>
                    <input type="time" value={recurForm.time} onChange={function(e) { setRecurForm(function(f) { return Object.assign({}, f, { time: e.target.value }) }) }} style={s.input} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.fieldLabel}>À partir du</div>
                    <input type="date" value={recurForm.startDate} onChange={function(e) { setRecurForm(function(f) { return Object.assign({}, f, { startDate: e.target.value }) }) }} style={s.input} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={s.fieldLabel}>Durée</div>
                    <select value={recurForm.duration} onChange={function(e) { setRecurForm(function(f) { return Object.assign({}, f, { duration: e.target.value }) }) }} style={s.input}>
                      <option value="1">1 mois</option>
                      <option value="3">3 mois</option>
                      <option value="6">6 mois</option>
                      <option value="12">12 mois</option>
                    </select>
                  </div>
                </div>
                {recurForm.clientId && (function() {
                  var client = clients.find(function(c) { return c.id === recurForm.clientId })
                  var weeks = parseInt(recurForm.duration) * 4
                  var credits = client ? (client.credits || 0) : 0
                  var noCredit = client && client.no_credit_required
                  var enough = noCredit || credits >= weeks
                  return (
                    <div style={{ fontSize: 12, color: noCredit ? '#4ade80' : enough ? '#4ade80' : '#fbbf24', background: noCredit ? 'rgba(74,222,128,0.06)' : enough ? 'rgba(74,222,128,0.06)' : 'rgba(251,191,36,0.06)', border: '1px solid', borderColor: noCredit ? 'rgba(74,222,128,0.2)' : enough ? 'rgba(74,222,128,0.2)' : 'rgba(251,191,36,0.2)', padding: '10px 14px', borderRadius: 8 }}>
                      {noCredit
                        ? '💳 Client en paiement à la séance — ' + weeks + ' séances seront créées sans déduction de crédits.'
                        : enough
                        ? '✅ ' + weeks + ' séances seront créées. Le client a ' + credits + ' crédits → il en restera ' + (credits - weeks) + '.'
                        : '⚠️ ' + weeks + ' séances seront créées. Le client a ' + credits + ' crédits → les ' + credits + ' premières sont couvertes. Tu recevras un mail quand ses crédits seront épuisés et le client aussi.'
                      }
                    </div>
                  )
                })()}
                <button onClick={bookRecurring} disabled={bookingRecur} style={s.btnGold}>
                  {bookingRecur ? 'Création en cours...' : 'Créer les séances récurrentes'}
                </button>
              </div>
            </div>
            </div>}
          </div>
        )}
        {/* CLIENTS */}
        {view === 'clients' && (
          <div style={{ animation: viewAnim }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={s.viewTitle}>Clients ({clients.length})</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={exportClients} style={{ ...s.btnGold, fontSize: 11, padding: '6px 12px' }}>📥</button>
                <button onClick={function() { setShowCreateClient(!showCreateClient) }} style={s.btnGold}>{showCreateClient ? '✕' : '+ Créer'}</button>
              </div>
            </div>

            <input value={clientSearch} onChange={function(e) { setClientSearch(e.target.value) }} placeholder="🔍 Rechercher par nom, email, téléphone..." style={{ ...s.input, width: '100%', marginBottom: 10, boxSizing: 'border-box' }} />

            {/* Client type tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
              {[{k:'all',l:'👥 Tous'},{k:'presentiel',l:'🏢 Présentiel'},{k:'domicile',l:'🏠 Domicile'},{k:'online',l:'📱 En ligne'}].map(function(t) {
                var sel = clientTab === t.k
                var count = t.k === 'all' ? clients.length : clients.filter(function(c) { return c.coaching_type === t.k }).length
                return <button key={t.k} onClick={function() { setClientTab(t.k) }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: sel ? GOLD : 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 11, whiteSpace: 'nowrap', transition: 'all 0.2s' }}>{t.l} ({count})</button>
              })}
            </div>

            {showCreateClient && (
              <div style={{ ...s.card, marginBottom: 24, borderColor: 'rgba(196,151,58,0.3)' }}>
                <div style={s.cardTitle}>Nouveau client</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Prénom *</div><input type="text" value={newClient.firstName} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { firstName: e.target.value }) }) }} placeholder="Jean" style={s.input} /></div>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Nom</div><input type="text" value={newClient.lastName} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { lastName: e.target.value }) }) }} placeholder="Dupont" style={s.input} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Email {newClient.noApp ? '' : '*'}</div><input type="email" value={newClient.email} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { email: e.target.value }) }) }} placeholder="jean@email.com" style={{ ...s.input, opacity: newClient.noApp && !newClient.email ? 0.5 : 1 }} /></div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={newClient.noApp} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { noApp: e.target.checked }) }) }} style={{ width: 18, height: 18, accentColor: GOLD }} />
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sans accès app</span>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}><div style={s.fieldLabel}>Téléphone</div><input type="tel" value={newClient.phone} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { phone: e.target.value }) }) }} placeholder="06 12 34 56 78" style={s.input} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={s.fieldLabel}>Type de coaching *</div>
                      <select value={newClient.coachingType} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { coachingType: e.target.value }) }) }} style={s.input}>
                        <option value="presentiel">🏋️ Présentiel</option>
                        <option value="domicile">🏠 À domicile</option>
                        <option value="online">📱 En ligne</option>
                <option value="hybride">🔄 Hybride (salle + en ligne)</option>
                      </select>
                    </div>
                  </div>
                  {(newClient.coachingType === 'domicile') && (
                    <div>
                      <div style={s.fieldLabel}>Adresse</div>
                      <div style={{ position: 'relative' }}>
                        <input type="text" value={newClient.addressSearch || ''} onChange={function(e) {
                          var q = e.target.value
                          setNewClient(function(f) { return Object.assign({}, f, { addressSearch: q }) })
                          if (q.length >= 4) {
                            fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(q) + '&limit=5')
                              .then(function(r) { return r.json() })
                              .then(function(data) { setNewClient(function(f) { return Object.assign({}, f, { suggestions: (data.features || []).map(function(ft) { return { label: ft.properties.label, number: ft.properties.housenumber || '', street: ft.properties.street || '', postcode: ft.properties.postcode || '', city: ft.properties.city || '' } }) }) }) })
                              .catch(function() {})
                          } else { setNewClient(function(f) { return Object.assign({}, f, { suggestions: [] }) }) }
                        }} placeholder="Commence à taper l'adresse..." style={s.input} />
                        {newClient.suggestions && newClient.suggestions.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, zIndex: 20, maxHeight: 200, overflow: 'auto' }}>
                            {newClient.suggestions.map(function(sg, i) {
                              return <button key={i} onClick={function() {
                                var fullAddr = (sg.number ? sg.number + ' ' : '') + sg.street + ', ' + sg.postcode + ' ' + sg.city
                                setNewClient(function(f) { return Object.assign({}, f, { address: fullAddr, addrNumber: sg.number, addrStreet: sg.street, addrPostcode: sg.postcode, addrCity: sg.city, addressSearch: sg.label, suggestions: [] }) })
                              }} style={{ display: 'block', width: '100%', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontFamily: 'Outfit, sans-serif' }}>{sg.label}</button>
                            })}
                          </div>
                        )}
                      </div>
                      {newClient.addrStreet && (
                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 1fr', gap: 8, marginTop: 10 }}>
                          <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>N°</div><input type="text" value={newClient.addrNumber || ''} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { addrNumber: e.target.value, address: (e.target.value ? e.target.value + ' ' : '') + f.addrStreet + ', ' + f.addrPostcode + ' ' + f.addrCity }) }) }} style={{ ...s.input, padding: '8px 10px', fontSize: 12 }} /></div>
                          <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Rue</div><input type="text" value={newClient.addrStreet || ''} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { addrStreet: e.target.value, address: (f.addrNumber ? f.addrNumber + ' ' : '') + e.target.value + ', ' + f.addrPostcode + ' ' + f.addrCity }) }) }} style={{ ...s.input, padding: '8px 10px', fontSize: 12 }} /></div>
                          <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Code postal</div><input type="text" value={newClient.addrPostcode || ''} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { addrPostcode: e.target.value, address: (f.addrNumber ? f.addrNumber + ' ' : '') + f.addrStreet + ', ' + e.target.value + ' ' + f.addrCity }) }) }} style={{ ...s.input, padding: '8px 10px', fontSize: 12 }} /></div>
                          <div><div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Ville</div><input type="text" value={newClient.addrCity || ''} onChange={function(e) { setNewClient(function(f) { return Object.assign({}, f, { addrCity: e.target.value, address: (f.addrNumber ? f.addrNumber + ' ' : '') + f.addrStreet + ', ' + f.addrPostcode + ' ' + e.target.value }) }) }} style={{ ...s.input, padding: '8px 10px', fontSize: 12 }} /></div>
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>Le client recevra un email avec son mot de passe temporaire et un lien vers l'application. Il devra le modifier à sa première connexion.</div>
                  <button onClick={createClient} disabled={creatingClient} style={s.btnGold}>{creatingClient ? 'Création en cours...' : 'Créer et envoyer l\'invitation'}</button>
                </div>
              </div>
            )}

            {/* Client list - filtered by search and tab */}
            {(function() {
              var filtered = clients.filter(function(c) {
                // Tab filter
                if (clientTab !== 'all' && c.coaching_type !== clientTab) return false
                // Search filter
                if (clientSearch.trim()) {
                  var q = clientSearch.toLowerCase()
                  return (c.full_name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
                }
                return true
              })

              if (filtered.length === 0) return <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>{clientSearch ? 'Aucun résultat pour "' + clientSearch + '"' : 'Aucun client dans cette catégorie'}</div>

              if (selectedClient) return <ClientProfile client={selectedClient} supabase={supabase} onClose={function() { setSelectedClient(null) }} onUpdate={function() { loadAll().then(function() { var updated = clients.find(function(cc) { return cc.id === selectedClient.id }); if (updated) setSelectedClient(updated) }) }} />

              if (clientTab !== 'all') {
                return <div className="clients-grid" style={s.clientsGrid}>{filtered.map(function(c) { return renderClientCard(c) })}</div>
              }

              // Group by type when "Tous" is selected
              var types = [{k:'presentiel',l:'🏋️ Présentiel'},{k:'domicile',l:'🏠 À domicile'},{k:'online',l:'📱 En ligne'},{k:'hybride',l:'🔄 Hybride'}]
              return types.map(function(t) {
                var group = filtered.filter(function(c) { return c.coaching_type === t.k })
                if (group.length === 0) return null
                return <div key={t.k} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>{t.l} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>({group.length})</span></div>
                  <div className="clients-grid" style={s.clientsGrid}>{group.map(function(c) { return renderClientCard(c) })}</div>
                </div>
              })
            })()}
          </div>
        )}

        {/* CREDITS */}
        {view === 'credits' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Ajouter des crédits</div></div>
            <div style={s.card}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select value={creditForm.clientId} onChange={function(e) { setCreditForm(function(f) { return Object.assign({}, f, { clientId: e.target.value }) }) }} style={{ ...s.input, flex: 2 }}>
                  <option value="">Sélectionner un client</option>
                  {sortedClients.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} ({c.credits || 0} crédits)</option> })}
                </select>
                <input type="number" min="1" max="20" value={creditForm.amount} onChange={function(e) { setCreditForm(function(f) { return Object.assign({}, f, { amount: e.target.value }) }) }} style={{ ...s.input, flex: 'none', width: 80 }} />
                <button onClick={addCredits} style={s.btnGold}>Ajouter</button>
              </div>
            </div>
          </div>
        )}

        {/* PAIEMENTS */}
        {/* CLIENT DETAIL */}
        {view === 'client-detail' && (function() {
          var client = clients.find(function(c) { return c.id === selectedClientId })
          if (!client) return null
          var CATS = [{ k: 'session', l: '🏋️ Séance' }, { k: 'injury', l: '🩹 Blessure' }, { k: 'goal', l: '🎯 Objectif' }, { k: 'nutrition', l: '🥗 Nutrition' }, { k: 'general', l: '📝 Général' }]
          return <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>{client.full_name || client.email}</div></div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button onClick={function() { sendBilanEmail(selectedClientId) }} style={{ ...s.btnGold, flex: 1, fontSize: 12 }}>📧 Bilan</button>
              <button onClick={function() { startConversation(selectedClientId); navigateTo('messaging') }} style={{ ...s.btnEdit, flex: 1, fontSize: 12 }}>💬 Message</button>
              <button onClick={function() { setCoachClient(client); navigateTo('programs') }} style={{ ...s.btnEdit, flex: 1, fontSize: 12 }}>🏋️ Sport</button>
            </div>

            {/* Abonnement / Prélèvement */}
            <div style={s.card}>
              <div style={s.cardTitle}>💳 Abonnement & Prélèvement</div>
              {(function() {
                var subs = (clientSubscriptions || []).filter(function(sub) { return sub.client_id === selectedClientId })
                return <div>
                  {subs.map(function(sub) {
                    return <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: sub.is_active ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: sub.is_active ? 'rgba(74,222,128,0.15)' : 'var(--border)', borderRadius: 10, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{sub.offer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>📅 Prélèvement le {sub.billing_day} de chaque mois{sub.notes ? ' · ' + sub.notes : ''}</div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>{sub.amount}€</div>
                      <button onClick={async function() { await supabase.from('client_subscriptions').update({ is_active: !sub.is_active }).eq('id', sub.id); loadClientSubscriptions() }} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>{sub.is_active ? '✅' : '⏸️'}</button>
                    </div>
                  })}
                  {subs.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Aucun abonnement actif</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <input id="sub_name" placeholder="Offre (ex: 2x/sem domicile)" style={{ ...s.input, flex: 2, fontSize: 11, padding: '6px 8px' }} />
                    <input id="sub_amount" type="number" placeholder="€/mois" style={{ ...s.input, width: 60, fontSize: 11, padding: '6px', textAlign: 'center' }} />
                    <input id="sub_day" type="number" placeholder="Jour" min="1" max="31" style={{ ...s.input, width: 50, fontSize: 11, padding: '6px', textAlign: 'center' }} />
                    <button onClick={async function() {
                      var name = document.getElementById('sub_name').value
                      var amount = document.getElementById('sub_amount').value
                      var day = document.getElementById('sub_day').value
                      if (!name || !amount || !day) return
                      await supabase.from('client_subscriptions').insert({ coach_id: profile.id, client_id: selectedClientId, offer_name: name, amount: parseFloat(amount), billing_day: parseInt(day), start_date: new Date().toISOString().split('T')[0] })
                      document.getElementById('sub_name').value = ''
                      document.getElementById('sub_amount').value = ''
                      document.getElementById('sub_day').value = ''
                      loadClientSubscriptions()
                      setMsg({ type: 'success', text: '💳 Abonnement ajouté ! Rappel le ' + day + ' de chaque mois.' })
                    }} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>+</button>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Un email de rappel sera envoyé chaque mois à la date indiquée.</div>
                </div>
              })()}
            </div>
            <div style={s.card}><div style={s.cardTitle}>📝 Notes</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>{CATS.map(function(cat) { return <button key={cat.k} onClick={function() { setNoteCategory(cat.k) }} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid', borderColor: noteCategory === cat.k ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: noteCategory === cat.k ? 'rgba(196,151,58,0.1)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 10 }}>{cat.l}</button> })}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}><input value={noteText} onChange={function(e) { setNoteText(e.target.value) }} onKeyDown={function(e) { if (e.key === 'Enter') addNote(selectedClientId) }} placeholder="Ajouter une note..." style={{ ...s.input, flex: 1 }} /><button onClick={function() { addNote(selectedClientId) }} style={s.btnGold}>+</button></div>
              {clientNotes.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12, padding: 10 }}>Aucune note</div>}
              {clientNotes.map(function(n) { var cat = CATS.find(function(c) { return c.k === n.category }) || CATS[4]; return <div key={n.id} style={s.bookingRow}><span style={{ fontSize: 12 }}>{cat.l.split(' ')[0]}</span><div style={{ flex: 1 }}><div style={{ fontSize: 13 }}>{n.content}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div></div><button onClick={async function() { await supabase.from('coach_notes').delete().eq('id', n.id); loadClientNotes(selectedClientId) }} style={{ ...s.btnDelete, padding: '2px 6px', fontSize: 10 }}>✕</button></div> })}
            </div>
            <div style={s.card}><div style={s.cardTitle}>📸 Photos avant/après</div>
              <PhotoGallery clientId={selectedClientId} photos={clientPhotos} onRefresh={function() { loadClientPhotos(selectedClientId) }} isCoach={true} />
            </div>
          </div>
        })()}

        {view === 'finance' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Finance</div><button onClick={exportFinance} style={{ ...s.btnGold, fontSize: 11, padding: '6px 12px' }}>📥 CSV</button></div>

            {/* Finance tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflow: 'auto' }}>
              {(function() {
                var tabs = [{k:'journal',l:'📝 Journal'},{k:'apercu',l:'📊 Mois'}]
                var billableLocs = coachLocations.filter(function(l) { return l.billable })
                billableLocs.forEach(function(loc) { tabs.push({k:'loc_'+loc.id, l:'🏢 '+loc.name}) })
                if (billableLocs.length === 0 && (fochClients.length > 0 || (financeEntries||[]).some(function(e){return e.type==='group_class'}))) tabs.push({k:'foch',l:'🏢 Salle'})
                tabs.push({k:'factures',l:'🧾 Factures'})
                tabs.push({k:'stripe',l:'💳 Stripe'})
                return tabs.map(function(tab) {
                return <button key={tab.k} onClick={function() { setFinanceTab(tab.k); if (tab.k === 'stripe' && payments.length === 0) loadPayments() }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid', borderColor: financeTab === tab.k ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: financeTab === tab.k ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 11, whiteSpace: 'nowrap' }}>{tab.l}</button>
              })})()}
            </div>

            {/* JOURNAL QUOTIDIEN */}
            {financeTab === 'journal' && (function() {
              var today = financeDate || new Date().toISOString().split('T')[0]
              var dayBookings = confirmedBookings.filter(function(b) { return b.time_slots && b.time_slots.start_time && b.time_slots.start_time.startsWith(today) })
              var dayEntries = financeEntries.filter(function(e) { return e.date === today })
              var validatedIds = {}; dayEntries.forEach(function(e) { if (e.booking_id) validatedIds[e.booking_id] = e })
              var validatedGcal = {}; dayEntries.forEach(function(e) { if (e.notes && e.notes.startsWith('gcal:')) validatedGcal[e.notes.replace('gcal:','')] = e })
              var FOCH_CLASSES = ['Cardio Boxing','Pilate Mat','Pilates Réformer','Teenager Boxing','Bootcamp&Cycle','CAF','TRX'].concat((customClassTypes||[]).map(function(c){return c.name}))
              return <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                  <button onClick={function() { var d = new Date(today); d.setDate(d.getDate()-1); setFinanceDate(d.toISOString().split('T')[0]) }} style={{ ...s.btnEdit, padding: '6px 12px' }}>←</button>
                  <input type="date" value={today} onChange={function(e) { setFinanceDate(e.target.value) }} style={{ ...s.input, flex: 1, textAlign: 'center' }} />
                  <button onClick={function() { var d = new Date(today); d.setDate(d.getDate()+1); setFinanceDate(d.toISOString().split('T')[0]) }} style={{ ...s.btnEdit, padding: '6px 12px' }}>→</button>
                </div>
                <button onClick={function() { loadGcalForDate(today) }} disabled={gcalLoading} style={{ width: '100%', padding: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', fontSize: 12, marginBottom: 12 }}>{gcalLoading ? '⏳ Chargement...' : '📅 Importer depuis Google Calendar'}</button>

                {/* Google Calendar events */}
                {gcalEvents.length > 0 && <div style={s.card}>
                  <div style={s.cardTitle}>📅 Google Calendar</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Coche pour ajouter au journal financier.</div>
                  {gcalEvents.map(function(ev) {
                    var validated = validatedGcal[ev.id]
                    var time = new Date(ev.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    return <div key={ev.id} style={{ ...s.bookingRow, background: validated ? 'rgba(74,222,128,0.04)' : 'transparent' }}>
                      <input type="checkbox" checked={!!validated} onChange={async function() {
                        if (validated) {
                          await supabase.from('finance_entries').delete().eq('id', validated.id)
                        } else {
                          await supabase.from('finance_entries').insert({ coach_id: profile.id, date: today, type: ev.title.includes('33Foch') || ev.title.includes('33 Foch') ? 'group_class' : 'coaching', client_name: ev.title.replace('YD Coaching - ', ''), amount: settings.session_price || 50, payment_method: 'cb', duration_minutes: ev.duration_minutes, notes: 'gcal:' + ev.id })
                        }
                        loadFinance()
                      }} style={{ accentColor: '#4ade80' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{time} · {ev.duration_minutes}min{ev.location ? ' · ' + ev.location : ''}</div>
                      </div>
                      {validated && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="number" value={validated.amount} onChange={async function(e) { await supabase.from('finance_entries').update({ amount: parseInt(e.target.value) || 0 }).eq('id', validated.id); loadFinance() }} style={{ ...s.input, width: 55, padding: '3px', fontSize: 11, textAlign: 'center' }} />
                        <select value={validated.payment_method} onChange={async function(e) { await supabase.from('finance_entries').update({ payment_method: e.target.value }).eq('id', validated.id); loadFinance() }} style={{ ...s.input, width: 80, padding: '3px', fontSize: 10 }}>
                          <option value="cb">💳 CB</option><option value="virement">🏦 Vir</option><option value="especes">💵 Esp</option>
                        </select>
                      </div>}
                      {validated && <span style={{ fontSize: 10, color: '#4ade80' }}>✅</span>}
                    </div>
                  })}
                </div>}
                {dayBookings.length > 0 && <div style={s.card}><div style={s.cardTitle}>📅 Séances réservées</div><div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Coche les séances effectuées.</div>
                  {dayBookings.map(function(b) { var validated = validatedIds[b.id]; var cName = b.profiles?.full_name || b.notes || '—'; var time = new Date(b.time_slots.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); return <div key={b.id} style={{ ...s.bookingRow, background: validated ? 'rgba(74,222,128,0.04)' : 'transparent' }}><input type="checkbox" checked={!!validated} onChange={async function() { if (validated) { await supabase.from('finance_entries').delete().eq('id', validated.id) } else { await supabase.from('finance_entries').insert({ coach_id: profile.id, date: today, type: 'coaching', client_name: cName, client_id: b.client_id, amount: settings.session_price || 50, payment_method: 'cb', booking_id: b.id, duration_minutes: settings.session_duration || 60 }) }; loadFinance() }} style={{ accentColor: '#4ade80' }} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{cName}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{time}</div></div>{validated && <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="number" value={validated.amount} onChange={async function(e) { await supabase.from('finance_entries').update({ amount: parseInt(e.target.value) || 0 }).eq('id', validated.id); loadFinance() }} style={{ ...s.input, width: 55, padding: '3px', fontSize: 11, textAlign: 'center' }} /><select value={validated.payment_method} onChange={async function(e) { await supabase.from('finance_entries').update({ payment_method: e.target.value }).eq('id', validated.id); loadFinance() }} style={{ ...s.input, width: 80, padding: '3px', fontSize: 10 }}><option value="cb">💳 CB</option><option value="virement">🏦 Vir</option><option value="especes">💵 Esp</option></select></div>}{validated && <span style={{ fontSize: 10, color: '#4ade80' }}>✅</span>}</div> })}
                </div>}
                <div style={s.card}><div style={s.cardTitle}>➕ Ajouter</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}><button onClick={function(){setFinanceAddType('coaching')}} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid', borderColor: financeAddType==='coaching'?'rgba(196,151,58,0.4)':'var(--border)', background: financeAddType==='coaching'?'rgba(196,151,58,0.1)':'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 11 }}>🏋️ Coaching</button>{coachLocations.filter(function(l){return l.billable}).map(function(loc){return <button key={loc.id} onClick={function(){setFinanceAddType('group_class');setFinanceLocName(loc.name)}} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid', borderColor: financeAddType==='group_class'&&financeLocName===loc.name?'rgba(196,151,58,0.4)':'var(--border)', background: financeAddType==='group_class'&&financeLocName===loc.name?'rgba(196,151,58,0.1)':'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 11 }}>🏢 {loc.name}</button>})}<button onClick={function(){setFinanceAddType('subscription')}} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid', borderColor: financeAddType==='subscription'?'rgba(196,151,58,0.4)':'var(--border)', background: financeAddType==='subscription'?'rgba(196,151,58,0.1)':'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 11 }}>📦 Abo</button></div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{financeAddType==='group_class'?<select value={financeClassType} onChange={function(e){if(e.target.value==='__new'){var n=prompt('Nom du cours (ex: Bootcamp, Pilates...)');if(n){var d=prompt('Durée en minutes',45);var p=prompt('Prix (€)',50);supabase.from('foch_class_types').insert({ coach_id: profile.id,name:n,duration_minutes:parseInt(d)||45,price:parseInt(p)||50}).then(loadFinance);setFinanceClassType(n);setFinanceDuration(d||'45');setFinanceAmount(p||'50')}}else{setFinanceClassType(e.target.value);var ct=(customClassTypes||[]).find(function(c){return c.name===e.target.value});if(ct){setFinanceAmount(String(ct.price||50));setFinanceDuration(String(ct.duration_minutes||45))}}}} style={{...s.input,flex:2}}><option value="">Cours...</option>{FOCH_CLASSES.map(function(c){return <option key={c} value={c}>{c}</option>})}<option value="__new">+ Nouveau cours...</option></select>:<select value={financeClientName} onChange={function(e){if(e.target.value==='__new'){var n=prompt('Nom du client');if(n){supabase.from('foch_clients').insert({ coach_id: profile.id,name:n}).then(loadFinance);setFinanceClientName(n)}}else setFinanceClientName(e.target.value)}} style={{...s.input,flex:2}}><option value="">Client...</option>{sortedClients.map(function(c){return <option key={c.id} value={c.full_name||c.email}>{c.full_name||c.email}</option>})}{(fochClients||[]).map(function(c){return <option key={c.id} value={c.name}>{c.name}</option>})}<option value="__new">+ Nouveau...</option></select>}<input type="time" value={financeTime} onChange={function(e){setFinanceTime(e.target.value)}} style={{...s.input,width:75}}/><input type="number" value={financeDuration} onChange={function(e){setFinanceDuration(e.target.value)}} placeholder="min" style={{...s.input,width:50,textAlign:'center'}}/><input type="number" value={financeAmount} onChange={function(e){setFinanceAmount(e.target.value)}} placeholder="€" style={{...s.input,width:55,textAlign:'center'}}/><select value={financePayMethod} onChange={function(e){setFinancePayMethod(e.target.value)}} style={{...s.input,width:85}}><option value="cb">💳 CB</option><option value="virement">🏦 Vir</option><option value="especes">💵 Esp</option></select></div>
                  <button onClick={async function(){if(financeAddType==='group_class'&&!financeClassType)return;if(financeAddType!=='group_class'&&!financeClientName)return;var dur=parseInt(financeDuration)||(settings.session_duration||60);var amt=parseInt(financeAmount)||0;await supabase.from('finance_entries').insert({ coach_id: profile.id,date:today,type:financeAddType,client_name:financeAddType==='group_class'?(financeLocName||'Salle'):financeClientName,amount:amt,payment_method:financePayMethod,class_type:financeAddType==='group_class'?financeClassType:null,duration_minutes:dur});if(financeTime&&financeAddType==='group_class'){var loc=coachLocations.find(function(l){return l.name===financeLocName});var startDt=new Date(today+'T'+financeTime);var endDt=new Date(startDt.getTime()+dur*60000);var fSlot=await supabase.from('time_slots').insert({start_time:startDt.toISOString(),end_time:endDt.toISOString(),is_available:false}).select().single();if(fSlot.data){await supabase.from('bookings').insert({coach_id:profile.id,slot_id:fSlot.data.id,status:'confirmed',notes:'📋 '+financeClassType+(loc?' · '+loc.name:''),location:loc?loc.address:null})}}setFinanceClientName('');setFinanceAmount('');setFinanceClassType('');setFinanceDuration('');setFinanceTime('');loadFinance();loadAll()}} style={{...s.btnGold,marginTop:8,width:'100%'}}>Ajouter</button>
                </div>
                {dayEntries.length>0&&<div style={s.card}><div style={s.cardTitle}>Journal du jour</div>{dayEntries.map(function(e){return <div key={e.id} style={s.bookingRow}><span style={{fontSize:14,marginRight:6}}>{e.type==='group_class'?'🏢':e.type==='subscription'?'📦':'🏋️'}</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500}}>{e.type==='group_class'?e.class_type:e.client_name}</div><div style={{fontSize:10,color:'var(--muted)'}}>{e.payment_method==='especes'?'💵 Espèces':e.payment_method==='virement'?'🏦 Virement':'💳 CB'}{e.duration_minutes?' · '+e.duration_minutes+'min':''}</div></div><div style={{fontSize:15,fontWeight:600,color:GOLD}}>{e.amount}€</div><button onClick={async function(){await supabase.from('finance_entries').delete().eq('id',e.id);loadFinance()}} style={{...s.btnDelete,padding:'2px 6px',fontSize:10}}>✕</button></div>})}<div style={{display:'flex',justifyContent:'space-between',borderTop:'2px solid var(--border)',paddingTop:10,marginTop:8}}><span style={{fontWeight:600}}>Total</span><span style={{fontWeight:600,color:GOLD,fontSize:16}}>{dayEntries.reduce(function(sum,e){return sum+(parseInt(e.amount)||0)},0)}€</span></div></div>}
              </div>
            })()}

            {/* RÉCAP MENSUEL */}
            {financeTab === 'apercu' && (function() {
              var month = financeMonth; var year = financeYear
              var monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
              var me = financeEntries.filter(function(e) { var d = new Date(e.date + 'T12:00:00'); return d.getMonth() === month && d.getFullYear() === year })
              var total = me.reduce(function(s, e) { return s + (parseInt(e.amount) || 0) }, 0)
              var cash = me.filter(function(e) { return e.payment_method === 'especes' }).reduce(function(s, e) { return s + (parseInt(e.amount) || 0) }, 0)
              var coaching = me.filter(function(e) { return e.type === 'coaching' })
              var foch = me.filter(function(e) { return e.type === 'group_class' })
              var subs = me.filter(function(e) { return e.type === 'subscription' })
              var cTotal = coaching.reduce(function(s, e) { return s + (parseInt(e.amount) || 0) }, 0)
              var fTotal = foch.reduce(function(s, e) { return s + (parseInt(e.amount) || 0) }, 0)
              var sTotal = subs.reduce(function(s, e) { return s + (parseInt(e.amount) || 0) }, 0)
              var mins = me.reduce(function(s, e) { return s + (e.duration_minutes || 0) }, 0)
              var fBk = {}; foch.forEach(function(e) { var ct = e.class_type || 'Autre'; if (!fBk[ct]) fBk[ct] = { n: 0, t: 0 }; fBk[ct].n++; fBk[ct].t += parseInt(e.amount) || 0 })
              return <div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}><button onClick={function() { if (month === 0) { setFinanceMonth(11); setFinanceYear(year - 1) } else setFinanceMonth(month - 1) }} style={{ ...s.btnEdit, padding: '6px 12px' }}>←</button><div style={{ fontSize: 16, fontWeight: 500 }}>{monthNames[month]} {year}</div><button onClick={function() { if (month === 11) { setFinanceMonth(0); setFinanceYear(year + 1) } else setFinanceMonth(month + 1) }} style={{ ...s.btnEdit, padding: '6px 12px' }}>→</button></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                  <div style={{ ...s.card, textAlign: 'center', padding: 18 }}><div style={{ fontSize: 26, fontWeight: 600, color: GOLD }}>{total}€</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Revenu total</div></div>
                  <div style={{ ...s.card, textAlign: 'center', padding: 18 }}><div style={{ fontSize: 26, fontWeight: 600, color: '#4ade80' }}>{total - cash}€</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>À déclarer URSSAF</div></div>
                  <div style={{ ...s.card, textAlign: 'center', padding: 18 }}><div style={{ fontSize: 20, fontWeight: 600 }}>{cash}€</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>💵 Espèces</div></div>
                  <div style={{ ...s.card, textAlign: 'center', padding: 18 }}><div style={{ fontSize: 20, fontWeight: 600 }}>{Math.floor(mins/60)}h{mins%60>0?mins%60:''}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>⏱️ Heures</div></div>
                </div>
                <div style={s.card}><div style={s.cardTitle}>Détail</div>
                  <div style={s.bookingRow}><div style={{flex:1}}>🏋️ Coaching ({coaching.length})</div><div style={{fontWeight:600}}>{cTotal}€</div></div>
                  <div style={s.bookingRow}><div style={{flex:1}}>🏢 33Foch ({foch.length})</div><div style={{fontWeight:600}}>{fTotal}€</div></div>
                  <div style={s.bookingRow}><div style={{flex:1}}>📦 Abonnements ({subs.length})</div><div style={{fontWeight:600}}>{sTotal}€</div></div>
                </div>
                {Object.keys(fBk).length > 0 && <div style={s.card}><div style={s.cardTitle}>🏢 33Foch — Pour facture</div>{Object.keys(fBk).sort().map(function(ct) { return <div key={ct} style={s.bookingRow}><div style={{flex:1}}>{ct} <span style={{color:'var(--muted)',fontSize:11}}>× {fBk[ct].n}</span></div><div style={{fontWeight:600,color:GOLD}}>{fBk[ct].t}€</div></div> })}<div style={{display:'flex',justifyContent:'space-between',borderTop:'2px solid var(--border)',paddingTop:10,marginTop:8,fontWeight:600}}><span>Total 33Foch</span><span style={{color:GOLD}}>{fTotal}€</span></div></div>}
              </div>
            })()}

            {/* 33FOCH MANAGEMENT */}
            {(financeTab === 'foch' || financeTab.startsWith('loc_')) && <div>
              <div style={s.card}><div style={s.cardTitle}>🏢 Clients 33Foch</div><div style={{display:'flex',gap:6,marginBottom:10}}><input id="new-foch-client" placeholder="Nom du client" style={{...s.input,flex:1}}/><button onClick={async function(){var n=document.getElementById('new-foch-client').value;if(!n.trim())return;await supabase.from('foch_clients').insert({ coach_id: profile.id,name:n});document.getElementById('new-foch-client').value='';loadFinance()}} style={s.btnGold}>+</button></div>{(fochClients||[]).map(function(c){return <div key={c.id} style={s.bookingRow}><div style={{flex:1,fontSize:13}}>{c.name}</div><button onClick={async function(){await supabase.from('foch_clients').delete().eq('id',c.id);loadFinance()}} style={{...s.btnDelete,padding:'2px 6px',fontSize:10}}>✕</button></div>})}</div>
              <div style={s.card}><div style={s.cardTitle}>📋 Types de cours</div>{['Cardio Boxing','Pilate Mat','Pilates Réformer','Teenager Boxing','Bootcamp&Cycle','CAF','TRX'].map(function(c){return <div key={c} style={{...s.bookingRow,fontSize:13}}>{c}<span style={{marginLeft:'auto',fontSize:11,color:'var(--muted)'}}>{c==='Pilates Réformer'?'50min':'45min'} · 50€</span></div>})}{(customClassTypes||[]).map(function(c){return <div key={c.id} style={s.bookingRow}><div style={{flex:1,fontSize:13}}>{c.name} <span style={{fontSize:11,color:'var(--muted)'}}>{c.duration_minutes}min · {c.price}€</span></div><button onClick={async function(){await supabase.from('foch_class_types').delete().eq('id',c.id);loadFinance()}} style={{...s.btnDelete,padding:'2px 6px',fontSize:10}}>✕</button></div>})}<button onClick={async function(){var n=prompt('Nom du cours');if(!n)return;var d=parseInt(prompt('Durée (min)','45'))||45;await supabase.from('foch_class_types').insert({ coach_id: profile.id,name:n,duration_minutes:d,price:50});loadFinance()}} style={{...s.btnEdit,marginTop:8,fontSize:11}}>+ Ajouter</button></div>
            </div>}

            {/* FACTURES */}
            {financeTab === 'factures' && (function() {
              var now = new Date()
              var thisMonth = now.getMonth()
              var thisYear = now.getFullYear()
              var monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
              var inv = invoiceSettings || {}
              return <div>
                {!inv.siret && <div style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 12, fontSize: 12, color: '#f87171' }}>⚠️ Configure tes infos dans <strong>Paramètres → 🧾 Facturation</strong></div>}
                <div style={s.card}>
                  <div style={s.cardTitle}>🧾 Nouvelle facture</div>
                  <div style={{ marginBottom: 12 }}><div style={s.fieldLabel}>Client</div><select id="inv-client" style={s.input}><option value="">Choisir...</option>{sortedClients.map(function(c) { return <option key={c.id} value={c.full_name || c.email}>{c.full_name || c.email}</option> })}{(fochClients || []).map(function(c) { return <option key={c.id} value={c.name}>{c.name}</option> })}<option value="33Foch">33Foch (tous les cours)</option></select></div>
                  <div style={{ marginBottom: 12 }}><div style={s.fieldLabel}>Entreprise facturée</div>
                    <select onChange={function(e) { var co = savedCompanies.find(function(c) { return c.id === e.target.value }); if (co) { document.getElementById('inv-co-name').value = co.name; document.getElementById('inv-co-siret').value = co.siret || ''; document.getElementById('inv-co-tva').value = co.tva_number || ''; document.getElementById('inv-co-addr').value = co.address || ''; document.getElementById('inv-email').value = co.email || '' } }} style={{ ...s.input, marginBottom: 6 }}><option value="">— Entreprise enregistrée —</option>{savedCompanies.map(function(c) { return <option key={c.id} value={c.id}>{c.name}{c.siret ? ' · ' + c.siret : ''}</option> })}</select>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Ou recherche auto :</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}><input id="inv-co-name" placeholder="Nom entreprise" style={{ ...s.input, flex: 1 }} /><button onClick={async function() { var q = document.getElementById('inv-co-name').value; if (!q || q.length < 3) return; var res = await fetch('/api/admin-actions?action=search-company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); var d = await res.json(); if (d.results && d.results.length > 0) { var r = d.results[0]; if (d.results.length > 1) { var ch = d.results.map(function(c, i) { return (i+1) + '. ' + c.name }).join('\n'); var pk = parseInt(prompt('Résultats :\n' + ch + '\n\nChoisis :')) || 1; r = d.results[pk-1] || d.results[0] } document.getElementById('inv-co-name').value = r.name; document.getElementById('inv-co-siret').value = r.siret; document.getElementById('inv-co-tva').value = r.tva; document.getElementById('inv-co-addr').value = r.address; setMsg({ type: 'success', text: r.name + ' trouvé !' }) } else setMsg({ type: 'error', text: 'Non trouvé' }) }} style={{ ...s.btnEdit, fontSize: 11 }}>🔍</button></div><div style={{ display: 'flex', gap: 6, marginBottom: 6 }}><input id="inv-co-siret" placeholder="SIRET" style={{ ...s.input, flex: 1 }} /><input id="inv-co-tva" placeholder="N° TVA" style={{ ...s.input, flex: 1 }} /></div><input id="inv-co-addr" placeholder="Adresse" style={{ ...s.input, marginBottom: 6 }} />
                    <button onClick={async function() { var n = document.getElementById('inv-co-name').value; if (!n) return; var em = document.getElementById('inv-email').value; var existing = savedCompanies.find(function(c) { return c.name === n }); if (existing) { await supabase.from('client_companies').update({ siret: document.getElementById('inv-co-siret').value, tva_number: document.getElementById('inv-co-tva').value, address: document.getElementById('inv-co-addr').value, email: em }).eq('id', existing.id) } else { await supabase.from('client_companies').insert({ coach_id: profile.id, name: n, siret: document.getElementById('inv-co-siret').value, tva_number: document.getElementById('inv-co-tva').value, address: document.getElementById('inv-co-addr').value, email: em }) } loadInvoiceSettings(); setMsg({ type: 'success', text: n + ' enregistré !' }) }} style={{ ...s.btnEdit, fontSize: 11, width: '100%' }}>💾 Enregistrer cette entreprise</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><div style={{ flex: 1 }}><div style={s.fieldLabel}>Mois</div><select id="inv-month" style={s.input}>{[0,1,2,3,4,5,6,7,8,9,10,11].map(function(m) { return <option key={m} value={m}>{monthNames[m]}</option> })}</select></div><div style={{ flex: 1 }}><div style={s.fieldLabel}>Année</div><select id="inv-year" style={s.input}><option>{thisYear}</option><option>{thisYear-1}</option></select></div></div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><div style={{ flex: 1 }}><div style={s.fieldLabel}>N° Facture</div><input id="inv-number" defaultValue={thisYear + '/' + String(inv.next_invoice_number || 1).padStart(3, '0')} style={s.input} /></div><div style={{ flex: 1 }}><div style={s.fieldLabel}>Email destinataire</div><input id="inv-email" placeholder="email@entreprise.fr" style={s.input} /></div></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={function() { generateInvoice('download') }} style={{ ...s.btnGold, flex: 1 }}>📄 Télécharger</button>
                  <button onClick={function() { generateInvoice('send') }} style={{ ...s.btnGold, flex: 1, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>📧 Envoyer par email</button>
                  </div>
                </div>
              </div>
            })()}

            {/* STRIPE */}
            {financeTab === 'stripe' && (
              <div>
                {payments.length === 0 && !loadingPayments && <div style={{ textAlign: 'center', padding: 20 }}><button onClick={loadPayments} style={s.btnGold}>Charger l'historique Stripe</button></div>}
                {loadingPayments && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Chargement...</div>}
                {payments.length > 0 && (function() {
                  var monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
                  var filtered = payments.filter(function(p) {
                    var d = new Date(p.created * 1000)
                    return d.getMonth() === financeMonth && d.getFullYear() === financeYear
                  })
                  var monthTotal = filtered.filter(function(p) { return p.status === 'complete' }).reduce(function(s, p) { return s + (p.amount / 100) }, 0)

                  return <div>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={function() { if (financeMonth === 0) { setFinanceMonth(11); setFinanceYear(financeYear - 1) } else setFinanceMonth(financeMonth - 1) }} style={{ ...s.btnEdit, padding: '6px 12px' }}>←</button>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{monthNames[financeMonth]} {financeYear}</div>
                      <button onClick={function() { if (financeMonth === 11) { setFinanceMonth(0); setFinanceYear(financeYear + 1) } else setFinanceMonth(financeMonth + 1) }} style={{ ...s.btnEdit, padding: '6px 12px' }}>→</button>
                    </div>
                    {monthTotal > 0 && <div style={{ ...s.card, textAlign: 'center', padding: 18, marginBottom: 12 }}><div style={{ fontSize: 26, fontWeight: 600, color: GOLD }}>{monthTotal.toFixed(0)}€</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Stripe ce mois ({filtered.filter(function(p) { return p.status === 'complete' }).length} paiements)</div></div>}
                    <div style={s.card}>
                      <div style={s.cardTitle}>Paiements — {monthNames[financeMonth]}</div>
                      {filtered.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, padding: 10 }}>Aucun paiement ce mois.</div>}
                      {filtered.map(function(p, i) {
                        var d = new Date(p.created * 1000)
                        var displayName = p.customer_name || p.customer_email || '—'
                        return <div key={i} style={s.bookingRow}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{displayName}</div>
                            {p.customer_name && p.customer_email && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.customer_email}</div>}
                            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.description || 'Paiement'} · {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 600, color: p.status === 'complete' ? GOLD : '#f87171' }}>{(p.amount / 100).toFixed(0)}€</div>
                            <div style={{ fontSize: 10, color: p.status === 'complete' ? '#4ade80' : '#f87171' }}>{p.status === 'complete' ? '✅' : '❌ ' + p.status}</div>
                          </div>
                        </div>
                      })}
                    </div>
                  </div>
                })()}
              </div>
            )}
          </div>
        )}

        {/* HORAIRES */}
        {/* PROGRAMMES */}
        {/* MESSAGING */}
        {view === 'messaging' && !activeConvo && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Messages</div></div>
            <button onClick={function() { var cid = prompt(''); setView('msg-new') }} style={{ width: '100%', padding: '12px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', marginBottom: 16, fontSize: 13 }}>💬 Nouvelle conversation</button>
            {conversations.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 30 }}>Aucune conversation</div>}
            {conversations.map(function(c) {
              return <button key={c.id} onClick={function() { setActiveConvo(c); loadMessages(c.id) }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: GOLD, flexShrink: 0 }}>{(c.profiles?.full_name || '?')[0].toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{c.profiles?.full_name || c.profiles?.email || '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                </div>
                <div style={{ color: 'var(--muted)' }}>›</div>
              </button>
            })}
          </div>
        )}

        {view === 'msg-new' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Nouvelle conversation</div></div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Choisis un client :</div>
            {clients.map(function(c) {
              return <button key={c.id} onClick={function() { startConversation(c.id); setView('messaging') }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: GOLD }}>{(c.full_name || '?')[0].toUpperCase()}</div>
                <div style={{ fontSize: 13 }}>{c.full_name || c.email}</div>
              </button>
            })}
          </div>
        )}

        {view === 'messaging' && activeConvo && (
          <div style={{ animation: viewAnim, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
              <button onClick={function() { setActiveConvo(null); loadConversations() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: GOLD }}>{(activeConvo.profiles?.full_name || '?')[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500 }}>{activeConvo.profiles?.full_name || activeConvo.profiles?.email}</div></div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 }}>
              {chatMessages.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>Aucun message. Commence la conversation !</div>}
              {chatMessages.map(function(m) {
                var isMe = m.sender_id === profile.id
                return <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <div style={{ background: isMe ? 'rgba(196,151,58,0.15)' : 'var(--surface)', border: '1px solid', borderColor: isMe ? 'rgba(196,151,58,0.3)' : 'var(--border)', borderRadius: 14, borderBottomRightRadius: isMe ? 4 : 14, borderBottomLeftRadius: isMe ? 14 : 4, padding: '10px 14px' }}>
                    {m.type === 'image' && m.file_url && <img src={m.file_url} style={{ maxWidth: '100%', borderRadius: 8, marginBottom: m.content ? 6 : 0, cursor: 'pointer' }} onClick={function() { window.open(m.file_url, '_blank') }} />}
                    {m.type === 'pdf' && m.file_url && <a href={m.file_url} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, color: GOLD, fontSize: 12, marginBottom: m.content ? 6 : 0, textDecoration: 'none' }}>📄 {m.file_name || 'Document.pdf'}</a>}
                    {m.content && <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{m.read_at && isMe ? ' ✓✓' : ''}</div>
                </div>
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-end' }}>
              <label style={{ cursor: 'pointer', fontSize: 20, padding: '6px' }}>📎<input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={function(e) { setMsgFile(e.target.files[0] || null) }} /></label>
              <div style={{ flex: 1 }}>
                {msgFile && <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>📎 {msgFile.name} <button onClick={function() { setMsgFile(null) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>✕</button></div>}
                <input value={msgText} onChange={function(e) { setMsgText(e.target.value) }} onKeyDown={function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(activeConvo.id) } }} placeholder="Message..." style={{ ...s.input, width: '100%', padding: '10px 14px' }} />
              </div>
              <button onClick={function() { sendMessage(activeConvo.id) }} disabled={sendingMsg || (!msgText.trim() && !msgFile)} style={{ ...s.btnGold, padding: '10px 16px', opacity: sendingMsg || (!msgText.trim() && !msgFile) ? 0.5 : 1 }}>{sendingMsg ? '...' : '➤'}</button>
            </div>
          </div>
        )}

        {/* SPORT CLIENTS */}
        {view === 'sport-clients' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Sport</div></div>
            <button onClick={function() { navigateTo('programs') }} style={{ width: '100%', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '16px', cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Gérer les programmes</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Exercices, blocs, vidéos</div>
              </div>
            </button>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Clients avec programme sport</div>
            {clients.filter(function(c) { return c.beta_features }).length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 30 }}>Aucun client avec un programme sport assigné.</div>}
            {clients.filter(function(c) { return c.beta_features }).map(function(c) {
              var initials = (c.full_name || '?').split(' ').map(function(n) { return n[0] || '' }).join('').toUpperCase().slice(0, 2)
              return (
                <button key={c.id} onClick={function() { setCoachClient(c) }} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#C4973A', flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{c.full_name || c.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.coaching_type === 'domicile' ? '🏠 Domicile' : c.coaching_type === 'presentiel' ? '🏋️ Présentiel' : '📱 En ligne'}</div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 16 }}>›</div>
                </button>
              )
            })}
          </div>
        )}

        {(view === 'programs' || view === 'live-training') && (
          <Programs onBack={function() { navigateTo('home') }} clients={clients} setCoachClient={setCoachClient} coachId={profile.id} isSuperAdmin={profile.is_super_admin} onEditingChange={setProgramsEditing} onLiveTraining={function() { navigateTo('live-training') }} liveTrainingActive={view === 'live-training'} profile={profile} />
        )}

        {view === 'drive' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>📁 Drive</div></div>
            {!activeDriveFolder ? (
              <div>
                <button onClick={async function() { var name = prompt('Nom du dossier (ex: Abdos, Plans nutritionnels...)'); if (!name) return; await supabase.from('drive_folders').insert({ name: name, coach_id: profile.id }); loadDrive() }} style={{ width: '100%', padding: '14px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, cursor: 'pointer', fontFamily: 'Outfit', color: GOLD, fontSize: 13, marginBottom: 16 }}>+ Créer un dossier</button>
                {driveFolders.map(function(folder) {
                  var sharedWith = (folder.shares || []).map(function(s) { return s.client_id })
                  return (
                    <div key={folder.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                      <button onClick={function() { setActiveDriveFolder(folder) }} style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📂</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{folder.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(folder.files || []).length} fichier{(folder.files || []).length > 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ fontSize: 18, color: 'var(--muted)' }}>›</div>
                      </button>
                      {/* Sharing chips */}
                      <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 4 }}>Partagé avec :</span>
                        {sharedWith.length === 0 && <span style={{ fontSize: 10, color: '#f87171' }}>Personne</span>}
                        {sharedWith.map(function(cid) {
                          var cl = clients.find(function(c) { return c.id === cid })
                          return <span key={cid} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(196,151,58,0.1)', color: GOLD }}>{cl ? (cl.full_name || cl.email).split(' ')[0] : '?'}</span>
                        })}
                        <button onClick={function() {
                          var sel = {}
                          ;(folder.shares || []).forEach(function(s) { sel[s.client_id] = true })
                          setShareSelected(sel)
                          setShareModal(folder)
                        }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--border)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Outfit' }}>👤 Gérer</button>
                      </div>
                    </div>
                  )
                })}
                {driveFolders.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>Aucun dossier. Crée ton premier dossier pour partager des fichiers avec tes clients.</div>}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <button onClick={function() { setActiveDriveFolder(null) }} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit' }}>← Tous les dossiers</button>
                  <button onClick={async function() { if (confirm('Supprimer le dossier "' + activeDriveFolder.name + '" et tous ses fichiers ?')) { await supabase.from('drive_folders').delete().eq('id', activeDriveFolder.id); setActiveDriveFolder(null); loadDrive() } }} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit' }}>🗑️ Supprimer</button>
                </div>
                <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>📂 {activeDriveFolder.name}</div>

                {/* Upload */}
                <label style={{ display: 'block', width: '100%', padding: '20px', background: 'var(--surface)', border: '2px dashed var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>📎</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{driveUploading ? 'Upload en cours...' : 'Clique pour ajouter un fichier (PDF, image, doc...)'}</div>
                  <input type="file" accept="*" style={{ display: 'none' }} onChange={async function(e) {
                    var file = e.target.files[0]; if (!file) return
                    setDriveUploading(true)
                    var ext = file.name.split('.').pop()
                    var path = 'drive/' + profile.id + '/' + Date.now() + '.' + ext
                    var { error: upErr } = await supabase.storage.from('uploads').upload(path, file)
                    if (!upErr) {
                      var { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
                      await supabase.from('drive_files').insert({ folder_id: activeDriveFolder.id, name: file.name, file_url: urlData.publicUrl, file_type: ext.toLowerCase(), size_bytes: file.size, coach_id: profile.id })
                      loadDrive()
                      setTimeout(function() { setActiveDriveFolder(function(f) { return driveFolders.find(function(df) { return df.id === f.id }) || f }) }, 500)
                    } else { setMsg({ type: 'error', text: 'Erreur upload: ' + upErr.message }) }
                    setDriveUploading(false)
                    e.target.value = ''
                  }} />
                </label>

                {/* Files list */}
                {(activeDriveFolder.files || []).map(function(file) {
                  var icon = file.file_type === 'pdf' ? '📄' : ['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(file.file_type) >= 0 ? '🖼️' : ['doc', 'docx'].indexOf(file.file_type) >= 0 ? '📝' : ['xls', 'xlsx'].indexOf(file.file_type) >= 0 ? '📊' : '📎'
                  return (
                    <div key={file.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 24, flexShrink: 0 }}>{icon}</div>
                      <a href={file.file_url} target="_blank" style={{ flex: 1, textDecoration: 'none', color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{file.name}</a>
                      <button onClick={async function() { if (confirm('Supprimer "' + file.name + '" ?')) { await supabase.from('drive_files').delete().eq('id', file.id); loadDrive() } }} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer', opacity: 0.5 }}>🗑️</button>
                    </div>
                  )
                })}
                {(activeDriveFolder.files || []).length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 12 }}>Aucun fichier. Uploade ton premier !</div>}
              </div>
            )}
          </div>
        )}


        {view === 'settings' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Paramètres</div></div>

            {/* SETTINGS TABS */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 16, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
              {[{k:'seances',l:t('settings.sessions')},{k:'tarifs',l:t('settings.pricing')},{k:'profil',l:t('settings.profile')},{k:'integrations',l:t('settings.integrations')},{k:'facturation',l:t('settings.billing')}].map(function(t) {
                var sel = settingsTab === t.k
                return <button key={t.k} onClick={function() { setSettingsTab(t.k) }} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: sel ? GOLD : 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s' }}>{t.l}</button>
              })}
            </div>

            {/* TAB: SÉANCES */}
            {settingsTab === 'seances' && <div>

            {/* SÉANCES */}
            <div style={s.card}>
              <div style={s.cardTitle}>🏋️ Séances</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={s.fieldLabel}>Durée d'une séance</div>
                  <select value={settings.session_duration} onChange={function(e) { setSettings(function(st) { return Object.assign({}, st, { session_duration: parseInt(e.target.value) }) }) }} style={{ ...s.input, width: 160 }}>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2 heures</option>
                  </select>
                </div>
                <div>
                  <div style={s.fieldLabel}>Fenêtre de réservation</div>
                  <select value={settings.booking_window_weeks || 4} onChange={function(e) { setSettings(function(st) { return Object.assign({}, st, { booking_window_weeks: parseInt(e.target.value) }) }) }} style={{ ...s.input, width: 200 }}>
                    <option value={1}>1 semaine</option>
                    <option value={2}>2 semaines</option>
                    <option value={3}>3 semaines</option>
                    <option value={4}>1 mois</option>
                    <option value={8}>2 mois</option>
                    <option value={12}>3 mois</option>
                  </select>
                </div>
                <div>
                  <div style={s.fieldLabel}>Fenêtre séance découverte</div>
                  <select value={settings.discovery_window_weeks || 2} onChange={function(e) { setSettings(function(st) { return Object.assign({}, st, { discovery_window_weeks: parseInt(e.target.value) }) }) }} style={{ ...s.input, width: 200 }}>
                    <option value={1}>1 semaine</option>
                    <option value={2}>2 semaines</option>
                    <option value={3}>3 semaines</option>
                    <option value={4}>1 mois</option>
                  </select>
                </div>
                <div>
                  <div style={s.fieldLabel}>Relance clients inactifs après</div>
                  <select value={settings.inactivity_weeks || 3} onChange={function(e) { setSettings(function(st) { return Object.assign({}, st, { inactivity_weeks: parseInt(e.target.value) }) }) }} style={{ ...s.input, width: 200 }}>
                    <option value={2}>2 semaines</option>
                    <option value={3}>3 semaines</option>
                    <option value={4}>1 mois</option>
                    <option value={6}>6 semaines</option>
                    <option value={8}>2 mois</option>
                    <option value={0}>Désactivé</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TAMPONS - masqué si coach en ligne uniquement */}
            {profile.coaching_mode !== 'online' && <div style={s.card}>
              <div style={s.cardTitle}>🚗 Tampons entre séances</div>

              {/* Slot increment */}
              <div style={{ marginBottom: 16 }}>
                <div style={s.fieldLabel}>Incrément des créneaux</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{v:15,l:'15 min'},{v:30,l:'30 min'},{v:45,l:'45 min'},{v:60,l:'1h'}].map(function(opt) {
                    var sel = (settings.slot_increment || 15) === opt.v
                    return <button key={opt.v} onClick={async function() { setSettings(function(s) { return Object.assign({}, s, { slot_increment: opt.v }) }); await supabase.from('coaching_settings').update({ slot_increment: opt.v }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Créneaux toutes les ' + opt.l }) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? GOLD : 'var(--text)' }}>{opt.l}</button>
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Les créneaux proposés seront espacés de {settings.slot_increment || 15} minutes.</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={s.fieldLabel}>Mode de déplacement</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[{k:'driving',l:'🚗',n:'Voiture / 2 roues'},{k:'bicycling',l:'🚴',n:'Vélo'},{k:'transit',l:'🚇',n:'Transports'},{k:'walking',l:'🚶',n:'À pieds'}].map(function(m) {
                    var sel = (settings.travel_mode || 'driving') === m.k
                    return <button key={m.k} onClick={async function() { setSettings(function(s) { return Object.assign({}, s, { travel_mode: m.k }) }); await supabase.from('coaching_settings').update({ travel_mode: m.k }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Mode : ' + m.n }) }} style={{ flex: 1, padding: '10px 6px', borderRadius: 8, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', minWidth: 60 }}>
                      <div style={{ fontSize: 18 }}>{m.l}</div>
                      <div style={{ fontSize: 9, color: sel ? GOLD : 'var(--text)', marginTop: 2 }}>{m.n}</div>
                    </button>
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button onClick={async function() { setBufferMode('travel'); await supabase.from('coaching_settings').update({ buffer_mode: 'travel' }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Mode trajet activé' }) }} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: bufferMode === 'travel' ? 'rgba(196,151,58,0.15)' : 'var(--surface)', borderColor: bufferMode === 'travel' ? 'rgba(196,151,58,0.4)' : 'var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>🗺️ Calcul automatique du trajet</button>
                <button onClick={async function() { setBufferMode('fixed'); await supabase.from('coaching_settings').update({ buffer_mode: 'fixed' }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Mode fixe activé' }) }} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: bufferMode === 'fixed' ? 'rgba(196,151,58,0.15)' : 'var(--surface)', borderColor: bufferMode === 'fixed' ? 'rgba(196,151,58,0.4)' : 'var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>⏱️ Tampon fixe</button>
              </div>
              {bufferMode === 'fixed' && (
                <div>
                  <div style={s.fieldLabel}>Tampon fixe (minutes)</div>
                  <select value={settings.buffer_time || 15} onChange={async function(e) { var v = parseInt(e.target.value); setSettings(function(st) { return Object.assign({}, st, { buffer_time: v }) }); await supabase.from('coaching_settings').update({ buffer_time: v }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Tampon : ' + v + ' min' }) }} style={{ ...s.input, width: 160 }}>
                    <option value={0}>Aucun</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 heure</option>
                  </select>
                </div>
              )}
              {bufferMode === 'travel' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 14 }}>
                    Le temps entre chaque séance est calculé automatiquement via Google Maps selon l'adresse du client précédent et du client suivant.
                  </div>
                  <div style={s.fieldLabel}>Ajustement tampon (minutes)</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Ajoute ou retire du temps au trajet calculé (pour se garer, se préparer...)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={async function() { var v = (settings.buffer_adjustment || 0) - 5; setSettings(function(st) { return Object.assign({}, st, { buffer_adjustment: v }) }); await supabase.from('coaching_settings').update({ buffer_adjustment: v }).eq('id', settings.id) }} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 16, fontFamily: 'Outfit', color: 'var(--text)' }}>−</button>
                    <div style={{ fontSize: 20, fontWeight: 600, color: (settings.buffer_adjustment || 0) > 0 ? '#4ade80' : (settings.buffer_adjustment || 0) < 0 ? '#f87171' : 'var(--muted)', minWidth: 60, textAlign: 'center' }}>{(settings.buffer_adjustment || 0) > 0 ? '+' : ''}{settings.buffer_adjustment || 0} min</div>
                    <button onClick={async function() { var v = (settings.buffer_adjustment || 0) + 5; setSettings(function(st) { return Object.assign({}, st, { buffer_adjustment: v }) }); await supabase.from('coaching_settings').update({ buffer_adjustment: v }).eq('id', settings.id) }} style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 16, fontFamily: 'Outfit', color: 'var(--text)' }}>+</button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Ex : trajet calculé 25 min + ajustement +10 min = tampon total de 35 min</div>

                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
                    <div style={s.fieldLabel}>🏠 Adresse du coach (domicile)</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Utilisée quand tu as un trou de + de X heures (on suppose que tu rentres chez toi).</div>
                    <AddressInput value={settings.coach_home_address || ''} onChange={function(v) { setSettings(function(st) { return Object.assign({}, st, { coach_home_address: v }) }) }} onBlur={async function(e) { await supabase.from('coaching_settings').update({ coach_home_address: e.target.value }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Adresse sauvegardée' }) }} placeholder="36 avenue du général Michel Bizot, 75012 Paris" style={s.input} />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
                    <div style={s.fieldLabel}>⏰ Retour domicile après (heures de trou)</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Si le trou entre 2 séances dépasse ce seuil, le trajet est calculé depuis ton domicile.</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" value={settings.home_return_hours || 2} onChange={async function(e) { var v = parseFloat(e.target.value) || 2; setSettings(function(st) { return Object.assign({}, st, { home_return_hours: v }) }); await supabase.from('coaching_settings').update({ home_return_hours: v }).eq('id', settings.id) }} style={{ ...s.input, width: 70, textAlign: 'center' }} step="0.5" />
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>heures</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
                    <div style={s.fieldLabel}>🎨 Couleurs des créneaux</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Seuils basés sur le temps de trajet calculé.</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} /> Vert (max min)</div><input type="number" value={settings.green_max || 15} onChange={async function(e) { var v = parseInt(e.target.value) || 15; setSettings(function(st) { return Object.assign({}, st, { green_max: v }) }); await supabase.from('coaching_settings').update({ green_max: v }).eq('id', settings.id) }} style={{ ...s.input, width: '100%', textAlign: 'center' }} /></div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fb923c' }} /> Orange (max min)</div><input type="number" value={settings.orange_max || 30} onChange={async function(e) { var v = parseInt(e.target.value) || 30; setSettings(function(st) { return Object.assign({}, st, { orange_max: v }) }); await supabase.from('coaching_settings').update({ orange_max: v }).eq('id', settings.id) }} style={{ ...s.input, width: '100%', textAlign: 'center' }} /></div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f87171' }} /> Rouge (au-dessus)</div><div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>Auto</div></div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}><input type="checkbox" checked={settings.hide_red_slots || false} onChange={async function(e) { var v = e.target.checked; setSettings(function(st) { return Object.assign({}, st, { hide_red_slots: v }) }); await supabase.from('coaching_settings').update({ hide_red_slots: v }).eq('id', settings.id) }} style={{ accentColor: '#C4973A' }} /> Masquer les créneaux rouges (trop loin)</label>
                  </div>
                </div>
              )}
            </div>}

            {/* RAPPELS */}
            <div style={s.card}>
              <div style={s.cardTitle}>🔔 Rappels automatiques</div>

              {/* Cancellation policy */}
              <div style={{ marginBottom: 16 }}>
                <div style={s.fieldLabel}>🚫 Délai d'annulation</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[{h:6,l:'6h'},{h:12,l:'12h'},{h:24,l:'24h'},{h:48,l:'48h'},{h:72,l:'72h'}].map(function(opt) {
                    var sel = (settings.cancellation_hours || 24) === opt.h
                    return <button key={opt.h} onClick={async function() { setSettings(function(s) { return Object.assign({}, s, { cancellation_hours: opt.h }) }); await supabase.from('coaching_settings').update({ cancellation_hours: opt.h }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Délai d\'annulation : ' + opt.h + 'h' }) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? GOLD : 'var(--text)' }}>{opt.l}</button>
                  })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Le client ne pourra pas annuler moins de {settings.cancellation_hours || 24}h avant la séance.</div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <div style={s.fieldLabel}>Rappel par email</div>
                  <select value={reminderDelay} onChange={function(e) { setReminderDelay(parseInt(e.target.value)) }} style={{ ...s.input, width: 200 }}>
                    <option value={0}>Désactivé</option>
                    <option value={6}>6h avant</option>
                    <option value={12}>12h avant</option>
                    <option value={24}>24h avant</option>
                    <option value={48}>48h avant</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>
                Un email de rappel sera envoyé automatiquement aux clients avant chaque séance.
              </div>
            </div>

            {/* HORAIRES */}
            <div style={s.card}>
              <div style={s.cardTitle}>🕐 Jours et heures d'ouverture</div>
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
            </div>

            {/* EXCEPTIONS */}
            <div style={s.card}>
              <div style={s.cardTitle}>🚫 Périodes bloquées</div>

              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={function() { setNewBlock(function(b) { return Object.assign({}, b, { mode: 'day' }) }) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: newBlock.mode === 'day' ? GOLD : 'var(--border)', background: newBlock.mode === 'day' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 12 }}>📅 Journée entière</button>
                <button onClick={function() { setNewBlock(function(b) { return Object.assign({}, b, { mode: 'range' }) }) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: newBlock.mode === 'range' ? GOLD : 'var(--border)', background: newBlock.mode === 'range' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 12 }}>🏖️ Plusieurs jours</button>
                <button onClick={function() { setNewBlock(function(b) { return Object.assign({}, b, { mode: 'partial' }) }) }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid', borderColor: newBlock.mode === 'partial' ? GOLD : 'var(--border)', background: newBlock.mode === 'partial' ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 12 }}>🕐 Créneau horaire</button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                {newBlock.mode === 'range' ? (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div><div style={s.fieldLabel}>Du</div><input type="date" value={newBlock.date} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { date: e.target.value }) }) }} style={s.input} /></div>
                    <div><div style={s.fieldLabel}>Au</div><input type="date" value={newBlock.endDate} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { endDate: e.target.value }) }) }} style={s.input} /></div>
                  </div>
                ) : (
                  <div><div style={s.fieldLabel}>Date</div><input type="date" value={newBlock.date} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { date: e.target.value }) }) }} style={s.input} /></div>
                )}
                {newBlock.mode === 'partial' && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div><div style={s.fieldLabel}>De</div><input type="time" value={newBlock.start_time} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { start_time: e.target.value }) }) }} style={{ ...s.input, width: 110 }} /></div>
                    <div><div style={s.fieldLabel}>À</div><input type="time" value={newBlock.end_time} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { end_time: e.target.value }) }) }} style={{ ...s.input, width: 110 }} /></div>
                  </div>
                )}
                <div style={{ flex: 2, minWidth: 150 }}><div style={s.fieldLabel}>Raison</div><input type="text" value={newBlock.reason} onChange={function(e) { setNewBlock(function(b) { return Object.assign({}, b, { reason: e.target.value }) }) }} style={s.input} placeholder="Congés, formation..." /></div>
                <button onClick={addBlock} style={{ ...s.btnGold, alignSelf: 'flex-end' }}>Bloquer</button>
              </div>

              {newBlock.mode === 'range' && newBlock.date && newBlock.endDate && (function() {
                var d1 = new Date(newBlock.date + 'T12:00:00')
                var d2 = new Date(newBlock.endDate + 'T12:00:00')
                var days = Math.round((d2 - d1) / 86400000) + 1
                return days > 0 ? <div style={{ fontSize: 12, color: GOLD, marginBottom: 12 }}>📅 {days} jour{days > 1 ? 's' : ''} sera/seront bloqué{days > 1 ? 's' : ''}</div> : null
              })()}

              {blockedPeriods.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune période bloquée.</div> : blockedPeriods.map(function(bp) {
                return (
                  <div key={bp.id} style={s.bookingRow}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{new Date(bp.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}{bp.start_time ? ' — ' + bp.start_time + (bp.end_time ? ' à ' + bp.end_time : '') : ' — Journée entière'}</div>
                      {bp.reason && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{bp.reason}</div>}
                    </div>
                    <button onClick={function() { supabase.from('blocked_periods').delete().eq('id', bp.id).then(loadAll) }} style={s.btnDelete}>Supprimer</button>
                  </div>
                )
              })}
            </div>

            </div>}

            {/* TAB: TARIFS */}
            {settingsTab === 'tarifs' && <div>
              <div style={s.card}>
                <div style={s.cardTitle}>💰 Mes offres</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Créez les tarifs que vos clients verront dans la boutique.</div>

                {/* Existing offers */}
                {coachOffers.map(function(offer) {
                  return <div key={offer.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 12, marginBottom: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 22 }}>{offer.type === 'single' ? '🏋️' : offer.type === 'pack' ? '📦' : '🔄'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{offer.name}</div>
                        {offer.badge && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(196,151,58,0.15)', color: GOLD, fontWeight: 600 }}>{offer.badge}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {offer.type === 'single' ? offer.credits + ' séance' + (offer.credits > 1 ? 's' : '') : offer.type === 'pack' ? offer.credits + ' séances' : offer.sessions_per_week + 'x/sem · ' + (offer.billing_period === 'monthly' ? 'mensuel' : 'annuel')}
                        {offer.description ? ' · ' + offer.description : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>{offer.price}€</div>
                      {offer.original_price && <div style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'line-through' }}>{offer.original_price}€</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={async function() { await supabase.from('coach_offers').update({ is_active: !offer.is_active }).eq('id', offer.id); loadOffers() }} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer' }}>{offer.is_active ? '👁️' : '🚫'}</button>
                      <button onClick={async function() { if (!confirm('Supprimer cette offre ?')) return; await supabase.from('coach_offers').delete().eq('id', offer.id); loadOffers() }} style={{ background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', color: '#f87171' }}>✕</button>
                    </div>
                  </div>
                })}
                {coachOffers.length === 0 && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: 13 }}>Aucune offre créée. Ajoutez vos tarifs ci-dessous.</div>}
              </div>

              {/* Add offer form */}
              <div style={s.card}>
                <div style={s.cardTitle}>➕ Nouvelle offre</div>

                {/* Type selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {[{k:'single',l:'🏋️ Séance',d:'À l\'unité'},{k:'pack',l:'📦 Pack',d:'Plusieurs séances'},{k:'subscription',l:'🔄 Abonnement',d:'Récurrent'}].map(function(t) {
                    var sel = offerForm.type === t.k
                    return <button key={t.k} onClick={function() { setOfferForm(function(f) { return Object.assign({}, f, { type: t.k }) }) }} style={{ flex: 1, padding: '12px 8px', borderRadius: 10, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 18 }}>{t.l.split(' ')[0]}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: sel ? GOLD : 'var(--text)', marginTop: 2 }}>{t.l.split(' ').slice(1).join(' ')}</div>
                    </button>
                  })}
                </div>

                {/* Form fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={s.fieldLabel}>Nom de l'offre</div>
                    <input value={offerForm.name} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { name: e.target.value }) }) }} placeholder={offerForm.type === 'single' ? 'Ex: Séance coaching' : offerForm.type === 'pack' ? 'Ex: Pack 10 séances' : 'Ex: 2x/semaine'} style={s.input} />
                  </div>
                  <div>
                    <div style={s.fieldLabel}>Prix (€)</div>
                    <input type="number" value={offerForm.price} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { price: e.target.value }) }) }} placeholder="60" style={s.input} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {(offerForm.type === 'single' || offerForm.type === 'pack') && <div>
                    <div style={s.fieldLabel}>Nombre de séances</div>
                    <input type="number" value={offerForm.credits} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { credits: parseInt(e.target.value) || 1 }) }) }} style={s.input} />
                  </div>}
                  {offerForm.type === 'subscription' && <div>
                    <div style={s.fieldLabel}>Séances par semaine</div>
                    <input type="number" value={offerForm.sessions_per_week} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { sessions_per_week: parseInt(e.target.value) || 1 }) }) }} style={s.input} />
                  </div>}
                  <div>
                    <div style={s.fieldLabel}>Prix barré (optionnel)</div>
                    <input type="number" value={offerForm.original_price} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { original_price: e.target.value }) }) }} placeholder="ex: 70" style={s.input} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={s.fieldLabel}>Description (optionnel)</div>
                    <input value={offerForm.description} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { description: e.target.value }) }) }} placeholder="ex: Idéal pour débuter" style={s.input} />
                  </div>
                  <div>
                    <div style={s.fieldLabel}>Badge (optionnel)</div>
                    <select value={offerForm.badge} onChange={function(e) { setOfferForm(function(f) { return Object.assign({}, f, { badge: e.target.value }) }) }} style={s.input}>
                      <option value="">Aucun</option>
                      <option value="⭐ Populaire">⭐ Populaire</option>
                      <option value="🔥 Meilleur rapport">🔥 Meilleur rapport</option>
                      <option value="💎 Premium">💎 Premium</option>
                      <option value="🎁 Promo">🎁 Promo</option>
                    </select>
                  </div>
                </div>

                <button onClick={async function() {
                  if (!offerForm.name.trim() || !offerForm.price) return
                  await supabase.from('coach_offers').insert({
                    coach_id: profile.id,
                    name: offerForm.name.trim(),
                    type: offerForm.type,
                    price: parseFloat(offerForm.price),
                    credits: offerForm.type === 'subscription' ? 0 : (parseInt(offerForm.credits) || 1),
                    description: offerForm.description || null,
                    billing_period: offerForm.type === 'subscription' ? 'monthly' : null,
                    sessions_per_week: offerForm.type === 'subscription' ? (parseInt(offerForm.sessions_per_week) || 1) : null,
                    original_price: offerForm.original_price ? parseFloat(offerForm.original_price) : null,
                    badge: offerForm.badge || null,
                    sort_order: coachOffers.length
                  })
                  setOfferForm({ name: '', type: 'single', price: '', credits: 1, description: '', billing_period: 'monthly', sessions_per_week: 1, original_price: '', badge: '' })
                  loadOffers()
                  setMsg({ type: 'success', text: 'Offre créée !' })
                }} style={{ ...s.btnGold, width: '100%' }}>💰 Créer l'offre</button>
              </div>
            </div>}

            {/* TAB: INTÉGRATIONS */}
            {settingsTab === 'integrations' && <div>

            {/* GOOGLE CALENDAR */}
            <div style={s.card}>
              <div style={s.cardTitle}>📅 Google Calendar</div>
              {!gcalStatus && <button onClick={async function() { try { var res = await fetch('/api/admin-actions?action=gcal-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); setGcalStatus(await res.json()) } catch(e) { setGcalStatus({ connected: false, error: e.message }) } }} style={s.btnGold}>Vérifier la connexion</button>}
              {gcalStatus && gcalStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><span style={{ fontSize: 18 }}>✅</span><span style={{ color: '#4ade80', fontWeight: 500 }}>Connecté</span></div>

                {/* Calendar selector */}
                <div style={{ marginBottom: 16 }}>
                  <div style={s.fieldLabel}>Sur quel calendrier enregistrer les réservations ?</div>
                  {!gcalCalendars ? <button onClick={async function() { try { var res = await fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list-calendars' }) }); var data = await res.json(); setGcalCalendars(data.calendars || []) } catch(e) { setMsg({ type: 'error', text: 'Erreur: ' + e.message }) } }} style={{ width: '100%', padding: '12px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 10, cursor: 'pointer', fontFamily: 'Outfit', color: GOLD, fontSize: 13 }}>📅 Voir mes calendriers</button> : <div>
                    {gcalCalendars.map(function(cal) {
                      var isSel = (settings.google_calendar_id || 'primary') === cal.id
                      return <button key={cal.id} onClick={async function() { 
                        setSettings(function(s) { return Object.assign({}, s, { google_calendar_id: cal.id }) })
                        // Save immediately to DB
                        await supabase.from('coaching_settings').update({ google_calendar_id: cal.id }).eq('id', settings.id)
                        setMsg({ type: 'success', text: '✅ Calendrier "' + cal.summary + '" sélectionné !' })
                      }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: isSel ? 'rgba(196,151,58,0.08)' : 'var(--surface)', border: '1px solid', borderColor: isSel ? 'rgba(196,151,58,0.4)' : 'var(--border)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', fontFamily: 'Outfit', fontSize: 13, color: 'var(--text)', textAlign: 'left', transition: 'all 0.2s' }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: cal.backgroundColor || GOLD, flexShrink: 0 }} />
                        <div style={{ flex: 1, fontWeight: isSel ? 600 : 400 }}>{cal.summary}</div>
                        {isSel && <span style={{ color: GOLD, fontSize: 16 }}>✓</span>}
                      </button>
                    })}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Les créneaux occupés sur <strong>tous</strong> tes calendriers seront bloqués pour les clients.</div>
                  </div>}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href="https://calendar.google.com" target="_blank" rel="noopener" style={{ padding: '10px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: GOLD, textDecoration: 'none', fontFamily: 'Outfit' }}>📅 Ouvrir Calendar</a>
                  <a href="/api/google-auth" style={{ padding: '10px 16px', background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.3)', borderRadius: 8, fontSize: 12, color: GOLD, textDecoration: 'none', fontFamily: 'Outfit' }}>🔄 Reconnecter</a>
                  <button onClick={async function() { if (!confirm('Déconnecter Google Calendar ?')) return; await supabase.from('google_tokens').delete().eq('coach_id', profile.id); setGcalStatus({ connected: false }); setMsg({ type: 'success', text: 'Google Calendar déconnecté' }) }} style={{ padding: '10px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, fontSize: 12, color: '#f87171', cursor: 'pointer', fontFamily: 'Outfit' }}>✕ Déconnecter</button>
                </div>
              </div>}
              {gcalStatus && !gcalStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 18 }}>❌</span><span style={{ color: '#f87171', fontWeight: 500 }}>Déconnecté</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{gcalStatus.error}</div>
                <a href="/api/google-auth" style={{ display: 'inline-block', padding: '12px 24px', background: GOLD, color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 500, fontSize: 13, fontFamily: 'Outfit' }}>🔗 Reconnecter Google Calendar</a>
              </div>}
            </div>

            {/* GOOGLE MAPS */}
            {/* GOOGLE MAPS - masqué si coach en ligne */}
            {profile.coaching_mode !== 'online' && <div style={s.card}>
              <div style={s.cardTitle}>🗺️ Google Maps (trajets)</div>
              {!gmapsStatus && <button onClick={async function() { try { var res = await fetch('/api/admin-actions?action=gmaps-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); setGmapsStatus(await res.json()) } catch(e) { setGmapsStatus({ connected: false, error: e.message }) } }} style={s.btnGold}>Vérifier la connexion</button>}
              {gmapsStatus && gmapsStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 18 }}>✅</span><span style={{ color: '#4ade80', fontWeight: 500 }}>Connecté</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Clé : {gmapsStatus.key}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Test Paris→Lyon : {gmapsStatus.test}</div>
              </div>}
              {gmapsStatus && !gmapsStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 18 }}>❌</span><span style={{ color: '#f87171', fontWeight: 500 }}>Non connecté</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{gmapsStatus.error}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
                  1. Va sur console.cloud.google.com<br/>
                  2. Active "Distance Matrix API"<br/>
                  3. Crée une clé API (Credentials → Create)<br/>
                  4. Mets-la dans Vercel → Environment Variables :<br/>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'monospace', marginTop: 6, color: 'var(--muted)' }}>GOOGLE_MAPS_KEY = AIza...</div>
                <div style={{ fontSize: 11, color: '#fb923c', marginTop: 8 }}>⚠️ Coche les 3 environnements : Production + Preview + Development</div>
              </div>}
            </div>}

            </div>}

            {/* TAB: PROFIL */}
            {settingsTab === 'profil' && <div>

            {/* LANGUE */}
            <div style={s.card}>
              <div style={s.cardTitle}>{t('lang.title')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{k:'fr',l:'🇫🇷',n:'Français'},{k:'en',l:'🇬🇧',n:'English'},{k:'es',l:'🇪🇸',n:'Español'},{k:'it',l:'🇮🇹',n:'Italiano'}].map(function(lg) {
                  var sel = lang === lg.k
                  return <button key={lg.k} onClick={function() { setLang(lg.k) }} style={{ flex: 1, padding: '12px 8px', borderRadius: 10, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: 22 }}>{lg.l}</div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: sel ? GOLD : 'var(--text)', marginTop: 4 }}>{lg.n}</div>
                  </button>
                })}
              </div>
            </div>

            {/* MODE DE COACHING */}
            <div style={s.card}>
              <div style={s.cardTitle}>🎯 Mode de coaching</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{k:'online',l:'🖥️ En ligne',d:'Coaching à distance'},{k:'in_person',l:'🏢 En salle',d:'Salle, studio, club...'},{k:'home',l:'🏠 À domicile',d:'Chez le client'},{k:'hybrid',l:'🔄 Hybride',d:'Plusieurs modes'}].map(function(m) {
                  var sel = (profile.coaching_mode || 'hybrid') === m.k
                  return <button key={m.k} onClick={async function() { await supabase.from('profiles').update({ coaching_mode: m.k }).eq('id', profile.id); setProfile(function(p) { return Object.assign({}, p, { coaching_mode: m.k }) }); setMsg({ type: 'success', text: 'Mode mis à jour !' }) }} style={{ padding: '16px 12px', borderRadius: 12, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.1)' : 'var(--surface)', cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'center', transition: 'all 0.2s' }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{m.l.split(' ')[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: sel ? GOLD : 'var(--text)' }}>{m.l.split(' ').slice(1).join(' ')}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{m.d}</div>
                  </button>
                })}
              </div>
            </div>

            {/* SALLES / LIEUX */}
            {(profile.coaching_mode === 'in_person' || profile.coaching_mode === 'hybrid' || !profile.coaching_mode) && <div style={s.card}>
              <div style={s.cardTitle}>📍 Mes salles & lieux</div>
              {coachLocations.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Ajoutez les salles où vous donnez vos cours. Vos clients pourront les sélectionner lors de la réservation.</div>}
              {coachLocations.map(function(loc) {
                var locCourses = (customClassTypes||[]).filter(function(ct) { return ct.location_id === loc.id })
                return <div key={loc.id} style={{ background: 'var(--surface2)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{loc.name}</div>
                        {loc.billable && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(196,151,58,0.1)', color: GOLD, fontWeight: 600 }}>🧾</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{loc.address}</div>
                    </div>
                    <button onClick={async function() { await supabase.from('coach_locations').update({ billable: !loc.billable }).eq('id', loc.id); loadLocations() }} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', opacity: 0.6 }}>{loc.billable ? '🧾' : '📋'}</button>
                    <button onClick={async function() { if (!confirm('Supprimer ' + loc.name + ' ?')) return; await supabase.from('coach_locations').delete().eq('id', loc.id); loadLocations() }} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 14, cursor: 'pointer' }}>✕</button>
                  </div>
                  {/* Courses for this gym */}
                  <div style={{ padding: '0 12px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: GOLD, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cours ({locCourses.length})</div>
                    {locCourses.map(function(ct) {
                      return <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--surface)', borderRadius: 6, marginBottom: 3, fontSize: 12 }}>
                        <div style={{ flex: 1 }}>{ct.name}</div>
                        <div style={{ color: 'var(--muted)', fontSize: 10 }}>⏱ {ct.duration_minutes}min</div>
                        <div style={{ color: GOLD, fontSize: 11, fontWeight: 600 }}>💰 {ct.price}€</div>
                        <button onClick={async function() { await supabase.from('foch_class_types').delete().eq('id', ct.id); loadFinance() }} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 10, cursor: 'pointer' }}>✕</button>
                      </div>
                    })}
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                      <input id={'ct_name_'+loc.id} placeholder="Nom du cours" style={{ ...s.input, flex: 2, padding: '4px 8px', fontSize: 11 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ fontSize: 9, color: 'var(--muted)' }}>⏱</span><input id={'ct_dur_'+loc.id} type="number" placeholder="45" defaultValue="45" style={{ ...s.input, width: 40, padding: '4px', fontSize: 11, textAlign: 'center' }} /></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}><span style={{ fontSize: 9, color: 'var(--muted)' }}>💰</span><input id={'ct_price_'+loc.id} type="number" placeholder="50" defaultValue="50" style={{ ...s.input, width: 40, padding: '4px', fontSize: 11, textAlign: 'center' }} /></div>
                      <button onClick={async function() { var n=document.getElementById('ct_name_'+loc.id).value; var d=document.getElementById('ct_dur_'+loc.id).value; var p=document.getElementById('ct_price_'+loc.id).value; if(!n.trim())return; await supabase.from('foch_class_types').insert({ coach_id: profile.id, name: n.trim(), duration_minutes: parseInt(d)||45, price: parseInt(p)||50, location_id: loc.id }); document.getElementById('ct_name_'+loc.id).value=''; loadFinance() }} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 600 }}>+</button>
                    </div>
                  </div>
                </div>
              })}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <input value={newLocation.name} onChange={function(e) { setNewLocation(function(l) { return Object.assign({}, l, { name: e.target.value }) }) }} placeholder="Nom (ex: Fitness Park)" style={s.input} />
                <AddressInput value={newLocation.address} onChange={function(v) { setNewLocation(function(l) { return Object.assign({}, l, { address: v }) }) }} placeholder="Adresse complète" style={s.input} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={newLocation.billable} onChange={function(e) { setNewLocation(function(l) { return Object.assign({}, l, { billable: e.target.checked }) }) }} style={{ accentColor: GOLD, width: 18, height: 18 }} />
                <span>🧾 Activer la facturation pour cette salle</span>
              </label>
              <button onClick={async function() { if (!newLocation.name.trim() || !newLocation.address.trim()) return; await supabase.from('coach_locations').insert({ coach_id: profile.id, name: newLocation.name.trim(), address: newLocation.address.trim(), billable: newLocation.billable }); setNewLocation({ name: '', address: '', billable: false }); loadLocations(); setMsg({ type: 'success', text: 'Salle ajoutée !' }) }} style={{ ...s.btnGold, width: '100%', marginTop: 8 }}>+ Ajouter une salle</button>

              {/* Location requests */}
              {locationRequests.length > 0 && <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: GOLD }}>📩 Demandes de clients ({locationRequests.length})</div>
                {locationRequests.map(function(req) {
                  return <div key={req.id} style={{ padding: '12px', background: 'rgba(196,151,58,0.05)', border: '1px solid rgba(196,151,58,0.15)', borderRadius: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{req.profiles?.full_name || req.profiles?.email}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>📍 {req.address}</div>
                    {req.message && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>{req.message}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={async function() { await supabase.from('coach_locations').insert({ coach_id: profile.id, name: 'Nouveau lieu', address: req.address }); await supabase.from('location_requests').update({ status: 'approved' }).eq('id', req.id); loadLocations(); setMsg({ type: 'success', text: 'Lieu approuvé et ajouté !' }) }} style={{ ...s.btnGold, flex: 1, padding: '8px', fontSize: 11 }}>✓ Approuver & ajouter</button>
                      <button onClick={async function() { await supabase.from('location_requests').update({ status: 'rejected' }).eq('id', req.id); loadLocations(); setMsg({ type: 'success', text: 'Demande refusée.' }) }} style={{ flex: 1, padding: '8px', fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Outfit' }}>✕ Refuser</button>
                    </div>
                  </div>
                })}
              </div>}
            </div>}

            {/* IDENTITÉ & SOUS-DOMAINE (inside profil tab) */}
            <div style={s.card}>
              <div style={s.cardTitle}>🌐 Identité & Sous-domaine</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={s.fieldLabel}>Nom de marque</div>
                  <input value={profile.brand_name || ''} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { brand_name: e.target.value }) }) }} placeholder="Ex: Thomas Coaching" style={s.input} />
                </div>
                <div>
                  <div style={s.fieldLabel}>Spécialité</div>
                  <input value={profile.specialty || ''} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { specialty: e.target.value }) }) }} placeholder="Coach Sport & Nutrition" style={s.input} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={s.fieldLabel}>Couleur de marque</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={profile.brand_color || '#C4973A'} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { brand_color: e.target.value }) }) }} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: profile.brand_color || '#C4973A' }} />
                  </div>
                </div>
                <div>
                  <div style={s.fieldLabel}>WhatsApp</div>
                  <input value={profile.whatsapp || ''} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { whatsapp: e.target.value }) }) }} placeholder="+33612345678" style={s.input} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={s.fieldLabel}>Sous-domaine</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input value={profile.subdomain || ''} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }) }) }} placeholder="monnom" style={{ ...s.input, flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>.ydcoaching.fr</span>
                </div>
                {profile.subdomain && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>🔗 https://{profile.subdomain}.ydcoaching.fr</div>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={s.fieldLabel}>Lien Google Reviews</div>
                <input value={profile.google_review_url || ''} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { google_review_url: e.target.value }) }) }} placeholder="https://g.page/..." style={s.input} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={s.fieldLabel}>🔗 Réseaux sociaux</div>
                {(function() {
                  var networks = [
                    { id: 'instagram', logo: 'https://cdn.simpleicons.org/instagram/E4405F', name: 'Instagram', placeholder: 'https://instagram.com/moncompte' },
                    { id: 'facebook', logo: 'https://cdn.simpleicons.org/facebook/1877F2', name: 'Facebook', placeholder: 'https://facebook.com/mapage' },
                    { id: 'tiktok', logo: 'https://cdn.simpleicons.org/tiktok/000000', name: 'TikTok', placeholder: 'https://tiktok.com/@moncompte' },
                    { id: 'youtube', logo: 'https://cdn.simpleicons.org/youtube/FF0000', name: 'YouTube', placeholder: 'https://youtube.com/@machaîne' },
                    { id: 'linkedin', logo: 'https://cdn.simpleicons.org/linkedin/0A66C2', name: 'LinkedIn', placeholder: 'https://linkedin.com/in/monprofil' },
                    { id: 'twitter', logo: 'https://cdn.simpleicons.org/x/000000', name: 'X (Twitter)', placeholder: 'https://x.com/moncompte' },
                    { id: 'snapchat', logo: 'https://cdn.simpleicons.org/snapchat/FFFC00', name: 'Snapchat', placeholder: 'https://snapchat.com/add/moncompte' },
                    { id: 'strava', logo: 'https://cdn.simpleicons.org/strava/FC4C02', name: 'Strava', placeholder: 'https://strava.com/athletes/monid' },
                    { id: 'website', logo: '', name: 'Site web', placeholder: 'https://monsite.com' }
                  ]
                  var links = profile.social_links || {}
                  var activeNets = Object.keys(links).filter(function(k) { return links[k] })
                  var availableNets = networks.filter(function(n) { return !links[n.id] })
                  return <div>
                    {networks.filter(function(n) { return links[n.id] || links[n.id] === '' }).map(function(n) {
                      return <div key={n.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        {n.logo ? <img src={n.logo} style={{ width: 20, height: 20 }} /> : <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>🌐</span>}
                        <input value={links[n.id] || ''} onChange={function(e) { var newLinks = Object.assign({}, links); newLinks[n.id] = e.target.value; setProfile(function(p) { return Object.assign({}, p, { social_links: newLinks }) }) }} placeholder={n.placeholder} style={{ ...s.input, flex: 1, padding: '8px 10px', fontSize: 12 }} />
                        <button onClick={function() { var newLinks = Object.assign({}, links); delete newLinks[n.id]; setProfile(function(p) { return Object.assign({}, p, { social_links: newLinks }) }) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14, padding: '4px' }}>✕</button>
                      </div>
                    })}
                    {availableNets.length > 0 && <select onChange={function(e) { if (!e.target.value) return; var newLinks = Object.assign({}, links); newLinks[e.target.value] = ''; setProfile(function(p) { return Object.assign({}, p, { social_links: newLinks }) }); e.target.value = '' }} style={{ ...s.input, fontSize: 12, padding: '6px 8px', color: 'var(--muted)' }}>
                      <option value="">+ Ajouter un réseau...</option>
                      {availableNets.map(function(n) { return <option key={n.id} value={n.id}>{n.name}</option> })}
                    </select>}
                  </div>
                })()}
              </div>
              <button onClick={async function() { await supabase.from('profiles').update({ brand_name: profile.brand_name, brand_color: profile.brand_color, specialty: profile.specialty, whatsapp: profile.whatsapp, subdomain: profile.subdomain, google_review_url: profile.google_review_url, social_links: profile.social_links || {} }).eq('id', profile.id); setCoachBrand({ name: profile.brand_name || profile.full_name || 'Coach', color: profile.brand_color || '#C4973A', logo: profile.logo_url, specialty: profile.specialty || '', whatsapp: profile.whatsapp || '', reviewUrl: profile.google_review_url || '', socialLinks: profile.social_links || {} }); setMsg({ type: 'success', text: 'Identité sauvegardée !' }) }} style={{ ...s.btnGold, width: '100%' }}>💾 Sauvegarder l'identité</button>
            </div>

            {/* STRIPE CONNECT */}
            <div style={s.card}>
              <div style={s.cardTitle}>💳 Recevoir mes paiements</div>
              {!stripeStatus && <div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>Connectez votre compte bancaire via Stripe pour recevoir les paiements de vos clients en toute sécurité.</div>
                <button onClick={async function() { try { var res = await fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stripe-connect-status', coachId: profile.id }) }); var data = await res.json(); setStripeStatus(data) } catch(e) { setStripeStatus({ connected: false }) } }} style={{ ...s.btnGold, width: '100%' }}>Vérifier mon compte</button>
              </div>}
              {stripeStatus && stripeStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10 }}><span style={{ fontSize: 18 }}>✅</span><div><div style={{ fontWeight: 600, color: '#4ade80' }}>Compte connecté</div><div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{stripeStatus.chargesEnabled ? 'Paiements activés' : '⏳ Activation en cours...'} · {stripeStatus.payoutsEnabled ? 'Virements activés' : '⏳ En attente'}</div></div></div>
                {!stripeStatus.detailsSubmitted && <button onClick={async function() { try { var res = await fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stripe-connect-create', coachId: profile.id, email: profile.email, coachName: profile.full_name }) }); var data = await res.json(); if (data.url) window.location.href = data.url } catch(e) { setMsg({ type: 'error', text: e.message }) } }} style={{ ...s.btnGold, width: '100%', marginBottom: 8 }}>📝 Finaliser mon inscription</button>}
                <button onClick={async function() { try { var res = await fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stripe-connect-dashboard', coachId: profile.id }) }); var data = await res.json(); if (data.url) window.open(data.url, '_blank') } catch(e) {} }} style={{ ...s.btnGold, width: '100%', marginBottom: 8, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>📊 Mes paiements Stripe</button>
                <button onClick={async function() { if (!confirm('Déconnecter votre compte Stripe ?')) return; await fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stripe-connect-disconnect', coachId: profile.id }) }); setStripeStatus(null); setMsg({ type: 'success', text: 'Compte déconnecté.' }) }} style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', marginTop: 4 }}>Déconnecter</button>
              </div>}
              {stripeStatus && !stripeStatus.connected && <div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>Recevez les paiements de vos clients directement sur votre compte bancaire. L'inscription prend 2 minutes.</div>
                <button onClick={async function() { try { setMsg({ type: 'success', text: '⏳ Redirection...' }); var res = await fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stripe-connect-create', coachId: profile.id, email: profile.email, coachName: profile.full_name }) }); var data = await res.json(); if (data.url) window.location.href = data.url; else setMsg({ type: 'error', text: 'Erreur de connexion. Réessayez.' }) } catch(e) { setMsg({ type: 'error', text: 'Erreur de connexion.' }) } }} style={{ ...s.btnGold, width: '100%' }}>💳 Connecter mon compte bancaire</button>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, textAlign: 'center' }}>Sécurisé par Stripe · Aucun frais d'inscription</div>
              </div>}
            </div>

            {/* FACTURATION */}
            </div>}

            {/* TAB: FACTURATION */}
            {settingsTab === 'facturation' && <div>

            {/* FIDÉLITÉ */}
            <div style={s.card}>
              <div style={s.cardTitle}>🏆 Programme de fidélité</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.loyalty_enabled || false} onChange={async function(e) { var v = e.target.checked; setSettings(function(s) { return Object.assign({}, s, { loyalty_enabled: v }) }); await supabase.from('coaching_settings').update({ loyalty_enabled: v }).eq('id', settings.id); setMsg({ type: 'success', text: v ? '✅ Fidélité activée' : 'Fidélité désactivée' }) }} style={{ accentColor: GOLD, width: 18, height: 18 }} />
                <span style={{ fontSize: 13 }}>Activer le programme de fidélité</span>
              </label>
              {settings.loyalty_enabled && <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Les crédits sont ajoutés automatiquement quand le client atteint un palier.</div>
                {(( typeof settings.loyalty_milestones === "string" ? JSON.parse(settings.loyalty_milestones) : settings.loyalty_milestones) || [{ sessions: 20, reward: 1, label: '🎁 +1 crédit offert' }, { sessions: 50, reward: 2, label: '🎁 +2 crédits offerts' }, { sessions: 100, reward: 5, label: '👑 +5 crédits offerts' }]).map(function(m, i) {
                  return <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <input type="number" value={m.sessions} onChange={function(e) { var ms = (( typeof settings.loyalty_milestones === "string" ? JSON.parse(settings.loyalty_milestones) : settings.loyalty_milestones) || [{ sessions: 20, reward: 1, label: '🎁 +1 crédit' }, { sessions: 50, reward: 2, label: '🎁 +2 crédits' }, { sessions: 100, reward: 5, label: '👑 +5 crédits' }]).slice(); ms[i] = Object.assign({}, ms[i], { sessions: parseInt(e.target.value) || 0 }); setSettings(function(s) { return Object.assign({}, s, { loyalty_milestones: ms }) }) }} placeholder="Séances" style={{ ...s.input, width: 70, textAlign: 'center', fontSize: 12, padding: '6px' }} />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>→</span>
                    <input type="number" value={m.reward} onChange={function(e) { var ms = (( typeof settings.loyalty_milestones === "string" ? JSON.parse(settings.loyalty_milestones) : settings.loyalty_milestones) || [{ sessions: 20, reward: 1, label: '🎁 +1 crédit' }, { sessions: 50, reward: 2, label: '🎁 +2 crédits' }, { sessions: 100, reward: 5, label: '👑 +5 crédits' }]).slice(); ms[i] = Object.assign({}, ms[i], { reward: parseInt(e.target.value) || 0 }); setSettings(function(s) { return Object.assign({}, s, { loyalty_milestones: ms }) }) }} placeholder="Crédits" style={{ ...s.input, width: 50, textAlign: 'center', fontSize: 12, padding: '6px' }} />
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>crédits</span>
                    <input value={m.label || ''} onChange={function(e) { var ms = (( typeof settings.loyalty_milestones === "string" ? JSON.parse(settings.loyalty_milestones) : settings.loyalty_milestones) || []).slice(); ms[i] = Object.assign({}, ms[i], { label: e.target.value }); setSettings(function(s) { return Object.assign({}, s, { loyalty_milestones: ms }) }) }} placeholder="Label" style={{ ...s.input, flex: 1, fontSize: 11, padding: '6px 8px' }} />
                    <button onClick={function() { var ms = (( typeof settings.loyalty_milestones === "string" ? JSON.parse(settings.loyalty_milestones) : settings.loyalty_milestones) || []).slice(); ms.splice(i, 1); setSettings(function(s) { return Object.assign({}, s, { loyalty_milestones: ms }) }); supabase.from('coaching_settings').update({ loyalty_milestones: JSON.stringify(ms) }).eq('id', settings.id) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                })}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={function() { var ms = (( typeof settings.loyalty_milestones === "string" ? JSON.parse(settings.loyalty_milestones) : settings.loyalty_milestones) || []).slice(); ms.push({ sessions: (ms.length > 0 ? ms[ms.length - 1].sessions + 25 : 25), reward: 1, label: '🎁 Bonus' }); setSettings(function(s) { return Object.assign({}, s, { loyalty_milestones: ms }) }) }} style={{ padding: '8px 14px', background: 'var(--surface2)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)' }}>+ Ajouter un palier</button>
                  <button onClick={async function() { var ms = settings.loyalty_milestones || []; await supabase.from('coaching_settings').update({ loyalty_milestones: JSON.stringify(ms) }).eq('id', settings.id); setMsg({ type: 'success', text: '✅ Paliers sauvegardés !' }) }} style={{ padding: '8px 14px', background: GOLD, border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', color: '#000', fontWeight: 600 }}>💾 Sauvegarder</button>
                </div>
              </div>}
            </div>

            {/* FACTURATION (inside tab) */}
            <div style={s.card}>
              <div style={s.cardTitle}>🧾 Facturation</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>Ces infos apparaîtront sur tes factures.</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}><div style={s.fieldLabel}>Nom / Raison sociale</div><input value={invoiceSettings.business_name || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { business_name: e.target.value }) }) }} placeholder="Yoann Desgrand" style={s.input} /></div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={s.fieldLabel}>SIRET (recherche auto)</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={invoiceSettings.siret || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { siret: e.target.value }) }) }} placeholder="123 456 789 00012" style={{ ...s.input, flex: 1 }} />
                  <button onClick={async function() { var q = prompt('Rechercher une entreprise (nom ou SIRET)'); if (!q) return; var res = await fetch('/api/admin-actions?action=search-company', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); var data = await res.json(); if (data.results && data.results.length > 0) { var r = data.results[0]; if (data.results.length > 1) { var choices = data.results.map(function(c, i) { return (i+1) + '. ' + c.name + ' (' + c.siret + ')' }).join('\n'); var pick = parseInt(prompt('Plusieurs résultats :\n' + choices + '\n\nChoisis (1-' + data.results.length + ')')) || 1; r = data.results[pick - 1] || data.results[0] } setInvoiceSettings(function(st) { return Object.assign({}, st, { business_name: r.name, siret: r.siret, tva_number: r.tva, address: r.address }) }); setMsg({ type: 'success', text: r.name + ' trouvé !' }) } else setMsg({ type: 'error', text: 'Aucune entreprise trouvée' }) }} style={{ ...s.btnEdit, fontSize: 11, whiteSpace: 'nowrap' }}>🔍 Chercher</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}><div style={s.fieldLabel}>N° TVA</div><input value={invoiceSettings.tva_number || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { tva_number: e.target.value }) }) }} placeholder="FR12345678901" style={s.input} /></div>
              </div>
              <div style={{ marginBottom: 10 }}><div style={s.fieldLabel}>Adresse</div><input value={invoiceSettings.address || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { address: e.target.value }) }) }} style={s.input} /></div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}><div style={s.fieldLabel}>Téléphone</div><input value={invoiceSettings.phone || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { phone: e.target.value }) }) }} style={s.input} /></div>
                <div style={{ flex: 1 }}><div style={s.fieldLabel}>Email</div><input value={invoiceSettings.email || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { email: e.target.value }) }) }} style={s.input} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}><div style={s.fieldLabel}>IBAN</div><input value={invoiceSettings.iban || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { iban: e.target.value }) }) }} placeholder="FR76 ..." style={s.input} /></div>
                <div style={{ flex: 1 }}><div style={s.fieldLabel}>BIC</div><input value={invoiceSettings.bic || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { bic: e.target.value }) }) }} style={s.input} /></div>
              </div>
              <div style={{ marginBottom: 10 }}><div style={s.fieldLabel}>Mention légale</div><input value={invoiceSettings.legal_mention || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { legal_mention: e.target.value }) }) }} placeholder="TVA non applicable, art. 293 B du CGI." style={s.input} /></div>
              <div style={{ marginBottom: 10 }}><div style={s.fieldLabel}>Conditions (facultatif)</div><textarea value={invoiceSettings.terms || ''} onChange={function(e) { setInvoiceSettings(function(st) { return Object.assign({}, st, { terms: e.target.value }) }) }} placeholder="Conditions de paiement..." rows={2} style={{ ...s.input, resize: 'vertical' }} /></div>
              <button onClick={async function() { await supabase.from('invoice_settings').upsert(Object.assign({}, invoiceSettings, { id: 'admin', updated_at: new Date().toISOString() })); setMsg({ type: 'success', text: 'Paramètres de facturation sauvegardés !' }) }} style={{ ...s.btnGold, width: '100%' }}>💾 Sauvegarder</button>
            </div>

            {/* STRIPE */}
            <div style={s.card}>
              <div style={s.cardTitle}>💳 Stripe</div>
              {!stripeStatus && <button onClick={async function() {
                try {
                  var res = await fetch('/api/admin-actions?action=stripe-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                  var data = await res.json()
                  setStripeStatus(data)
                } catch(e) { setStripeStatus({ connected: false, error: e.message }) }
              }} style={s.btnGold}>Vérifier la connexion Stripe</button>}
              {stripeStatus && !stripeStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><span style={{ fontSize: 18 }}>❌</span><span style={{ color: '#f87171', fontWeight: 500 }}>Non connecté</span></div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>{stripeStatus.error}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>Pour connecter Stripe, ajoute ta clé API dans les variables d'environnement Vercel :</div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', marginTop: 8, color: 'var(--muted)' }}>STRIPE_SECRET_KEY = sk_live_xxx...</div>
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: GOLD }}>→ Obtenir ma clé Stripe</a>
              </div>}
              {stripeStatus && stripeStatus.connected && <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><span style={{ fontSize: 18 }}>✅</span><span style={{ color: '#4ade80', fontWeight: 500 }}>Connecté</span></div>
                <div style={{ fontSize: 13, marginBottom: 4 }}><strong>{stripeStatus.business_name || '—'}</strong></div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{stripeStatus.email}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>ID : {stripeStatus.account_id}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Paiements : {stripeStatus.charges_enabled ? '✅ Activés' : '❌ Désactivés'} · Virements : {stripeStatus.payouts_enabled ? '✅ Activés' : '❌ Désactivés'}
                </div>
                <a href="https://dashboard.stripe.com" target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: GOLD }}>→ Ouvrir le dashboard Stripe</a>
              </div>}
            </div>

            {/* QR CODE & PARRAINAGE */}
            <div style={s.card}>
              <div style={s.cardTitle}>🤝 Parrainage & QR Code</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>QR Code d'inscription</div>
                  <img src={'https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=C4973A&bgcolor=0a0908&data=' + encodeURIComponent('https://app.yoanndesgrand.fr/login')} style={{ width: 140, height: 140, borderRadius: 10, border: '1px solid var(--border)' }} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Imprime-le ou affiche-le en salle</div>
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>QR Code séance découverte</div>
                  <img src={'https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=C4973A&bgcolor=0a0908&data=' + encodeURIComponent('https://app.yoanndesgrand.fr/login?discovery=1')} style={{ width: 140, height: 140, borderRadius: 10, border: '1px solid var(--border)' }} />
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Pour les prospects</div>
                </div>
              </div>
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Stats parrainage</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Les clients avec un code parrain gagnent 1 crédit quand leur filleul s'inscrit.</div>
                <button onClick={async function() {
                  var { data } = await supabase.from('referrals').select('*, referrer:referrer_id(full_name), referred:referred_id(full_name, email)').order('created_at', { ascending: false })
                  if (data && data.length > 0) {
                    var txt = data.map(function(r) { return (r.referrer?.full_name || '?') + ' → ' + (r.referred?.full_name || r.referred?.email || '?') }).join('\n')
                    alert('Parrainages (' + data.length + ') :\n\n' + txt)
                  } else { setMsg({ type: 'info', text: 'Aucun parrainage pour le moment' }) }
                }} style={{ ...s.btnGold, marginTop: 8, fontSize: 11, padding: '8px 16px' }}>📊 Voir les parrainages</button>
              </div>
            </div>

            </div>}

            <button onClick={saveHours} disabled={savingHours} style={{ ...s.btnGold, width: '100%', marginTop: 8 }}>{savingHours ? t('settings.saving') : t('settings.saveAll')}</button>
          </div>
        )}
      </div>
      {/* Reschedule modal */}
      {rescheduling && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px 24px', maxWidth: 480, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>Décaler la séance</div>
              <button onClick={function() { setRescheduling(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text)' }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              {rescheduling.profiles?.full_name} — actuellement le {rescheduling.time_slots ? new Date(rescheduling.time_slots.start_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </div>
            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={function() { var m = rescheduleMonth - 1, y = rescheduleYear; if (m < 1) { m = 12; y-- } setRescheduleMonth(m); setRescheduleYear(y); loadRescheduleSlots(m, y, rescheduling.client_id) }} style={s.btnEdit}>←</button>
              <div style={{ fontWeight: 500 }}>{['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][rescheduleMonth]} {rescheduleYear}</div>
              <button onClick={function() { var m = rescheduleMonth + 1, y = rescheduleYear; if (m > 12) { m = 1; y++ } setRescheduleMonth(m); setRescheduleYear(y); loadRescheduleSlots(m, y, rescheduling.client_id) }} style={s.btnEdit}>→</button>
            </div>
            {/* Days */}
            {(function() {
              var days = {}; rescheduleSlots.forEach(function(sl) { if (!days[sl.date]) days[sl.date] = []; days[sl.date].push(sl) })
              return Object.keys(days).map(function(date) {
                var d = new Date(date + 'T12:00:00')
                return (
                  <div key={date} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: GOLD, marginBottom: 6 }}>{['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][d.getDay()]} {d.getDate()}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {days[date].map(function(sl) {
                        var t = new Date(sl.start)
                        return <button key={sl.start} onClick={function() { if (window.confirm('Décaler au ' + d.getDate() + ' à ' + t.getHours() + 'h' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ' ?')) confirmReschedule(sl) }} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>{t.getHours()}h{t.getMinutes() < 10 ? '0' : ''}{t.getMinutes()}</button>
                      })}
                    </div>
                  </div>
                )
              })
            })()}
            {rescheduleSlots.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>Aucun créneau ce mois</div>}
          </div>
        </div>
      )}

      {/* Coach mode overlay */}
      {/* Share folder modal */}
      {shareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={function() { setShareModal(null) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 20px', maxWidth: 400, width: '100%', maxHeight: '70vh', overflow: 'auto' }} onClick={function(e) { e.stopPropagation() }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>📂 {shareModal.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Sélectionne les clients qui auront accès à ce dossier</div>

            {/* Select all / none */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={function() { var all = {}; clients.forEach(function(c) { all[c.id] = true }); setShareSelected(all) }} style={{ fontSize: 11, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit' }}>Tout sélectionner</button>
              <button onClick={function() { setShareSelected({}) }} style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit' }}>Aucun</button>
            </div>

            {/* Client checkboxes */}
            {clients.map(function(c) {
              var initials = (c.full_name || '?').split(' ').map(function(n) { return n[0] || '' }).join('').toUpperCase().slice(0, 2)
              var checked = shareSelected[c.id] || false
              return (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={function() { setShareSelected(function(s) { var n = Object.assign({}, s); if (n[c.id]) delete n[c.id]; else n[c.id] = true; return n }) }} style={{ accentColor: GOLD, width: 18, height: 18, flexShrink: 0 }} />
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: checked ? 'rgba(196,151,58,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: checked ? GOLD : 'var(--muted)', flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{c.full_name || c.email}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.email}</div>
                  </div>
                </label>
              )
            })}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={async function() {
                var selectedIds = Object.keys(shareSelected).filter(function(k) { return shareSelected[k] })
                await supabase.from('drive_folder_shares').delete().eq('folder_id', shareModal.id)
                if (selectedIds.length > 0) {
                  await supabase.from('drive_folder_shares').insert(selectedIds.map(function(cid) { return { folder_id: shareModal.id, client_id: cid } }))
                }
                loadDrive()
                setShareModal(null)
                setMsg({ type: 'success', text: selectedIds.length + ' client' + (selectedIds.length > 1 ? 's' : '') + ' ont accès à "' + shareModal.name + '"' })
              }} style={{ flex: 1, padding: '14px', background: GOLD, color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>✓ Enregistrer</button>
              <button onClick={function() { setShareModal(null) }} style={{ padding: '14px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 14, cursor: 'pointer', fontFamily: 'Outfit' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {coachClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 150, overflow: 'auto' }}>
          <Programs onBack={function() { setCoachClient(null) }} coachMode={true} coachClientId={coachClient.id} coachClientName={coachClient.full_name || coachClient.email} coachId={profile.id} onEditingChange={setProgramsEditing} />
        </div>
      )}

      {/* BOTTOM NAV BAR */}
      {view === 'timer' && <div style={s.container}><Timer /></div>}

      {/* SUPER ADMIN */}
      {view === 'super-admin' && profile.is_super_admin && (function() {
        async function loadCoaches() {
          var { data: coaches } = await supabase.from('profiles').select('id, full_name, email, brand_name, subdomain, stripe_account_id, stripe_charges_enabled, coach_status, coach_plan, coach_registered_at, created_at').eq('is_admin', true).order('created_at', { ascending: false })
          setAllCoaches(coaches || [])
          // Load stats per coach
          var stats = {}
          for (var ci = 0; ci < (coaches || []).length; ci++) {
            var c = coaches[ci]
            var { count: clientCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('coach_id', c.id).eq('is_admin', false)
            var { count: bookingCount } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('coach_id', c.id).eq('status', 'confirmed')
            stats[c.id] = { clients: clientCount || 0, bookings: bookingCount || 0 }
          }
          setCoachStats(stats)
        }
        if (allCoaches.length === 0) loadCoaches()

        return (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}>
              <div style={s.viewTitle}>👑 Super Admin</div>
              <button onClick={loadCoaches} style={s.btnGold}>🔄</button>
            </div>

            {/* Platform stats */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={s.statMini}>
                <div style={s.statMiniValue}>{allCoaches.length}</div>
                <div style={s.statMiniLabel}>Coachs</div>
              </div>
              <div style={s.statMini}>
                <div style={s.statMiniValue}>{Object.values(coachStats).reduce(function(s, c) { return s + c.clients }, 0)}</div>
                <div style={s.statMiniLabel}>Clients total</div>
              </div>
              <div style={s.statMini}>
                <div style={s.statMiniValue}>{Object.values(coachStats).reduce(function(s, c) { return s + c.bookings }, 0)}</div>
                <div style={s.statMiniLabel}>Séances total</div>
              </div>
            </div>

            {/* Coaches list */}
            {allCoaches.map(function(c) {
              var st = coachStats[c.id] || { clients: 0, bookings: 0 }
              return (
                <div key={c.id} style={{ ...s.card, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{c.brand_name || c.full_name || c.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email}</div>
                      {c.subdomain && <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>🔗 {c.subdomain}.ydcoaching.fr</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {c.stripe_charges_enabled && <span title="Stripe actif" style={{ fontSize: 14 }}>💳</span>}
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: c.coach_status === 'suspended' ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)', color: c.coach_status === 'suspended' ? '#f87171' : '#4ade80', fontWeight: 600 }}>{c.coach_status === 'suspended' ? 'Suspendu' : 'Actif'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                    <span>👥 {st.clients} clients</span>
                    <span>📅 {st.bookings} séances</span>
                    <span>📋 {c.coach_plan || 'free'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select value={c.coach_status || 'active'} onChange={async function(e) { await supabase.from('profiles').update({ coach_status: e.target.value }).eq('id', c.id); loadCoaches() }} style={{ ...s.input, flex: 1, fontSize: 11 }}>
                      <option value="active">✅ Actif</option>
                      <option value="trial">⏳ Essai</option>
                      <option value="suspended">🚫 Suspendu</option>
                    </select>
                    <select value={c.coach_plan || 'free'} onChange={async function(e) { await supabase.from('profiles').update({ coach_plan: e.target.value }).eq('id', c.id); loadCoaches() }} style={{ ...s.input, flex: 1, fontSize: 11 }}>
                      <option value="free">🆓 Free</option>
                      <option value="pro">⭐ Pro</option>
                      <option value="enterprise">🏢 Enterprise</option>
                    </select>
                  </div>
                </div>
              )
            })}
            {allCoaches.length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Aucun coach inscrit</div>}
          </div>
        )
      })()}

      {!coachClient && <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', padding: '6px 0 env(safe-area-inset-bottom, 6px)', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}>
        <button onClick={function() { navigateTo('home') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: view === 'home' ? GOLD : 'var(--muted)', opacity: view === 'home' ? 1 : 0.6 }}><div style={{ fontSize: 20 }}>🏠</div><div style={{ fontSize: 9 }}>{t('nav.home')}</div></button>
        <button onClick={function() { navigateTo('book') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: (view === 'book') ? GOLD : 'var(--muted)', opacity: (view === 'book') ? 1 : 0.6 }}><div style={{ fontSize: 20 }}>📅</div><div style={{ fontSize: 9 }}>{t('nav.booking')}</div></button>
        <button onClick={function() { navigateTo('clients') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: (view === 'clients' || view === 'client-detail') ? GOLD : 'var(--muted)', opacity: (view === 'clients' || view === 'client-detail') ? 1 : 0.6 }}><div style={{ fontSize: 20 }}>👥</div><div style={{ fontSize: 9 }}>{t('nav.clients')}</div></button>
        <button onClick={function() { navigateTo('finance') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: view === 'finance' ? GOLD : 'var(--muted)', opacity: view === 'finance' ? 1 : 0.6 }}><div style={{ fontSize: 20 }}>💰</div><div style={{ fontSize: 9 }}>{t('nav.finance')}</div></button>
        <button onClick={function() { navigateTo('messaging') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: view === 'messaging' ? GOLD : 'var(--muted)', opacity: view === 'messaging' ? 1 : 0.6, position: 'relative' }}><div style={{ fontSize: 20 }}>💬</div><div style={{ fontSize: 9 }}>{t('nav.messages')}</div>{unreadCount > 0 && <div style={{ position: 'absolute', top: 2, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</div>}</button>
        <button onClick={function() { navigateTo('programs') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: view === 'programs' ? GOLD : 'var(--muted)', opacity: view === 'programs' ? 1 : 0.6 }}><div style={{ fontSize: 20 }}>🏋️</div><div style={{ fontSize: 9 }}>{t('nav.sport')}</div></button>
        {profile.is_super_admin && <button onClick={function() { navigateTo('super-admin') }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, padding: '6px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: view === 'super-admin' ? GOLD : 'var(--muted)', opacity: view === 'super-admin' ? 1 : 0.6 }}><div style={{ fontSize: 20 }}>👑</div><div style={{ fontSize: 9 }}>{t('nav.admin')}</div></button>}
      </div>}
      <div style={{ height: 70 }} />

      <style>{"@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } } @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } } @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } } @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } } .tile-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); } .tile-hover:active { transform: translateY(0); box-shadow: var(--shadow); } .tile-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; } @media (max-width: 600px) { .tiles-grid { grid-template-columns: repeat(2, 1fr) !important; } .stats-grid { grid-template-columns: repeat(2, 1fr) !important; } .clients-grid { grid-template-columns: 1fr !important; } }"}</style>

      {/* Pending navigation confirmation when Programs is editing */}
      {pendingNav && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
        <div style={{background:'var(--surface)',borderRadius:16,padding:24,maxWidth:380,width:'100%',border:'1px solid var(--border)'}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8,fontFamily:'Outfit'}}>⚠️ Programme en cours d'édition</div>
          <div style={{fontSize:13,color:'var(--muted)',marginBottom:20,lineHeight:1.5}}>Tu as un programme en cours de création. Si tu quittes maintenant, les modifications seront perdues.</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={function(){var dest=pendingNav;setPendingNav(null);setProgramsEditing(false);setView(dest)}} style={{padding:'12px 16px',background:'transparent',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)',borderRadius:10,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Outfit'}}>🚪 Quitter sans sauvegarder</button>
            <button onClick={function(){setPendingNav(null)}} style={{padding:'12px 16px',background:GOLD,color:'#000',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>← Retourner à l'éditeur</button>
          </div>
        </div>
      </div>}
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
  nav: { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' },
  navLogo: { fontFamily: 'Cormorant Garamond, serif', fontSize: 18 },
  btnNav: { background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
  container: { maxWidth: 900, margin: '0 auto', padding: '32px 20px' },
  tilesGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 },
  tile: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 20px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', textAlign: 'center', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxShadow: 'var(--shadow)' },
  tileIcon: { fontSize: 32, marginBottom: 4 },
  tileTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text)' },
  tileSub: { fontSize: 12, color: 'var(--muted)' },
  viewHeader: { marginBottom: 24 },
  viewTitle: { fontFamily: 'Cormorant Garamond, serif', fontSize: 26 },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', marginBottom: 16, boxShadow: 'var(--shadow)' },
  cardTitle: { fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#C4973A', marginBottom: 20 },
  bookingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 },
  clientCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px', boxShadow: 'var(--shadow)' },
  clientsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  btnWa: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 8, fontSize: 16, textDecoration: 'none', cursor: 'pointer', flexShrink: 0 },
  btnEdit: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.3)', borderRadius: 8, fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  btnDeleteSmall: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 8, fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  fieldLabel: { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 },
  input: { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit, sans-serif', width: '100%', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  btnGold: { background: '#C4973A', color: '#000', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(196,151,58,0.25)' },
  statMini: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', textAlign: 'center', boxShadow: 'var(--shadow)' },
  statMiniValue: { fontSize: 28, fontWeight: 600, fontFamily: 'Outfit, sans-serif', lineHeight: 1, marginBottom: 4 },
  statMiniLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' },
  btnDelete: { background: 'none', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' },
}
