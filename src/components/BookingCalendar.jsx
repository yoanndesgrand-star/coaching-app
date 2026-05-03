import { useEffect, useState } from 'react'

const GOLD = '#C4973A'
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function getSlotColor(slot) {
  const margin = slot.margin_minutes ?? 999
  const travel = slot.travel_minutes || 0

  // Pas de trajet ou pas d'événement avant → vert
  if (travel === 0 || margin >= 999) return { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', text: '#4ade80' }
  // Marge confortable (≥ 5 min après trajet) → vert
  if (margin >= 5) return { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)', text: '#4ade80' }
  // Marge serrée (0-5 min) → orange
  if (margin >= 0) return { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24' }
  // Marge négative (pas assez de temps) → rouge
  return { bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.4)', text: '#f87171' }
}

export default function BookingCalendar({ profile, onBooked }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [booking, setBooking] = useState(null)
  const [confirmSlot, setConfirmSlot] = useState(null)

  useEffect(() => { loadSlots() }, [year, month])

  async function loadSlots() {
    setLoading(true)
    setSelectedDate(null)
    try {
      const res = await fetch('/api/available-slots?year=' + year + '&month=' + month + '&clientId=' + profile.id)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch (e) { setSlots([]) }
    setLoading(false)
  }

  async function bookSlot(slot) {
    if (booking) return
    setBooking(slot.start)
    setConfirmSlot(null)
    try {
      const res = await fetch('/api/book-slot-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: profile.id, startTime: slot.start, endTime: slot.end })
      })
      const data = await res.json()
      if (data.success) {
        onBooked(data.creditsLeft)
        loadSlots()

        // Envoyer email de confirmation (silencieux, ne bloque pas)
        fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: profile.email,
            fullName: profile.full_name,
            date: formatDateTime(slot.start),
            time: formatTime(slot.start),
            location: clientLocation,
            creditsLeft: data.creditsLeft,
            coachingType: profile.coaching_type
          })
        }).catch(() => {})
      } else {
        alert(data.error || 'Erreur lors de la réservation')
      }
    } catch (e) { alert('Erreur de connexion') }
    setBooking(null)
  }

  function formatDateTime(iso) {
    const d = new Date(iso)
    const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    const MONTHS_FULL = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FULL[d.getMonth()]
  }

  function isLessThan24h(iso) {
    return (new Date(iso) - new Date()) < 24 * 60 * 60 * 1000
  }

  const clientLocation = profile.coaching_type === 'domicile'
    ? (profile.address || 'À domicile')
    : 'ON AIR BNF — 93 av. de France, Paris 13e'

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date(); today.setHours(0,0,0,0)
  const datesWithSlots = new Set(slots.map(s => s.date))
  const daySlots = selectedDate ? slots.filter(s => s.date === selectedDate) : []

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }
  function formatTime(iso) {
    const d = new Date(iso)
    return d.getHours().toString().padStart(2,'0') + 'h' + d.getMinutes().toString().padStart(2,'0')
  }

  return (
    <div>
      {/* Navigation mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={prevMonth} style={s.navBtn}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{MONTHS[month - 1]} {year}</div>
        <button onClick={nextMonth} style={s.navBtn}>→</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Chargement...</div>
      ) : (
        <>
          {/* Calendrier */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
            {DAYS_SHORT.map(d => (
              <div key={d} style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textAlign: 'center', padding: '4px 0', letterSpacing: '0.1em' }}>{d}</div>
            ))}
            {Array.from({ length: firstDay }, (_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0')
              const dayDate = new Date(year, month - 1, day)
              const isPast = dayDate < today
              const hasSlots = datesWithSlots.has(dateStr)
              const isSelected = selectedDate === dateStr
              const isToday = dayDate.toDateString() === today.toDateString()
              return (
                <div
                  key={day}
                  onClick={() => !isPast && hasSlots && setSelectedDate(dateStr)}
                  style={{
                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8, fontSize: 13,
                    fontWeight: isToday ? 600 : 400,
                    cursor: hasSlots && !isPast ? 'pointer' : 'default',
                    background: isSelected ? GOLD : hasSlots && !isPast ? 'rgba(196,151,58,0.15)' : 'transparent',
                    color: isSelected ? '#000' : isPast ? 'var(--dim)' : hasSlots ? 'var(--text)' : 'var(--muted)',
                    border: isToday && !isSelected ? '1px solid ' + GOLD : '1px solid transparent',
                  }}
                >
                  {day}
                </div>
              )
            })}
          </div>

          {/* Créneaux du jour */}
          {selectedDate && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
                Créneaux disponibles
              </div>
              {daySlots.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun créneau ce jour.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                  {daySlots.map(slot => {
                    const color = getSlotColor(slot)
                    return (
                      <button
                        key={slot.start}
                        onClick={() => setConfirmSlot(slot)}
                        disabled={booking === slot.start}
                        style={{
                          background: booking === slot.start ? 'var(--surface2)' : color.bg,
                          color: booking === slot.start ? 'var(--muted)' : color.text,
                          border: '1px solid ' + color.border,
                          borderRadius: 8, padding: '12px',
                          fontSize: 14, fontWeight: 500,
                          cursor: booking ? 'not-allowed' : 'pointer',
                          fontFamily: 'Outfit, sans-serif',
                          transition: 'all 0.15s'
                        }}
                      >
                        {booking === slot.start ? '...' : formatTime(slot.start)}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Légende */}
              <div style={{ padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 10, color: 'var(--muted)', letterSpacing: '0.05em' }}>LÉGENDE DES CRÉNEAUX</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: '#4ade80', flexShrink: 0 }} />
                    <span><strong style={{ color: '#4ade80' }}>Idéal</strong> — moins de 15 min de trajet pour Yoann</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: '#fbbf24', flexShrink: 0 }} />
                    <span><strong style={{ color: '#fbbf24' }}>Acceptable</strong> — entre 15 et 30 min de trajet</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: '#f87171', flexShrink: 0 }} />
                    <span><strong style={{ color: '#f87171' }}>Long trajet</strong> — plus de 30 min de déplacement</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                  Ces couleurs t'aident à choisir un créneau qui minimise les déplacements de Yoann entre ses séances.
                </div>
              </div>
            </div>
          )}

          {!selectedDate && slots.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Aucun créneau disponible ce mois-ci.
            </div>
          )}
          {!selectedDate && slots.length > 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              Clique sur un jour pour voir les créneaux disponibles.
            </div>
          )}
        </>
      )}

      {/* MODAL CONFIRMATION */}
      {confirmSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setConfirmSlot(null)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', maxWidth: 400, width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, marginBottom: 24, textAlign: 'center' }}>Confirmer la réservation</div>

            <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                📅 {formatDateTime(confirmSlot.start)} à {formatTime(confirmSlot.start)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                📍 {clientLocation}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 8 }}>
              <strong style={{ color: 'var(--text)' }}>Conditions d'annulation :</strong>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>
              • Annulation gratuite jusqu'à <strong style={{ color: 'var(--text)' }}>24h avant</strong> la séance (crédit restitué).<br />
              • Passé ce délai, la séance est due et le crédit ne sera pas remboursé.
            </div>

            {isLessThan24h(confirmSlot.start) && (
              <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#f87171', marginBottom: 16 }}>
                ⚠️ Ce créneau est dans moins de 24h — l'annulation sera impossible une fois confirmé.
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmSlot(null)}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 8, padding: '13px', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={() => bookSlot(confirmSlot)}
                disabled={!!booking}
                style={{ flex: 1, background: '#C4973A', color: '#000', border: 'none', borderRadius: 8, padding: '13px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
              >
                {booking ? 'Réservation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  navBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 14px', fontSize: 16, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }
}
