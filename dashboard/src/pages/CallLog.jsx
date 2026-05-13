import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { fetchCalls } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

const DEMO_CALLS = Array.from({ length: 10 }, (_, i) => ({
  id: `demo-${i}`,
  patient_phone: `+9198765432${String(i).padStart(2,'0')}`,
  language: ['en-IN', 'hi-IN', 'mr-IN'][i % 3],
  primary_intent: ['appointment_book', 'lab_report', 'opd_timings', 'symptom_triage', 'faq'][i % 5],
  outcome: ['resolved', 'escalated', 'resolved', 'abandoned', 'resolved'][i % 5],
  started_at: new Date(Date.now() - i * 3720000).toISOString(),
  duration_seconds: 72 + i * 28,
  turn_count: 3 + i,
  sentiment_score: 0.4 + (i % 5) * 0.12,
}))

function SentimentBar({ score }) {
  const pct = Math.round((score ?? 0.5) * 100)
  const color = pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--amber)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 56, height: 4, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.6s var(--ease-out)' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>{pct}%</span>
    </div>
  )
}

export default function CallLog() {
  const navigate = useNavigate()
  const [calls, setCalls] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCalls({ page, page_size: 15, search: search || undefined })
      setCalls(data.calls)
      setTotal(data.total)
      setIsDemo(false)
    } catch {
      setCalls(DEMO_CALLS)
      setTotal(DEMO_CALLS.length)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const pages = Math.max(1, Math.ceil(total / 15))

  return (
    <div className="anim-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Call Log</h1>
          <p className="page-sub">{total} calls total · click a row to view transcript</p>
        </div>
        <div className="search-wrap" style={{ width: 240 }}>
          <Search size={13} className="search-icon" />
          <input
            className="input"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by phone…"
          />
        </div>
      </div>

      {isDemo && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>⚠</span>
          <span>Demo mode — connect the API to see real call data.</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Lang</th>
                <th>Intent</th>
                <th>Outcome</th>
                <th>Duration</th>
                <th>Sentiment</th>
                <th>When</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }, (_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, width: j === 7 ? 24 : '80%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
                    No calls found
                  </td>
                </tr>
              ) : calls.map((call, idx) => (
                <tr
                  key={call.id}
                  className="clickable anim-fade-up"
                  style={{ animationDelay: `${idx * 30}ms` }}
                  onClick={() => navigate(`/calls/${call.id}`)}
                >
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-1)' }}>
                      {call.patient_phone}
                    </span>
                  </td>
                  <td><StatusBadge type="language" value={call.language} /></td>
                  <td style={{ color: 'var(--text-2)', fontSize: 12 }}>
                    {(call.primary_intent || '—').replace(/_/g, ' ')}
                  </td>
                  <td><StatusBadge type="outcome" value={call.outcome} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                    {call.duration_seconds
                      ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                      : '—'}
                  </td>
                  <td><SentimentBar score={call.sentiment_score} /></td>
                  <td style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {call.started_at
                      ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true })
                      : '—'}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}`) }}
                    >
                      <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pagination">
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Page {page} of {pages} · {total} records
          </span>
          <button className="btn btn-ghost btn-icon" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft size={13} />
          </button>
          <button className="btn btn-ghost btn-icon" disabled={page === pages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
