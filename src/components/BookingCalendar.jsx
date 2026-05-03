import { useEffect, useState } from 'react'

const GOLD = '#C4973A'
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

export default function BookingCalendar({ profile, onBooked }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    loadSlots()
  }, [year, month])

  async function loadSlots() {
    setLoading(true)
    setSelectedDate(null)
    try {
      const res = await fetch('/api/available-slots?year=' + year + '&month=' + month + '&clientId=' + profile.id)
      const data = await res.json()
      setSlots(data.slots || [])
    } catch (e) {
      setSlots([])
    }
    setLoading(false)
  }

  async function bookSlot(slot) {
    if (booking) return
    setBooking(slot.start)
    try {
      // Créer d'abord le time_slot dans Supabase
      const { createClient } = await import('@supabase/supabase-js')
      // On appelle l'API book-slot avec les données du créneau
      const res = await fetch('/api/book-slot-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: profile.id,
          startTime: slot.start,
          endTime: slot.end
        })
      })
      const data = await res.json()
      if (data.success) {
        onBooked(data.creditsLeft)
        loadSlots()
      } else {
        alert(data.error || 'Erreur lors de la réservation')
      }
    } catch (e) {
      alert('Erreur de connexion')
    }
    setBooking(null)
  }

  // Générer les jours du mois
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date(); today.setHours(0,0,0,0)

  // Jours qui ont des créneaux
  const datesWithSlots = new Set(slots.map(s => s.date))

  // Créneaux du jour sélectionné
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
            {Array.from({ length: firstDay }, (_, i) => <div key={'empty-' + i} />)}
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
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isToday ? 600 : 400,
                    cursor: hasSlots && !isPast ? 'pointer' : 'default',
                    background: isSelected ? GOLD : hasSlots && !isPast ? 'rgba(196,151,58,0.15)' : 'transparent',
                    color: isSelected ? '#000' : isPast ? 'var(--dim)' : hasSlots ? 'var(--text)' : 'var(--muted)',
                    border: isToday && !isSelected ? '1px solid ' + GOLD : '1px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  {day}
                </div>
              )
            })}
          </div>

          {/* Créneaux du jour sélectionné */}
          {selectedDate && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: GOLD, marginBottom: 12 }}>
                Créneaux disponibles
              </div>
              {daySlots.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Aucun créneau ce jour.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {daySlots.map(slot => (
                    <button
                      key={slot.start}
                      onClick={() => bookSlot(slot)}
                      disabled={booking === slot.start}
                      style={{
                        background: booking === slot.start ? 'var(--surface2)' : GOLD,
                        color: booking === slot.start ? 'var(--muted)' : '#000',
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: booking ? 'not-allowed' : 'pointer',
                        fontFamily: 'Outfit, sans-serif'
                      }}
                    >
                      {booking === slot.start ? '...' : formatTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!selectedDate && slots.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              Aucun créneau disponible ce mois-ci.
            </div>
          )}

          {!selectedDate && slots.length > 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
              Clique sur un jour en surbrillance pour voir les créneaux.
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  navBtn: { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '6px 14px', fontSize: 16, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }
}
