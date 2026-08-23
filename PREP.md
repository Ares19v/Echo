# Study Prep Guide: Echo – AI Healthcare Voice Agent

Welcome! This guide is a step-by-step beginner's tutorial designed to help you understand and build **Echo**—a real-time, multilingual AI voice assistant for healthcare clinics. You will learn about Voice AI Pipelines, WebRTC audio streaming, API integrations, and regulatory data compliance.

---

## 🗺️ System Architecture

Echo handles live telephone calls using a robust, real-time streaming pipeline. The user's audio is captured, processed, and responded to in under **500 milliseconds** using modern WebRTC and ultra-fast inference layers:

```
               [Patient Telephone]
                       │ (PSTN Audio)
                       ▼
               [LiveKit WebRTC Cloud]
                       │ (Binary Audio websocket)
                       ▼
              [LiveKit Agent Worker]
            /          │           \
           /           │            \
    [Sarvam STT]  [Groq LLM]   [Sarvam TTS]
    (Audio->Text)  (Llama-3.1)  (Text->Audio)
                       │
             [Clinic Database / HMS]
              (Appointment Booking)
```

---

## 📚 Core Learning Prerequisites

Make sure you understand:
1. **The Voice Pipeline**:
   - **Speech-to-Text (STT)**: Converting audio into text.
   - **Language Model (LLM)**: Reasoning and deciding how to respond (using tool calling for booking).
   - **Text-to-Speech (TTS)**: Synthesizing the text response back into natural-sounding speech.
2. **WebRTC**: A protocol designed for real-time peer-to-peer audio/video streaming with minimal latency.
3. **Groq / LPU**: A hardware technology designed specifically to perform LLM inference at incredible speeds (over 800 tokens/sec), crucial for natural phone conversations.

---

## 🛠️ Step-by-Step Implementation Guide

Let's build a mock voice response loop in Python to see how an LLM handles patient appointment scheduling!

### Step 1: Set Up the Environment
Create a folder and install the required modules:
```bash
mkdir mini-echo
cd mini-echo
python -m venv venv
venv\Scripts\activate  # On Windows
pip install fastapi uvicorn pydantic requests
```

---

### Step 2: Implement Clinic Appointment Tool Calling
Create a Python script `clinic_agent.py` to see how we define mock appointment booking tools and let an LLM decide when to call them:

```python
import json

# 1. Mock Clinic Database
appointments = [
    {"id": 1, "doctor": "Dr. Sharma", "time": "10:00 AM", "patient": "Rahul Kumar"},
    {"id": 2, "doctor": "Dr. Patil", "time": "11:30 AM", "patient": "Priya Singh"}
]

# 2. Define Actionable Tools
def book_appointment(doctor: str, time: str, patient: str):
    new_id = len(appointments) + 1
    new_booking = {"id": new_id, "doctor": doctor, "time": time, "patient": patient}
    appointments.append(new_booking)
    return f"Appointment successfully booked for {patient} with {doctor} at {time}. (ID: {new_id})"

def check_doctor_availability(doctor: str):
    # Returns mock slot availability
    return f"{doctor} is available at 1:00 PM and 3:30 PM today."

# 3. Simulate LLM Tool Execution Hook
def handle_patient_query(query: str):
    # In production, we pass the tool signatures to the LLM.
    # The LLM returns a structured JSON calling the tool.
    print(f"\nUser Query: \"{query}\"")
    
    if "book" in query.lower() or "schedule" in query.lower():
        # Mocking LLM extraction of arguments
        result = book_appointment("Dr. Sharma", "3:30 PM", "Amit Shah")
        return result
    elif "available" in query.lower() or "free" in query.lower():
        result = check_doctor_availability("Dr. Sharma")
        return result
    else:
        return "I can help you book appointments or check doctor availability. What would you like to do?"

print(handle_patient_query("Is Dr. Sharma free today?"))
print(handle_patient_query("I want to book an appointment with Dr. Sharma at 3:30 PM."))
```

Run this file:
```bash
python clinic_agent.py
```

---

### Step 3: Implement an Immutable Audit Log (DPDP Compliance)
Under privacy regulations like India's DPDP Act, patient interactions must generate an immutable audit trail. Create `audit_logger.py`:

```python
from datetime import datetime

class ImmutableAuditLog:
    def __init__(self):
        self._events = [] # Private list

    def log_event(self, user_id: str, action: str, details: str):
        # Create a read-only dictionary snapshot
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "action": action,
            "details": details
        }
        self._events.append(event)
        print(f"[AUDIT LOG] {event['timestamp']} - User {user_id} performed {action}: {details}")

    @property
    def events(self):
        # Return a copy to prevent in-place modifications
        return list(self._events)

# Test it
audit = ImmutableAuditLog()
audit.log_event("agent_worker_01", "CONSENT_CAPTURED", "Spoken consent granted by caller +919876543210")
audit.log_event("agent_worker_01", "APPOINTMENT_BOOKED", "Booked ID: 3 for Amit Shah")
```

Run this script:
```bash
python audit_logger.py
```

---

## 🔍 Key Deep Dive Topics

### 1. Indian Code-Switching (Hinglish)
Indian patients routinely code-switch (mix Hindi/Marathi words with English, e.g. *"Doctor available hai kya?"*). 
- Standard Whisper models fail on Hinglish because they transcribe phonetically into separate languages.
- Echo leverages **Sarvam AI (Bulbul STT)**, which is fine-tuned specifically to capture local dialect inflections and Hinglish grammar patterns natively.

### 2. LiveKit Agents WebSocket Pipeline
Instead of loading AI models directly inside a standard REST API, Echo boots an independent **LiveKit Agent Worker**. This worker opens a persistent WebSocket connection directly with LiveKit's WebRTC servers, enabling two-way real-time audio chunk transmission and support for immediate user interruption ("Barge-in").

---

## 🎯 Verification Tasks

1. **Install and Boot**: Run `INSTALL.bat` and then `Run_Project.bat` to spin up uvicorn and Vite.
2. **Dashboard Review**: Open the React administrator dashboard at `http://localhost:5173` and inspect the Live Call logs and DPDP Audit compliance records.
