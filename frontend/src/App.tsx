import React, { useEffect, useMemo, useState } from 'react'

interface SummaryRow {
  in: string
  out: string
  room_only: number | null
  breakfast: number | null
}

type SummaryRowWithFlags = SummaryRow & { prefetched?: boolean }

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

function generateDateRanges(start: string, end: string) {
  const ranges: Array<{in: string, out: string}> = []
  const startDate = new Date(start)
  const endDate = new Date(end)
  const curr = new Date(startDate)
  
  while (curr <= endDate) {
    if (curr.getDay() === 0) { // Sunday
      const out = new Date(curr)
      out.setDate(out.getDate() + 4)
      if (out <= endDate) {
        ranges.push({
          in: fmtDateInput(curr),
          out: fmtDateInput(out)
        })
      }
    }
    if (curr.getDay() === 4) { // Thursday
      const out = new Date(curr)
      out.setDate(out.getDate() + 3)
      if (out <= endDate) {
        ranges.push({
          in: fmtDateInput(curr),
          out: fmtDateInput(out)
        })
      }
    }
    curr.setDate(curr.getDate() + 1)
  }
  return ranges
}

function buildClubotelUrl(inDate: string, outDate: string) {
  const params = new URLSearchParams({
    lang: 'heb',
    hotel: '1_1',
    rooms: '1',
    ad1: '2',
    ch1: '3',
    inf1: '0',
    in: inDate,
    out: outDate,
    _ga: '2.78397907.694390100.1752303048-758168206.1752303047'
  })
  return `https://www.clubhotels.co.il/BE_Results.aspx?${params.toString()}`
}

async function fetchWithProxy(url: string): Promise<string> {
  const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  const resp = await fetch(proxied, { cache: 'no-store' })
  if (!resp.ok) throw new Error(`Proxy fetch failed: ${resp.status}`)
  const text = await resp.text()
  if (!text) throw new Error('Proxy returned empty response')
  return text
}

function normalizeMeal(text: string): 'breakfast' | 'room_only' | null {
  const t = text.toLowerCase()
  // Hebrew and common abbreviations
  if (
    t.includes('כולל ארוחת בוקר') ||
    t.includes('ארוחת בוקר') ||
    t.includes('עם ארוחת') ||
    t.includes('bb')
  ) return 'breakfast'
  if (
    t.includes('לינה בלבד') ||
    t.includes('ללא ארוחת') ||
    t.includes('room only') ||
    t.includes('ro')
  ) return 'room_only'
  return null
}

function parseStrict(doc: Document): Array<{ price: number; meal: 'breakfast'|'room_only' }> {
  const found: Array<{ price: number; meal: 'breakfast'|'room_only' }> = []
  const planDivs = Array.from(doc.querySelectorAll('div.planprice')) as HTMLElement[]
  for (const div of planDivs) {
    const priceSpan = div.querySelector('span.PriceD') as HTMLElement | null
    let price: number | null = null
    if (priceSpan && priceSpan.getAttribute('price')) {
      const raw = priceSpan.getAttribute('price') || ''
      const digits = raw.replace(/[^0-9]/g, '')
      if (digits) price = parseInt(digits, 10)
    }
    // find nearest matrixButton before or after this price block
    let meal: 'breakfast'|'room_only' | null = null
    // forward scan
    {
      const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT)
      walker.currentNode = div
      let steps = 0
      while (steps < 400 && !meal) {
        const n = walker.nextNode() as HTMLElement | null
        if (!n) break
        steps++
        if (n.matches && n.matches('div.matrixButton')) {
          const rd = n.getAttribute('roomdata') || ''
          const m = normalizeMeal(rd)
          if (m) meal = m
        }
      }
    }
    // backward scan (siblings upwards) if still unknown
    if (!meal) {
      let sib: Element | null = div.previousElementSibling
      let hops = 0
      while (sib && hops < 60 && !meal) {
        if (sib instanceof HTMLElement && sib.matches('div.matrixButton')) {
          const rd = sib.getAttribute('roomdata') || ''
          const m = normalizeMeal(rd)
          if (m) meal = m
        }
        sib = sib.previousElementSibling
        hops++
      }
    }
    if (price != null && meal) {
      // sanity filter to avoid outrageous numbers picked from unrelated parts
      if (price >= 300 && price <= 50000) {
        found.push({ price, meal })
      }
    }
  }
  return found
}

