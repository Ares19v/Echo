import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { fetchHealthStatus } from '../api/client'

const SERVICE_META = {
  hms:     { name: 'HMS / EHR',         icon: '🏥' },
  sarvam:  { name: 'Sarvam AI (STT+TTS)', icon: '🎙️' },
  gemini:  { name: 'Gemini LLM',        icon: '🤖' },
  livekit: { name: 'LiveKit (Real-time)', icon: '📡' },
  exotel:  { name: 'Exotel (Telephony)', icon: '📞' },
}

function ServiceRow({ serviceKey, data, delay = 0 }) {
  const meta = SERVICE_META[serviceKey] || { name: serviceKey, icon: '⚙️' }
  const ok = data?.ok ?? data?.configured ?? false
  const pending = !data?.configured && data?.ok === false

  return (
    <div className="service-row anim-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--r-sm)',
          background: ok ? 'var(--green-dim)' : 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
          border: `1px solid ${ok ? 'rgba(34,211,168,0.2)' : 'var(--border)'}`,
        }}>
          {meta.icon}
        </div>
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-1)' }}>{meta.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {data?.provider && `Provider: ${data.provider}`}
            {data?.model && `Model: ${data.model}`}
            {!data?.provider && !data?.model && (pending ? 'Needs API key in .env' : 'Operational')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {data?.latency_ms >= 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
            {data.latency_ms}ms
          </span>
        )}
        <span className={`badge ${ok ? 'badge-green' : pending ? 'badge-amber' : 'badge-gray'}`}>
          <span className="badge-dot" style={{ background: ok ? 'var(--green)' : pending ? 'var(--amber)' : 'var(--text-3)' }} />
          {ok ? 'Operational' : pending ? 'Not Configured' : 'Unavailable'}
        </span>
      </div>
    </div>
  )
}

export default function SystemHealth() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    setRefreshing(true)
    try {
      const data = await fetchHealthStatus()
      setHealth(data)
    } catch {
      setHealth({
        overall: 'demo',
        services: {
          hms:     { ok: true,  latency_ms: 2,   provider: 'mock' },
          sarvam:  { ok: false, configured: false },
          gemini:  { ok: false, configured: false, model: 'gemini-2.5-flash' },
          livekit: { ok: false, configured: false },
          exotel:  { ok: false, configured: false },
        },
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastCheck(new Date())
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const overall = health?.overall
  const operationalCount = Object.values(health?.services || {}).filter(s => s?.ok).length
  const totalCount = Object.keys(health?.services || {}).length

  return (
    <div className="anim-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">System Health</h1>
          <p className="page-sub">
            {lastCheck
              ? `Last checked ${lastCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Checking services…'}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={refreshing}>
          <RefreshCw size={12} style={{ animation: refreshing ? 'pulse 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Overall status card */}
      <div
        className="card-glow anim-fade-up"
        style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--r-md)',
          background: overall === 'healthy' ? 'var(--green-dim)' : overall === 'degraded' ? 'var(--amber-dim)' : 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {overall === 'healthy' ? '✅' : overall === 'degraded' ? '⚠️' : '🔌'}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>
            {overall === 'healthy' ? 'All Systems Operational'
             : overall === 'degraded' ? 'Partially Degraded'
             : 'Demo Mode — Not Connected'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
            {operationalCount} of {totalCount} services operational
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className={`badge ${overall === 'healthy' ? 'badge-green' : overall === 'degraded' ? 'badge-amber' : 'badge-gray'}`}>
            <span className="badge-dot" style={{ background: overall === 'healthy' ? 'var(--green)' : overall === 'degraded' ? 'var(--amber)' : 'var(--text-3)' }} />
            {overall === 'healthy' ? 'Healthy' : overall === 'degraded' ? 'Degraded' : 'Demo'}
          </span>
        </div>
      </div>

      {/* Services */}
      {loading ? (
        <div className="card">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <div className="skeleton" style={{ height: 14, width: 180 }} />
              <div className="skeleton" style={{ height: 14, width: 90 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          {Object.entries(health?.services || {}).map(([key, data], i) => (
            <ServiceRow key={key} serviceKey={key} data={data} delay={i * 50} />
          ))}
        </div>
      )}

      {overall !== 'healthy' && (
        <div className="alert alert-warning" style={{ marginTop: 16 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Some services are not configured.</strong> Add the required API keys to your{' '}
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>.env</code> file and restart the backend to activate them.
            See <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>.env.example</code> for reference.
          </div>
        </div>
      )}
    </div>
  )
}
