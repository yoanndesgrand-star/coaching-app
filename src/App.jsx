import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordReset, setIsPasswordReset] = useState(false)

  useEffect(() => {
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
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      if (error) console.error('Profile error:', error)
      setProfile(data || null)
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (isPasswordReset) return <ResetPassword />

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#080808' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:32, color:'#C4973A', marginBottom:8 }}>Yoann Desgrand</div>
        <div style={{ fontSize:13, color:'#7a7065' }}>Chargement…</div>
      </div>
    </div>
  )

  if (!session) return (
    <Routes>
      <Route path="*" element={<Login />} />
    </Routes>
  )

  if (!profile) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#080808', color:'#f87171', fontSize:14 }}>
      Profil introuvable. Contacte le support.
    </div>
  )

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" />} />
      <Route path="/admin" element={profile.is_admin ? <Admin profile={profile} /> : <Navigate to="/" />} />
      <Route path="/" element={profile.is_admin ? <Navigate to="/admin" /> : <Dashboard profile={profile} setProfile={setProfile} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
