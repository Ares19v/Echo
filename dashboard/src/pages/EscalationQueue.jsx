import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Eye } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { fetchEscalations } from '../api/client'
import { format } from 'date-fns'

const ESCALATION_REASON_LABELS = {
  emergency: { label: '🚨 Emergency', cls: 'badge-red' },
  patient_requested: { label: 'Patient Request', cls: 'badge-amber' },
  max_clarifications: { label: 'Max Retries', cls: 'badge-gray' },
  technical_failure: { label: 'Technical', cls: 'badge-gray' },
  mental_health: { label: '⚠ Mental Health', cls: 'badge-purple' },
}

export default function EscalationQueue() {
  const navigate = useNavigate()
  const [calls, setCalls] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchEscalations()
        setCalls(data.calls)
        setTotal(data.total)
      } catch {
        // Demo
        setCalls([
          { id: 'esc-1', patient_phone: '+919876543210', language: 'en-IN', escalation_reason: 'emergency', started_at: new Date().toISOString(), duration_seconds: 45, turn_count: 2 },
          { id: 'esc-2', patient_phone: '+919988776655', language: 'hi-IN', escalation_reason: 'patient_requested', started_at: new Date(Date.now() - 3600000).toISOString(), duration_seconds: 120, turn_count: 5 },
          { id: 'esc-3', patient_phone: '+919123456789', language: 'mr-IN', escalation_reason: 'max_clarifications', started_at: new Date(Date.now() - 7200000).toISOString(), duration_seconds: 90, turn_count: 7 },
        ])
        setTotal(3)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Escalation Queue</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          {total} calls transferred to human staff
        </p>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Language</th>
                <th>Reason</th>
                <th>Duration</th>
                <th>Turns</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : calls.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No escalations found</td></tr>
              ) : calls.map(call => {
                const reason = ESCALATION_REASON_LABELS[call.escalation_reason] || { label: call.escalation_reason, cls: 'badge-gray' }
                return (
                  <tr key={call.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{call.patient_phone}</td>
                    <td><StatusBadge type="language" value={call.language} /></td>
                    <td><span className={`badge ${reason.cls}`}>{reason.label}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{call.turn_count}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {call.started_at ? format(new Date(call.started_at), 'dd MMM, HH:mm') : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => navigate(`/calls/${call.id}`)}>
                        <Eye size={13} />
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
