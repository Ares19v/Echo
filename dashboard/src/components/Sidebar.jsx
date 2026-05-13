import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Activity, PhoneCall, AlertTriangle,
  HeartPulse, Settings, Radio, Phone,
} from 'lucide-react'

const NAV = [
  { to: '/monitor',     icon: Radio,          label: 'Live Monitor',   color: '#22d3a8' },
  { to: '/simulator',   icon: Phone,          label: 'Call Simulator', color: '#22d3a8' },
  { to: '/calls',       icon: PhoneCall,      label: 'Call Log',       color: '#3d7bfd' },
  { to: '/escalations', icon: AlertTriangle,  label: 'Escalations',    color: '#f04747' },
  { to: '/health',      icon: HeartPulse,     label: 'System Health',  color: '#a78bfa' },
  { to: '/settings',    icon: Settings,       label: 'Settings',       color: '#f5a623' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Activity size={18} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
            Echo
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1, letterSpacing: '0.05em' }}>
            AI VOICE AGENT
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', fontWeight: 600, padding: '8px 12px 4px', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {NAV.map(({ to, icon: Icon, label, color }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <div
                  className="nav-icon"
                  style={isActive ? { background: `${color}18` } : {}}
                >
                  <Icon
                    size={15}
                    color={isActive ? color : 'var(--text-2)'}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className="pulse-dot" />
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Demo Mode</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>Echo v1.0.0 · DPDP Compliant</div>
      </div>
    </aside>
  )
}
