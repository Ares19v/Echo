import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { fetchHealthStatus } from '../api/client'

function ServiceRow({ name, data }) {
  const ok = data?.ok ?? data?.configured
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--bg-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {ok ? <CheckCircle size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />}
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
          {data?.provider && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Provider: {data.provider}</div>}
          {data?.model && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Model: {data.model}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {data?.latency_ms >= 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{data.latency_ms}ms</span>
        )}
        <span className={`badge ${ok ? 'badge-green' : 'badge-red'}`}>
          {ok ? 'Operational' : (data?.configured === false ? 'Not Configured' : 'Degraded')}
        </span>
      </div>
    </div>
  )
}

export default function SystemHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchHealthStatus()
        setHealth(data)
      } catch {
        setHealth({
          overall: 'demo',
          services: {
            hms:     { ok: true,  latency_ms: 2,  provider: 'mock' },
            sarvam:  { ok: false, configured: false },
            gemini:  { ok: false, configured: false, model: 'gemini-2.5-flash' },
            livekit: { ok: false, configured: false },
            exotel:  { ok: false, configured: false },
          },
        })
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const overall = health?.overall
  const overallColor = overall === 'healthy' ? '#10b981' : overall === 'degraded' ? '#f59e0b' : '#94a3b8'

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>System Health</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Service status · refreshes every 30s
        </p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Checking services...</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: overallColor }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              Overall: <span style={{ color: overallColor, textTransform: 'capitalize' }}>{overall}</span>
            </div>
            {overall === 'demo' && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— API not connected</span>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Service Status</h3>
            <ServiceRow name="HMS / EHR" data={health?.services?.hms} />
            <ServiceRow name="Sarvam AI (STT + TTS)" data={health?.services?.sarvam} />
            <ServiceRow name="Gemini (LLM)" data={health?.services?.gemini} />
            <ServiceRow name="LiveKit (Real-time)" data={health?.services?.livekit} />
            <ServiceRow name="Exotel (Telephony)" data={health?.services?.exotel} />
          </div>

          {overall !== 'healthy' && (
            <div style={{ marginTop: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: 16, fontSize: 13, color: 'var(--accent-amber)' }}>
              <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
              Some services are not configured. Add the required API keys to your <code>.env</code> file to enable them.
            </div>
          )}
        </>
      )}
    </div>
  )
}
