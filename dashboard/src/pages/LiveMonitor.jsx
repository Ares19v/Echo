import React, { useState, useEffect, useCallback } from 'react'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import { PhoneCall, CheckCircle, AlertTriangle, Clock, Radio } from 'lucide-react'
import { fetchStats } from '../api/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']

export default function LiveMonitor() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [liveCalls, setLiveCalls] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchStats()
      setStats(data)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError('Could not reach API. Running in demo mode.')
      // Demo data so the UI is never empty
      setStats({
        total_calls: 247, today_calls: 18,
        resolution_rate: 84.2, escalation_rate: 8.5,
        avg_duration_seconds: 142,
        intents: [
          { intent: 'appointment_book', count: 89 },
          { intent: 'lab_report', count: 42 },
          { intent: 'opd_timings', count: 37 },
          { intent: 'prescription', count: 31 },
          { intent: 'symptom_triage', count: 24 },
          { intent: 'faq', count: 24 },
        ],
        languages: [
          { language: 'en-IN', count: 138 },
          { language: 'hi-IN', count: 72 },
          { language: 'mr-IN', count: 37 },
        ],
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div style={{ color: 'var(--text-secondary)', padding: 40 }}>Loading...</div>

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Live Monitor</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Real-time call activity · refreshes every 15s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <span className="pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          Live
          {lastUpdated && <span>· {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: 'var(--accent-amber)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Calls" value={stats?.total_calls ?? 0} icon={PhoneCall} color="#3b82f6" />
        <StatCard label="Today" value={stats?.today_calls ?? 0} icon={Radio} color="#8b5cf6" />
        <StatCard label="Resolution Rate" value={`${stats?.resolution_rate ?? 0}%`} icon={CheckCircle} color="#10b981" />
        <StatCard label="Avg Duration" value={`${Math.floor((stats?.avg_duration_seconds ?? 0) / 60)}m ${(stats?.avg_duration_seconds ?? 0) % 60}s`} icon={Clock} color="#f59e0b" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Top Intents (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats?.intents ?? []} barSize={24}>
              <XAxis dataKey="intent" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                tickFormatter={v => v.replace('_', ' ')} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 12 }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Language Split</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={stats?.languages ?? []} dataKey="count" nameKey="language" cx="50%" cy="50%" outerRadius={70} label={({ language, percent }) => `${language === 'en-IN' ? 'EN' : language === 'hi-IN' ? 'HI' : 'MR'} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {(stats?.languages ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
            {(stats?.languages ?? []).map((l, i) => (
              <div key={l.language} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i], display: 'inline-block' }} />
                {l.language === 'en-IN' ? 'English' : l.language === 'hi-IN' ? 'Hindi' : 'Marathi'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
