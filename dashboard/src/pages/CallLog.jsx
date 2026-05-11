import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import { fetchCalls } from '../api/client'
import { format } from 'date-fns'

const DEMO_CALLS = Array.from({ length: 8 }, (_, i) => ({
  id: `demo-${i}`,
  patient_phone: `+9198765432${i}0`,
  language: ['en-IN', 'hi-IN', 'mr-IN'][i % 3],
  primary_intent: ['appointment_book', 'lab_report', 'opd_timings', 'symptom_triage', 'faq'][i % 5],
  outcome: ['resolved', 'escalated', 'resolved', 'abandoned'][i % 4],
  escalation_reason: i % 4 === 1 ? 'emergency' : null,
  started_at: new Date(Date.now() - i * 3600000).toISOString(),
  duration_seconds: 80 + i * 30,
  turn_count: 3 + i,
  consent_given: true,
}))

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
      const data = await fetchCalls({ page, page_size: 20, search: search || undefined })
      setCalls(data.calls)
      setTotal(data.total)
    } catch {
      setCalls(DEMO_CALLS)
      setTotal(DEMO_CALLS.length)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const pages = Math.max(1, Math.ceil(total / 20))

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Call Log</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {total} total calls · click a row to view transcript
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search by phone..."
            style={{ paddingLeft: 30, width: 220 }}
          />
        </div>
      </div>

      {isDemo && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: 'var(--accent-amber)' }}>
          ⚠ Demo mode – showing sample data. Connect API to see live calls.
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Language</th>
                <th>Intent</th>
                <th>Outcome</th>
                <th>Duration</th>
                <th>Turns</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : calls.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No calls found</td></tr>
              ) : calls.map(call => (
                <tr key={call.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/calls/${call.id}`)}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{call.patient_phone}</td>
                  <td><StatusBadge type="language" value={call.language} /></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{(call.primary_intent || '—').replace(/_/g, ' ')}</td>
                  <td><StatusBadge type="outcome" value={call.outcome} /></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{call.turn_count}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    {call.started_at ? format(new Date(call.started_at), 'dd MMM, HH:mm') : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                      onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}`) }}>
                      <Eye size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--bg-border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Page {page} of {pages}</span>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
          <button className="btn btn-ghost" style={{ padding: '4px 8px' }} disabled={page === pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  )
}