function parseRelaxed(doc: Document): Array<{ price: number; meal: 'breakfast'|'room_only' }> {
  const found: Array<{ price: number; meal: 'breakfast'|'room_only' }> = []
  const containers = Array.from(doc.querySelectorAll('div, tr, span')) as HTMLElement[]
  for (const el of containers) {
    const text = el.textContent || ''
    const priceMatch = text.match(/₪\s*([\d,.]+)/)
    if (!priceMatch) continue
    const price = parseInt(priceMatch[1].replace(/[^0-9]/g, ''), 10)
    const lc = text.toLowerCase()
    const meal: 'breakfast'|'room_only' = (lc.includes('בוקר') || lc.includes('ארוחה')) ? 'breakfast' : 'room_only'
    if (!Number.isNaN(price) && price >= 300 && price <= 50000) {
      found.push({ price, meal })
    }
  }
  return found
}

async function scrapeClientSide(start: string, end: string, progress: (done: number, total: number) => void, fast = false) {
  const ranges = generateDateRanges(start, end)
  const results: Array<{in: string, out: string, meal_type: string, price: number}> = []
  const total = ranges.length
  let done = 0

  const scrapeOne = async (inDate: string, outDate: string) => {
    try {
      const url = buildClubotelUrl(inDate, outDate)
      const html = await fetchWithProxy(url)
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      let parsed = parseStrict(doc)
      if (parsed.length === 0) parsed = parseRelaxed(doc)
      for (const p of parsed) {
        results.push({ in: inDate, out: outDate, meal_type: p.meal, price: p.price })
      }
    } catch (e) {
      console.error(`Client scrape failed for ${inDate}-${outDate}`, e)
    } finally {
      done += 1
      progress(done, total)
    }
  }

  if (!fast) {
    for (const r of ranges) {
      // eslint-disable-next-line no-await-in-loop
      await scrapeOne(r.in, r.out)
    }
  } else {
    const concurrency = 6
    let index = 0
    const workers = Array.from({ length: Math.min(concurrency, ranges.length) }, async () => {
      while (index < ranges.length) {
        const myIndex = index++
        const r = ranges[myIndex]
        // eslint-disable-next-line no-await-in-loop
        await scrapeOne(r.in, r.out)
      }
    })
    await Promise.all(workers)
  }
  
  return results
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export const App: React.FC = () => {
  const today = new Date()
  const threeMonths = new Date(today)
  threeMonths.setMonth(threeMonths.getMonth() + 3)

  const [data, setData] = useState<SummaryRowWithFlags[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>({ status: 'idle' })
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'in', direction: 'asc' })
  const [fast, setFast] = useState(false)
  const [clientSide, setClientSide] = useState(false)
  const [start, setStart] = useState(fmtDateInput(today))
  const [end, setEnd] = useState(fmtDateInput(threeMonths))
  const [refreshing, setRefreshing] = useState(false)
  const [totalRefreshItems, setTotalRefreshItems] = useState(0)
  const [completedRefreshItems, setCompletedRefreshItems] = useState(0)

  // Session cache helpers
  const SESSION_KEY = 'clubotel_prices_cache_v2'
  type CacheShape = {
    start: string
    end: string
    items: Record<string, SummaryRow & { lastChecked: number }>
  }
  const readCache = (): CacheShape | null => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as CacheShape
      if (!parsed || !parsed.items) return null
      return parsed
    } catch {
      return null
    }
  }
  const writeCache = (cache: CacheShape) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache))
    } catch {}
  }
  const upsertCacheItem = (key: string, row: SummaryRow, lastChecked = Date.now()) => {
    const existing = readCache() || { start, end, items: {} }
    existing.start = start
    existing.end = end
    existing.items[key] = { ...row, lastChecked }
    writeCache(existing)
    return existing
  }
  const keyFor = (r: { in: string; out: string }) => `${r.in}-${r.out}`

  // Background prefetch by date pairs
  const generateAllNightRanges = (start: string, end: string) => {
    const ranges: Array<{in: string, out: string}> = []
    const startDate = new Date(start)
    const endDate = new Date(end)
    const curr = new Date(startDate)
    
    while (curr <= endDate) {
      // For each day, generate 1-3 night stays
      for (let nights = 1; nights <= 3; nights++) {
        const out = new Date(curr)
        out.setDate(out.getDate() + nights)
        if (out <= endDate) {
          ranges.push({
            in: fmtDateInput(curr),
            out: fmtDateInput(out)
          })
        }
      }
      curr.setDate(curr.getDate() + 1)
    }
    return ranges
  }

  const prefetchInBackground = async () => {
    // First do the standard ranges (Thursday/Sunday patterns)
    const standardRanges = generateDateRanges(start, end)
    if (standardRanges.length === 0) return
    const newlyArrived = new Set<string>()

    // Calculate total number of ranges including additional 1-3 night stays
    const extraRanges = generateAllNightRanges(start, end)
    const allRanges = [...standardRanges, ...extraRanges]
    
    setRefreshing(true)
    setTotalRefreshItems(allRanges.length)
    setCompletedRefreshItems(0)

    const fetchWithRetry = async (url: string, retries = 3, delay = 2000): Promise<string> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await fetchWithProxy(url)
        } catch (error) {
          if (attempt === retries) throw error
          console.log(`Attempt ${attempt} failed for ${url}, retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          // Increase delay for next attempt
          delay *= 1.5
        }
      }
      throw new Error('All retry attempts failed')
    }

    const processRange = async (inDate: string, outDate: string) => {
      try {
        const key = `${inDate}-${outDate}`
        const cache = readCache()
        const existingItem = cache?.items?.[key]
        
        // Skip if item was checked in the last 30 minutes
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000
        if (existingItem?.lastChecked && existingItem.lastChecked > thirtyMinutesAgo) {
          return
        }

        const url = buildClubotelUrl(inDate, outDate)
        const html = await fetchWithRetry(url)
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        let parsed = parseStrict(doc)
        if (parsed.length === 0) parsed = parseRelaxed(doc)

        const candidate: SummaryRow = { in: inDate, out: outDate, room_only: null, breakfast: null }
        for (const p of parsed) {
          if (p.meal === 'room_only') {
            candidate.room_only = candidate.room_only == null ? p.price : Math.min(candidate.room_only, p.price)
          } else if (p.meal === 'breakfast') {
            candidate.breakfast = candidate.breakfast == null ? p.price : Math.min(candidate.breakfast, p.price)
          }
        }
        
        const improved = !existingItem ||
          ((candidate.room_only != null && (existingItem.room_only == null || candidate.room_only < existingItem.room_only)) ||
           (candidate.breakfast != null && (existingItem.breakfast == null || candidate.breakfast < existingItem.breakfast)))
        
        // Always update lastChecked, but only update price if improved
        if (improved) {
          const updatedCache = upsertCacheItem(key, candidate)
          newlyArrived.add(key)
          const items = Object.values(updatedCache.items)
          // Only mark as prefetched if the price was actually updated
          setData(items.map(it => ({ 
            ...it, 
            prefetched: newlyArrived.has(keyFor(it))
          })))
        } else {
          // Just update the lastChecked timestamp
          upsertCacheItem(key, existingItem, Date.now())
        }
      } catch (e) {
        console.error(`Final error fetching ${inDate}-${outDate} after retries:`, e)
      } finally {
        setCompletedRefreshItems((prev: number) => {
          const newCount = prev + 1
          if (newCount === allRanges.length) {
            setRefreshing(false)
          }
          return newCount
        })
      }

      // Add a small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Initialize UI from existing cache immediately
    const initialItems = Object.values(readCache()?.items || {})
    if (initialItems.length > 0) {
      setData(initialItems.map(it => ({ ...it, prefetched: false })))
    }

    const concurrency = fast ? 8 : 4
    let index = 0
    const workers = Array.from({ length: Math.min(concurrency, allRanges.length) }, async () => {
      while (index < allRanges.length) {
        const my = index++
        const r = allRanges[my]
        if (r) {  // Add null check for TypeScript
          // eslint-disable-next-line no-await-in-loop
          await processRange(r.in, r.out)
        }
      }
    })
    await Promise.all(workers)
  }

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
    
    if (clientSide) {
      // Client-side scraping
      try {
        setProgress({ status: 'running', total: 0, done: 0 })
        // Only fetch missing pairs, including 1-3 night stays
        const standardRanges = generateDateRanges(start, end)
        const extraRanges = generateAllNightRanges(start, end)
        const allRanges = [...standardRanges, ...extraRanges]
        const cache = readCache()
        const missing = allRanges.filter(r => !cache?.items?.[keyFor(r)])
        let done = 0
        const total = missing.length
        const rawResults = await (async () => {
          if (missing.length === 0) return [] as Array<{ in: string; out: string; meal_type: string; price: number }>
          const startDate = missing[0]?.in || start
          const endDate = missing[missing.length - 1]?.out || end
          return await scrapeClientSide(startDate, endDate, (d, t) => {
            // best-effort progress for partial fetch
            done = Math.min(total, done + 1)
            setProgress({ status: 'running', total, done })
          }, fast)
        })()
        
        // Process the results to match the server-side format
        const processedResults = rawResults.reduce<Record<string, SummaryRow>>((acc, curr) => {
          const key = `${curr.in}-${curr.out}`
          if (!acc[key]) {
            acc[key] = {
              in: curr.in,
              out: curr.out,
              room_only: null,
              breakfast: null
            }
          }
          
          if (curr.meal_type === 'room_only') {
            acc[key].room_only = acc[key].room_only == null
              ? curr.price
              : Math.min(acc[key].room_only, curr.price)
          } else if (curr.meal_type === 'breakfast') {
            acc[key].breakfast = acc[key].breakfast == null
              ? curr.price
              : Math.min(acc[key].breakfast, curr.price)
          }
          
          return acc
        }, {} as Record<string, SummaryRow>)
        
        // Merge back into cache and update UI
        const existing = readCache() || { start, end, items: {} }
        for (const [k, v] of Object.entries(processedResults)) {
          existing.items[k] = v
        }
        writeCache(existing)
        const finalResults = Object.values(existing.items)
        setData(finalResults.map(r => ({ ...r, prefetched: false })))
        setProgress({ status: 'done', total: 0, done: 0 })
      } catch (e: any) {
        setError(e.message || 'Client-side scraping failed')
      } finally {
        setLoading(false)
        setProgress({ status: 'idle' })
      }
      return
    }
    
    // Refresh using session cache first and fetch only missing pairs
    try {
      const ranges = generateDateRanges(start, end)
      const cache = readCache() || { start, end, items: {} }
      const cachedItems = Object.values(cache.items)
      if (cachedItems.length > 0) {
        setData(cachedItems.map(r => ({ ...r, prefetched: false })))
      }

      const missing = ranges.filter(r => !cache.items[keyFor(r)])
      if (missing.length === 0) {
        return
      }

      setProgress({ status: 'running', total: missing.length, done: 0 })
      let done = 0
      // Scrape only missing pairs client-side in the background of this refresh
      const groupedByContiguity: Array<{ start: string; end: string }> = []
      if (missing.length > 0) {
        let currentStart = missing[0].in
        let currentEnd = missing[0].out
        for (let i = 1; i < missing.length; i++) {
          currentEnd = missing[i].out
        }
        groupedByContiguity.push({ start: currentStart, end: currentEnd })
      }
      for (const g of groupedByContiguity) {
        // eslint-disable-next-line no-await-in-loop
        const rawResults = await scrapeClientSide(g.start, g.end, () => {
          done += 1
          setProgress({ status: 'running', total: missing.length, done })
        }, fast)
        const processed = rawResults.reduce<Record<string, SummaryRow>>((acc, curr) => {
          const key = `${curr.in}-${curr.out}`
          if (!acc[key]) {
            acc[key] = { in: curr.in, out: curr.out, room_only: null, breakfast: null }
          }
          if (curr.meal_type === 'room_only') {
            acc[key].room_only = acc[key].room_only == null ? curr.price : Math.min(acc[key].room_only, curr.price)
          } else if (curr.meal_type === 'breakfast') {
            acc[key].breakfast = acc[key].breakfast == null ? curr.price : Math.min(acc[key].breakfast, curr.price)
          }
          return acc
        }, {} as Record<string, SummaryRow>)
        for (const [k, v] of Object.entries(processed)) {
          cache.items[k] = v
        }
        writeCache(cache)
        setData(Object.values(cache.items).map(r => ({ ...r, prefetched: false })))
      }
      setProgress({ status: 'done', total: missing.length, done: missing.length })
    } catch (e: any) {
      setError(e.message || 'Unknown error')
    } finally {
      setLoading(false)
      setProgress({ status: 'idle' })
    }
  }

  useEffect(() => {
    // On mount: hydrate from session and start background prefetch
    const cached = readCache()
    if (cached && Object.values(cached.items).length > 0) {
      setData(Object.values(cached.items).map(r => ({ ...r, prefetched: false })))
    }
    
    // Initial prefetch
    prefetchInBackground()

    // Set up periodic background refresh every 30 minutes
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !refreshing) {
        prefetchInBackground()
      }
    }, 30 * 60 * 1000)

    // Also refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !refreshing) {
        prefetchInBackground()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [start, end]) // Re-run when date range changes

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const rows = useMemo(() => {
    const sortedData = [...data].map(r => {
      const nights = diffNights(r.in, r.out)
      const roomOnlyPerNight = r.room_only != null ? Math.round(r.room_only / nights) : null
      const breakfastPerNight = r.breakfast != null ? Math.round(r.breakfast / nights) : null
      return { ...r, nights, roomOnlyPerNight, breakfastPerNight }
    });

    if (sortConfig.key) {
      sortedData.sort((a: any, b: any) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortedData;
  }, [data, sortConfig]);

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
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)' }}>
            <input type="checkbox" checked={clientSide} onChange={e => setClientSide(e.target.checked)} />
            Client-side
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
              <th>
                <button
                  onClick={() => requestSort('in')}
                  className={`sort-button ${sortConfig.key === 'in' ? sortConfig.direction : ''}`}
                >
                  Check-in {sortConfig.key === 'in' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => requestSort('out')}
                  className={`sort-button ${sortConfig.key === 'out' ? sortConfig.direction : ''}`}
                >
                  Check-out {sortConfig.key === 'out' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => requestSort('nights')}
                  className={`sort-button ${sortConfig.key === 'nights' ? sortConfig.direction : ''}`}
                >
                  Nights {sortConfig.key === 'nights' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => requestSort('room_only')}
                  className={`sort-button ${sortConfig.key === 'room_only' ? sortConfig.direction : ''}`}
                >
                  Room only (total) {sortConfig.key === 'room_only' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => requestSort('roomOnlyPerNight')}
                  className={`sort-button ${sortConfig.key === 'roomOnlyPerNight' ? sortConfig.direction : ''}`}
                >
                  Room only (per night) {sortConfig.key === 'roomOnlyPerNight' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => requestSort('breakfast')}
                  className={`sort-button ${sortConfig.key === 'breakfast' ? sortConfig.direction : ''}`}
                >
                  Breakfast (total) {sortConfig.key === 'breakfast' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button
                  onClick={() => requestSort('breakfastPerNight')}
                  className={`sort-button ${sortConfig.key === 'breakfastPerNight' ? sortConfig.direction : ''}`}
                >
                  Breakfast (per night) {sortConfig.key === 'breakfastPerNight' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>Source</th>
              <th>Page</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>Pick dates and click Refresh.</td>
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
                <td>{r.prefetched ? 'Prefetch' : ''}</td>
                <td>
                  <a href={buildClubotelUrl(r.in, r.out)} target="_blank" rel="noopener noreferrer">Open</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Removed overlay */}

      <footer className="footer">Prices in NIS. Updated on demand.</footer>
    </div>
  )
}
