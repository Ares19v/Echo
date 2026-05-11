import React from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, PhoneCall, AlertTriangle, HeartPulse, Settings, Radio } from 'lucide-react'

const NAV = [
  { to: '/monitor',     icon: Radio,         label: 'Live Monitor' },
  { to: '/calls',       icon: PhoneCall,     label: 'Call Log' },
  { to: '/escalations', icon: AlertTriangle,  label: 'Escalations' },
  { to: '/health',      icon: HeartPulse,    label: 'System Health' },
  { to: '/settings',    icon: Settings,      label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside style={{
      width: 220,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--bg-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 28px', borderBottom: '1px solid var(--bg-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>Echo</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>AI Voice Agent</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--bg-border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Echo v1.0.0</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>DPDP Compliant</div>
      </div>
    </aside>
  )
}
