import React from 'react'

const OUTCOME_STYLES = {
  resolved:  { cls: 'badge-green',  label: 'Resolved' },
  escalated: { cls: 'badge-red',    label: 'Escalated' },
  abandoned: { cls: 'badge-amber',  label: 'Abandoned' },
  failed:    { cls: 'badge-gray',   label: 'Failed' },
}
const LANG_LABELS = { 'en-IN': 'EN', 'hi-IN': 'HI', 'mr-IN': 'MR', unknown: '—' }

export default function StatusBadge({ type, value }) {
  if (type === 'outcome') {
    const s = OUTCOME_STYLES[value] || { cls: 'badge-gray', label: value }
    return <span className={`badge ${s.cls}`}>{s.label}</span>
  }
  if (type === 'language') {
    return <span className="badge badge-blue">{LANG_LABELS[value] || value}</span>
  }
  return <span className="badge badge-gray">{value}</span>
}
