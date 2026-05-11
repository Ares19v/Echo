import React from 'react'

export default function StatCard({ label, value, icon: Icon, color = '#3b82f6', trend }) {
  return (
    <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={color} />
        </div>
        {trend !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: trend >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}
