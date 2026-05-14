import React, { useEffect, useState } from 'react'
import { Calendar, MessageSquare, CheckCircle } from 'lucide-react'

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [smsLogs, setSmsLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const headers = { 'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY }
      const [apptsRes, smsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/appointments/`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/appointments/sms-log`, { headers })
      ])
      
      if (apptsRes.ok) setAppointments(await apptsRes.json())
      if (smsRes.ok) setSmsLogs(await smsRes.json())
    } catch (err) {
      console.error("Failed to fetch appointment data", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000) // auto refresh for demo
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading demo data...</div>

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Appointments & SMS Demo</h1>
        <p className="text-gray-400">Real-time view of bookings and simulated SMS messages from the AI agent.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Appointments Table */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden shadow-xl backdrop-blur-sm">
          <div className="p-4 border-b border-gray-700/50 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Latest Bookings</h2>
          </div>
          <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
            {appointments.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No appointments booked yet. Call the agent to test.</div>
            ) : (
              appointments.map(a => (
                <div key={a.id} className="p-4 hover:bg-gray-700/20 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium text-white">{a.patient_name}</div>
                      <div className="text-sm text-gray-400">{a.patient_phone}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" />
                      {a.status}
                    </span>
                  </div>
                  <div className="bg-gray-900/50 rounded p-3 text-sm text-gray-300">
                    <span className="text-indigo-400 font-medium">{a.doctor_name}</span> ({a.department})<br/>
                    <span className="text-emerald-400">{a.appointment_date} at {a.appointment_time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SMS Log */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden shadow-xl backdrop-blur-sm">
          <div className="p-4 border-b border-gray-700/50 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Outbound SMS (Demo)</h2>
          </div>
          <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto bg-gray-900/30">
            {smsLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">No SMS sent yet.</div>
            ) : (
              smsLogs.map(sms => (
                <div key={sms.id} className="p-4 flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">To: {sms.recipient_phone}</span>
                      <span className="text-gray-500">{new Date(sms.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-200 border border-gray-700 whitespace-pre-wrap font-mono">
                      {sms.message_body}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
