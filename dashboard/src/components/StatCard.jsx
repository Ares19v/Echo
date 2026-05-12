import React, { useRef, useEffect, useState } from 'react'

export default function StatCard({ label, value, icon: Icon, color = '#3d7bfd', trend }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`stat-card anim-fade-up`} style={{ '--accent': color }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${color}44, transparent)`,
      }} />

      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 90, height: 90,
        borderRadius: '50%',
        background: `${color}0a`,
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative' }}>
        <div
          className="stat-icon"
          style={{ background: `${color}15` }}
        >
          <Icon size={17} color={color} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
            padding: '2px 8px', borderRadius: 999,
            background: trend >= 0 ? 'var(--green-dim)' : 'var(--red-dim)',
            color: trend >= 0 ? 'var(--green)' : 'var(--red)',
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>

      <div className={animated ? 'anim-count-up' : ''} style={{ position: 'relative' }}>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}
