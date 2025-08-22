import React, { useEffect, useMemo, useState } from 'react'

interface SummaryRow {
  in: string
  out: string
  room_only: number | null
  breakfast: number | null
}

interface Progress {
  status: 'idle' | 'running' | 'done' | 'unknown'
  total?: number
  done?: number
}

function formatNis(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value)
}

function diffNights(inDate: string, outDate: string) {
  const inD = new Date(inDate)
  const outD = new Date(outDate)
  const ms = outD.getTime() - inD.getTime()
  const nights = Math.round(ms / (1000 * 60 * 60 * 24))
  return Math.max(1, nights)
}

function fmtDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export const App: React.FC = () => {
  const today = new Date()
  const twoWeeks = new Date(today)
  twoWeeks.setDate(twoWeeks.getDate() + 14)

  const [data, setData] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ status: 'idle' })
  const [fast, setFast] = useState(false)
  const [start, setStart] = useState(fmtDateInput(today))
  const [end, setEnd] = useState(fmtDateInput(twoWeeks))

  const pollProgress = () => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/progress', { cache: 'no-store' })
        if (res.ok) {
          const p = (await res.json()) as Progress
          setProgress(p)
          if (p.status === 'done') clearInterval(timer)
        }
      } catch {}
    }, 800)
    return () => clearInterval(timer)
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    const stop = pollProgress()
    try {
      const params = new URLSearchParams({ fast: fast ? '1' : '0', start, end })
      const res = await fetch(`/lowest_two_prices_json?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = (await res.json()) as unknown
      if (!Array.isArray(json)) throw new Error('Unexpected response')
      const safe = json.map((r: any) => ({
        in: String(r?.in ?? ''),
        out: String(r?.out ?? ''),
        room_only: r?.room_only ?? null,
        breakfast: r?.breakfast ?? null,
      })) as SummaryRow[]
      setData(safe)
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      stop()
      setLoading(false)
      setProgress({ status: 'idle' })
    }
  }

  useEffect(() => {
    // No auto refresh on mount
  }, [])

  const rows = useMemo(() => {
    return data.map(r => {
      const nights = diffNights(r.in, r.out)
      const roomOnlyPerNight = r.room_only != null ? Math.round(r.room_only / nights) : null
      const breakfastPerNight = r.breakfast != null ? Math.round(r.breakfast / nights) : null
      return { ...r, nights, roomOnlyPerNight, breakfastPerNight }
    })
  }, [data])

  const percent = progress.total && progress.total > 0
    ? Math.min(100, Math.round(((progress.done || 0) / progress.total) * 100))
    : undefined

  return (
    <div className="page">
      <header className="header">
        <h1>Clubotel Prices</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)' }}>
            <input type="checkbox" checked={fast} onChange={e => setFast(e.target.checked)} />
            Fast mode
          </label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} />
          <span style={{ color: 'var(--muted)' }}>→</span>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn" onClick={() => setEnd(fmtDateInput(addMonths(new Date(start), 1)))}>+1 mo</button>
            <button className="btn" onClick={() => setEnd(fmtDateInput(addMonths(new Date(start), 2)))}>+2 mo</button>
            <button className="btn" onClick={() => setEnd(fmtDateInput(addMonths(new Date(start), 3)))}>+3 mo</button>
          </div>
          <button className="btn" onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Nights</th>
              <th>Room only (total)</th>
              <th>Room only (per night)</th>
              <th>Breakfast (total)</th>
              <th>Breakfast (per night)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>Pick dates and click Refresh.</td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={`${r.in}-${r.out}-${i}`}>
                <td>{r.in}</td>
                <td>{r.out}</td>
                <td>{r.nights}</td>
                <td>{formatNis(r.room_only)}</td>
                <td>{formatNis(r.roomOnlyPerNight)}</td>
                <td>{formatNis(r.breakfast)}</td>
                <td>{formatNis(r.breakfastPerNight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="spinner" />
            <div className="overlay-title">Refreshing data…</div>
            {percent !== undefined && (
              <>
                <div className="progress">
                  <div className="bar" style={{ width: `${percent}%` }} />
                </div>
                <div className="progress-caption">{progress.done}/{progress.total} ({percent}%)</div>
              </>
            )}
            {percent === undefined && <div className="progress-caption">Starting…</div>}
          </div>
        </div>
      )}

      <footer className="footer">Prices in NIS. Updated on demand.</footer>
    </div>
  )
}
