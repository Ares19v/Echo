"""
Echo – LiveKit Agent Worker.
Properly wired voice pipeline using AgentSession + Silero VAD + Sarvam STT/TTS + Gemini LLM.

Running (production):
    python -m agent.worker

Running (from Run_Project.bat):
    python -m agent.worker start
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# Load .env before anything else so LIVEKIT_URL etc. are available to the worker CLI
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import silero

from agent.livekit_plugins import GeminiLLM, SarvamSTT, SarvamTTS
from config.settings import get_settings

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)
settings = get_settings()

_PROMPT_DIR = Path(__file__).parent / "prompts"

_SYSTEM_PROMPT = """
You are Echo, an AI healthcare voice assistant for a clinic. 
Be concise (1-3 sentences per response) since this is a voice call.
Help patients with: appointment booking, lab reports, OPD timings, prescriptions, and general clinic questions.
Always be polite, empathetic, and professional.
Start by asking the patient how you can help them today.

If the patient wants to book an appointment, ask for their preferred day and time.
Once they provide a day and time, confirm the booking and tell them their appointment is confirmed. 
For the purposes of this demo, you have already successfully written the appointment to the database.

If someone has an emergency, immediately advise them to call 112 or go to the nearest emergency room.
If a patient is distressed or asks for a human, say you will transfer them.
Keep answers short and clear for voice.
""".strip()


from datetime import datetime, UTC
from db.session import get_db_context
from db.models import CallLog, CallOutcome, CallIntent

class EchoAgent(Agent):
    """Echo healthcare voice agent — one instance per call."""

    def __init__(self) -> None:
        super().__init__(instructions=_SYSTEM_PROMPT)

    async def on_enter(self) -> None:
        """Called when the agent joins a room — plays the opening greeting."""
        await self.session.say(
            "Namaste! You've reached the clinic. I'm Echo, your AI assistant. "
            "This call may be recorded for quality purposes. How can I help you today?",
            allow_interruptions=True,
        )


async def entrypoint(ctx: JobContext) -> None:
    """One LiveKit job = one call session."""
    logger.info("New Echo call session — room: %s", ctx.room.name)
    started_at = datetime.now(UTC)

    await ctx.connect()

    # Build the voice pipeline
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=SarvamSTT(
            api_key=settings.SARVAM_API_KEY,
            model=settings.SARVAM_STT_MODEL,
            language=settings.DEFAULT_LANGUAGE,
        ),
        llm=GeminiLLM(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_MODEL,
            temperature=settings.GEMINI_TEMPERATURE,
            max_tokens=settings.GEMINI_MAX_TOKENS,
            system_prompt=_SYSTEM_PROMPT,
        ),
        tts=SarvamTTS(
            api_key=settings.SARVAM_API_KEY,
            model=settings.SARVAM_TTS_MODEL,
            voice=settings.SARVAM_DEFAULT_VOICE,
            language=settings.DEFAULT_LANGUAGE,
            speed=settings.SARVAM_TTS_SPEED,
        ),
    )

    disconnect_fut = asyncio.Future()
    
    @ctx.room.on("disconnected")
    def on_disconnect(*args, **kwargs):
        if not disconnect_fut.done():
            disconnect_fut.set_result(None)

    await session.start(ctx.room, agent=EchoAgent())
    logger.info("Echo session started for room %s", ctx.room.name)

    # Wait for the call to end
    await disconnect_fut
    logger.info("Room disconnected, saving call log for %s", ctx.room.name)

    try:
        ended_at = datetime.now(UTC)
        duration = int((ended_at - started_at).total_seconds())
        
        transcript = []
        if hasattr(session, "history"):
            for msg in session.history.messages:
                if getattr(msg, "text_content", None):
                    transcript.append({
                        "role": msg.role,
                        "text": msg.text_content
                    })
        
        async with get_db_context() as db:
            log = CallLog(
                livekit_room_name=ctx.room.name,
                patient_phone="browser-simulator",
                started_at=started_at,
                ended_at=ended_at,
                duration_seconds=duration,
                turn_count=len(transcript),
                transcript=transcript,
                outcome=CallOutcome.RESOLVED if len(transcript) > 2 else CallOutcome.ABANDONED,
                primary_intent=CallIntent.UNKNOWN
            )
            db.add(log)
            # db.commit() is handled automatically by get_db_context()
        logger.info("Saved call log for room %s successfully.", ctx.room.name)
    except Exception as e:
        logger.error("Failed to save call log: %s", e)


if __name__ == "__main__":
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
