import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  ParticipantEvent,
} from 'livekit-client'
import { Phone, PhoneOff, Mic, MicOff, Loader, Radio, MessageSquare, AlertCircle } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || ''

const CALL_STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AGENT_JOINED: 'agent_joined',
  ENDED: 'ended',
  ERROR: 'error',
}

const STATE_LABELS = {
  [CALL_STATES.IDLE]:        { text: 'Ready to call', color: 'var(--text-3)' },
  [CALL_STATES.CONNECTING]:  { text: 'Connecting…',   color: '#f5a623' },
  [CALL_STATES.CONNECTED]:   { text: 'Waiting for Echo…', color: '#f5a623' },
  [CALL_STATES.AGENT_JOINED]:{ text: 'Echo is listening', color: '#22d3a8' },
  [CALL_STATES.ENDED]:       { text: 'Call ended',    color: 'var(--text-3)' },
  [CALL_STATES.ERROR]:       { text: 'Error',         color: '#f04747' },
}

export default function Simulator() {
  const [callState, setCallState] = useState(CALL_STATES.IDLE)
  const [transcript, setTranscript] = useState([])
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState(null)
  const [duration, setDuration] = useState(0)

  const roomRef = useRef(null)
  const localTrackRef = useRef(null)
  const timerRef = useRef(null)
  const transcriptEndRef = useRef(null)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Call timer
  useEffect(() => {
    if (callState === CALL_STATES.AGENT_JOINED) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      clearInterval(timerRef.current)
      if (callState === CALL_STATES.IDLE || callState === CALL_STATES.ENDED) setDuration(0)
    }
    return () => clearInterval(timerRef.current)
  }, [callState])

  const formatDuration = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const addMessage = useCallback((role, text) => {
    setTranscript(prev => [...prev, { role, text, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
  }, [])

  const startCall = async () => {
    setError(null)
    setTranscript([])
    setCallState(CALL_STATES.CONNECTING)

    try {
      // 1. Get LiveKit token from backend
      const res = await fetch(`${API_BASE}/admin/simulator/token?room_name=echo-demo&identity=admin-${Date.now()}`, {
        method: 'POST',
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      if (!res.ok) throw new Error(`Token request failed: ${res.status}`)
      const { token, livekit_url } = await res.json()

      // 2. Create and connect room
      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      // Room event listeners
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        if (participant.identity?.startsWith('agent') || participant.identity?.startsWith('echo')) {
          setCallState(CALL_STATES.AGENT_JOINED)
          addMessage('system', 'Echo AI has joined the call')
        }
      })

      room.on(RoomEvent.ParticipantDisconnected, () => {
        addMessage('system', 'Echo AI has left the call')
        endCall()
      })

      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.style.display = 'none'
          document.body.appendChild(el)
        }
      })

      room.on(RoomEvent.DataReceived, (data) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(data))
          if (msg.type === 'transcript') {
            addMessage(msg.role || 'assistant', msg.text)
          }
        } catch { /* ignore non-JSON data */ }
      })

      room.on(RoomEvent.Disconnected, () => {
        setCallState(prev => prev !== CALL_STATES.ENDED ? CALL_STATES.ENDED : prev)
      })

      await room.connect(livekit_url, token)
      setCallState(CALL_STATES.CONNECTED)

      // 3. Publish microphone
      const localAudio = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true })
      localTrackRef.current = localAudio
      await room.localParticipant.publishTrack(localAudio)

      addMessage('system', 'Microphone connected — waiting for Echo AI agent to join…')

    } catch (err) {
      console.error('Call error:', err)
      setError(err.message)
      setCallState(CALL_STATES.ERROR)
    }
  }

  const endCall = useCallback(async () => {
    setCallState(CALL_STATES.ENDED)
    if (localTrackRef.current) {
      localTrackRef.current.stop()
      localTrackRef.current = null
    }
    if (roomRef.current) {
      await roomRef.current.disconnect()
      roomRef.current = null
    }
    addMessage('system', 'Call ended')
  }, [addMessage])

  const toggleMute = () => {
    if (!localTrackRef.current) return
    if (isMuted) {
      localTrackRef.current.unmute()
    } else {
      localTrackRef.current.mute()
    }
    setIsMuted(m => !m)
  }

  const isActive = callState === CALL_STATES.CONNECTED || callState === CALL_STATES.AGENT_JOINED

  return (
    <div className="anim-fade-up" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Call Simulator</h1>
          <p className="page-sub">Talk to Echo AI directly from your browser — no phone needed</p>
        </div>
        {isActive && (
          <div className="live-indicator">
            <span className="pulse-dot" />
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Info banner */}
      {callState === CALL_STATES.IDLE && (
        <div style={{
          background: 'rgba(61,123,253,0.08)', border: '1px solid rgba(61,123,253,0.2)',
          borderRadius: 'var(--r-md)', padding: '14px 18px', marginBottom: 24,
          display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13,
        }}>
          <Radio size={16} color="#3d7bfd" style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ color: 'var(--text-2)' }}>
            <strong style={{ color: 'var(--text-1)' }}>How it works: </strong>
            Click <em>Call Echo</em>, allow microphone access, then speak naturally.
            Echo AI will pick up, introduce itself, and respond to your voice.
            The agent worker must be running for Echo to join the room.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 }}>
        {/* Left — Call controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main call card */}
          <div className="card-glow" style={{ textAlign: 'center', padding: 36 }}>
            {/* Avatar / pulse ring */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              {callState === CALL_STATES.AGENT_JOINED && (
                <>
                  <div style={{ position: 'absolute', width: 110, height: 110, borderRadius: '50%', background: 'rgba(34,211,168,0.08)', animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite' }} />
                  <div style={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', background: 'rgba(34,211,168,0.12)', animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite 0.5s' }} />
                </>
              )}
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: callState === CALL_STATES.AGENT_JOINED
                  ? 'linear-gradient(135deg, #22d3a8, #3d7bfd)'
                  : 'var(--surface-2)',
                border: `2px solid ${callState === CALL_STATES.AGENT_JOINED ? 'rgba(34,211,168,0.4)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.4s ease', position: 'relative', zIndex: 1,
              }}>
                <Radio size={28} color={callState === CALL_STATES.AGENT_JOINED ? '#fff' : 'var(--text-3)'} />
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-1)', marginBottom: 6 }}>Echo AI</div>
            <div style={{ fontSize: 13, color: STATE_LABELS[callState].color, marginBottom: 28 }}>
              {STATE_LABELS[callState].text}
            </div>

            {/* Primary call button */}
            {!isActive ? (
              <button
                id="call-echo-btn"
                onClick={callState === CALL_STATES.CONNECTING ? undefined : startCall}
                disabled={callState === CALL_STATES.CONNECTING}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '14px 32px', borderRadius: 40,
                  background: callState === CALL_STATES.ERROR
                    ? 'linear-gradient(135deg, #f04747, #c0392b)'
                    : 'linear-gradient(135deg, #22d3a8, #3d7bfd)',
                  border: 'none', cursor: callState === CALL_STATES.CONNECTING ? 'wait' : 'pointer',
                  color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em',
                  boxShadow: '0 4px 24px rgba(34,211,168,0.25)',
                  transition: 'all 0.2s', opacity: callState === CALL_STATES.CONNECTING ? 0.7 : 1,
                }}
              >
                {callState === CALL_STATES.CONNECTING ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={18} />}
                {callState === CALL_STATES.ERROR ? 'Retry Call' : callState === CALL_STATES.CONNECTING ? 'Connecting…' : 'Call Echo'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {/* Mute */}
                <button
                  id="mute-btn"
                  onClick={toggleMute}
                  style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: isMuted ? 'rgba(240,71,71,0.15)' : 'var(--surface-2)',
                    border: `1px solid ${isMuted ? 'rgba(240,71,71,0.4)' : 'var(--border)'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                >
                  {isMuted ? <MicOff size={18} color="#f04747" /> : <Mic size={18} color="var(--text-2)" />}
                </button>
                {/* End call */}
                <button
                  id="end-call-btn"
                  onClick={endCall}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '0 24px', height: 48, borderRadius: 40,
                    background: 'linear-gradient(135deg, #f04747, #c0392b)',
                    border: 'none', cursor: 'pointer',
                    color: '#fff', fontWeight: 700, fontSize: 14,
                    boxShadow: '0 4px 16px rgba(240,71,71,0.3)', transition: 'all 0.2s',
                  }}
                >
                  <PhoneOff size={16} />
                  End Call
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(240,71,71,0.08)', border: '1px solid rgba(240,71,71,0.2)',
              borderRadius: 'var(--r-md)', padding: '12px 16px',
              display: 'flex', gap: 10, fontSize: 12, color: '#f04747', alignItems: 'flex-start',
            }}>
              <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Agent status checklist */}
          <div className="card-glow">
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', marginBottom: 14 }}>Requirements</div>
            {[
              { label: 'Backend API running', ok: true },
              { label: 'Agent worker running', ok: callState === CALL_STATES.AGENT_JOINED, pending: isActive && callState !== CALL_STATES.AGENT_JOINED },
              { label: 'Microphone access granted', ok: isActive },
              { label: 'LiveKit room joined', ok: isActive || callState === CALL_STATES.ENDED },
            ].map(({ label, ok, pending }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 12 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: ok ? '#22d3a8' : pending ? '#f5a623' : 'var(--surface-3)',
                  boxShadow: ok ? '0 0 6px rgba(34,211,168,0.5)' : 'none',
                }} />
                <span style={{ color: ok ? 'var(--text-2)' : 'var(--text-3)' }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)' }}>
              Start the agent worker with:<br />
              <code style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>python -m agent.worker</code>
            </div>
          </div>
        </div>

        {/* Right — Live Transcript */}
        <div className="card-glow" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <MessageSquare size={15} color="var(--text-3)" />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>Live Transcript</span>
            {isActive && <span className="pulse-dot" style={{ marginLeft: 'auto' }} />}
          </div>

          <div style={{
            flex: 1, minHeight: 340, maxHeight: 420, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 10,
            paddingRight: 4,
          }}>
            {transcript.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-3)', fontSize: 13, gap: 8, paddingTop: 40 }}>
                <MessageSquare size={28} strokeWidth={1.2} />
                <span>Transcript will appear here during the call</span>
              </div>
            )}
            {transcript.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: 8,
              }}>
                {msg.role === 'system' ? (
                  <div style={{
                    width: '100%', textAlign: 'center', fontSize: 11,
                    color: 'var(--text-3)', padding: '4px 0',
                  }}>
                    — {msg.text} —
                  </div>
                ) : (
                  <>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: msg.role === 'user' ? 'rgba(61,123,253,0.2)' : 'rgba(34,211,168,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: msg.role === 'user' ? '#3d7bfd' : '#22d3a8',
                    }}>
                      {msg.role === 'user' ? 'YOU' : 'AI'}
                    </div>
                    <div style={{
                      maxWidth: '76%',
                      background: msg.role === 'user' ? 'rgba(61,123,253,0.1)' : 'var(--surface-2)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(61,123,253,0.2)' : 'var(--border)'}`,
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '9px 13px', fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5,
                    }}>
                      {msg.text}
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{msg.ts}</div>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {/* Ping animation keyframe */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
