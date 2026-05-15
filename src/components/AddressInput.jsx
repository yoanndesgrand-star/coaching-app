import { useState, useRef } from 'react'

export default function AddressInput({ value, onChange, placeholder, style }) {
  var [suggestions, setSuggestions] = useState([])
  var [show, setShow] = useState(false)
  var timer = useRef(null)

  function handleChange(e) {
    var v = e.target.value
    onChange(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.length < 3) { setSuggestions([]); return }
    timer.current = setTimeout(function() {
      fetch('https://api-adresse.data.gouv.fr/search/?q=' + encodeURIComponent(v) + '&limit=5')
        .then(function(r) { return r.json() })
        .then(function(data) {
          setSuggestions((data.features || []).map(function(f) { return f.properties.label }))
          setShow(true)
        })
        .catch(function() { setSuggestions([]) })
    }, 300)
  }

  function select(addr) {
    onChange(addr)
    setSuggestions([])
    setShow(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value || ''}
        onChange={handleChange}
        onFocus={function() { if (suggestions.length > 0) setShow(true) }}
        onBlur={function() { setTimeout(function() { setShow(false) }, 200) }}
        placeholder={placeholder || 'Tapez une adresse...'}
        style={style}
      />
      {show && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0 0 10px 10px', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxHeight: 200, overflow: 'auto' }}>
          {suggestions.map(function(s, i) {
            return <button key={i} onMouseDown={function() { select(s) }} style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontFamily: 'Outfit', fontSize: 12, color: 'var(--text)', textAlign: 'left' }}>{s}</button>
          })}
        </div>
      )}
    </div>
  )
}
