"""
Echo – LiveKit Agent Worker.
This is the entrypoint for the Echo AI voice pipeline.
One instance of this worker runs per active inbound call.

Architecture:
  Exotel WebSocket → LiveKit SIP → This Worker
  Worker: VAD → Sarvam STT → Gemini LLM → Sarvam TTS → LiveKit → Exotel → Patient

Running:
  python -m agent.worker          (connects to LiveKit Cloud)
  ECHO_DEMO=1 python -m agent.worker  (mock mode, no live keys required)
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path

import google.generativeai as genai
import httpx
from livekit import agents
from livekit.agents import JobContext, WorkerOptions, cli

from agent.core.barge_in_handler import BargeInHandler
from agent.core.dialogue_manager import DialogueManager, DialogueState
from agent.core.escalation import EscalationEngine
from agent.core.language_router import Lang, LanguageSession, detect_language
from agent.core.sentiment_monitor import SentimentMonitor
from agent.tools import appointments, faq, lab_reports, patient_lookup, triage
from config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Prompt Loading ───────────────────────────────────────────────────────────

_PROMPT_DIR = Path(__file__).parent / "prompts"


def _load_system_prompt(lang: Lang) -> str:
    lang_file = {Lang.ENGLISH: "system_en.md", Lang.HINDI: "system_hi.md", Lang.MARATHI: "system_mr.md"}
    path = _PROMPT_DIR / lang_file.get(lang, "system_en.md")
    return path.read_text(encoding="utf-8") if path.exists() else "You are Echo, a healthcare AI assistant."


# ─── Sarvam STT/TTS Clients ──────────────────────────────────────────────────

class SarvamSTT:
    """Streaming STT using Sarvam Saarika v2. Falls back to echo in demo mode."""

    async def transcribe(self, audio_bytes: bytes, language_hint: str = "en-IN") -> tuple[str, str, float]:
        """Returns (transcript, detected_lang_code, confidence)."""
        if not settings.sarvam_ready:
            return "[DEMO MODE – no Sarvam key]", "en-IN", 0.9

        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                f"{settings.SARVAM_BASE_URL}/speech-to-text",
                headers={"api-subscription-key": settings.SARVAM_API_KEY},
                data={"model": settings.SARVAM_STT_MODEL, "language_code": language_hint},
                files={"file": ("audio.wav", audio_bytes, "audio/wav")},
            )
            resp.raise_for_status()
            data = resp.json()
            transcript = data.get("transcript", "")
            lang_code = data.get("language_code", "en-IN")
            confidence = data.get("confidence", 0.85)
            return transcript, lang_code, confidence


class SarvamTTS:
    """TTS using Sarvam Bulbul. Falls back to silence bytes in demo mode."""

    async def synthesize(self, text: str, language_code: str = "en-IN", voice: str = "meera") -> bytes:
        if not settings.sarvam_ready:
            logger.debug("[DEMO TTS] Would say: %s", text[:80])
            return b""  # silent audio in demo

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.SARVAM_BASE_URL}/text-to-speech",
                headers={
                    "api-subscription-key": settings.SARVAM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "inputs": [text],
                    "target_language_code": language_code,
                    "speaker": voice,
                    "model": settings.SARVAM_TTS_MODEL,
                    "speech_sample_rate": 16000,
                    "enable_preprocessing": True,
                    "pace": settings.SARVAM_TTS_SPEED,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            import base64
            return base64.b64decode(data["audios"][0])


# ─── Gemini LLM Client ───────────────────────────────────────────────────────

class GeminiLLM:
    """Gemini 2.5 Flash with tool-calling. Falls back to static responses in demo mode."""

    _TOOL_SCHEMAS = [
        {
            "name": "get_available_slots",
            "description": "Get available appointment slots. Use when patient wants to book an appointment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "e.g. Gastroenterology"},
                    "doctor_name": {"type": "string"},
                    "preferred_date_str": {"type": "string", "description": "YYYY-MM-DD format"},
                },
            },
        },
        {
            "name": "book_appointment",
            "description": "Book a confirmed appointment slot for the patient.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "slot_id": {"type": "string"},
                    "notes": {"type": "string"},
                },
                "required": ["patient_id", "slot_id"],
            },
        },
        {
            "name": "get_lab_reports",
            "description": "Check lab report status for a patient.",
            "parameters": {
                "type": "object",
                "properties": {"patient_id": {"type": "string"}},
                "required": ["patient_id"],
            },
        },
        {
            "name": "get_prescriptions",
            "description": "Get active prescriptions for a patient.",
            "parameters": {
                "type": "object",
                "properties": {"patient_id": {"type": "string"}},
                "required": ["patient_id"],
            },
        },
        {
            "name": "run_triage",
            "description": "Perform symptom triage intake. Use when patient describes symptoms.",
            "parameters": {
                "type": "object",
                "properties": {
                    "chief_complaint": {"type": "string"},
                    "symptoms": {"type": "array", "items": {"type": "string"}},
                    "duration": {"type": "string"},
                    "severity": {"type": "integer", "minimum": 1, "maximum": 10},
                },
                "required": ["chief_complaint", "symptoms", "duration", "severity"],
            },
        },
        {
            "name": "search_faq",
            "description": "Search clinic FAQ for patient questions about timings, policies, etc.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    ]

    _TOOL_DISPATCH = {
        "get_available_slots": appointments.get_available_slots,
        "book_appointment": appointments.book_appointment,
        "get_lab_reports": lab_reports.get_lab_reports,
        "get_prescriptions": lab_reports.get_prescriptions,
        "run_triage": triage.run_triage,
        "search_faq": faq.search_faq,
    }

    def __init__(self) -> None:
        if settings.gemini_ready:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._model = genai.GenerativeModel(
                model_name=settings.GEMINI_MODEL,
                tools=self._TOOL_SCHEMAS,
                generation_config=genai.GenerationConfig(
                    temperature=settings.GEMINI_TEMPERATURE,
                    max_output_tokens=settings.GEMINI_MAX_TOKENS,
                ),
            )
        else:
            self._model = None

    async def respond(self, state: DialogueState, user_text: str) -> str:
        """Generate a response. Handles tool calls automatically."""
        if not self._model:
            return self._demo_response(user_text, state)

        system_prompt = _load_system_prompt(state.session_lang)
        history = state.get_context_for_llm()

        # Build patient context injection
        patient_ctx = ""
        if state.patient_id:
            patient_ctx = (
                f"\n[PATIENT CONTEXT]\n"
                f"Patient: {state.patient_name} (ID: {state.patient_id})\n"
                f"Preferred language: {state.session_lang.value}\n"
            )

        chat = self._model.start_chat(history=history)
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: chat.send_message(
                f"{system_prompt}{patient_ctx}\n\nUser: {user_text}"
            ),
        )

        # Handle tool calls
        if response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    tool_name = part.function_call.name
                    tool_args = dict(part.function_call.args)
                    logger.info("Tool call: %s(%s)", tool_name, tool_args)

                    tool_fn = self._TOOL_DISPATCH.get(tool_name)
                    if tool_fn:
                        tool_result = await tool_fn(**tool_args)
                        # Send tool result back to model
                        final_response = await asyncio.get_event_loop().run_in_executor(
                            None,
                            lambda tn=tool_name, tr=tool_result: chat.send_message(
                                genai.protos.Content(parts=[
                                    genai.protos.Part(function_response=genai.protos.FunctionResponse(
                                        name=tn,
                                        response={"result": json.dumps(tr)},
                                    ))
                                ])
                            ),
                        )
                        return final_response.text

        return response.text

    def _demo_response(self, user_text: str, state: DialogueState) -> str:
        """Static demo responses when no Gemini key is configured."""
        text_lower = user_text.lower()
        if any(w in text_lower for w in ["appointment", "book", "schedule"]):
            return "Of course! I can help you book an appointment. Which department or doctor would you like to see, and what date works best for you?"
        if any(w in text_lower for w in ["report", "lab", "result", "test"]):
            return "Let me check your lab reports. One moment please."
        if any(w in text_lower for w in ["timing", "hours", "open", "time"]):
            return "Our OPD is open Monday to Friday from 9 AM to 6 PM, and Saturday from 9 AM to 2 PM."
        if any(w in text_lower for w in ["hello", "hi", "namaste", "namaskar"]):
            return f"Hello{' ' + state.patient_name + '!' if state.patient_name else '!'} How can I help you today?"
        return "I understand. Could you tell me a little more about how I can help you?"


# ─── Main Agent Entrypoint ────────────────────────────────────────────────────

async def entrypoint(ctx: JobContext) -> None:
    """Main entry point for each incoming call session."""
    call_id = str(uuid.uuid4())
    logger.info("New call session: %s | room=%s", call_id, ctx.room.name)

    # Extract caller phone from room metadata (set by Exotel webhook)
    try:
        metadata = json.loads(ctx.room.metadata or "{}")
    except (json.JSONDecodeError, TypeError):
        metadata = {}

    caller_phone = metadata.get("caller_phone", "unknown")

    # Initialise per-call components
    lang_session = LanguageSession()
    state = DialogueState(call_id=call_id, patient_phone=caller_phone)
    dialogue = DialogueManager(state)
    escalation_engine = EscalationEngine()
    sentiment = SentimentMonitor()
    BargeInHandler(
        base_silence_ms=settings.VAD_SILENCE_THRESHOLD_MS,
        elderly_silence_ms=settings.VAD_ELDERLY_THRESHOLD_MS,
    )
    SarvamSTT()
    tts_client = SarvamTTS()
    llm = GeminiLLM()

    await ctx.connect(auto_subscribe=agents.AutoSubscribe.AUDIO_ONLY)

    # ── Patient Identification ────────────────────────────────────────────────
    if caller_phone != "unknown":
        patient_data = await patient_lookup.lookup_by_phone(caller_phone)
        if patient_data.get("found"):
            state.patient_id = patient_data["patient_id"]
            state.patient_name = patient_data["name"]
            state.is_known_patient = True
            # Use patient's preferred language
            pref_lang = patient_data.get("preferred_language", "en-IN")
            lang_map = {"en-IN": Lang.ENGLISH, "hi-IN": Lang.HINDI, "mr-IN": Lang.MARATHI}
            state.session_lang = lang_map.get(pref_lang, Lang.ENGLISH)
            lang_session.session_lang = state.session_lang

    # ── Consent Greeting ──────────────────────────────────────────────────────
    consent_messages = {
        Lang.ENGLISH: (
            "Namaste! You've reached the clinic. This call is assisted by an AI and may be recorded for quality purposes. "
            "Say 'yes' or 'hanji' to continue, or press 1."
        ),
        Lang.HINDI: (
            "Namaste! Aap clinic mein phone kar rahe hain. Yeh call ek AI se assist ki ja rahi hai aur quality ke liye record ho sakti hai. "
            "Continue karne ke liye 'hanji' bolein ya 1 dabaein."
        ),
        Lang.MARATHI: (
            "Namaste! Tumhi clinic la phone kela ahe. He call AI ne assist kele jaat ahe aani quality saathi record hoʾu shakate. "
            "Continue karnyasaathi 'hoy' mhana kinva 1 daba."
        ),
    }

    greeting = consent_messages.get(state.session_lang, consent_messages[Lang.ENGLISH])
    logger.info("Playing consent greeting in %s", state.session_lang)

    # In production: synthesize and stream this via LiveKit audio track
    await tts_client.synthesize(
        greeting,
        language_code=state.session_lang.value,
        voice="meera" if state.session_lang == Lang.ENGLISH else "pavithra",
    )

    # ── Personalised Welcome ──────────────────────────────────────────────────
    if state.is_known_patient:
        welcome = {
            Lang.ENGLISH: f"Welcome back, {state.patient_name}! How can I help you today?",
            Lang.HINDI: f"Wapas swagat hai, {state.patient_name}! Main aaj aapki kaise madad kar sakta hoon?",
            Lang.MARATHI: f"Punha swagat, {state.patient_name}! Mi aaj tumhala kashi madad karu?",
        }.get(state.session_lang, f"Welcome back, {state.patient_name}! How can I help?")
    else:
        welcome = {
            Lang.ENGLISH: "Welcome! I'm Echo, the clinic's AI assistant. How can I help you today?",
            Lang.HINDI: "Swagat hai! Main Echo hoon, clinic ka AI assistant. Aaj main aapki kaise madad kar sakta hoon?",
            Lang.MARATHI: "Swagat! Mi Echo ahe, cliniccha AI assistant. Mi aaj tumhala kashi maddat karu?",
        }.get(state.session_lang, "Welcome! How can I help you today?")

    state.consent_given = True
    state.add_turn("assistant", welcome)

    # ── Main Conversation Loop ────────────────────────────────────────────────
    # In production: LiveKit VoiceAssistant handles the audio streaming loop.
    # Below is the core logic that the VoiceAssistant callbacks call into.

    async def handle_user_speech(transcript: str, lang_code: str, confidence: float) -> str:
        """Process a transcribed user utterance and return the agent's response."""
        # Update language
        detected_lang, _ = detect_language(transcript, lang_code)
        lang_session.update(detected_lang, confidence)
        state.session_lang = lang_session.session_lang

        state.add_turn("user", transcript)

        # Emergency check first — highest priority
        esc = escalation_engine.check(transcript, state.session_lang)
        if esc.is_emergency:
            state.escalated = True
            state.escalation_reason = "emergency"
            return esc.advisory_message

        # Sentiment check
        sent = sentiment.analyse(transcript, state.session_lang.value)
        empathy_prefix = sent.empathy_phrase + " " if sent.empathy_phrase else ""

        # Low confidence — ask to repeat
        if lang_session.needs_clarification:
            return dialogue.handle_clarification_failure()

        # Check if patient is asking for human
        human_request_signals = [
            "human", "person", "staff", "receptionist", "doctor", "someone",
            "koi insaan", "staff se", "manush", "wyakti",
        ]
        if any(s in transcript.lower() for s in human_request_signals) and "appointment" not in transcript.lower():
            state.escalated = True
            state.escalation_reason = "patient_requested"
            msgs = {
                Lang.ENGLISH: "Of course! Let me connect you to our team right away.",
                Lang.HINDI: "Bilkul! Main abhi aapko hamare team se connect karta hoon.",
                Lang.MARATHI: "Nakki! Mi aata tumhala aamchya teamshī joḍto.",
            }
            return msgs.get(state.session_lang, msgs[Lang.ENGLISH])

        # Generate LLM response
        response_text = await llm.respond(state, transcript)
        full_response = empathy_prefix + response_text

        state.add_turn("assistant", full_response)
        return full_response

    # Expose the handler (called by LiveKit agent framework callbacks)
    ctx.room.metadata = json.dumps({
        "call_id": call_id,
        "patient_id": state.patient_id,
        "session_lang": state.session_lang.value,
    })

    logger.info(
        "Call %s ready | patient=%s | lang=%s | hms=%s | gemini=%s | sarvam=%s",
        call_id, state.patient_id or "new",
        state.session_lang.value,
        settings.HMS_PROVIDER.value,
        "✓" if settings.gemini_ready else "DEMO",
        "✓" if settings.sarvam_ready else "DEMO",
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
