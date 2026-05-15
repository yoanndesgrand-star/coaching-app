import { useEffect, useState, Component } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import LandingPage from './pages/LandingPage'
import CoachLandingPage from './pages/CoachLandingPage'
import Dashboard from './pages/Dashboard'
import Discovery from './pages/Discovery'
import Admin from './pages/Admin'
import ResetPassword from './pages/ResetPassword'
import CoachSignup from './pages/CoachSignup'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error: error } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Outfit, sans-serif', color: '#f0ece4', background: '#080808', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
          <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Oops, quelque chose a planté</div>
          <div style={{ fontSize: 13, color: '#7a7065', marginBottom: 24, maxWidth: 300 }}>{this.state.error && this.state.error.message}</div>
          <button onClick={function() { window.location.reload() }} style={{ background: '#C4973A', color: '#000', border: 'none', borderRadius: 10, padding: '14px 32px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit' }}>Recharger l'app</button>
        </div>
      )
    }
    return this.props.children
  }
}

function CoachPageRoute() {
  var { slug } = useParams()
  var [brand, setBrand] = useState(null)
  var [cId, setCId] = useState(null)
  useEffect(function() {
    if (!slug) return
    supabase.from('profiles').select('*').eq('subdomain', slug).single().then(function(r) {
      if (r.data) {
        setBrand({ name: r.data.brand_name || r.data.full_name, color: r.data.brand_color || '#C4973A', logo: r.data.logo_url, specialty: r.data.specialty, whatsapp: r.data.whatsapp, reviewUrl: r.data.google_reviews_url })
        setCId(r.data.id)
      }
    })
  }, [slug])
  if (!brand) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080706', color: '#7a7065', fontFamily: 'Outfit' }}>Chargement...</div>
  return <CoachLandingPage coachBrand={brand} coachId={cId} />
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileChecked, setProfileChecked] = useState(false)
  const [isPasswordReset, setIsPasswordReset] = useState(false)
  const [coachBrand, setCoachBrand] = useState({ name: 'Yoann Desgrand', color: '#C4973A', logo: null, specialty: 'Coach Sport & Nutrition' })
  const [subdomainCoachId, setSubdomainCoachId] = useState(null)

  // Detect subdomain: thomas.ydcoaching.fr → 'thomas'
  function detectSubdomain() {
    try {
      var host = window.location.hostname
      // Skip localhost, vercel preview, and main app domain
      if (host === 'localhost' || host.includes('vercel.app') || host === 'app.yoanndesgrand.fr') return null
      var parts = host.split('.')
      // pattern: subdomain.domain.tld (at least 3 parts, first part is the subdomain)
      if (parts.length >= 3 && parts[0] !== 'app' && parts[0] !== 'www') return parts[0]
      return null
    } catch(e) { return null }
  }

  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light')

    // Detect subdomain and load coach branding
    var sub = detectSubdomain()
    if (sub) {
      supabase.from('profiles').select('id, brand_name, brand_color, logo_url, specialty, whatsapp, google_review_url, social_links, full_name').eq('subdomain', sub).eq('is_admin', true).single().then(function(r) {
        if (r.data) {
          setSubdomainCoachId(r.data.id)
          setCoachBrand({ name: r.data.brand_name || r.data.full_name || 'Coach', color: r.data.brand_color || '#C4973A', logo: r.data.logo_url, specialty: r.data.specialty || '', whatsapp: r.data.whatsapp || '', reviewUrl: r.data.google_review_url || '', socialLinks: (function(){ try { var s = r.data.social_links; return typeof s === 'string' ? JSON.parse(s) : (s || {}) } catch(e){ return {} } })() })
          // Apply coach's brand color to CSS
          if (r.data.brand_color) document.documentElement.style.setProperty('--gold', r.data.brand_color)
        }
      })
    }

    // Capture referral code from URL
    try {
      var params = new URLSearchParams(window.location.search)
      var ref = params.get('ref')
      if (ref) { localStorage.setItem('yd_ref', ref); window.history.replaceState({}, '', window.location.pathname) }
    } catch(e) {}

    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setIsPasswordReset(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session && !hash.includes('type=recovery')) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordReset(true)
        setSession(session)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) { setProfileChecked(false); fetchProfile(session.user.id) }
      else { setProfile(null); setProfileChecked(false); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      let { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()

      // Si le profil n'existe pas, on le crée automatiquement
      if (error && error.code === 'PGRST116') {
        const { data: { user } } = await supabase.auth.getUser()
        var refCode = (userId.replace(/-/g, '').slice(0, 6)).toUpperCase()
        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: user?.email || '',
            full_name: user?.user_metadata?.full_name || '',
            is_admin: false,
            credits: 0,
            referral_code: refCode,
            coach_id: subdomainCoachId || null,
          }, { onConflict: 'id' })
          .select()
          .single()
        data = newProfile
        // Send welcome email
        if (newProfile && newProfile.email) {
          fetch('/api/email-sequences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'welcome', email: newProfile.email, name: newProfile.full_name, profileId: newProfile.id }) }).catch(function(){})
        }
        // Process referral
        try {
          var savedRef = localStorage.getItem('yd_ref')
          if (savedRef && newProfile) {
            localStorage.removeItem('yd_ref')
            var { data: referrer } = await supabase.from('profiles').select('id, credits').eq('referral_code', savedRef).single()
            if (referrer && referrer.id !== newProfile.id) {
              await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: newProfile.id })
              await supabase.from('profiles').update({ credits: (referrer.credits || 0) + 1 }).eq('id', referrer.id)
            }
          }
        } catch(e) {}
      } else if (error) {
        console.error('Profile error:', error)
      }

      setProfile(data || null)
      // Load coach branding
      if (data) {
        if (data.is_admin) {
          setCoachBrand({ name: data.brand_name || data.full_name || 'Coach', color: data.brand_color || '#C4973A', logo: data.logo_url, specialty: data.specialty || '', whatsapp: data.whatsapp || '', reviewUrl: data.google_review_url || '', socialLinks: (function(){ try { var s = data.social_links; return typeof s === 'string' ? JSON.parse(s) : (s || {}) } catch(e){ return {} } })() })
        } else if (data.coach_id) {
          supabase.from('profiles').select('brand_name, brand_color, logo_url, specialty, whatsapp, google_review_url, social_links, full_name').eq('id', data.coach_id).single().then(function(r) {
            if (r.data) setCoachBrand({ name: r.data.brand_name || r.data.full_name || 'Coach', color: r.data.brand_color || '#C4973A', logo: r.data.logo_url, specialty: r.data.specialty || '', whatsapp: r.data.whatsapp || '', reviewUrl: r.data.google_review_url || '', socialLinks: (function(){ try { var s = r.data.social_links; return typeof s === 'string' ? JSON.parse(s) : (s || {}) } catch(e){ return {} } })() })
          })
        }
      }
      if (data && !data.is_admin) {
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(function() {})
        // Save push subscription if available
        try {
          var pushSub = localStorage.getItem('yd_push_sub')
          if (pushSub) {
            fetch('/api/admin-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'push-subscribe', userId: userId, subscription: JSON.parse(pushSub) }) }).catch(function() {})
          }
        } catch(e) {}
      }
      setProfileChecked(true)
    } catch(e) {
      console.error(e)
      setProfileChecked(true)
    } finally {
      setLoading(false)
    }
  }

  if (isPasswordReset) return <ResetPassword />

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:32, color:'#C4973A', marginBottom:8 }}>Yoann Desgrand</div>
        <div style={{ fontSize:13, color:'#7a7065' }}>Chargement…</div>
      </div>
    </div>
  )

  if (!session) return (
    <Routes>
      <Route path="/decouverte" element={<Discovery />} />
      <Route path="/coach-signup" element={<CoachSignup />} />
      <Route path="/page/:slug" element={<CoachPageRoute />} />
      <Route path="/login" element={<Login />} />
      <Route path="*" element={subdomainCoachId ? <CoachLandingPage coachBrand={coachBrand} coachId={subdomainCoachId} /> : <LandingPage />} />
    </Routes>
  )

  if (!profile) {
    if (!profileChecked) {
      // Profil en cours de chargement
      return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)' }}>
          <div style={{ textAlign:'center' }}>
            {coachBrand.logo && <img src={coachBrand.logo} style={{ width:48, height:48, borderRadius:12, objectFit:'cover', marginBottom:12 }} />}
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:32, color: coachBrand.color, marginBottom:8 }}>{coachBrand.name}</div>
            <div style={{ fontSize:13, color:'#7a7065' }}>Chargement…</div>
          </div>
        </div>
      )
    }
    // Profil vérifié mais introuvable → déconnexion
    supabase.auth.signOut()
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', flexDirection:'column', gap:16 }}>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:24, color:'var(--text)' }}>Session expirée</div>
        <div style={{ fontSize:13, color:'var(--muted)' }}>Reconnecte-toi pour accéder à ton espace.</div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/login" element={<Navigate to="/" />} />
      <Route path="/decouverte" element={<Discovery />} />
      <Route path="/page/:slug" element={<CoachPageRoute />} />
      <Route path="/admin" element={profile.is_admin ? <Admin profile={profile} setProfile={setProfile} coachBrand={coachBrand} setCoachBrand={setCoachBrand} /> : <Navigate to="/" />} />
      <Route path="/" element={profile.is_admin ? <Navigate to="/admin" /> : <Dashboard profile={profile} setProfile={setProfile} coachBrand={coachBrand} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </ErrorBoundary>
  )
}
