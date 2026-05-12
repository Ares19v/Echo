import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ExternalLink, Zap } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { fetchEscalations } from '../api/client'
import { formatDistanceToNow } from 'date-fns'

const REASON_META = {
  emergency:         { label: 'Emergency', cls: 'badge-red',    icon: '🚨' },
  patient_requested: { label: 'Patient Request', cls: 'badge-amber', icon: '👤' },
  max_clarifications:{ label: 'Max Retries', cls: 'badge-gray', icon: '🔄' },
  technical_failure: { label: 'Technical', cls: 'badge-gray',   icon: '⚙️' },
  mental_health:     { label: 'Mental Health', cls: 'badge-purple', icon: '🧠' },
}

const DEMO = [
  { id: 'e1', patient_phone: '+919876543210', language: 'en-IN', escalation_reason: 'emergency', started_at: new Date(Date.now() - 120000).toISOString(), duration_seconds: 38, turn_count: 2, outcome: 'escalated' },
  { id: 'e2', patient_phone: '+919988776655', language: 'hi-IN', escalation_reason: 'mental_health', started_at: new Date(Date.now() - 1800000).toISOString(), duration_seconds: 95, turn_count: 6, outcome: 'escalated' },
  { id: 'e3', patient_phone: '+919123456789', language: 'mr-IN', escalation_reason: 'patient_requested', started_at: new Date(Date.now() - 7200000).toISOString(), duration_seconds: 112, turn_count: 4, outcome: 'escalated' },
]

export default function EscalationQueue() {
  const navigate = useNavigate()
  const [calls, setCalls] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEscalations()
        setCalls(data.calls); setTotal(data.total)
      } catch {
        setCalls(DEMO); setTotal(DEMO.length)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <div className="anim-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Escalation Queue</h1>
          <p className="page-sub">{total} calls transferred to human staff</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={13} color="var(--red)" />
          <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{total} requiring attention</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Lang</th>
                <th>Escalation Reason</th>
                <th>Duration</th>
                <th>Turns</th>
                <th>When</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }, (_, j) => (
                      <td key={j}><div className="skeleton" style={{ height: 14, width: '75%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
                    No escalations — great news!
                  </td>
                </tr>
              ) : calls.map((call, idx) => {
                const rm = REASON_META[call.escalation_reason] || { label: call.escalation_reason, cls: 'badge-gray', icon: '?' }
                return (
                  <tr
                    key={call.id}
                    className="clickable anim-fade-up"
                    style={{ animationDelay: `${idx * 40}ms` }}
                    onClick={() => navigate(`/calls/${call.id}`)}
                  >
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{call.patient_phone}</span></td>
                    <td><StatusBadge type="language" value={call.language} /></td>
                    <td>
                      <span className={`badge ${rm.cls}`}>
                        <span>{rm.icon}</span>
                        {rm.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                      {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{call.turn_count}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {call.started_at ? formatDistanceToNow(new Date(call.started_at), { addSuffix: true }) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); navigate(`/calls/${call.id}`) }}>
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
