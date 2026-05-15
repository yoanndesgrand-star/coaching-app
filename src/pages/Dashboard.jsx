import { useEffect, useState, useRef } from 'react'
import BookingCalendar from '../components/BookingCalendar'
import { useLang } from '../lib/i18n'
import AddressSetup from '../components/AddressSetup'
import WorkoutPlayer from '../components/WorkoutPlayer'
import CircuitPlayer from '../components/CircuitPlayer'
import Timer from '../components/Timer'
import WelcomeScreen from '../components/WelcomeScreen'
import PhotoGallery from '../components/PhotoGallery'
import { supabase } from '../lib/supabase'
import ProgressionChart from '../components/ProgressionChart'

const GOLD = '#C4973A'
const MODE_INFO = { circuit:{name:'Circuit',emoji:'🔄'}, tabata:{name:'Tabata',emoji:'⚡'}, amrap:{name:'AMRAP',emoji:'💀'}, fortime:{name:'For Time',emoji:'⏱️'}, emom:{name:'EMOM',emoji:'⏰'} }
var WHATSAPP_DEFAULT = 'https://wa.me/33687207855'
var GOOGLE_REVIEW_DEFAULT = 'https://www.google.com/maps/search/Yoann+Desgrand+coach+sportif+Paris'
const LOGO_URL = '/logo-yd.png'

const STRIPE = {
  seance_60:   'https://buy.stripe.com/28E5kCcMB9mWaR8d7M5Rm00',
  seance_50:   'https://buy.stripe.com/4gM6oG4g5dDc9N45Fk5Rm06',
  pack5_275:   'https://buy.stripe.com/4gM14m5k98iSbVcaZE5Rm01',
  pack5_250:   'https://buy.stripe.com/00waEWcMB9mW1gy5Fk5Rm07',
  pack10:      'https://buy.stripe.com/dRm9ASh2RgPo5wOaZE5Rm02',
  sport:       'https://buy.stripe.com/eVq14m13TdDc1gy0l05Rm03',
  nutrition:   'https://buy.stripe.com/fZu6oG8wlar0aR83xc5Rm04',
  sport_nutri: 'https://buy.stripe.com/00w6oGh2RdDc5wO2t85Rm05',
}

const SUBSCRIPTIONS = {
  presentiel:                 { label: 'Présentiel' },
  domicile:                   { label: 'Coaching à domicile' },
  sport_online:               { label: 'Sport en ligne' },
  nutrition:                  { label: 'Nutrition' },
  sport_nutrition:            { label: 'Sport + Nutrition' },
}

