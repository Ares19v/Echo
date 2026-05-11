import React, { useState, useEffect } from 'react'
import { fetchConfig, fetchFlags, patchFlag } from '../api/client'

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: enabled ? 'var(--accent)' : 'var(--bg-border)',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: enabled ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

const FLAG_LABELS = {
  triage_enabled: { label: 'Symptom Triage', desc: 'Allow patients to describe symptoms for intake' },
  lab_lookup_enabled: { label: 'Lab Report Lookup', desc: 'Allow patients to check report status' },
  prescription_lookup_enabled: { label: 'Prescription Lookup', desc: 'Show active prescriptions via voice' },
  registration_enabled: { label: 'New Patient Registration', desc: 'Accept new patient draft registrations' },
  faq_enabled: { label: 'FAQ Search', desc: 'Answer common clinic questions' },
  sms_summary_enabled: { label: 'Post-Call SMS', desc: 'Send appointment confirmation SMS (requires Exotel)' },
}

export default function Settings() {
  const [config, setConfig] = useState(null)
  const [flags, setFlags] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [cfg, fl] = await Promise.all([fetchConfig(), fetchFlags()])
        setConfig(cfg)
        setFlags(fl.flags || {})
      } catch {
        setConfig({ app_name: 'Echo', version: '1.0.0', environment: 'development', hms_provider: 'mock', gemini_model: 'gemini-2.5-flash', gemini_ready: false, sarvam_ready: false, livekit_ready: false, exotel_ready: false })
        setFlags({ triage_enabled: true, lab_lookup_enabled: true, prescription_lookup_enabled: true, registration_enabled: true, faq_enabled: true, sms_summary_enabled: false })
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
      setFlags(f => ({ ...f, [flag]: !val })) // revert on failure
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div style={{ color: 'var(--text-secondary)', padding: 40 }}>Loading settings...</div>

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Runtime configuration and feature toggles
        </p>
      </div>

      {/* Runtime Config */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Runtime Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {config && Object.entries({
            'App Version': config.version,
            'Environment': config.environment,
            'HMS Provider': config.hms_provider,
            'LLM Model': config.gemini_model,
            'Gemini': config.gemini_ready ? '✓ Ready' : '✗ Not configured',
            'Sarvam AI': config.sarvam_ready ? '✓ Ready' : '✗ Not configured',
            'LiveKit': config.livekit_ready ? '✓ Ready' : '✗ Not configured',
            'Exotel': config.exotel_ready ? '✓ Ready' : '✗ Not configured',
          }).map(([key, val]) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: typeof val === 'string' && val.startsWith('✗') ? 'var(--accent-red)' : val.startsWith?.('✓') ? 'var(--accent-green)' : 'var(--text-primary)' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Feature Toggles</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {Object.entries(FLAG_LABELS).map(([flag, { label, desc }]) => (
            <div key={flag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--bg-border)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {saving === flag && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saving...</span>}
                <Toggle enabled={!!flags[flag]} onChange={val => handleToggle(flag, val)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
