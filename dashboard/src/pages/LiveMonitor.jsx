import React, { useState, useEffect, useCallback } from 'react'
import StatCard from '../components/StatCard'
import { PhoneCall, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { fetchStats } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from 'recharts'

const COLORS = ['#3d7bfd', '#a78bfa', '#22d3a8', '#f5a623']

/* Simulated hourly data for demo */
const HOURLY = Array.from({ length: 12 }, (_, i) => ({
  h: `${(8 + i * 1.5).toFixed(0)}:00`,
  calls: Math.round(8 + Math.sin(i * 0.8) * 6 + Math.random() * 4),
}))

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-2)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>
          {p.value} {p.name}
        </div>
      ))}
    </div>
  )
}

export default function LiveMonitor() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const data = await fetchStats()
      setStats(data)
      setIsDemo(false)
    } catch {
      setIsDemo(true)
      setStats({
        total_calls: 247, today_calls: 18,
        resolution_rate: 84.2, escalation_rate: 8.5,
        avg_duration_seconds: 142,
        intents: [
          { intent: 'Appointment', count: 89 },
          { intent: 'Lab Report', count: 42 },
          { intent: 'OPD Timings', count: 37 },
          { intent: 'Prescription', count: 31 },
          { intent: 'Triage', count: 24 },
          { intent: 'FAQ', count: 24 },
        ],
        languages: [
          { language: 'en-IN', count: 138 },
          { language: 'hi-IN', count: 72 },
          { language: 'mr-IN', count: 37 },
        ],
      })
    } finally {
      setLoading(false)
      setLastUpdated(new Date())
    }
  }, [])

  useEffect(() => {
    load()
    const refresh = setInterval(() => { load(); setTick(t => t + 1) }, 15000)
    return () => clearInterval(refresh)
  }, [load])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ height: 28, width: 180 }} className="skeleton" />
      <div className="grid-4 stagger">
        {[0,1,2,3].map(i => <div key={i} style={{ height: 120 }} className="skeleton anim-fade-up" />)}
      </div>
    </div>
  )

  const mins = Math.floor((stats?.avg_duration_seconds ?? 0) / 60)
  const secs = (stats?.avg_duration_seconds ?? 0) % 60

  return (
    <div className="anim-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Live Monitor</h1>
          <p className="page-sub">Real-time call activity — refreshes every 15s</p>
        </div>
        <div className="live-indicator">
          <span className="pulse-dot" />
          {isDemo ? 'Demo Mode' : 'Live'}
          {lastUpdated && (
            <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>
              · {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {isDemo && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <span>⚠</span>
          <span>API not connected — displaying sample data. Add your API keys to <code>.env</code> to go live.</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid-4 stagger" style={{ marginBottom: 24 }}>
        <StatCard label="Total Calls" value={stats?.total_calls ?? 0} icon={PhoneCall} color="#3d7bfd" trend={12} />
        <StatCard label="Today" value={stats?.today_calls ?? 0} icon={TrendingUp} color="#22d3a8" trend={5} />
        <StatCard label="Resolution Rate" value={`${stats?.resolution_rate ?? 0}%`} icon={CheckCircle} color="#a78bfa" trend={2} />
        <StatCard label="Avg Duration" value={`${mins}m ${secs}s`} icon={Clock} color="#f5a623" trend={-3} />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Area chart */}
        <div className="card-glow" style={{ gridColumn: '1 / 3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Call Volume</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Today&apos;s hourly trend</div>
            </div>
            <span className="badge badge-blue">Today</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={HOURLY} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#3d7bfd" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3d7bfd" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="h" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="calls" name="calls" stroke="#3d7bfd" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card-glow">
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', marginBottom: 4 }}>Languages</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>All time split</div>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie
                data={stats?.languages ?? []}
                dataKey="count"
                cx="50%" cy="50%"
                innerRadius={36} outerRadius={58}
                strokeWidth={0}
                paddingAngle={3}
              >
                {(stats?.languages ?? []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {(stats?.languages ?? []).map((l, i) => (
              <div key={l.language} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-2)' }}>
                    {l.language === 'en-IN' ? 'English' : l.language === 'hi-IN' ? 'Hindi' : 'Marathi'}
                  </span>
                </div>
                <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{l.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intent Bar Chart */}
      <div className="card-glow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Top Intents</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Last 7 days</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={stats?.intents ?? []} barSize={22} margin={{ top: 0, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="intent" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="calls" radius={[4, 4, 0, 0]}>
              {(stats?.intents ?? []).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={i === 0 ? 1 : 0.65} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
