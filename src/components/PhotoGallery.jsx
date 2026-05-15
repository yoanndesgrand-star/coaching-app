import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

var GOLD = '#C4973A'
var ZONES = [
  { k: 'front', l: 'Face', icon: '🧍' },
  { k: 'side', l: 'Profil', icon: '🧍‍♂️' },
  { k: 'back', l: 'Dos', icon: '🔄' },
  { k: 'other', l: 'Autre', icon: '📷' }
]

export default function PhotoGallery({ clientId, photos, onRefresh, isCoach }) {
  var [view, setView] = useState('grid') // grid, timeline, compare, fullscreen
  var [uploadZone, setUploadZone] = useState('front')
  var [uploadType, setUploadType] = useState('progress')
  var [uploading, setUploading] = useState(false)
  var [fullImg, setFullImg] = useState(null)
  var [compareZone, setCompareZone] = useState('front')
  var [sliderPos, setSliderPos] = useState(50)
  var sliderRef = useRef(null)

  async function handleUpload(e) {
    var file = e.target.files[0]; if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 Mo'); return }
    setUploading(true)
    var ext = file.name.split('.').pop()
    var path = 'photos/' + clientId + '/' + Date.now() + '.' + ext
    var { error } = await supabase.storage.from('uploads').upload(path, file)
    if (!error) {
      var { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      await supabase.from('client_photos').insert({
        client_id: clientId,
        photo_url: urlData.publicUrl,
        type: uploadType,
        zone: uploadZone,
        taken_at: new Date().toISOString().split('T')[0]
      })
      if (onRefresh) onRefresh()
    }
    setUploading(false)
    e.target.value = ''
  }

  async function deletePhoto(id) {
    if (!confirm('Supprimer cette photo ?')) return
    await supabase.from('client_photos').delete().eq('id', id)
    if (onRefresh) onRefresh()
  }

  function handleSlider(e) {
    if (!sliderRef.current) return
    var rect = sliderRef.current.getBoundingClientRect()
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    var pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(pct)
  }

  var sorted = (photos || []).slice().sort(function(a, b) { return new Date(a.taken_at) - new Date(b.taken_at) })

  // ═══ FULLSCREEN ═══
  if (fullImg) {
    return (
      <div onClick={function() { setFullImg(null) }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <img src={fullImg.photo_url} style={{ maxWidth: '95%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#fff', marginBottom: 4 }}>{fullImg.type === 'before' ? 'Avant' : fullImg.type === 'after' ? 'Après' : 'Progrès'} — {ZONES.find(function(z) { return z.k === fullImg.zone }) ? ZONES.find(function(z) { return z.k === fullImg.zone }).l : ''}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{fullImg.taken_at}</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[{ k: 'grid', l: '📷 Galerie' }, { k: 'timeline', l: '📅 Timeline' }, { k: 'compare', l: '🔀 Comparer' }].map(function(v) {
          return <button key={v.k} onClick={function() { setView(v.k) }} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: '1px solid', borderColor: view === v.k ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: view === v.k ? 'rgba(196,151,58,0.1)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 11, fontWeight: 500 }}>{v.l}</button>
        })}
      </div>

      {/* Upload */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {ZONES.map(function(z) {
            return <button key={z.k} onClick={function() { setUploadZone(z.k) }} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, border: '1px solid', borderColor: uploadZone === z.k ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: uploadZone === z.k ? 'rgba(196,151,58,0.1)' : 'transparent', color: uploadZone === z.k ? GOLD : 'var(--muted)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 10, textAlign: 'center' }}>{z.icon}<div>{z.l}</div></button>
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'before', l: '📷 Avant' }, { k: 'after', l: '📷 Après' }, { k: 'progress', l: '📷 Progrès' }].map(function(t) {
            return <label key={t.k} onClick={function() { setUploadType(t.k) }} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', border: '1px dashed', borderColor: uploadType === t.k ? 'rgba(196,151,58,0.4)' : 'var(--border)', borderRadius: 10, cursor: 'pointer', fontSize: 11, color: uploadType === t.k ? GOLD : 'var(--muted)', background: uploadType === t.k ? 'rgba(196,151,58,0.05)' : 'transparent' }}>
              {uploading ? '⏳' : t.l}
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleUpload} />
            </label>
          })}
        </div>
      </div>

      {/* ═══ GRID VIEW ═══ */}
      {view === 'grid' && (
        <div>
          {ZONES.map(function(zone) {
            var zonePhotos = sorted.filter(function(p) { return (p.zone || 'other') === zone.k })
            if (zonePhotos.length === 0) return null
            return (
              <div key={zone.k} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{zone.icon} {zone.l}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {zonePhotos.map(function(p) {
                    var label = p.type === 'before' ? 'Avant' : p.type === 'after' ? 'Après' : 'Progrès'
                    return (
                      <div key={p.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={function() { setFullImg(p) }}>
                        <img src={p.photo_url} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 }} />
                        <div style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>{label}</div>
                        <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>{p.taken_at}</div>
                        {isCoach && <button onClick={function(e) { e.stopPropagation(); deletePhoto(p.id) }} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(220,38,38,0.8)', color: '#fff', border: 'none', borderRadius: 4, width: 18, height: 18, fontSize: 10, cursor: 'pointer' }}>✕</button>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {sorted.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>📸 Aucune photo. Prends ta première !</div>}
        </div>
      )}

      {/* ═══ TIMELINE VIEW ═══ */}
      {view === 'timeline' && (
        <div>
          {(function() {
            var dates = {}
            sorted.forEach(function(p) { if (!dates[p.taken_at]) dates[p.taken_at] = []; dates[p.taken_at].push(p) })
            var dateKeys = Object.keys(dates).sort()
            return dateKeys.map(function(date) {
              return (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: GOLD, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: GOLD, flexShrink: 0 }} />
                    {new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingLeft: 20, borderLeft: '2px solid rgba(196,151,58,0.2)', marginLeft: 4, paddingBottom: 4 }}>
                    {dates[date].map(function(p) {
                      var zone = ZONES.find(function(z) { return z.k === p.zone }) || { l: '' }
                      return (
                        <div key={p.id} style={{ flexShrink: 0, cursor: 'pointer' }} onClick={function() { setFullImg(p) }}>
                          <img src={p.photo_url} style={{ width: 100, height: 130, objectFit: 'cover', borderRadius: 10 }} />
                          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{zone.icon} {p.type === 'before' ? 'Avant' : p.type === 'after' ? 'Après' : 'Progrès'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
          {sorted.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>Aucune photo dans la timeline.</div>}
        </div>
      )}

      {/* ═══ COMPARE VIEW (SLIDER) ═══ */}
      {view === 'compare' && (function() {
        var zonePhotos = sorted.filter(function(p) { return (p.zone || 'other') === compareZone })
        var befores = zonePhotos.filter(function(p) { return p.type === 'before' })
        var afters = zonePhotos.filter(function(p) { return p.type === 'after' || p.type === 'progress' })
        var beforeImg = befores.length > 0 ? befores[0] : null
        var afterImg = afters.length > 0 ? afters[afters.length - 1] : null

        return (
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {ZONES.map(function(z) {
                return <button key={z.k} onClick={function() { setCompareZone(z.k); setSliderPos(50) }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid', borderColor: compareZone === z.k ? 'rgba(196,151,58,0.4)' : 'var(--border)', background: compareZone === z.k ? 'rgba(196,151,58,0.1)' : 'transparent', color: compareZone === z.k ? GOLD : 'var(--muted)', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 10 }}>{z.icon} {z.l}</button>
              })}
            </div>

            {beforeImg && afterImg ? (
              <div>
                <div ref={sliderRef} onMouseMove={function(e) { if (e.buttons === 1) handleSlider(e) }} onTouchMove={function(e) { handleSlider(e) }} style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', cursor: 'col-resize', userSelect: 'none', touchAction: 'none' }}>
                  {/* After (full background) */}
                  <img src={afterImg.photo_url} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* Before (clipped) */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: sliderPos + '%', height: '100%', overflow: 'hidden' }}>
                    <img src={beforeImg.photo_url} style={{ position: 'absolute', top: 0, left: 0, width: sliderRef.current ? sliderRef.current.offsetWidth + 'px' : '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  {/* Slider line */}
                  <div style={{ position: 'absolute', top: 0, left: sliderPos + '%', width: 3, height: '100%', background: '#fff', transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }}>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>↔</div>
                  </div>
                  {/* Labels */}
                  <div style={{ position: 'absolute', top: 12, left: 12, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6 }}>Avant</div>
                  <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6 }}>Après</div>
                  {/* Dates */}
                  <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{beforeImg.taken_at}</div>
                  <div style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{afterImg.taken_at}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>↔ Glisse pour comparer</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                {!beforeImg && !afterImg && <div>Ajoute une photo "Avant" et une "Après" pour comparer.</div>}
                {beforeImg && !afterImg && <div>Photo "Avant" prête ! Ajoute une photo "Après" pour comparer.</div>}
                {!beforeImg && afterImg && <div>Photo "Après" prête ! Ajoute une photo "Avant" pour comparer.</div>}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
