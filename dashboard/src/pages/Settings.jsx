import React, { useState, useEffect } from 'react'
import { fetchConfig, fetchFlags, patchFlag } from '../api/client'
import { Settings2 } from 'lucide-react'

const FLAG_META = {
  triage_enabled:               { label: 'Symptom Triage',        desc: 'Allows patients to describe symptoms for intake assessment.' },
  lab_lookup_enabled:           { label: 'Lab Report Lookup',      desc: 'Enables patients to check their lab report status.' },
  prescription_lookup_enabled:  { label: 'Prescription Lookup',    desc: 'Allows patients to hear their active prescriptions.' },
  registration_enabled:         { label: 'New Patient Registration',desc: 'Accepts draft registrations for new patients.' },
  faq_enabled:                  { label: 'FAQ Search',             desc: 'Answers common clinic questions via AI search.' },
  sms_summary_enabled:          { label: 'Post-Call SMS',          desc: 'Sends appointment confirmation SMS (requires Exotel).' },
}

function Toggle({ on, onChange, saving }) {
  return (
    <button
      className={`toggle${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      disabled={saving}
      style={{ opacity: saving ? 0.5 : 1 }}
    >
      <div className="toggle-thumb" />
    </button>
  )
}

function ConfigItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: typeof value === 'string' && value.startsWith('✗') ? 'var(--red)'
             : typeof value === 'string' && value.startsWith('✓') ? 'var(--green)'
             : 'var(--text-1)',
        fontWeight: 500,
      }}>
        {value}
      </div>
    </div>
  )
}

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [flags, setFlags] = useState({})
  const [saving, setSaving] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, fl] = await Promise.all([fetchConfig(), fetchFlags()])
        setConfig(cfg)
        setFlags(fl.flags || {})
      } catch {
        setConfig({
          version: '1.0.0', environment: 'development', hms_provider: 'mock',
          gemini_model: 'gemini-2.5-flash', gemini_ready: false,
          sarvam_ready: false, livekit_ready: false, exotel_ready: false,
        })
        setFlags({
          triage_enabled: true, lab_lookup_enabled: true,
          prescription_lookup_enabled: true, registration_enabled: true,
          faq_enabled: true, sms_summary_enabled: false,
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleToggle = async (flag, val) => {
    setSaving(flag)
    setFlags(f => ({ ...f, [flag]: val }))
    try {
      await patchFlag(flag, val)
    } catch {
      setFlags(f => ({ ...f, [flag]: !val }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Runtime configuration and feature flags</p>
      </div>

      {/* Runtime Config */}
      <div className="card-glow anim-fade-up" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Settings2 size={14} color="var(--blue)" />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Runtime Configuration</span>
          <span style={{ marginLeft: 'auto' }} className="badge badge-gray">Read-only</span>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton" style={{ height: 36 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            <ConfigItem label="Version"     value={config?.version} />
            <ConfigItem label="Environment" value={config?.environment} />
            <ConfigItem label="HMS"         value={config?.hms_provider} />
            <ConfigItem label="LLM Model"   value={config?.gemini_model} />
            <ConfigItem label="Gemini"      value={config?.gemini_ready ? '✓ Ready' : '✗ Not configured'} />
            <ConfigItem label="Sarvam AI"   value={config?.sarvam_ready ? '✓ Ready' : '✗ Not configured'} />
            <ConfigItem label="LiveKit"     value={config?.livekit_ready ? '✓ Ready' : '✗ Not configured'} />
            <ConfigItem label="Exotel"      value={config?.exotel_ready ? '✓ Ready' : '✗ Not configured'} />
          </div>
        )}
      </div>

      {/* Feature Flags */}
      <div className="card anim-fade-up" style={{ animationDelay: '80ms' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)', marginBottom: 4 }}>Feature Flags</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>
          Toggle agent capabilities without restarting the server.
        </div>

        {loading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="skeleton" style={{ height: 32, width: 240 }} />
              <div className="skeleton" style={{ height: 22, width: 40 }} />
            </div>
          ))
        ) : (
          Object.entries(FLAG_META).map(([flag, { label, desc }], i) => (
            <div
              key={flag}
              className="anim-fade-up"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 0',
                borderBottom: i < Object.keys(FLAG_META).length - 1 ? '1px solid var(--border)' : 'none',
                animationDelay: `${100 + i * 40}ms`,
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-1)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {saving === flag && (
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Saving…</span>
                )}
                <Toggle on={!!flags[flag]} onChange={val => handleToggle(flag, val)} saving={saving === flag} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