export default function Dashboard({ profile, setProfile, coachBrand }) {
  var { t } = useLang()
  var GOOGLE_REVIEW = (coachBrand && coachBrand.reviewUrl) || GOOGLE_REVIEW_DEFAULT
  var WHATSAPP = (coachBrand && coachBrand.whatsapp) ? 'https://wa.me/' + coachBrand.whatsapp.replace(/[^0-9]/g, '') : WHATSAPP_DEFAULT
  const [view, setView] = useState('home')
  const [viewAnim, setViewAnim] = useState('fadeIn 0.4s ease')
  const [tab, setTab] = useState('home')

  var [pendingDashNav, setPendingDashNav] = useState(null)
  function navigateTo(target) {
    // Intercept navigation when in free-session with exercises selected
    if (view === 'free-session' && freeExercises.length > 0 && target !== 'free-session') {
      setPendingDashNav({ target: target, type: 'free' })
      return
    }
    if (target === 'home') {
      setViewAnim('slideInLeft 0.35s ease')
    } else if (view === 'home') {
      setViewAnim('slideInRight 0.35s ease')
    } else {
      setViewAnim('scaleIn 0.3s ease')
    }
    setView(target)
  }

  function switchTab(newTab) {
    // Intercept when in free-session with exercises
    if (view === 'free-session' && freeExercises.length > 0) {
      setPendingDashNav({ target: newTab, type: 'tab' })
      return
    }
    if (newTab === tab) {
      // If clicking same tab, go to tab home
      setViewAnim('scaleIn 0.3s ease')
      setView(newTab === 'home' ? 'home' : newTab === 'sport' ? 'program' : 'settings')
      return
    }
    setTab(newTab)
    setViewAnim('fadeIn 0.3s ease')
    if (newTab === 'home') setView('home')
    else if (newTab === 'booking') setView('booking')
    else if (newTab === 'sport') setView('program')
    else if (newTab === 'progression') setView('progression')
    else if (newTab === 'timer') setView('timer')
    else if (newTab === 'settings') setView('settings')
  }
  const [bookings, setBookings] = useState([])
  const [msg, setMsg] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [editPhone, setEditPhone] = useState(profile.phone || '')
  const [editEmail, setEditEmail] = useState(profile.email || '')
  const [editAddress, setEditAddress] = useState(profile.address || '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [shopTab, setShopTab] = useState('seances')
  const [forcePw, setForcePw] = useState('')
  const [forceConfirmPw, setForceConfirmPw] = useState('')
  const [coachLocs, setCoachLocs] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [otherLocationText, setOtherLocationText] = useState('')
  const [gymMembershipConfirmed, setGymMembershipConfirmed] = useState(false)
  const [coachOffers, setCoachOffers] = useState([])
  const [cancelHours, setCancelHours] = useState(24)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [loyaltyConfig, setLoyaltyConfig] = useState(null)
  const [forcePwSaving, setForcePwSaving] = useState(false)
  const [forcePwError, setForcePwError] = useState('')
  const [theme, setThemeState] = useState(localStorage.getItem('theme') || 'dark')
  const [cropImage, setCropImage] = useState(null)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 })
  const [cropDragging, setCropDragging] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  const [notifEnabled, setNotifEnabled] = useState(localStorage.getItem('notif') === 'on')
  const [clientProgram, setClientProgram] = useState(null)
  const [clientPrograms, setClientPrograms] = useState([])
  const [workoutActive, setWorkoutActive] = useState(function() {
    try { var saved = localStorage.getItem('yd_workout_active'); return saved ? JSON.parse(saved) : false } catch(e) { return false }
  })
  const [freeExercises, setFreeExercises] = useState([])
  const [freeProgName, setFreeProgName] = useState('')
  const [freeSessName, setFreeSessName] = useState('')
  const [allExercises, setAllExercises] = useState([])
  const [freeSearch, setFreeSearch] = useState('')
  const [openFolder, setOpenFolder] = useState(null)
  const [videoFolders, setVideoFolders] = useState([])
  const [activeVideoFolder, setActiveVideoFolder] = useState(null)
  const [clientPRs, setClientPRs] = useState([])
  const [clientBadges, setClientBadges] = useState([])
  const [clientReschedule, setClientReschedule] = useState(null)
  const [rescheduleSlots, setRescheduleSlots] = useState([])
  const [rescheduleMonth, setRescheduleMonth] = useState(new Date().getMonth() + 1)
  const [rescheduleYear, setRescheduleYear] = useState(new Date().getFullYear())
  const [showChat, setShowChat] = useState(false)
  const [showWelcome, setShowWelcome] = useState(function() {
    try { return !localStorage.getItem('yd_welcome_shown') } catch(e) { return false }
  })
  const [referralCount, setReferralCount] = useState(0)
  const [waterCount, setWaterCount] = useState(function() { try { var w = localStorage.getItem('yd_water_' + new Date().toISOString().split('T')[0]); return w ? parseInt(w) || 0 : 0 } catch(e) { return 0 } })
  const [showBodyTracker, setShowBodyTracker] = useState(false)
  const [bodyMeasures, setBodyMeasures] = useState({})
  useEffect(function() { try { localStorage.setItem('yd_water_' + new Date().toISOString().split('T')[0], String(waterCount)) } catch(e) {} }, [waterCount])
  const [driveFolders, setDriveFolders2] = useState([])
  const [activeDriveFolder, setActiveDriveFolder] = useState(null)
  const [clientPhotos, setClientPhotos] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Online/offline detection + sync
  useEffect(function() {
    function goOnline() { setIsOnline(true); syncOfflineWorkouts() }
    function goOffline() { setIsOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    // Try sync on load
    syncOfflineWorkouts()
    return function() { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline) }
  }, [])

  async function syncOfflineWorkouts() {
    try {
      var queue = localStorage.getItem('yd_offline_workouts')
      if (!queue) return
      var workouts = JSON.parse(queue)
      if (!workouts.length) return
      var synced = 0
      for (var i = 0; i < workouts.length; i++) {
        var w = workouts[i]
        try {
          var { data: log } = await supabase.from('workout_logs').insert({ client_id: w.client_id, program_id: w.program_id, duration_minutes: w.duration, completed_at: w.completed_at, emoji: w.emoji, comment: w.comment }).select().single()
          if (log && w.sets && w.sets.length > 0) {
            await supabase.from('workout_sets').insert(w.sets.map(function(s) { return Object.assign({}, s, { workout_log_id: log.id }) }))
          }
          synced++
        } catch(e) {}
      }
      localStorage.removeItem('yd_offline_workouts')
      if (synced > 0) setMsg({ type: 'success', text: '✅ ' + synced + ' séance' + (synced > 1 ? 's' : '') + ' synchronisée' + (synced > 1 ? 's' : '') + ' !' })
    } catch(e) {}
  }
  const showChatRef = useState({ current: false })[0]
  const [chatMsgs, setChatMsgs] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatConvoId, setChatConvoId] = useState(null)
  const [chatFile, setChatFile] = useState(null)
  const [chatSending, setChatSending] = useState(false)
  const [chatUnread, setChatUnread] = useState(0)
  const chatChannelRef = useState({ current: null })[0]
  const [timerMode, setTimerMode] = useState('tabata')
  const [timerConfig, setTimerConfig] = useState({ work: 40, rest: 20, rounds: 8, totalMin: 10, emomInterval: 60 })
  const [timerActive, setTimerActive] = useState(false)
  const [timerSec, setTimerSec] = useState(0)
  const [timerRound, setTimerRound] = useState(0)
  const [timerPhase, setTimerPhase] = useState('work')
  const [timerRef2] = useState({ current: null })
  const dashAudioCtx = useState({ current: null })[0]

  // iOS audio unlock — force "media" mode to bypass silent switch
  function unlockiOSAudio() {
    try {
      if (!dashAudioCtx.current) dashAudioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      dashAudioCtx.current.resume()
      // Play silent buffer to switch iOS to media playback mode
      var buf = dashAudioCtx.current.createBuffer(1, 1, 22050)
      var src = dashAudioCtx.current.createBufferSource()
      src.buffer = buf; src.connect(dashAudioCtx.current.destination); src.start(0)
    } catch(e) {}
  }

  function dashPlayBeep(freq) {
    try {
      if (!dashAudioCtx.current) dashAudioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
      var ctx = dashAudioCtx.current; ctx.resume()
      for (var i = 0; i < 3; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = [880, 988, 1047][i]
        g.gain.value = 0.8
        o.start(ctx.currentTime + i * 0.2)
        o.stop(ctx.currentTime + i * 0.2 + 0.15)
      }
    } catch(e) {}
  }

  async function startClientReschedule(booking) {
    setClientReschedule(booking)
    var m = new Date().getMonth() + 1, y = new Date().getFullYear()
    setRescheduleMonth(m); setRescheduleYear(y)
    var res = await fetch('/api/available-slots?year=' + y + '&month=' + m + '&clientId=' + profile.id)
    setRescheduleSlots((await res.json()).slots || [])
  }

  async function loadClientRescheduleSlots(m, y) {
    setRescheduleMonth(m); setRescheduleYear(y)
    var res = await fetch('/api/available-slots?year=' + y + '&month=' + m + '&clientId=' + profile.id)
    setRescheduleSlots((await res.json()).slots || [])
  }

  async function confirmClientReschedule(slot) {
    if (!clientReschedule) return
    try {
      var res = await fetch('/api/admin-actions?action=reschedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: clientReschedule.id, newStartTime: slot.start, newEndTime: slot.end })
      })
      var data = await res.json()
      if (data.success) setMsg({ type: 'success', text: 'Séance décalée !' })
      else setMsg({ type: 'error', text: data.error || 'Erreur' })
    } catch (e) { setMsg({ type: 'error', text: 'Erreur' }) }
    setClientReschedule(null)
    loadBookings()
  }

  function setTheme(t) {
    setThemeState(t)
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light')
    else document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('theme', t)
  }

  const sub = SUBSCRIPTIONS[profile.subscription_type] || SUBSCRIPTIONS[profile.coaching_type] || null

  useEffect(function() { loadBookings(); loadExercises(); loadClientVideos(); loadProgram(); loadPRsAndBadges(); checkReminders(); loadChat(); loadCoachLocations(); loadCoachOffers()
    // Load referral count
    supabase.from('referrals').select('id', { count: 'exact' }).eq('referrer_id', profile.id).then(function(r) { setReferralCount(r.data ? r.data.length : 0) }).catch(function(){})
    // Load photos
    supabase.from('client_photos').select('*').eq('client_id', profile.id).order('taken_at').then(function(r) { setClientPhotos(r.data || []) }).catch(function(){})
    // Load drive (only folders shared with this client)
    supabase.from('drive_folder_shares').select('folder_id').eq('client_id', profile.id).then(function(r) {
      var sharedIds = (r.data || []).map(function(s) { return s.folder_id })
      if (sharedIds.length === 0) { setDriveFolders2([]); return }
      supabase.from('drive_folders').select('*').in('id', sharedIds).order('order_index').then(function(r2) {
        var folders = r2.data || []
        supabase.from('drive_files').select('*').order('created_at', { ascending: false }).then(function(r3) {
          var allFiles = r3.data || []
          folders.forEach(function(f) { f.files = allFiles.filter(function(fi) { return fi.folder_id === f.id }) })
          setDriveFolders2(folders.filter(function(f) { return f.files.length > 0 }))
        })
      })
    }).catch(function(){})
  }, [])

  // Persist workout state across reloads
  useEffect(function() {
    try {
      if (workoutActive) localStorage.setItem('yd_workout_active', JSON.stringify(workoutActive))
      else localStorage.removeItem('yd_workout_active')
    } catch(e) {}
  }, [workoutActive])

  async function loadChat() {
    try {
      var res = await supabase.from('conversations').select('id').eq('client_id', profile.id).single()
      if (res.data) {
        var convoId = res.data.id
        setChatConvoId(convoId)
        var msgs = await supabase.from('messages').select('*, profiles:sender_id(full_name, is_admin)').eq('conversation_id', convoId).order('created_at', { ascending: true })
        setChatMsgs(msgs.data || [])
        // Count unread
        var unread = (msgs.data || []).filter(function(m) { return !m.read_at && m.sender_id !== profile.id }).length
        // Only set unread if chat is closed
        if (!showChatRef.current) {
          setChatUnread(unread)
        } else if (unread > 0) {
          // Chat is open, mark as read
          await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', convoId).is('read_at', null).neq('sender_id', profile.id)
          setChatUnread(0)
        }
        // Real-time — remove old subscription first
        if (chatChannelRef.current) {
          supabase.removeChannel(chatChannelRef.current)
        }
        var channel = supabase.channel('client-msg-' + convoId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convoId }, function(payload) {
          if (payload.new.sender_id === profile.id) return
          setChatMsgs(function(prev) { return prev.concat([payload.new]) })
          if (!showChatRef.current) setChatUnread(function(n) { return n + 1 })
          else supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id)
        }).subscribe()
        chatChannelRef.current = channel
      }
    } catch(e) {}
  }

  async function sendChatMsg() {
    if (!chatInput.trim() && !chatFile) return
    setChatSending(true)
    var convoId = chatConvoId
    if (!convoId) {
      var res = await supabase.from('conversations').insert({ client_id: profile.id }).select().single()
      if (res.data) { convoId = res.data.id; setChatConvoId(convoId) }
    }
    if (!convoId) { setChatSending(false); return }
    var fileUrl = null; var fileName = null; var type = 'text'
    if (chatFile) {
      var ext = chatFile.name.split('.').pop()
      var path = 'messages/' + convoId + '/' + Date.now() + '.' + ext
      var up = await supabase.storage.from('uploads').upload(path, chatFile)
      if (up.data) { var pub = supabase.storage.from('uploads').getPublicUrl(path); fileUrl = pub.data.publicUrl; fileName = chatFile.name; type = chatFile.type.includes('pdf') ? 'pdf' : 'image' }
    }
    await supabase.from('messages').insert({ conversation_id: convoId, sender_id: profile.id, content: chatInput.trim() || null, type: type, file_url: fileUrl, file_name: fileName })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convoId)
    setChatInput(''); setChatFile(null); loadChat()
    setChatSending(false)
  }

  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    setInterval(function() {
      var now = new Date()
      bookings.forEach(function(b) {
        if (!b.time_slots || b.status !== 'confirmed') return
        var start = new Date(b.time_slots.start_time)
        var diff = (start - now) / 60000
        if (diff > 55 && diff < 65) {
          new Notification('🏋️ Séance dans 1h !', { body: 'Prépare-toi, ta séance est à ' + start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), icon: '/favicon.svg', tag: 'reminder-' + b.id })
        }
      })
    }, 60000)
  }

  async function loadPRsAndBadges() {
    var pr = await supabase.from('personal_records').select('*, exercises(name, muscle_group)').eq('client_id', profile.id).order('weight_kg', { ascending: false })
    setClientPRs(pr.data || [])
    var bg = await supabase.from('badges').select('*').eq('client_id', profile.id).order('achieved_at')
    setClientBadges(bg.data || [])
  }

  async function loadExercises() {
    try {
      var r = await supabase.from('exercises').select('*').order('muscle_group').order('name').limit(5000)
      setAllExercises(r.data || [])
      try { localStorage.setItem('offline_exercises', JSON.stringify(r.data || [])) } catch(e) {}
    } catch(e) {
      try { var cached = localStorage.getItem('offline_exercises'); if (cached) setAllExercises(JSON.parse(cached)) } catch(e2) {}
    }
  }

  async function loadClientVideos() {
    var cid = profile.coach_id || profile.id
    var r = await supabase.from('video_folders').select('*').eq('coach_id', cid).order('order_index')
    var vr = await supabase.from('videos').select('*').eq('coach_id', cid).order('order_index')
    var folders = r.data || []
    var allVids = vr.data || []
    folders.forEach(function(f) { f.videos = allVids.filter(function(v) { return v.folder_id === f.id }) })
    setVideoFolders(folders.filter(function(f) { return f.videos.length > 0 }))
  }

  function getYtId(url) { if(!url)return null; var m=url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m?m[1]:null }

  async function loadProgram() {
    try {
      var { data: cps } = await supabase.from('client_programs').select('*, programs(*)').eq('client_id', profile.id)
      var allProgs = []
      if (cps) {
        var allPE = []; var allEx = []; var allSess = []
        try {
          var r1 = await supabase.from('program_sessions').select('*').order('order_index')
          var r2 = await supabase.from('program_exercises').select('*').order('order_index')
          var r3 = await supabase.from('exercises').select('*')
          allSess = r1.data || []; allPE = r2.data || []; allEx = r3.data || []
        } catch(e) {}
        var exMap = {}
        allEx.forEach(function(e) { exMap[e.id] = e })
        for (var ci = 0; ci < cps.length; ci++) {
          var cp = cps[ci]
          if (cp && cp.programs) {
            cp.programs.program_sessions = allSess.filter(function(s) { return s.program_id === cp.programs.id }).map(function(s) {
              s.program_exercises = allPE.filter(function(pe) { return pe.session_id === s.id }).map(function(pe) { pe.exercises = exMap[pe.exercise_id] || null; return pe })
              return s
            })
            allProgs.push(cp)
          }
        }
      }
      setClientPrograms(allProgs)
      setClientProgram(allProgs[0] || null)
      // Cache for offline
      try { localStorage.setItem('offline_programs', JSON.stringify(allProgs)) } catch(e) {}
    } catch (e) {
      console.log('loadProgram error:', e)
      // Try offline cache
      try {
        var cached = localStorage.getItem('offline_programs')
        if (cached) {
          var progs = JSON.parse(cached)
          setClientPrograms(progs)
          setClientProgram(progs[0] || null)
        }
      } catch(e2) {}
    }
  }

  useEffect(function() {
    if (!notifEnabled || !('Notification' in window)) return
    function checkNotifications() {
      var now = new Date()
      bookings.forEach(function(b) {
        if (!b.time_slots || b.status !== 'confirmed') return
        var start = new Date(b.time_slots.start_time)
        var diff = (start - now) / 3600000
        if (diff > 0 && diff <= 2) {
          var notifKey = 'notif_sent_' + b.id
          if (localStorage.getItem(notifKey)) return
          localStorage.setItem(notifKey, '1')
          new Notification('🏋️ Séance dans ' + Math.round(diff * 60) + ' min', {
            body: formatDate(b.time_slots.start_time) + ' à ' + formatTime(b.time_slots.start_time),
            icon: '/icon-192.png',
            badge: '/icon-192.png'
          })
        }
      })
    }
    checkNotifications()
    var interval = setInterval(checkNotifications, 5 * 60 * 1000)
    return function() { clearInterval(interval) }
  }, [bookings, notifEnabled])

  async function loadCoachLocations() {
    var cid = profile.coach_id || profile.id
    var { data } = await supabase.from('coach_locations').select('*').eq('coach_id', cid).eq('is_active', true).order('created_at')
    setCoachLocs(data || [])
    if (data && data.length > 0 && !selectedLocation) setSelectedLocation(data[0].name + ' - ' + data[0].address)
  }

  async function loadCoachOffers() {
    var cid = profile.coach_id || profile.id
    var { data } = await supabase.from('coach_offers').select('*').eq('coach_id', cid).eq('is_active', true).order('sort_order')
    setCoachOffers(data || [])
    // Load cancellation policy + loyalty
    try {
      var { data: cs } = await supabase.from('coaching_settings').select('*').eq('coach_id', cid).single()
      if (cs) {
        if (cs.cancellation_hours) setCancelHours(cs.cancellation_hours)
        if (cs.loyalty_enabled) {
          var milestones = cs.loyalty_milestones
          if (typeof milestones === 'string') try { milestones = JSON.parse(milestones) } catch(e) { milestones = [] }
          setLoyaltyConfig({ enabled: true, milestones: milestones || [] })
        }
      }
    } catch(e) {}
  }

  async function loadBookings() {
    var { data } = await supabase.from('bookings').select('*, time_slots(*)').eq('client_id', profile.id).eq('status', 'confirmed').order('created_at', { ascending: false })
    setBookings(data || [])

    // Check loyalty milestones - auto-add credits
    if (loyaltyConfig && loyaltyConfig.enabled && data) {
      var pastCount = (data || []).filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) < new Date() }).length
      var claimed = JSON.parse(localStorage.getItem('loyalty_claimed_' + profile.id) || '[]')
      var milestones = loyaltyConfig.milestones || []
      milestones.forEach(function(m) {
        if (pastCount >= m.sessions && claimed.indexOf(m.sessions) === -1) {
          // Milestone reached! Add credits
          supabase.from('profiles').update({ credits: (profile.credits || 0) + m.reward }).eq('id', profile.id)
          setProfile(function(p) { return Object.assign({}, p, { credits: (p.credits || 0) + m.reward }) })
          claimed.push(m.sessions)
          localStorage.setItem('loyalty_claimed_' + profile.id, JSON.stringify(claimed))
          setMsg({ type: 'success', text: '🏆 Palier ' + m.sessions + ' séances atteint ! ' + (m.label || '+' + m.reward + ' crédit' + (m.reward > 1 ? 's' : '')) })
        }
      })
    }
  }

  async function cancelBooking(booking) {
    if (!booking.time_slots) return
    var hoursUntil = (new Date(booking.time_slots.start_time) - new Date()) / 3600000
    if (hoursUntil < cancelHours) { setMsg({ type: 'error', text: 'Annulation impossible moins de ' + cancelHours + 'h avant la séance.' }); return }
    setCancelling(booking.id)
    try {
      var res = await fetch('/api/admin-actions?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id })
      })
      var data = await res.json()
      if (data.success) {
        setProfile(function(p) { return Object.assign({}, p, { credits: (p.credits || 0) + 1 }) })
        setMsg({ type: 'success', text: 'Séance annulée, crédit restitué.' })
        loadBookings()
      } else {
        setMsg({ type: 'error', text: data.error || 'Erreur' })
      }
    } catch (e) { setMsg({ type: 'error', text: 'Erreur de connexion' }) }
    setCancelling(null)
  }

  var nextBooking = bookings.filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) > new Date() }).sort(function(a, b) { return new Date(a.time_slots.start_time) - new Date(b.time_slots.start_time) })[0]
  var upcomingBookings = bookings.filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) > new Date() })
  var pastBookings = bookings.filter(function(b) { return b.time_slots && new Date(b.time_slots.start_time) < new Date() })
  var locationLabel = profile.coaching_type === 'domicile' ? 'À domicile' : (coachLocs.length > 0 ? coachLocs[0].name : 'En salle')
  var firstName = (profile.full_name || '').split(' ')[0] || ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'min(65vw, 65vh)', height: 'min(65vw, 65vh)', backgroundImage: 'url(' + LOGO_URL + ')', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', opacity: 0.06, pointerEvents: 'none', zIndex: 0 }} />

      {!profile.address && (profile.coaching_type === 'domicile' || profile.coaching_type === 'presentiel') && (
        <AddressSetup profile={profile} onComplete={function() { setProfile(function(p) { return Object.assign({}, p, { address: 'set' }) }) }} />
      )}

      {/* CHANGEMENT MOT DE PASSE OBLIGATOIRE */}
      {profile.must_change_password && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 32px', maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, marginBottom: 8 }}>Bienvenue !</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.6 }}>Pour sécuriser ton compte, choisis un nouveau mot de passe.</div>
            {forcePwError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 12, padding: '10px', background: 'rgba(248,113,113,0.1)', borderRadius: 8 }}>{forcePwError}</div>}
            <div style={{ marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Nouveau mot de passe</div>
              <input type="password" value={forcePw} onChange={function(e) { setForcePw(e.target.value) }} placeholder="6 caractères minimum" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Confirmer</div>
              <input type="password" value={forceConfirmPw} onChange={function(e) { setForceConfirmPw(e.target.value) }} placeholder="Confirmer le mot de passe" style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'var(--text)', fontSize: 14, fontFamily: 'Outfit, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={async function() {
              setForcePwError('')
              if (forcePw.length < 6) { setForcePwError('Le mot de passe doit faire au moins 6 caractères.'); return }
              if (forcePw !== forceConfirmPw) { setForcePwError('Les mots de passe ne correspondent pas.'); return }
              setForcePwSaving(true)
              var res = await supabase.auth.updateUser({ password: forcePw })
              if (res.error) { setForcePwError(res.error.message); setForcePwSaving(false); return }
              await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id)
              setProfile(function(p) { return Object.assign({}, p, { must_change_password: false }) })
              setForcePwSaving(false)
            }} disabled={forcePwSaving} style={{ width: '100%', background: GOLD, color: '#000', border: 'none', borderRadius: 8, padding: '14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
              {forcePwSaving ? 'Enregistrement...' : 'Valider mon nouveau mot de passe'}
            </button>
          </div>
        </div>
      )}

      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18 }}>{coachBrand && coachBrand.logo && <img src={coachBrand.logo} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', marginRight: 8, verticalAlign: 'middle' }} />}{coachBrand ? coachBrand.name.split(' ').map(function(w, i, a) { return i === a.length - 1 ? <span key={i} style={{ color: coachBrand.color }}>{w}</span> : w + ' ' }) : 'Coach'}</div>
        <button onClick={async function() { 
          // Save coach slug for redirect
          var coachId = profile.coach_id
          var slug = null
          if (coachId) {
            var { data: coach } = await supabase.from('profiles').select('subdomain').eq('id', coachId).single()
            if (coach && coach.subdomain) slug = coach.subdomain
          }
          await supabase.auth.signOut()
          if (slug) { window.location.href = '/page/' + slug } else { window.location.href = '/' }
        }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'Outfit' }}>Déconnexion</button>
      </nav>

      {msg && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 8, border: '1px solid', fontSize: 13, borderColor: msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)', background: msg.type === 'success' ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)', color: msg.type === 'success' ? '#4ade80' : '#f87171' }}>
            <span>{msg.text}</span>
            <button onClick={function() { setMsg(null) }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        </div>
      )}

      <div style={s.container}>

        {view === 'home' && (
          <div style={{ animation: viewAnim }}>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', marginBottom: 10 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, color: '#000', margin: '0 auto 10px' }}>
                  {(profile.full_name || '?').split(' ').map(function(n) { return n[0] || '' }).join('').toUpperCase().slice(0, 2)}
                </div>
              )}
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, marginBottom: 4 }}>
                {firstName ? ('Bonjour ' + firstName) : 'Bienvenue'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{profile.credits || 0} crédit{(profile.credits || 0) !== 1 ? 's' : ''} · {sub ? sub.label : 'Aucun abonnement'}</div>
            </div>

            {nextBooking && (
              <div style={s.nextCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={s.nextDate}>
                    <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{new Date(nextBooking.time_slots.start_time).getDate()}</div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)' }}>{['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][new Date(nextBooking.time_slots.start_time).getMonth()]}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{formatTime(nextBooking.time_slots.start_time)} — {locationLabel}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{formatDate(nextBooking.time_slots.start_time)}</div>
                  </div>
                </div>
                {(new Date(nextBooking.time_slots.start_time) - new Date()) / 3600000 >= 24 ? (
                  <button onClick={function() { cancelBooking(nextBooking) }} disabled={cancelling === nextBooking.id} style={s.btnCancel}>{cancelling === nextBooking.id ? '...' : 'Annuler'}</button>
                ) : (
                  <a href={WHATSAPP + '?text=' + encodeURIComponent('Bonjour Yoann, je ne pourrai pas être présent(e) à ma séance du ' + formatDate(nextBooking.time_slots.start_time) + '. Raison : ')} target="_blank" style={{ textDecoration: 'none' }}><button style={s.btnCancel}>Contacter</button></a>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <button onClick={function() { navigateTo('booking') }} className="tile-hover" style={{ ...s.tile, padding: '18px 14px' }}>
                <div style={{ fontSize: 22 }}>📅</div><div style={{ fontSize: 13, fontWeight: 500 }}>Réserver</div>
              </button>
              {clientProgram ? (
                <button onClick={function() { switchTab('sport') }} className="tile-hover" style={{ ...s.tile, padding: '18px 14px' }}>
                  <div style={{ fontSize: 22 }}>🏋️</div><div style={{ fontSize: 13, fontWeight: 500 }}>Sport</div>
                </button>
              ) : (
                <button onClick={function() { navigateTo('shop') }} className="tile-hover" style={{ ...s.tile, padding: '18px 14px' }}>
                  <div style={{ fontSize: 22 }}>🛒</div><div style={{ fontSize: 13, fontWeight: 500 }}>Acheter</div>
                </button>
              )}
              <button onClick={function() { switchTab('progression') }} className="tile-hover" style={{ ...s.tile, padding: '18px 14px' }}>
                <div style={{ fontSize: 22 }}>👤</div><div style={{ fontSize: 13, fontWeight: 500 }}>Mon profil</div>
              </button>
              <a href={WHATSAPP + '?text=Bonjour%20Yoann%2C%20j%27ai%20une%20question.'} target="_blank" className="tile-hover" style={{ ...s.tile, textDecoration: 'none', color: 'var(--text)', padding: '18px 14px' }}>
                <div style={{ fontSize: 22 }}>💬</div><div style={{ fontSize: 13, fontWeight: 500 }}>Contact</div>
              </a>
            </div>
            {clientProgram && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <button onClick={function() { navigateTo('shop') }} className="tile-hover" style={{ ...s.tile, padding: '14px' }}>
                <div style={{ fontSize: 20 }}>🛒</div><div style={{ fontSize: 12, fontWeight: 500 }}>Acheter</div>
              </button>
              {driveFolders.length > 0 ? (
                <button onClick={function() { navigateTo('drive') }} className="tile-hover" style={{ ...s.tile, padding: '14px' }}>
                  <div style={{ fontSize: 20 }}>📁</div><div style={{ fontSize: 12, fontWeight: 500 }}>Drive</div>
                </button>
              ) : (
                <a href={GOOGLE_REVIEW} target="_blank" className="tile-hover" style={{ ...s.tile, textDecoration: 'none', color: 'var(--text)', padding: '14px' }}>
                  <div style={{ fontSize: 20 }}>⭐</div><div style={{ fontSize: 12, fontWeight: 500 }}>Avis</div>
                </a>
              )}
            </div>}

            {pastBookings.length >= 3 && (
              <div style={{ background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 12, padding: '14px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Tu apprécies ton coaching ? ⭐</div>
                <a href={GOOGLE_REVIEW} target="_blank" style={{ color: GOLD, fontSize: 12 }}>Laisse un avis Google →</a>
              </div>
            )}

            {/* FIDÉLITÉ (configurable par le coach) */}
            {loyaltyConfig && loyaltyConfig.enabled && pastBookings.length > 0 && (function() {
              var total = pastBookings.length
              var milestones = loyaltyConfig.milestones || []
              var next = milestones.find(function(m) { return total < m.sessions })
              if (!next) return null
              var pct = Math.round(total / next.sessions * 100)
              return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>🏆 Fidélité</div>
                  <div style={{ fontSize: 11, color: GOLD }}>{total} séance{total > 1 ? 's' : ''}</div>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: GOLD, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Encore {next.sessions - total} séance{next.sessions - total > 1 ? 's' : ''} → {next.label || ('+' + next.reward + ' crédit' + (next.reward > 1 ? 's' : ''))}</div>
              </div>
            })()}

            {/* PARRAINAGE */}
            {profile.referral_code && <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>🤝 Parrainage</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>Invite un ami ! Il s'inscrit avec ton lien et tu gagnes <strong style={{ color: GOLD }}>1 crédit offert</strong>.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: GOLD, letterSpacing: '0.1em', textAlign: 'center' }}>{profile.referral_code}</div>
                <button onClick={function() {
                  var url = 'https://app.yoanndesgrand.fr/login?ref=' + profile.referral_code
                  if (navigator.share) { navigator.share({ title: 'Coaching Yoann Desgrand', text: 'Inscris-toi avec mon lien et on gagne tous les deux !', url: url }) }
                  else { navigator.clipboard.writeText(url).then(function() { setMsg({ type: 'success', text: 'Lien copié !' }) }) }
                }} style={{ padding: '10px 14px', background: GOLD, color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', whiteSpace: 'nowrap' }}>📤 Partager</button>
              </div>
              {referralCount > 0 && <div style={{ fontSize: 11, color: '#4ade80' }}>✅ {referralCount} filleul{referralCount > 1 ? 's' : ''} inscrit{referralCount > 1 ? 's' : ''}</div>}
            </div>}

            {/* Water Tracker - DISABLED FOR DEBUG */}

            {/* Body Tracker - DISABLED FOR DEBUG */}

            {/* Social Links - TODO: réactiver */}

            {/* Water Tracker */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>💧 Hydratation</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{waterCount}/8 verres</div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {Array.from({length: 8}).map(function(_, i) {
                  return <button key={i} onClick={function() { setWaterCount(i + 1) }} style={{ flex: 1, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', background: i < waterCount ? 'rgba(96,165,250,0.25)' : 'rgba(96,165,250,0.05)', transition: 'all 0.2s' }}>
                    <span style={{ fontSize: 14, opacity: i < waterCount ? 1 : 0.2 }}>💧</span>
                  </button>
                })}
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (waterCount / 8 * 100) + '%', background: 'linear-gradient(90deg, #60a5fa, #3b82f6)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Body Tracker */}
            {!showBodyTracker ? (
              <button onClick={function() { setShowBodyTracker(true) }} style={{ display: 'block', width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, cursor: 'pointer', fontFamily: 'Outfit', textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>📏 Mensurations</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Suivre ma progression corporelle</div>
              </button>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>📏 Mensurations</div>
                  <button onClick={function() { setShowBodyTracker(false) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[{key:'weight',label:'Poids (kg)',icon:'⚖️'},{key:'waist',label:'Tour de taille (cm)',icon:'📐'},{key:'hips',label:'Hanches (cm)',icon:'🍑'},{key:'chest',label:'Poitrine (cm)',icon:'💪'},{key:'arms',label:'Bras (cm)',icon:'💪'},{key:'thighs',label:'Cuisses (cm)',icon:'🦵'}].map(function(f) {
                    return <div key={f.key}>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{f.icon + ' ' + f.label}</div>
                      <input inputMode="decimal" value={bodyMeasures[f.key] || ''} onChange={function(e) { setBodyMeasures(function(b) { var n = {}; for (var k in b) n[k] = b[k]; n[f.key] = e.target.value; return n }) }} placeholder="—" style={{ width: '100%', padding: '8px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  })}
                </div>
                <button onClick={async function() {
                  var entry = { date: new Date().toISOString().split('T')[0], client_id: profile.id, weight: bodyMeasures.weight || null, waist: bodyMeasures.waist || null, hips: bodyMeasures.hips || null, chest: bodyMeasures.chest || null, arms: bodyMeasures.arms || null, thighs: bodyMeasures.thighs || null }
                  await supabase.from('body_measurements').insert(entry)
                  setMsg({ type: 'success', text: '📏 Mensurations enregistrées !' })
                  setShowBodyTracker(false)
                  setBodyMeasures({})
                }} style={{ width: '100%', padding: '10px', marginTop: 10, background: GOLD, color: '#000', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>💾 Enregistrer</button>
              </div>
            )}

            {/* Social Links */}
            {coachBrand && coachBrand.socialLinks && typeof coachBrand.socialLinks === 'object' && (function() {
              var sl = coachBrand.socialLinks
              var nets = {instagram:{logo:'https://cdn.simpleicons.org/instagram/E4405F',name:'Instagram',bg:'linear-gradient(135deg,rgba(131,58,180,0.1),rgba(253,29,29,0.1),rgba(252,176,69,0.1))',border:'rgba(131,58,180,0.2)'},facebook:{logo:'https://cdn.simpleicons.org/facebook/1877F2',name:'Facebook',bg:'rgba(24,119,242,0.06)',border:'rgba(24,119,242,0.2)'},tiktok:{logo:'https://cdn.simpleicons.org/tiktok',name:'TikTok',bg:'rgba(0,0,0,0.04)',border:'rgba(0,0,0,0.15)'},youtube:{logo:'https://cdn.simpleicons.org/youtube/FF0000',name:'YouTube',bg:'rgba(255,0,0,0.04)',border:'rgba(255,0,0,0.15)'},linkedin:{logo:'https://cdn.simpleicons.org/linkedin/0A66C2',name:'LinkedIn',bg:'rgba(0,119,181,0.06)',border:'rgba(0,119,181,0.2)'},twitter:{logo:'https://cdn.simpleicons.org/x',name:'X',bg:'rgba(0,0,0,0.04)',border:'rgba(0,0,0,0.15)'},snapchat:{logo:'https://cdn.simpleicons.org/snapchat/FFFC00',name:'Snapchat',bg:'rgba(255,252,0,0.06)',border:'rgba(255,252,0,0.3)'},strava:{logo:'https://cdn.simpleicons.org/strava/FC4C02',name:'Strava',bg:'rgba(252,76,2,0.06)',border:'rgba(252,76,2,0.2)'},website:{logo:'',name:'Site web',bg:'rgba(196,151,58,0.06)',border:'rgba(196,151,58,0.2)'}}
              var active = Object.keys(sl).filter(function(k) { return sl[k] && typeof sl[k] === 'string' })
              var hasReview = coachBrand.reviewUrl
              if (active.length === 0 && !hasReview) return null
              return <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 16px',marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>🔗 Restons connectés</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {active.map(function(k) { var n = nets[k] || {logo:'',name:k,bg:'rgba(196,151,58,0.06)',border:'rgba(196,151,58,0.2)'}; return <a key={k} href={String(sl[k])} target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:n.bg,border:'1px solid '+n.border,borderRadius:10,textDecoration:'none',flex:1,minWidth:130,justifyContent:'center'}}>{n.logo ? <img src={n.logo} style={{width:20,height:20}} /> : <span style={{fontSize:18}}>🌐</span>}<span style={{fontSize:12,fontWeight:500,color:'var(--text)'}}>{n.name}</span></a> })}
                  {hasReview && <a href={String(coachBrand.reviewUrl)} target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'rgba(251,191,36,0.06)',border:'1px solid rgba(251,191,36,0.2)',borderRadius:10,textDecoration:'none',flex:1,minWidth:130,justifyContent:'center'}}><span style={{fontSize:18}}>⭐</span><span style={{fontSize:12,fontWeight:500,color:'var(--text)'}}>Laisser un avis</span></a>}
                </div>
              </div>
            })()}
          </div>
        )}

        {view === 'booking' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}>
              <button onClick={function(){switchTab('home')}} style={{background:'none',border:'none',color:GOLD,fontSize:13,cursor:'pointer',fontFamily:'Outfit',padding:'4px 0'}}>← Accueil</button>
              <div style={s.viewTitle}>Réserver une séance</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{profile.credits || 0} crédit{(profile.credits || 0) > 1 ? 's' : ''} disponible{(profile.credits || 0) > 1 ? 's' : ''}</div>
            </div>
            {(profile.credits || 0) > 0 || profile.no_credit_required ? (
              <div>
                {/* Location selector */}
                {profile.coaching_type !== 'domicile' && coachLocs.length > 0 && (
                  <div style={{ marginBottom: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', boxShadow: 'var(--shadow)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>📍 Lieu de la séance</div>
                    {coachLocs.map(function(loc) {
                      var sel = selectedLocation === loc.name + ' - ' + loc.address
                      return <button key={loc.id} onClick={function() { setSelectedLocation(loc.name + ' - ' + loc.address); setGymMembershipConfirmed(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: '1px solid', borderColor: sel ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: sel ? 'rgba(196,151,58,0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'Outfit', marginBottom: 4, transition: 'all 0.2s' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: sel ? '#C4973A' : 'var(--text)' }}>{loc.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{loc.address}</div>
                      </button>
                    })}
                    {selectedLocation && selectedLocation !== 'other' && (
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: '12px 14px', background: gymMembershipConfirmed ? 'rgba(74,222,128,0.06)' : 'rgba(196,151,58,0.04)', border: '1px solid', borderColor: gymMembershipConfirmed ? 'rgba(74,222,128,0.3)' : 'rgba(196,151,58,0.2)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}>
                        <input type="checkbox" checked={gymMembershipConfirmed} onChange={function(e) { setGymMembershipConfirmed(e.target.checked) }} style={{ accentColor: '#4ade80', width: 18, height: 18, marginTop: 2, flexShrink: 0 }} />
                        <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>Je confirme bénéficier d'un abonnement actif à <strong style={{ color: GOLD }}>{selectedLocation.split(' - ')[0]}</strong> me permettant d'accéder à la salle pour mes séances de coaching.</div>
                      </label>
                    )}
                    <button onClick={function() { setSelectedLocation('other') }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10, border: '1px dashed', borderColor: selectedLocation === 'other' ? 'rgba(196,151,58,0.5)' : 'var(--border)', background: selectedLocation === 'other' ? 'rgba(196,151,58,0.08)' : 'transparent', cursor: 'pointer', fontFamily: 'Outfit', marginTop: 4, transition: 'all 0.2s' }}>
                      <div style={{ fontSize: 13, color: selectedLocation === 'other' ? '#C4973A' : 'var(--muted)' }}>📩 Proposer une autre adresse</div>
                    </button>
                    {selectedLocation === 'other' && (
                      <div style={{ marginTop: 8 }}>
                        <input value={otherLocationText} onChange={function(e) { setOtherLocationText(e.target.value) }} placeholder="Adresse souhaitée..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', boxSizing: 'border-box' }} />
                        <button onClick={async function() { if (!otherLocationText.trim()) return; await supabase.from('location_requests').insert({ coach_id: profile.coach_id, client_id: profile.id, address: otherLocationText.trim() }); setMsg({ type: 'success', text: '📩 Demande envoyée à votre coach !' }); setOtherLocationText(''); setSelectedLocation(null) }} style={{ width: '100%', marginTop: 6, padding: '10px', background: '#C4973A', color: '#000', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit' }}>Envoyer la demande</button>
                      </div>
                    )}
                  </div>
                )}
              {/* Show calendar only if domicile OR membership confirmed OR no locations */}
              {(profile.coaching_type === 'domicile' || coachLocs.length === 0 || gymMembershipConfirmed || !selectedLocation || selectedLocation === 'other') ? (
                <BookingCalendar profile={profile} onBooked={function(creditsLeft) { setProfile(function(p) { return Object.assign({}, p, { credits: creditsLeft }) }); loadBookings(); setMsg({ type: 'success', text: '✅ Séance réservée ! Il te reste ' + creditsLeft + ' crédit' + (creditsLeft > 1 ? 's' : '') + '.' }); switchTab('home') }} />
              ) : (
                <div style={{ background: 'rgba(196,151,58,0.04)', border: '1px dashed rgba(196,151,58,0.3)', borderRadius: 12, padding: 24, textAlign: 'center', marginTop: 8 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🏋️</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Confirmation requise</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>Pour accéder aux créneaux, confirme que tu disposes d'un abonnement actif à <strong style={{ color: GOLD }}>{selectedLocation ? selectedLocation.split(' - ')[0] : 'la salle'}</strong> en cochant la case ci-dessus.</div>
                </div>
              )}

              {/* SÉANCES À VENIR */}
              {upcomingBookings.length > 0 && <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginTop: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: GOLD }}>📅 Mes séances à venir ({upcomingBookings.length})</div>
                {upcomingBookings.sort(function(a,b){return new Date(a.time_slots.start_time)-new Date(b.time_slots.start_time)}).map(function(b) {
                  var d = new Date(b.time_slots.start_time)
                  var hoursUntil = (d - new Date()) / 3600000
                  return <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 42, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 600 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>{['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][d.getMonth()]}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{formatTime(b.time_slots.start_time)} — {formatDate(b.time_slots.start_time)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{locationLabel}</div>
                    </div>
                    {hoursUntil >= cancelHours && <button onClick={function(){cancelBooking(b)}} disabled={cancelling===b.id} style={{ background: 'none', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 10, color: '#f87171', cursor: 'pointer', fontFamily: 'Outfit' }}>{cancelling===b.id?'...':'Annuler'}</button>}
                  </div>
                })}
              </div>}

              {/* HISTORIQUE */}
              {pastBookings.length > 0 && <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📋 Historique ({pastBookings.length} séance{pastBookings.length > 1 ? 's' : ''})</div>
                {pastBookings.sort(function(a,b){return new Date(b.time_slots.start_time)-new Date(a.time_slots.start_time)}).slice(0, showAllHistory ? 100 : 5).map(function(b) {
                  var d = new Date(b.time_slots.start_time)
                  return <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', opacity: 0.7 }}>
                    <div style={{ width: 42, textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][d.getMonth()]}</div>
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{formatDate(b.time_slots.start_time)} à {formatTime(b.time_slots.start_time)}</div>
                    <div style={{ fontSize: 11, color: '#4ade80' }}>✅</div>
                  </div>
                })}
                {pastBookings.length > 5 && <button onClick={function(){setShowAllHistory(!showAllHistory)}} style={{ width: '100%', padding: '8px', background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', marginTop: 6 }}>{showAllHistory ? '▲ Réduire' : '▼ Voir tout (' + pastBookings.length + ')'}</button>}
              </div>}
              </div>
            ) : (
              <div style={s.emptyCard}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
                <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Aucun crédit</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Achète des séances pour pouvoir réserver.</div>
                <button onClick={function() { navigateTo('shop') }} style={s.btnGold}>Acheter des séances</button>
              </div>
            )}
          </div>
        )}

        {view === 'account' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Mon compte</div></div>

            {/* Stats enrichies */}
            {(function() {
              var now = new Date()
              var thisMonth = now.getMonth()
              var thisYear = now.getFullYear()
              var totalSessions = pastBookings.length
              var sessionsThisMonth = pastBookings.filter(function(b) { var d = new Date(b.time_slots.start_time); return d.getMonth() === thisMonth && d.getFullYear() === thisYear }).length
              // Streak: semaines consécutives avec au moins une séance
              var streak = 0
              if (pastBookings.length > 0) {
                var sorted = pastBookings.slice().sort(function(a, b) { return new Date(b.time_slots.start_time) - new Date(a.time_slots.start_time) })
                var weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
                weekStart.setHours(0,0,0,0)
                for (var w = 0; w < 52; w++) {
                  var wEnd = new Date(weekStart.getTime() + 7 * 86400000)
                  var found = sorted.some(function(b) { var d = new Date(b.time_slots.start_time); return d >= weekStart && d < wEnd })
                  if (found) { streak++ } else if (w > 0) break
                  weekStart = new Date(weekStart.getTime() - 7 * 86400000)
                }
              }
              var memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'

              return (
                <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                  <div style={s.statCard}>
                    <div style={s.statLabel}>Crédits</div>
                    <div style={{ fontFamily: 'Outfit', fontSize: 36, fontWeight: 600, color: GOLD, marginTop: 8 }}>{profile.credits || 0}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statLabel}>Séances totales</div>
                    <div style={{ fontFamily: 'Outfit', fontSize: 36, fontWeight: 600, marginTop: 8 }}>{totalSessions}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statLabel}>Ce mois</div>
                    <div style={{ fontFamily: 'Outfit', fontSize: 36, fontWeight: 600, color: '#4ade80', marginTop: 8 }}>{sessionsThisMonth}</div>
                  </div>
                  <div style={s.statCard}>
                    <div style={s.statLabel}>Régularité</div>
                    <div style={{ fontFamily: 'Outfit', fontSize: 36, fontWeight: 600, color: streak >= 4 ? '#4ade80' : streak >= 2 ? GOLD : 'var(--muted)', marginTop: 8 }}>{streak}<span style={{ fontSize: 14, fontWeight: 400 }}>sem</span></div>
                  </div>
                </div>
              )
            })()}

            {/* Info abonnement + lieu */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Abonnement</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{sub ? '⭐ ' + sub.label : '— Aucun —'}</div>
              </div>
              <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Lieu</div>
                <div style={{ fontSize: 14 }}>{locationLabel}</div>
              </div>
            </div>

            {/* Séances à venir */}
            {upcomingBookings.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Séances à venir ({upcomingBookings.length})</div>
                {upcomingBookings.map(function(b) { return (
                  <div key={b.id} style={s.bookingRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, background: 'rgba(196,151,58,0.1)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>{new Date(b.time_slots.start_time).getDate()}</div>
                        <div style={{ fontSize: 8, textTransform: 'uppercase', color: 'var(--muted)' }}>{['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'][new Date(b.time_slots.start_time).getMonth()]}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(b.time_slots.start_time)}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{formatTime(b.time_slots.start_time)} — {locationLabel}</div>
                      </div>
                    </div>
                    {(new Date(b.time_slots.start_time) - new Date()) / 3600000 >= 24 ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={function() { startClientReschedule(b) }} style={{ ...s.btnCancel, color: GOLD, borderColor: 'rgba(196,151,58,0.3)' }}>Décaler</button>
                        <button onClick={function() { cancelBooking(b) }} disabled={cancelling === b.id} style={s.btnCancel}>{cancelling === b.id ? '...' : 'Annuler'}</button>
                      </div>
                    ) : (
                      <a href={WHATSAPP + '?text=' + encodeURIComponent('Bonjour Yoann, concernant ma séance du ' + formatDate(b.time_slots.start_time) + '...')} target="_blank" style={{ textDecoration: 'none' }}><button style={s.btnCancel}>Contacter</button></a>
                    )}
                  </div>
                ) })}
              </div>
            )}

            {/* Historique complet groupé par mois */}
            {pastBookings.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>Historique ({pastBookings.length} séance{pastBookings.length > 1 ? 's' : ''})</div>
                {(function() {
                  var sorted = pastBookings.slice().sort(function(a, b) { return new Date(b.time_slots.start_time) - new Date(a.time_slots.start_time) })
                  var months = {}
                  sorted.forEach(function(b) {
                    var d = new Date(b.time_slots.start_time)
                    var key = d.getFullYear() + '-' + d.getMonth()
                    var label = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][d.getMonth()] + ' ' + d.getFullYear()
                    if (!months[key]) months[key] = { label: label, bookings: [] }
                    months[key].bookings.push(b)
                  })
                  return Object.keys(months).map(function(key) {
                    var group = months[key]
                    return (
                      <div key={key} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: GOLD, marginBottom: 8 }}>{group.label} — {group.bookings.length} séance{group.bookings.length > 1 ? 's' : ''}</div>
                        {group.bookings.map(function(b) {
                          return (
                            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
                              <div style={{ width: 36, height: 36, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✓</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13 }}>{formatDate(b.time_slots.start_time)}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{formatTime(b.time_slots.start_time)} — {locationLabel}</div>
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Terminée</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {pastBookings.length >= 3 && (
              <div style={{ background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 12, padding: '20px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⭐</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Tu apprécies ton coaching ?</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>Un avis Google aide d'autres personnes à découvrir Yoann.</div>
                <a href={GOOGLE_REVIEW} target="_blank" style={{ display: 'inline-block', background: GOLD, color: '#000', border: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 13, fontWeight: 500, textDecoration: 'none', fontFamily: 'Outfit, sans-serif' }}>Laisser un avis ⭐</a>
              </div>
            )}

            {pastBookings.length === 0 && upcomingBookings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <div style={{ fontSize: 14 }}>Aucune séance pour le moment</div>
                <button onClick={function() { navigateTo('booking') }} style={{ ...s.btnGold, marginTop: 16 }}>Réserver ma première séance</button>
              </div>
            )}
          </div>
        )}

        {view === 'shop' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Acheter & Souscrire</div></div>

            {/* Coach custom offers */}
            {coachOffers.length > 0 && <div>
              <div className="shop-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                {coachOffers.map(function(offer) {
                  return <div key={offer.id} style={s.shopCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 28 }}>{offer.type === 'single' ? '🏋️' : offer.type === 'pack' ? '📦' : '🔄'}</div>
                      {offer.badge && <span style={{ fontSize: 9, padding: '3px 8px', borderRadius: 6, background: 'rgba(196,151,58,0.15)', color: GOLD, fontWeight: 600 }}>{offer.badge}</span>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{offer.name}</div>
                    {offer.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{offer.description}</div>}
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 700, color: GOLD }}>{offer.price}€</span>
                      {offer.original_price && <span style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'line-through', marginLeft: 8 }}>{offer.original_price}€</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {offer.type === 'single' ? offer.credits + ' séance' + (offer.credits > 1 ? 's' : '') : offer.type === 'pack' ? offer.credits + ' séances' : offer.sessions_per_week + 'x/sem'}
                      {offer.type === 'pack' && offer.credits > 0 ? ' · ' + Math.round(offer.price / offer.credits) + '€/séance' : ''}
                    </div>
                    <a href={'mailto:' + (coachBrand.name || '') + '?subject=Achat: ' + offer.name} style={s.btnShop}>Acheter</a>
                  </div>
                })}
              </div>
            </div>}

            {coachOffers.length === 0 && <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <button onClick={function() { setShopTab('seances') }} style={{ ...s.shopTabBtn, ...(shopTab === 'seances' ? { borderColor: GOLD, color: GOLD, background: 'rgba(196,151,58,0.08)' } : {}) }}>🏋️ Séances de coaching</button>
              <button onClick={function() { setShopTab('abonnements') }} style={{ ...s.shopTabBtn, ...(shopTab === 'abonnements' ? { borderColor: GOLD, color: GOLD, background: 'rgba(196,151,58,0.08)' } : {}) }}>📱 Abonnements en ligne</button>
            </div>

            {/* Current subscription banner */}
            {sub && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 10, marginBottom: 20 }}>
                <div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Mon abonnement actuel</div><div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>⭐ {sub.label}</div></div>
                <div style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>{profile.credits || 0} crédits</div>
              </div>
            )}

            {/* SÉANCES */}
            {shopTab === 'seances' && (
              <div>
                {(function() {
                  var hasOnlineSub = profile.subscription_type && (profile.subscription_type.includes('sport') || profile.subscription_type.includes('nutrition'))
                  var unitPrice = hasOnlineSub ? '50€' : '60€'
                  var unitLink = hasOnlineSub ? STRIPE.seance_50 : STRIPE.seance_60
                  var pack5Price = hasOnlineSub ? '250€' : '275€'
                  var pack5Unit = hasOnlineSub ? '50€' : '55€'
                  var pack5Saving = hasOnlineSub ? '50€' : '25€'
                  var pack5Link = hasOnlineSub ? STRIPE.pack5_250 : STRIPE.pack5_275
                  return (
                    <div>
                      {profile.coaching_type === 'domicile' && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                          🏋️ Ces séances sont en salle à ON AIR BNF, Paris 13e. Pour les séances à domicile, contacte Yoann.
                        </div>
                      )}
                      <div style={s.contactBar}>
                        <div><div style={{ fontSize: 14, fontWeight: 500 }}>Payer sur place</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Espèces ou CB</div></div>
                        <a href={WHATSAPP + '?text=Bonjour%20Yoann%2C%20je%20souhaite%20acheter%20des%20séances.'} target="_blank" style={s.btnGoldSmall}>Contacter</a>
                      </div>
                      {hasOnlineSub && (
                        <div style={{ fontSize: 12, color: '#4ade80', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                          ⭐ Tarif abonné — 50€/séance au lieu de 60€
                        </div>
                      )}
                      <div className="shop-grid" style={s.shopGrid}>
                        <div style={s.shopCard}>
                          <div style={s.shopLabel}>À l'unité</div>
                          <div style={s.shopTitle}>Séance individuelle</div>
                          <div style={s.shopPrice}>{unitPrice}<span style={s.shopPer}>/séance</span></div>
                          <a href={unitLink} target="_blank" style={s.btnShop}>Payer</a>
                        </div>
                        <div style={s.shopCard}>
                          <div style={s.shopLabel}>Pack 5</div>
                          <div style={s.shopTitle}>Programme Court</div>
                          <div style={s.shopPrice}>{pack5Price}<span style={s.shopPer}> {pack5Unit}/séance</span></div>
                          <div style={s.shopSaving}>Économie {pack5Saving}</div>
                          <a href={pack5Link} target="_blank" style={s.btnShop}>Payer</a>
                        </div>
                        <div style={{ ...s.shopCard, borderColor: GOLD, position: 'relative' }}>
                          <div style={s.shopBest}>Meilleure offre</div>
                          <div style={s.shopLabel}>Pack 10</div>
                          <div style={s.shopTitle}>Programme SHIFT</div>
                          <div style={s.shopPrice}>500€<span style={s.shopPer}> 50€/séance</span></div>
                          <div style={s.shopSaving}>Économie 100€</div>
                          <a href={STRIPE.pack10} target="_blank" style={s.btnShop}>Payer</a>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ABONNEMENTS */}
            {shopTab === 'abonnements' && (
              <div>
                <div className="shop-grid" style={s.shopGrid}>
                  <div style={s.shopCard}>
                    <div style={s.shopLabel}>Sport</div>
                    <div style={s.shopTitle}>Programme Sport en ligne</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>Programme d'entraînement personnalisé accessible depuis ton téléphone.</div>
                    <div style={s.shopPrice}>59€<span style={s.shopPer}>/mois</span></div>
                    <a href={STRIPE.sport} target="_blank" style={s.btnShop}>Souscrire</a>
                  </div>
                  <div style={s.shopCard}>
                    <div style={s.shopLabel}>Nutrition</div>
                    <div style={s.shopTitle}>Suivi Nutritionnel</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>Plan alimentaire personnalisé avec suivi hebdomadaire.</div>
                    <div style={s.shopPrice}>119€<span style={s.shopPer}>/mois</span></div>
                    <a href={STRIPE.nutrition} target="_blank" style={s.btnShop}>Souscrire</a>
                  </div>
                  <div style={{ ...s.shopCard, borderColor: GOLD, position: 'relative' }}>
                    <div style={s.shopBest}>Meilleure offre</div>
                    <div style={s.shopLabel}>Sport + Nutrition</div>
                    <div style={s.shopTitle}>Programme Complet</div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>Sport en ligne + suivi nutritionnel combinés.</div>
                    <div style={s.shopPrice}>149€<span style={s.shopPer}>/mois</span></div>
                    <div style={s.shopSaving}>Économie 29€/mois</div>
                    <a href={STRIPE.sport_nutri} target="_blank" style={s.btnShop}>Souscrire</a>
                  </div>
                </div>
              </div>
            )}
            </div>}
          </div>
        )}

        {/* PROGRAMME */}
        {view === 'program' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Mon programme</div></div>

            {/* Free session + Videos buttons */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <button onClick={function() { navigateTo('free-session') }} style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '14px', cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>⚡</span>
                <div style={{ textAlign: 'left' }}><div style={{ fontSize: 13, fontWeight: 500 }}>Séance libre</div></div>
              </button>
              <button onClick={function() { navigateTo('timer') }} style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '14px', cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>⏱️</span>
                <div style={{ textAlign: 'left' }}><div style={{ fontSize: 13, fontWeight: 500 }}>Timer</div></div>
              </button>
              {videoFolders.length > 0 && <button onClick={function() { navigateTo('videos') }} style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <span style={{ fontSize: 20 }}>🎬</span>
                <div style={{ textAlign: 'left' }}><div style={{ fontSize: 13, fontWeight: 500 }}>Vidéos</div></div>
              </button>}
            </div>
            {clientPrograms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div><div>Aucun programme assigné pour le moment.</div></div>
            ) : clientPrograms.map(function(cp) {
              var prog = cp.programs
              if (!prog) return null
              var sessions = (prog.program_sessions || []).sort(function(a, b) { return a.order_index - b.order_index })
              return (
                <div key={cp.id} style={{ marginBottom: 16 }}>
                  {/* Program card */}
                  <button onClick={function() { setOpenFolder(openFolder === prog.id ? null : prog.id) }} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: openFolder === prog.id ? '16px 16px 0 0' : 16, padding: '20px', cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left', transition: 'all 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(196,151,58,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{openFolder === prog.id ? '📂' : '📁'}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 2 }}>{prog.name}</div>
                        {prog.description && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{prog.description}</div>}
                        <div style={{ display: 'inline-block', fontSize: 10, padding: '3px 10px', borderRadius: 10, background: 'rgba(196,151,58,0.1)', color: GOLD, marginTop: 6 }}>{sessions.length} séance{sessions.length > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontSize: 20, color: 'var(--muted)', transform: openFolder === prog.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
                    </div>
                  </button>

                  {/* Sessions */}
                  {openFolder === prog.id && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '8px 14px 16px' }}>
                      {sessions.map(function(sess, si) {
                        var exList = (sess.program_exercises || []).sort(function(a, b) { return a.order_index - b.order_index })
                        var letter = sess.name.replace(/[^A-Za-z]/g, '')[0] || String.fromCharCode(65 + si)
                        return (
                          <div key={sess.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px', marginTop: 10 }}>
                            {/* Session header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: exList.length > 0 ? 14 : 0 }}>
                              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, color: GOLD, flexShrink: 0 }}>{letter}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 15, fontWeight: 500 }}>{sess.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{exList.length} exercice{exList.length > 1 ? 's' : ''}{sess.workout_mode && sess.workout_mode !== 'normal' ? ' · ' + (MODE_INFO[sess.workout_mode] || {}).emoji + ' ' + (MODE_INFO[sess.workout_mode] || {}).name : ''}</div>
                              </div>
                              <button onClick={function() {
                                var ms={};try{ms=sess.mode_settings?JSON.parse(sess.mode_settings):{}}catch(e){}
                                // Build blocks from exercise-level block_mode
                                var blocks = []
                                var currentBlock = { mode: sess.workout_mode || 'normal', settings: ms, startIdx: 0, name: '' }
                                exList.forEach(function(pe, idx) {
                                  var peMode = pe.block_mode || sess.workout_mode || 'normal'
                                  var peName = pe.block_name || ''
                                  var peSettings = {}; try { peSettings = pe.block_settings ? JSON.parse(pe.block_settings) : {} } catch(e) {}
                                  // Use session settings if block settings are empty
                                  if (Object.keys(peSettings).length === 0 && peMode === (sess.workout_mode || 'normal')) peSettings = ms
                                  if (idx === 0 || peMode !== currentBlock.mode || peName !== currentBlock.name) {
                                    if (idx > 0) { currentBlock.endIdx = idx - 1; blocks.push(currentBlock) }
                                    currentBlock = { mode: peMode, settings: peSettings, startIdx: idx, name: peName }
                                  }
                                })
                                if (exList.length > 0) { currentBlock.endIdx = exList.length - 1; blocks.push(currentBlock) }
                                setWorkoutActive({ programId: prog.id, programName: prog.name + ' — ' + sess.name, exercises: exList, mode: sess.workout_mode || 'normal', settings: ms, sessionObj: sess, blocks: blocks })
                              }} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit', whiteSpace: 'nowrap' }}>▶ Lancer</button>
                            </div>
                            {/* Exercise list */}
                            {exList.map(function(pe, i) {
                              var ex = pe.exercises
                              return (
                                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                                  <div style={{ width: 20, fontSize: 11, fontWeight: 600, color: GOLD, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                                  {ex && ex.gif_url ? <img src={ex.gif_url} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(196,151,58,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🏋️</div>}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ex && ex.name || '?'}</div>
                                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{ex && ex.muscle_group || ''}{ex && ex.equipment ? ' · ' + ex.equipment : ''}</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: GOLD }}>{pe.sets}x{pe.rep_min === pe.rep_max ? pe.rep_min : pe.rep_min + '-' + pe.rep_max}</div>
                                    {pe.rest_seconds > 0 && <div style={{ fontSize: 9, color: 'var(--muted)' }}>{pe.rest_seconds}s repos</div>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* PHOTOS */}
        {view === 'photos' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>📸 Mon évolution</div></div>
            <PhotoGallery clientId={profile.id} photos={clientPhotos} onRefresh={function() { supabase.from('client_photos').select('*').eq('client_id', profile.id).order('taken_at').then(function(r) { setClientPhotos(r.data || []) }) }} isCoach={false} />
          </div>
        )}

        {/* DRIVE */}
        {view === 'drive' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>📁 Drive</div></div>
            {!activeDriveFolder ? (
              <div>
                {driveFolders.map(function(folder) {
                  return (
                    <button key={folder.id} onClick={function() { setActiveDriveFolder(folder) }} style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📂</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{folder.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(folder.files || []).length} fichier{(folder.files || []).length > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontSize: 18, color: 'var(--muted)' }}>›</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <button onClick={function() { setActiveDriveFolder(null) }} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', marginBottom: 16 }}>← Tous les dossiers</button>
                <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>📂 {activeDriveFolder.name}</div>
                {(activeDriveFolder.files || []).map(function(file) {
                  var icon = file.file_type === 'pdf' ? '📄' : ['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(file.file_type) >= 0 ? '🖼️' : ['doc', 'docx'].indexOf(file.file_type) >= 0 ? '📝' : '📎'
                  return (
                    <a key={file.id} href={file.file_url} target="_blank" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
                      <div style={{ fontSize: 28, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{file.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{file.size_bytes ? Math.round(file.size_bytes / 1024) + ' Ko' : ''}</div>
                      </div>
                      <div style={{ fontSize: 12, color: GOLD }}>Ouvrir →</div>
                    </a>
                  )
                })}
                {(activeDriveFolder.files || []).length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 12 }}>Ce dossier est vide.</div>}
              </div>
            )}
          </div>
        )}

        {/* VIDEOS */}
        {view === 'videos' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Vidéos</div></div>
            {!activeVideoFolder ? (
              <div>
                {videoFolders.map(function(folder) {
                  var firstVid = (folder.videos || [])[0]
                  var ytId = firstVid ? getYtId(firstVid.youtube_url) : null
                  return (
                    <button key={folder.id} onClick={function() { setActiveVideoFolder(folder) }} style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontFamily: 'Outfit', color: 'var(--text)', textAlign: 'left' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0, overflow: 'hidden' }}>
                        {ytId ? <img src={'https://img.youtube.com/vi/' + ytId + '/mqdefault.jpg'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📂'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{folder.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(folder.videos || []).length} vidéo{(folder.videos || []).length > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ fontSize: 18, color: 'var(--muted)' }}>›</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <button onClick={function() { setActiveVideoFolder(null) }} style={{ background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit', marginBottom: 16 }}>← Tous les dossiers</button>
                <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 16 }}>{activeVideoFolder.name}</div>
                {(activeVideoFolder.videos || []).map(function(vid) {
                  var ytId = getYtId(vid.youtube_url)
                  return (
                    <a key={vid.id} href={vid.youtube_url} target="_blank" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
                      {ytId && <div style={{ width: 140, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                        <img src={'https://img.youtube.com/vi/' + ytId + '/mqdefault.jpg'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>▶</div></div>
                      </div>}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{vid.title}</div>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* PRs & BADGES in sport tab */}
        {view === 'program' && (clientPRs.length > 0 || clientBadges.length > 0) && (
          <div style={{ padding: '0 0 20px' }}>
            {clientBadges.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {clientBadges.map(function(b) {
                  var labels = { first_workout: '🎯 1re séance', '10_workouts': '🔥 10 séances', '25_workouts': '💪 25 séances', '50_workouts': '🏆 50 séances', '100_workouts': '👑 100 séances' }
                  return <div key={b.id} style={{ background: 'rgba(196,151,58,0.08)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: GOLD }}>{labels[b.badge_type] || b.badge_type}</div>
                })}
              </div>
            )}
            {clientPRs.length > 0 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px' }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>🏆 Records personnels</div>
                {(function() {
                  var unique = {}
                  clientPRs.forEach(function(pr) { if (!unique[pr.exercise_id]) unique[pr.exercise_id] = pr })
                  return Object.values(unique).slice(0, 10).map(function(pr) {
                    return <div key={pr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13 }}>{pr.exercises && pr.exercises.name || '?'}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: GOLD }}>{pr.weight_kg}kg x {pr.reps}</div>
                    </div>
                  })
                })()}
              </div>
            )}
          </div>
        )}

        {/* FREE SESSION */}
        {view === 'free-session' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Séance libre</div></div>

            {/* Selected exercises */}
            {freeExercises.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{freeExercises.length} exercice{freeExercises.length > 1 ? 's' : ''} sélectionné{freeExercises.length > 1 ? 's' : ''}</div>
                {freeExercises.map(function(ex, i) {
                  return (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: 'var(--surface)', borderRadius: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: GOLD, width: 20 }}>{i + 1}</div>
                      {ex.gif_url && <img src={ex.gif_url} style={{ width: 30, height: 30, borderRadius: 5, objectFit: 'cover' }} />}
                      <div style={{ flex: 1, fontSize: 13 }}>{ex.name}</div>
                      <button onClick={function() { setFreeExercises(function(f) { return f.filter(function(_, j) { return j !== i }) }) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>
                  )
                })}
                <div style={{ background: 'rgba(196,151,58,0.04)', border: '1px solid rgba(196,151,58,0.15)', borderRadius: 10, padding: 12, marginTop: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: GOLD, marginBottom: 8 }}>📋 Nommer la séance (optionnel)</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={freeProgName} onChange={function(e) { setFreeProgName(e.target.value) }} placeholder="Nom du programme" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'Outfit', outline: 'none' }} />
                    <input value={freeSessName} onChange={function(e) { setFreeSessName(e.target.value) }} placeholder="Nom de la séance" style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'Outfit', outline: 'none' }} />
                  </div>
                </div>
                <button onClick={function() {
                  var peList = freeExercises.map(function(ex, i) {
                    return { exercise_id: ex.id, exercises: ex, sets: 3, rep_min: 8, rep_max: 12, rep_mode: 'range', rest_seconds: 90, order_index: i, notes: '' }
                  })
                  var pName = freeProgName.trim() || 'Séance libre'
                  var sName = freeSessName.trim()
                  setWorkoutActive({ programId: null, programName: sName ? pName + ' — ' + sName : pName, exercises: peList })
                }} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit', width: '100%', marginTop: 8 }}>▶ Lancer la séance ({freeExercises.length} exos)</button>
              </div>
            )}

            {/* Exercise search */}
            <input placeholder="🔍 Rechercher un exercice..." value={freeSearch} onChange={function(e) { setFreeSearch(e.target.value) }} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'Outfit', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

            {/* Exercise list grouped by muscle */}
            {(function() {
              var q = freeSearch.toLowerCase()
              var filtered = q ? allExercises.filter(function(e) { return e.name.toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q) }) : allExercises
              var groups = {}
              filtered.forEach(function(e) { var g = e.muscle_group || 'Autre'; if (!groups[g]) groups[g] = []; groups[g].push(e) })
              var alreadyIds = {}
              freeExercises.forEach(function(e) { alreadyIds[e.id] = true })
              return Object.keys(groups).map(function(g) {
                return (
                  <div key={g} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: GOLD, marginBottom: 4 }}>{g}</div>
                    {groups[g].map(function(ex) {
                      var added = alreadyIds[ex.id]
                      return (
                        <button key={ex.id} onClick={function() { if (!added) setFreeExercises(function(f) { return f.concat([ex]) }) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: added ? 'rgba(196,151,58,0.06)' : 'transparent', border: '1px solid var(--border)', borderRadius: 6, cursor: added ? 'default' : 'pointer', marginBottom: 3, fontFamily: 'Outfit', color: added ? GOLD : 'var(--text)', textAlign: 'left', fontSize: 12, opacity: added ? 0.6 : 1 }}>
                          {ex.gif_url && <img src={ex.gif_url} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
                          <span style={{ flex: 1 }}>{ex.name}</span>
                          <span style={{ fontSize: 16 }}>{added ? '✓' : '+'}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* Reschedule modal */}
        {clientReschedule && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.2s ease' }} onClick={function(e) { if (e.target === e.currentTarget) setClientReschedule(null) }}>
            <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '28px 24px', maxWidth: 480, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Décaler ma séance</div>
                <button onClick={function() { setClientReschedule(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text)' }}>✕</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={function() { var m = rescheduleMonth - 1, y = rescheduleYear; if (m < 1) { m = 12; y-- } loadClientRescheduleSlots(m, y) }} style={s.btnCancel}>←</button>
                <div style={{ fontWeight: 500 }}>{['','Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][rescheduleMonth]} {rescheduleYear}</div>
                <button onClick={function() { var m = rescheduleMonth + 1, y = rescheduleYear; if (m > 12) { m = 1; y++ } loadClientRescheduleSlots(m, y) }} style={s.btnCancel}>→</button>
              </div>
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
                          return <button key={sl.start} onClick={function() { if (window.confirm('Décaler au ' + d.getDate() + ' à ' + t.getHours() + 'h' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ' ?')) confirmClientReschedule(sl) }} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', color: '#4ade80', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>{t.getHours()}h{t.getMinutes() < 10 ? '0' : ''}{t.getMinutes()}</button>
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

        {/* Workout Player overlay */}
        {workoutActive && (
          workoutActive.mode && workoutActive.mode !== 'normal' ? (
            <CircuitPlayer session={{ program_exercises: workoutActive.exercises }} mode={workoutActive.mode} settings={workoutActive.settings || {}} onClose={function() { setWorkoutActive(false); loadProgram(); loadPRsAndBadges() }} />
          ) : (
            <WorkoutPlayer program={{ id: workoutActive.programId, name: workoutActive.programName, program_exercises: workoutActive.exercises, blocks: workoutActive.blocks || [] }} profileId={profile.id} profileName={profile.full_name} onClose={function() { setWorkoutActive(false); loadProgram(); loadPRsAndBadges() }} />
          )
        )}

        {view === 'settings' && (
          <div style={{ animation: viewAnim }}>
            <div style={s.viewHeader}><div style={s.viewTitle}>Mes paramètres</div></div>
            <div style={s.settingsCard}>
              {/* Photo de profil */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 600, color: '#000' }}>
                      {(profile.full_name || '?').split(' ').map(function(n) { return n[0] || '' }).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <label style={{ position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: '50%', background: GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', color: '#000' }}>
                    📷
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={function(e) {
                      var file = e.target.files[0]
                      if (!file) return
                      if (file.size > 5 * 1024 * 1024) { setMsg({ type: 'error', text: 'Image trop lourde (max 5 Mo).' }); return }
                      var reader = new FileReader()
                      reader.onload = function(ev) { setCropImage(ev.target.result); setCropZoom(1); setCropPos({ x: 0, y: 0 }) }
                      reader.readAsDataURL(file)
                      e.target.value = ''
                    }} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Clique sur 📷 pour changer ta photo (max 5 Mo)</div>
              </div>

              {/* CROPPER MODAL */}
              {cropImage && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, color: '#fff' }}>Recadre ta photo</div>
                  <div style={{ position: 'relative', width: 280, height: 280, borderRadius: '50%', overflow: 'hidden', border: '3px solid ' + GOLD, background: '#111', touchAction: 'none' }}
                    onMouseDown={function(e) { setCropDragging(true); setCropStart({ x: e.clientX - cropPos.x, y: e.clientY - cropPos.y }) }}
                    onMouseMove={function(e) { if (cropDragging) setCropPos({ x: e.clientX - cropStart.x, y: e.clientY - cropStart.y }) }}
                    onMouseUp={function() { setCropDragging(false) }}
                    onMouseLeave={function() { setCropDragging(false) }}
                    onTouchStart={function(e) { var t = e.touches[0]; setCropDragging(true); setCropStart({ x: t.clientX - cropPos.x, y: t.clientY - cropPos.y }) }}
                    onTouchMove={function(e) { if (cropDragging) { var t = e.touches[0]; setCropPos({ x: t.clientX - cropStart.x, y: t.clientY - cropStart.y }) } }}
                    onTouchEnd={function() { setCropDragging(false) }}
                  >
                    <img src={cropImage} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(calc(-50% + ' + cropPos.x + 'px), calc(-50% + ' + cropPos.y + 'px)) scale(' + cropZoom + ')', maxWidth: 'none', width: 280, height: 'auto', userSelect: 'none', pointerEvents: 'none' }} draggable="false" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, color: '#fff' }}>
                    <span style={{ fontSize: 12 }}>🔍</span>
                    <input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={function(e) { setCropZoom(parseFloat(e.target.value)) }} style={{ width: 180, accentColor: GOLD }} />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{Math.round(cropZoom * 100)}%</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Glisse la photo pour la repositionner</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button onClick={function() { setCropImage(null) }} style={{ padding: '12px 24px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Annuler</button>
                    <button onClick={async function() {
                      var canvas = document.createElement('canvas')
                      canvas.width = 300; canvas.height = 300
                      var ctx = canvas.getContext('2d')
                      var img = new Image()
                      img.crossOrigin = 'anonymous'
                      img.onload = async function() {
                        var scale = 280 / img.width * cropZoom
                        var dx = 150 + cropPos.x - (img.width * scale / 2)
                        var dy = 150 + cropPos.y - (img.height * scale / 2)
                        ctx.beginPath(); ctx.arc(150, 150, 150, 0, Math.PI * 2); ctx.clip()
                        ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale)
                        canvas.toBlob(async function(blob) {
                          if (!blob) { setMsg({ type: 'error', text: 'Erreur de recadrage.' }); return }
                          var path = 'avatars/' + profile.id + '.jpg'
                          var { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
                          if (error) { setMsg({ type: 'error', text: 'Erreur : ' + error.message }); return }
                          var { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
                          var avatarUrl = urlData.publicUrl + '?t=' + Date.now()
                          await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id)
                          setProfile(function(p) { return Object.assign({}, p, { avatar_url: avatarUrl }) })
                          setCropImage(null)
                          setMsg({ type: 'success', text: 'Photo mise à jour !' })
                        }, 'image/jpeg', 0.85)
                      }
                      img.src = cropImage
                    }} style={{ padding: '12px 24px', borderRadius: 8, background: GOLD, color: '#000', border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>Valider ✓</button>
                  </div>
                </div>
              )}
              <div style={s.settingsField}><div style={s.settingsLabel}>Nom</div><div style={{ fontSize: 15, padding: '12px 0' }}>{profile.full_name || '—'}</div></div>
              <div style={s.settingsField}><div style={s.settingsLabel}>Email</div><input type="email" value={editEmail} onChange={function(e) { setEditEmail(e.target.value) }} style={s.settingsInput} /><div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Un email de confirmation sera envoyé.</div></div>
              <div style={s.settingsField}><div style={s.settingsLabel}>Téléphone</div><input type="tel" value={editPhone} onChange={function(e) { setEditPhone(e.target.value) }} placeholder="06 12 34 56 78" style={s.settingsInput} /></div>
              {profile.coaching_type === 'domicile' && (
                <div style={s.settingsField}><div style={s.settingsLabel}>Adresse domicile</div><input type="text" value={editAddress} onChange={function(e) { setEditAddress(e.target.value) }} placeholder="Ex: 39 rue Gustave Eiffel, Clichy" style={s.settingsInput} /><div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Pour calculer les temps de trajet.</div></div>
              )}
              {profile.coaching_type === 'presentiel' && (
                <div style={s.settingsField}><div style={s.settingsLabel}>Lieu</div><div style={{ fontSize: 13, padding: '12px 0', color: 'var(--muted)' }}>📍 ON AIR BNF — 93 av. de France, Paris 13e</div></div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0', paddingTop: 20 }}>
                <div style={s.settingsField}>
                  <div style={s.settingsLabel}>Apparence</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={function() { setTheme('dark') }} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: theme === 'dark' ? 'rgba(196,151,58,0.15)' : 'var(--surface)', borderColor: theme === 'dark' ? 'rgba(196,151,58,0.4)' : 'var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>🌙 Sombre</button>
                    <button onClick={function() { setTheme('light') }} style={{ flex: 1, padding: '14px', borderRadius: 8, border: '1px solid var(--border)', background: theme === 'light' ? 'rgba(196,151,58,0.15)' : 'var(--surface)', borderColor: theme === 'light' ? 'rgba(196,151,58,0.4)' : 'var(--border)', cursor: 'pointer', color: 'var(--text)', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}>☀️ Clair</button>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0', paddingTop: 20 }}>
                <div style={s.settingsField}>
                  <div style={s.settingsLabel}>Notifications</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>🔔 Rappel de séance</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Notification 2h avant ta séance</div>
                    </div>
                    <button onClick={function() {
                      if (!('Notification' in window)) { setMsg({ type: 'error', text: 'Ton navigateur ne supporte pas les notifications.' }); return }
                      if (notifEnabled) {
                        setNotifEnabled(false); localStorage.setItem('notif', 'off')
                        setMsg({ type: 'success', text: 'Notifications désactivées.' })
                      } else {
                        Notification.requestPermission().then(function(perm) {
                          if (perm === 'granted') {
                            setNotifEnabled(true); localStorage.setItem('notif', 'on')
                            setMsg({ type: 'success', text: 'Notifications activées ! Tu seras prévenu(e) 2h avant chaque séance.' })
                            new Notification('🏋️ Notifications activées', { body: 'Tu recevras un rappel avant chaque séance.', icon: '/icon-192.png' })
                          } else {
                            setMsg({ type: 'error', text: 'Tu as refusé les notifications. Active-les dans les réglages de ton navigateur.' })
                          }
                        })
                      }
                    }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid', borderColor: notifEnabled ? 'rgba(74,222,128,0.3)' : 'var(--border)', background: notifEnabled ? 'rgba(74,222,128,0.08)' : 'var(--surface)', color: notifEnabled ? '#4ade80' : 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}>
                      {notifEnabled ? '✓ Activées' : 'Activer'}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0', paddingTop: 20 }}>
                <div style={s.settingsField}><div style={s.settingsLabel}>Nouveau mot de passe</div><input type="password" value={newPassword} onChange={function(e) { setNewPassword(e.target.value) }} placeholder="Laisser vide pour ne pas changer" style={s.settingsInput} /></div>
                <div style={s.settingsField}><div style={s.settingsLabel}>Confirmer le mot de passe</div><input type="password" value={confirmPassword} onChange={function(e) { setConfirmPassword(e.target.value) }} placeholder="Confirmer le nouveau mot de passe" style={s.settingsInput} /></div>
              </div>
              <button onClick={async function() {
                setSavingSettings(true)
                var updates = { phone: editPhone.trim() }
                if (profile.coaching_type === 'domicile') updates.address = editAddress.trim()
                await supabase.from('profiles').update(updates).eq('id', profile.id)
                setProfile(function(p) { return Object.assign({}, p, updates) })
                if (editEmail.trim() !== profile.email) {
                  var res1 = await supabase.auth.updateUser({ email: editEmail.trim() })
                  if (res1.error) setMsg({ type: 'error', text: 'Erreur email : ' + res1.error.message })
                  else setMsg({ type: 'success', text: 'Confirmation envoyée à ' + editEmail.trim() })
                }
                if (newPassword) {
                  if (newPassword.length < 6) {
                    setMsg({ type: 'error', text: 'Le mot de passe doit faire au moins 6 caractères.' })
                    setSavingSettings(false); return
                  }
                  if (newPassword !== confirmPassword) {
                    setMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
                    setSavingSettings(false); return
                  }
                  var res2 = await supabase.auth.updateUser({ password: newPassword })
                  if (res2.error) { setMsg({ type: 'error', text: 'Erreur mot de passe : ' + res2.error.message }); setSavingSettings(false); return }
                  setNewPassword(''); setConfirmPassword('')
                  setMsg({ type: 'success', text: 'Mot de passe mis à jour.' })
                }
                if (!msg) setMsg({ type: 'success', text: 'Paramètres mis à jour.' })
                setSavingSettings(false); navigateTo('home')
              }} disabled={savingSettings} style={{ ...s.btnGold, width: '100%', marginTop: 8, textAlign: 'center' }}>
                {savingSettings ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

      </div>
      {/* TIMER */}
      {view === 'timer' && <Timer />}

      {/* PROGRESSION */}
      {view === 'progression' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <button onClick={function(){switchTab('home')}} style={{background:'none',border:'none',color:GOLD,fontSize:13,cursor:'pointer',fontFamily:'Outfit',padding:'4px 0',marginBottom:8}}>← Accueil</button>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>👤 Mon profil</div>

          {/* Photos avant/après */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📸 Mon évolution</div>
            <PhotoGallery clientId={profile.id} isAdmin={false} />
          </div>

          {/* Progression graphique */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📈 Ma progression</div>
            <ProgressionChart clientId={profile.id} exercises={allExercises} />
          </div>

          {/* Drive */}
          {driveFolders.length > 0 && <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📁 Mes documents</div>
            <button onClick={function(){ navigateTo('drive') }} style={{ width: '100%', padding: '12px', background: 'rgba(196,151,58,0.08)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: 8, color: GOLD, fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit' }}>📁 Ouvrir mon Drive</button>
          </div>}
        </div>
      )}


      {/* BOTTOM TAB BAR */}
      {!workoutActive && <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', padding: '6px 0 env(safe-area-inset-bottom, 6px)', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', maxWidth: 400, width: '100%', justifyContent: 'space-around' }}>
          <button onClick={function() { switchTab('home') }} style={tabStyle(tab === 'home')}>
            <div style={{ fontSize: 22 }}>🏠</div><div style={tabLabel}>{t('nav.home')}</div>
          </button>
          <button onClick={function() { switchTab('booking') }} style={tabStyle(tab === 'booking')}>
            <div style={{ fontSize: 22 }}>📅</div><div style={tabLabel}>{t('nav.booking')}</div>
          </button>
          <button onClick={function() { switchTab('sport') }} style={tabStyle(tab === 'sport')}>
            <div style={{ fontSize: 22 }}>🏋️</div><div style={tabLabel}>Sport</div>
          </button>
          <button onClick={function() { switchTab('progression') }} style={tabStyle(tab === 'progression')}>
            <div style={{ fontSize: 22 }}>👤</div><div style={tabLabel}>Profil</div>
          </button>
          <button onClick={function() { switchTab('settings') }} style={tabStyle(tab === 'settings')}>
            <div style={{ fontSize: 22 }}>⚙️</div><div style={tabLabel}>Paramètres</div>
          </button>
        </div>
      </div>}
      {!workoutActive && <div style={{ height: 70 }} />}

      {/* OFFLINE INDICATOR */}
      {!isOnline && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300, background: '#dc2626', color: '#fff', textAlign: 'center', padding: '6px', fontSize: 11, fontWeight: 500 }}>📡 Mode hors-ligne — tes séances seront synchronisées au retour</div>}

      {/* WELCOME SCREEN */}
      {showWelcome && <WelcomeScreen name={profile.full_name} onDismiss={function() { setShowWelcome(false); try { localStorage.setItem('yd_welcome_shown', '1') } catch(e) {} }} />}

      {/* FLOATING CHAT BUTTON — hidden during workout */}
      {!workoutActive && <button onClick={async function() { if (!showChat) { setShowChat(true); showChatRef.current = true; setChatUnread(0); await loadChat() } else { setShowChat(false); showChatRef.current = false } }} style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: GOLD, color: '#000', border: 'none', cursor: 'pointer', fontSize: 24, boxShadow: '0 4px 20px rgba(196,151,58,0.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', animation: chatUnread > 0 ? 'pulse 2s infinite' : 'none' }}>💬{chatUnread > 0 && <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{chatUnread}</div>}</button>}

      {/* CHAT PANEL */}
      {showChat && <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, top: 0, background: 'var(--bg)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={function() { setShowChat(false); showChatRef.current = false }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(196,151,58,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: GOLD }}>YD</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 500 }}>{coachBrand ? coachBrand.name : 'Coach'}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{coachBrand ? coachBrand.specialty : 'Coach sportif'}</div></div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chatMsgs.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>Envoie ton premier message à ton coach ! 💪</div>}
          {chatMsgs.map(function(m) {
            var isMe = m.sender_id === profile.id
            return <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{ background: isMe ? 'rgba(196,151,58,0.15)' : 'var(--surface)', border: '1px solid', borderColor: isMe ? 'rgba(196,151,58,0.3)' : 'var(--border)', borderRadius: 14, borderBottomRightRadius: isMe ? 4 : 14, borderBottomLeftRadius: isMe ? 14 : 4, padding: '10px 14px' }}>
                {m.type === 'image' && m.file_url && <img src={m.file_url} style={{ maxWidth: '100%', borderRadius: 8, marginBottom: m.content ? 6 : 0 }} onClick={function() { window.open(m.file_url, '_blank') }} />}
                {m.type === 'pdf' && m.file_url && <a href={m.file_url} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 6, color: GOLD, fontSize: 12, textDecoration: 'none' }}>📄 {m.file_name || 'Document'}</a>}
                {m.content && <div style={{ fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, textAlign: isMe ? 'right' : 'left' }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', alignItems: 'flex-end' }}>
          <label style={{ cursor: 'pointer', fontSize: 20, padding: '6px' }}>📎<input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={function(e) { setChatFile(e.target.files[0] || null) }} /></label>
          <div style={{ flex: 1 }}>
            {chatFile && <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>📎 {chatFile.name} <button onClick={function() { setChatFile(null) }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 11 }}>✕</button></div>}
            <input value={chatInput} onChange={function(e) { setChatInput(e.target.value) }} onKeyDown={function(e) { if (e.key === 'Enter') { e.preventDefault(); sendChatMsg() } }} placeholder="Message..." style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'Outfit', fontSize: 14, outline: 'none' }} />
          </div>
          <button onClick={sendChatMsg} disabled={chatSending || (!chatInput.trim() && !chatFile)} style={{ background: GOLD, color: '#000', border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontFamily: 'Outfit', fontWeight: 500, opacity: chatSending || (!chatInput.trim() && !chatFile) ? 0.5 : 1 }}>{chatSending ? '...' : '➤'}</button>
        </div>
      </div>}

      {/* Navigation confirmation when in free session */}
      {pendingDashNav && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
        <div style={{background:'var(--surface)',borderRadius:16,padding:24,maxWidth:380,width:'100%',border:'1px solid var(--border)'}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8,fontFamily:'Outfit'}}>⚠️ Séance en cours</div>
          <div style={{fontSize:13,color:'var(--muted)',marginBottom:20,lineHeight:1.5}}>Tu as {freeExercises.length} exercice{freeExercises.length>1?'s':''} sélectionné{freeExercises.length>1?'s':''}. Si tu quittes, ta sélection sera perdue.</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={function(){var peList=freeExercises.map(function(ex,i){return{exercise_id:ex.id,exercises:ex,sets:3,rep_min:8,rep_max:12,rep_mode:'range',rest_seconds:90,order_index:i,notes:''}});var pName=freeProgName.trim()||'Séance libre';var sName=freeSessName.trim();setWorkoutActive({programId:null,programName:sName?pName+' — '+sName:pName,exercises:peList});setPendingDashNav(null)}} style={{padding:'12px 16px',background:GOLD,color:'#000',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>▶ Lancer la séance maintenant</button>
            <button onClick={function(){setPendingDashNav(null)}} style={{padding:'12px 16px',background:'transparent',color:'var(--text)',border:'1px solid var(--border)',borderRadius:10,fontSize:13,cursor:'pointer',fontFamily:'Outfit'}}>← Continuer la sélection</button>
            <button onClick={function(){var nav=pendingDashNav;setPendingDashNav(null);setFreeExercises([]);setFreeProgName('');setFreeSessName('');if(nav.type==='tab'){switchTab(nav.target)}else{navigateTo(nav.target)}}} style={{padding:'12px 16px',background:'transparent',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)',borderRadius:10,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Outfit'}}>🚪 Quitter sans sauvegarder</button>
          </div>
        </div>
      </div>}

      <style>{"@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } } @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } } @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } } @keyframes staggerIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } } .tile-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.15); } .tile-hover:active { transform: translateY(0); box-shadow: var(--shadow); } .tile-hover { transition: transform 0.2s ease, box-shadow 0.2s ease; } .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(196,151,58,0.35); } .btn-hover:active { transform: translateY(0); } .btn-hover { transition: transform 0.15s ease, box-shadow 0.15s ease; } @media (max-width: 600px) { .shop-grid { grid-template-columns: 1fr !important; } .stats-row { grid-template-columns: repeat(2, 1fr) !important; } .tiles-grid { grid-template-columns: repeat(2, 1fr) !important; } .info-row { flex-direction: column !important; } }"}</style>
    </div>
  )
}

function formatDate(iso) {
  var d = new Date(iso)
  var DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  var MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]
}

function formatTime(iso) {
  var d = new Date(iso)
  return d.getHours().toString().padStart(2,'0') + 'h' + d.getMinutes().toString().padStart(2,'0')
}

var tabLabel = { fontSize: 9, marginTop: 2, fontWeight: 500, letterSpacing: '0.02em' }
function tabStyle(active) {
  return { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 14px', background: active ? 'rgba(196,151,58,0.08)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'Outfit', color: active ? GOLD : 'var(--muted)', borderRadius: 10, transition: 'all 0.2s' }
}

var s = {
  nav: { position:'sticky', top:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', background:'var(--bg)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--border)', boxShadow:'0 2px 12px rgba(0,0,0,0.15)' },
  navLogo: { fontFamily:'Cormorant Garamond, serif', fontSize:18, fontWeight:400 },
  btnNav: { background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer', fontFamily:'Outfit, sans-serif' },
  container: { maxWidth:900, margin:'0 auto', padding:'32px 20px', position:'relative', zIndex:1 },
  tilesGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:14, marginBottom:24 },
  tile: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 20px', cursor:'pointer', fontFamily:'Outfit, sans-serif', textAlign:'center', transition:'all 0.2s', display:'flex', flexDirection:'column', alignItems:'center', gap:6, boxShadow:'var(--shadow)' },
  tileIcon: { fontSize:32, marginBottom:4 },
  tileTitle: { fontSize:15, fontWeight:500, color:'var(--text)' },
  tileSub: { fontSize:12, color:'var(--muted)' },
  nextCard: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', background:'rgba(196,151,58,0.06)', border:'1px solid rgba(196,151,58,0.2)', borderRadius:12, marginBottom:16 },
  nextDate: { width:48, height:48, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  contactBar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, marginBottom:16, boxShadow:'var(--shadow)' },
  viewHeader: { marginBottom:24 },
  viewTitle: { fontFamily:'Cormorant Garamond, serif', fontSize:26, marginBottom:4 },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:20 },
  statCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'20px', boxShadow:'var(--shadow)' },
  statLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)' },
  section: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'24px', marginBottom:16, boxShadow:'var(--shadow)' },
  sectionTitle: { fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'#C4973A', marginBottom:16 },
  bookingRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, marginBottom:8 },
  emptyCard: { textAlign:'center', padding:'48px 24px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, boxShadow:'var(--shadow)' },
  shopGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:14, marginTop:16 },
  shopTabBtn: { flex:1, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:10, padding:'12px 16px', fontSize:13, cursor:'pointer', fontFamily:'Outfit, sans-serif', transition:'all 0.2s' },
  shopCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'28px 20px 20px', display:'flex', flexDirection:'column', gap:10, textAlign:'center', boxShadow:'var(--shadow)' },
  shopLabel: { fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)' },
  shopTitle: { fontFamily:'Cormorant Garamond, serif', fontSize:18, lineHeight:1.3 },
  shopPrice: { fontSize:28, fontWeight:600, color:'#C4973A', fontFamily:'Outfit, sans-serif' },
  shopPer: { fontSize:11, color:'var(--muted)', fontWeight:400 },
  shopSaving: { fontSize:11, fontWeight:600, color:'#4ade80', background:'rgba(74,222,128,0.08)', padding:'4px 10px', borderRadius:6, margin:'0 auto' },
  shopBest: { position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'#C4973A', color:'#000', fontSize:10, fontWeight:600, padding:'5px 14px', borderRadius:20, textTransform:'uppercase', whiteSpace:'nowrap' },
  btnShop: { display:'block', textAlign:'center', background:'#C4973A', color:'#000', borderRadius:10, padding:'14px', fontSize:13, fontWeight:600, textDecoration:'none', marginTop:'auto', letterSpacing:'0.02em', transition:'all 0.2s', boxShadow:'0 2px 8px rgba(196,151,58,0.25)' },
  settingsCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'32px 28px', boxShadow:'var(--shadow)' },
  settingsField: { marginBottom:20 },
  settingsLabel: { fontSize:11, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--muted)', marginBottom:6 },
  settingsInput: { width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', color:'var(--text)', fontSize:14, fontFamily:'Outfit, sans-serif', outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' },
  btnGold: { background:'#C4973A', color:'#000', border:'none', borderRadius:10, padding:'13px 24px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Outfit, sans-serif', textDecoration:'none', display:'inline-block', transition:'all 0.2s', boxShadow:'0 2px 8px rgba(196,151,58,0.25)' },
  btnGoldSmall: { background:'#C4973A', color:'#000', border:'none', borderRadius:8, padding:'10px 18px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'Outfit, sans-serif', textDecoration:'none', whiteSpace:'nowrap', transition:'all 0.2s' },
  btnCancel: { background:'transparent', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 14px', fontSize:12, cursor:'pointer', fontFamily:'Outfit, sans-serif' },
}
