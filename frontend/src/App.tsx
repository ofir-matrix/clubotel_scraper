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

export const App: React.FC = () => {
  const [data, setData] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ status: 'idle' })

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
      const res = await fetch('/lowest_two_prices_json', { cache: 'no-store' })
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
    fetchData()
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
        <button className="btn" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>No data yet. Click Refresh.</td>
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
