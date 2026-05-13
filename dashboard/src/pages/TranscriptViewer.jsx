import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Bot, Clock, Mic, Hash } from 'lucide-react'
import { fetchCall } from '../api/client'
import StatusBadge from '../components/StatusBadge'

const DEMO_CALL = {
  id: 'demo-1', patient_phone: '+919876543210',
  language: 'en-IN', primary_intent: 'appointment_book',
  outcome: 'resolved', duration_seconds: 187, turn_count: 10,
  started_at: new Date().toISOString(), consent_given: true,
  sentiment_score: 0.78,
  summary: "Patient successfully booked an appointment with Dr. Arjun Sharma for Friday at 10:00 AM. Patient was satisfied with the service.",
  transcript: [
    { role: 'assistant', text: "Hello! You've reached the clinic. This call is assisted by Echo AI. Do you consent to continue?", language: 'en-IN' },
    { role: 'user', text: 'Yes, please.', language: 'en-IN' },
    { role: 'assistant', text: "Welcome back! How can I help you today?", language: 'en-IN' },
    { role: 'user', text: 'I need to book an appointment with Dr. Sharma for this Friday.', language: 'en-IN' },
    { role: 'assistant', text: "Of course! Let me check Dr. Sharma's availability for this Friday. One moment...", language: 'en-IN' },
    { role: 'assistant', text: 'Dr. Arjun Sharma has slots available at 10:00 AM and 3:00 PM this Friday. Which works better for you?', language: 'en-IN' },
    { role: 'user', text: '10 AM please.', language: 'en-IN' },
    { role: 'assistant', text: "Perfect! I've booked your appointment with Dr. Arjun Sharma on Friday at 10:00 AM. You'll receive a confirmation SMS shortly. Is there anything else I can help you with?", language: 'en-IN' },
    { role: 'user', text: "No, that's all. Thank you.", language: 'en-IN' },
    { role: 'assistant', text: "You're welcome! Take care, and we'll see you on Friday.", language: 'en-IN' },
  ],
}

function MetaItem({ icon: Icon, label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        <Icon size={10} />
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: valueColor || 'var(--text-1)' }}>{value}</div>
    </div>
  )
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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 24, width: 120 }} className="skeleton" />
      <div style={{ height: 100 }} className="skeleton" />
      <div style={{ height: 400 }} className="skeleton" />
    </div>
  )

  if (!call) return (
    <div style={{ color: 'var(--red)', padding: 40, textAlign: 'center' }}>Call not found.</div>
  )

  const mins = Math.floor((call.duration_seconds ?? 0) / 60)
  const secs = (call.duration_seconds ?? 0) % 60
  const sentPct = Math.round((call.sentiment_score ?? 0.5) * 100)

  return (
    <div className="anim-fade-up">
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/calls')}>
        <ArrowLeft size={13} /> Back
      </button>

      {/* Call Metadata */}
      <div className="card-glow" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: call.summary ? 20 : 0 }}>
          <MetaItem icon={Mic}   label="Phone"    value={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{call.patient_phone}</span>} />
          <MetaItem icon={Hash}  label="Outcome"  value={<StatusBadge type="outcome" value={call.outcome} />} />
          <MetaItem icon={Clock} label="Duration" value={`${mins}m ${secs}s`} />
          <MetaItem icon={Hash}  label="Language" value={<StatusBadge type="language" value={call.language} />} />
          <MetaItem icon={Hash}  label="Intent"   value={(call.primary_intent || '—').replace(/_/g, ' ')} />
          <MetaItem icon={Hash}  label="Turns"    value={call.turn_count} />
          <MetaItem icon={Hash}  label="Consent"  value={call.consent_given ? '✓ Captured' : '✗ Not given'} valueColor={call.consent_given ? 'var(--green)' : 'var(--red)'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Sentiment</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  width: `${sentPct}%`, height: '100%', borderRadius: 999,
                  background: sentPct >= 70 ? 'var(--green)' : sentPct >= 45 ? 'var(--amber)' : 'var(--red)',
                  transition: 'width 0.6s var(--ease-out)',
                }} />
              </div>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-1)', fontWeight: 600 }}>{sentPct}%</span>
            </div>
          </div>
        </div>

        {call.summary && (
          <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>
              AI Summary
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{call.summary}</p>
          </div>
        )}
      </div>

      {/* Transcript */}
      <div className="card">
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Transcript · {call.turn_count} turns
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(call.transcript || []).map((turn, i) => (
            <div
              key={i}
              className={`bubble-wrap${turn.role === 'user' ? ' user' : ''} anim-fade-up`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className={`bubble-avatar ${turn.role === 'user' ? 'user' : 'agent'}`}>
                {turn.role === 'user'
                  ? <User size={13} color="var(--purple)" />
                  : <Bot size={13} color="var(--blue)" />}
              </div>
              <div className={`bubble ${turn.role === 'user' ? 'user' : 'agent'}`}>
                <div className="bubble-meta">
                  {turn.role === 'user' ? 'Patient' : 'Echo AI'}
                  {turn.language && (
                    <span style={{ marginLeft: 8, opacity: 0.6 }}>
                      {turn.language === 'en-IN' ? 'EN' : turn.language === 'hi-IN' ? 'HI' : 'MR'}
                    </span>
                  )}
                </div>
                {turn.text}
              </div>
            </div>
          ))}

          {(!call.transcript || call.transcript.length === 0) && (
            <p style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>No transcript available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
