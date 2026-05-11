import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Bot } from 'lucide-react'
import { fetchCall } from '../api/client'
import { format } from 'date-fns'
import StatusBadge from '../components/StatusBadge'

const DEMO_CALL = {
  id: 'demo-1', patient_phone: '+919876543210',
  language: 'en-IN', primary_intent: 'appointment_book',
  outcome: 'resolved', duration_seconds: 187, turn_count: 6,
  started_at: new Date().toISOString(), consent_given: true,
  summary: 'Patient booked appointment with Dr. Arjun Sharma for Friday at 10:00 AM.',
  transcript: [
    { role: 'assistant', text: 'Namaste! You've reached the clinic. This call is assisted by an AI. Say "yes" to continue.', language: 'en-IN' },
    { role: 'user', text: 'Yes, please.', language: 'en-IN' },
    { role: 'assistant', text: 'Welcome back! How can I help you today?', language: 'en-IN' },
    { role: 'user', text: 'I need to book an appointment with Dr. Sharma for this Friday.', language: 'en-IN' },
    { role: 'assistant', text: 'Of course! Let me check Dr. Sharma\'s availability for this Friday. One moment...', language: 'en-IN' },
    { role: 'assistant', text: 'Dr. Arjun Sharma has slots available at 10:00 AM and 3:00 PM this Friday. Which works better for you?', language: 'en-IN' },
    { role: 'user', text: '10 AM please.', language: 'en-IN' },
    { role: 'assistant', text: 'Perfect! I\'ve booked your appointment with Dr. Arjun Sharma on Friday at 10:00 AM. You\'ll receive a confirmation SMS shortly. Is there anything else I can help you with?', language: 'en-IN' },
    { role: 'user', text: 'No, that\'s all. Thank you.', language: 'en-IN' },
    { role: 'assistant', text: 'You\'re welcome! Take care, and we\'ll see you on Friday.', language: 'en-IN' },
  ],
}

export default function TranscriptViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [call, setCall] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchCall(id)
        setCall(data)
      } catch {
        setCall(DEMO_CALL)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <div style={{ color: 'var(--text-secondary)', padding: 40 }}>Loading transcript...</div>
  if (!call) return <div style={{ color: 'var(--accent-red)', padding: 40 }}>Call not found.</div>

  return (
    <div className="fade-in">
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/calls')}>
        <ArrowLeft size={14} /> Back to Call Log
      </button>

      {/* Call metadata */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            ['Phone', call.patient_phone],
            ['Language', <StatusBadge key="l" type="language" value={call.language} />],
            ['Outcome', <StatusBadge key="o" type="outcome" value={call.outcome} />],
            ['Duration', call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'],
            ['Intent', (call.primary_intent || '—').replace(/_/g, ' ')],
            ['Turns', call.turn_count],
            ['Time', call.started_at ? format(new Date(call.started_at), 'dd MMM yyyy, HH:mm') : '—'],
            ['Consent', call.consent_given ? '✓ Given' : '✗ Not given'],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
        {call.summary && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bg-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Summary</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{call.summary}</p>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Conversation Transcript</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(call.transcript || []).map((turn, i) => (
            <div key={i} style={{
              display: 'flex',
              gap: 12,
              flexDirection: turn.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                background: turn.role === 'user' ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {turn.role === 'user' ? <User size={14} color="#8b5cf6" /> : <Bot size={14} color="#3b82f6" />}
              </div>
              <div style={{
                maxWidth: '70%',
                background: turn.role === 'user' ? 'rgba(139,92,246,0.1)' : 'var(--bg-elevated)',
                border: `1px solid ${turn.role === 'user' ? 'rgba(139,92,246,0.2)' : 'var(--bg-border)'}`,
                borderRadius: 10,
                padding: '10px 14px',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {turn.role === 'user' ? 'Patient' : 'Echo'}
                  {turn.language && <span style={{ marginLeft: 8 }}>{turn.language === 'en-IN' ? 'EN' : turn.language === 'hi-IN' ? 'HI' : 'MR'}</span>}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>{turn.text}</p>
              </div>
            </div>
          ))}
          {(!call.transcript || call.transcript.length === 0) && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No transcript available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
