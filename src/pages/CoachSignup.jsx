import { useState } from 'react'
import { supabase } from '../lib/supabase'

var GOLD = '#C4973A'

export default function CoachSignup() {
  var [step, setStep] = useState(1)
  var [loading, setLoading] = useState(false)
  var [error, setError] = useState('')
  var [success, setSuccess] = useState(false)

  // Step 1: Account
  var [email, setEmail] = useState('')
  var [password, setPassword] = useState('')
  var [firstName, setFirstName] = useState('')
  var [lastName, setLastName] = useState('')
  var [phone, setPhone] = useState('')

  // Step 2: Branding
  var [brandName, setBrandName] = useState('')
  var [specialty, setSpecialty] = useState('')
  var [brandColor, setBrandColor] = useState('#C4973A')
  var [bio, setBio] = useState('')
  var [logoFile, setLogoFile] = useState(null)
  var [logoPreview, setLogoPreview] = useState(null)

  function handleLogoChange(e) {
    var file = e.target.files[0]
    if (!file) return
    setLogoFile(file)
    var reader = new FileReader()
    reader.onload = function(ev) { setLogoPreview(ev.target.result) }
    reader.readAsDataURL(file)
  }

  async function handleSignup() {
    setLoading(true); setError('')

    if (!firstName.trim() || !lastName.trim()) { setError('Nom et prénom requis'); setLoading(false); return }
    if (!email.trim()) { setError('Email requis'); setLoading(false); return }
    if (password.length < 8) { setError('Mot de passe : 8 caractères minimum'); setLoading(false); return }

    try {
      // 1. Create auth account
      var { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: { emailRedirectTo: window.location.origin }
      })
      if (authError) { setError(authError.message); setLoading(false); return }
      if (!authData?.user) { setError('Erreur de création de compte'); setLoading(false); return }

      var userId = authData.user.id

      // 2. Upload logo if present
      var logoUrl = null
      if (logoFile) {
        var ext = logoFile.name.split('.').pop()
        var path = 'logos/' + userId + '.' + ext
        var { error: uploadErr } = await supabase.storage.from('avatars').upload(path, logoFile, { upsert: true })
        if (!uploadErr) {
          var { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      // 3. Create coach profile
      await supabase.from('profiles').upsert({
        id: userId,
        email: email.trim(),
        full_name: firstName.trim() + ' ' + lastName.trim(),
        phone: phone.trim(),
        is_admin: true,
        credits: 0,
        brand_name: brandName.trim() || firstName.trim() + ' ' + lastName.trim(),
        brand_color: brandColor,
        logo_url: logoUrl,
        specialty: specialty.trim(),
        coach_bio: bio.trim(),
      }, { onConflict: 'id' })

      // 4. Create default coaching settings
      await supabase.from('coaching_settings').upsert({
        id: 'coach-' + userId,
        coach_id: userId,
        session_duration: 60,
        buffer_time: 15,
        buffer_mode: 'both',
        session_price: 50,
        booking_window_weeks: 4,
      }, { onConflict: 'id' })

      setSuccess(true)
    } catch(e) {
      setError(e.message || 'Erreur inattendue')
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Bienvenue coach !</div>
          <div style={{ fontSize: 14, color: '#7a7065', lineHeight: 1.6, marginBottom: 24 }}>
            Ton espace est prêt. Vérifie tes emails pour confirmer ton compte, puis connecte-toi.
          </div>
          <button onClick={function() { window.location.href = '/' }} style={S.btnGold}>Se connecter →</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 4 }}>🏋️</div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22 }}>Devenir coach</div>
          <div style={{ fontSize: 12, color: '#7a7065', marginTop: 4 }}>Crée ton espace coaching en 2 minutes</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: GOLD }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: step >= 2 ? GOLD : '#2a2520' }} />
        </div>

        {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}

        {/* Step 1: Account */}
        {step === 1 && <div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>1. Ton compte</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Prénom *</div>
              <input value={firstName} onChange={function(e) { setFirstName(e.target.value) }} style={S.input} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Nom *</div>
              <input value={lastName} onChange={function(e) { setLastName(e.target.value) }} style={S.input} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Email *</div>
            <input type="email" value={email} onChange={function(e) { setEmail(e.target.value) }} style={S.input} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Mot de passe * (min. 8 caractères)</div>
            <input type="password" value={password} onChange={function(e) { setPassword(e.target.value) }} style={S.input} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>Téléphone</div>
            <input type="tel" value={phone} onChange={function(e) { setPhone(e.target.value) }} placeholder="+33..." style={S.input} />
          </div>
          <button onClick={function() {
            if (!firstName.trim() || !lastName.trim()) { setError('Nom et prénom requis'); return }
            if (!email.trim()) { setError('Email requis'); return }
            if (password.length < 8) { setError('8 caractères minimum'); return }
            setError(''); setStep(2)
          }} style={S.btnGold}>Suivant →</button>
        </div>}

        {/* Step 2: Branding */}
        {step === 2 && <div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 14 }}>2. Ton identité</div>

          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Nom de ta marque / entreprise</div>
            <input value={brandName} onChange={function(e) { setBrandName(e.target.value) }} placeholder={firstName + ' ' + lastName} style={S.input} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Spécialité</div>
            <input value={specialty} onChange={function(e) { setSpecialty(e.target.value) }} placeholder="Ex: Coach Sport & Nutrition" style={S.input} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Bio courte</div>
            <textarea value={bio} onChange={function(e) { setBio(e.target.value) }} placeholder="Présente-toi en quelques lignes..." style={{ ...S.input, minHeight: 70, resize: 'vertical' }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={S.label}>Couleur principale</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={brandColor} onChange={function(e) { setBrandColor(e.target.value) }} style={{ width: 44, height: 36, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
              <input value={brandColor} onChange={function(e) { setBrandColor(e.target.value) }} style={{ ...S.input, flex: 1, fontFamily: 'monospace', fontSize: 13 }} />
              <div style={{ width: 36, height: 36, borderRadius: 8, background: brandColor }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={S.label}>Logo (facultatif)</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', border: '1px dashed #2a2520', borderRadius: 10, cursor: 'pointer' }}>
              {logoPreview ? <img src={logoPreview} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} /> : <div style={{ width: 48, height: 48, borderRadius: 10, background: '#1a1714', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>}
              <div style={{ fontSize: 13, color: '#7a7065' }}>{logoFile ? logoFile.name : 'Clique pour uploader ton logo'}</div>
              <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Preview */}
          <div style={{ background: '#0a0908', border: '1px solid #2a2520', borderRadius: 12, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Aperçu</div>
            {logoPreview && <img src={logoPreview} style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', marginBottom: 8 }} />}
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18 }}>
              {(brandName || firstName + ' ' + lastName).split(' ').map(function(w, i) {
                return i === 0 ? w + ' ' : <span key={i} style={{ color: brandColor }}>{w}</span>
              })}
            </div>
            {specialty && <div style={{ fontSize: 10, color: '#7a7065', marginTop: 2 }}>{specialty}</div>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={function() { setStep(1); setError('') }} style={S.btnBack}>←</button>
            <button onClick={handleSignup} disabled={loading} style={{ ...S.btnGold, flex: 1, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Création...' : '✓ Créer mon espace coach'}
            </button>
          </div>
        </div>}

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/" style={{ fontSize: 12, color: '#7a7065', textDecoration: 'none' }}>Déjà coach ? Se connecter →</a>
        </div>
      </div>
    </div>
  )
}

var S = {
  page: { minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'Outfit, sans-serif', color: '#f0ece4' },
  card: { background: '#0f0e0c', border: '1px solid #2a2520', borderRadius: 20, padding: '32px 24px', maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  label: { fontSize: 11, color: '#7a7065', marginBottom: 4, fontWeight: 500 },
  input: { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1px solid #2a2520', background: '#141210', color: '#f0ece4', fontFamily: 'Outfit, sans-serif', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  btnGold: { width: '100%', padding: '14px', background: GOLD, color: '#000', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(196,151,58,0.25)' },
  btnBack: { padding: '14px 18px', background: '#141210', color: '#f0ece4', border: '1px solid #2a2520', borderRadius: 12, fontSize: 15, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s' }
}
