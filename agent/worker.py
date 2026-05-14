"""
Echo – LiveKit Agent Worker.
Voice pipeline: Silero VAD + Sarvam STT/TTS + Gemini LLM.

Start (dev mode):
    python -m agent.worker dev
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import silero, openai

from agent.livekit_plugins import SarvamSTT, SarvamTTS
from config.settings import get_settings

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)
settings = get_settings()

_SYSTEM_PROMPT = """
You are Echo, an AI healthcare voice assistant for a clinic.
Be concise (1-3 sentences per response) since this is a voice call.
Help patients with: appointment booking, lab reports, OPD timings, prescriptions, and general clinic questions.
Always be polite, empathetic, and professional.

If the patient wants to book an appointment, ask for their preferred day and time.
Once they provide a day and time, confirm the booking is confirmed.
For this demo, treat bookings as already written to the database.

If someone has an emergency, immediately advise them to call 112 or go to the nearest emergency room.
If a patient asks for a human, say you will transfer them.
Keep answers short and clear for voice.
""".strip()


class EchoAgent(Agent):
    """Echo healthcare voice agent — one instance per call."""

    def __init__(self) -> None:
        super().__init__(instructions=_SYSTEM_PROMPT)

    async def on_enter(self) -> None:
        """Greet the patient as soon as the agent joins."""
        await self.session.say(
            "Namaste! You've reached the clinic. I'm Echo, your AI healthcare assistant. "
            "How can I help you today?",
            allow_interruptions=True,
        )


async def entrypoint(ctx: JobContext) -> None:
    """One LiveKit job = one call session."""
    logger.info("New Echo call session — room: %s", ctx.room.name)
    started_at = datetime.now(UTC)

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=SarvamSTT(
            api_key=settings.SARVAM_API_KEY,
            model=settings.SARVAM_STT_MODEL,
            language=settings.DEFAULT_LANGUAGE,
        ),
        llm=openai.LLM(
            api_key=settings.GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
            model=settings.GROQ_MODEL,
        ),
        tts=SarvamTTS(
            api_key=settings.SARVAM_API_KEY,
            model=settings.SARVAM_TTS_MODEL,
            voice=settings.SARVAM_DEFAULT_VOICE,
            language=settings.DEFAULT_LANGUAGE,
            speed=settings.SARVAM_TTS_SPEED,
        ),
    )

    # Start the session — this internally handles ctx.connect() and room joining
    await session.start(EchoAgent(), room=ctx.room)
    logger.info("Echo session started for room %s", ctx.room.name)

    # session.start() is non-blocking (returns once started), so we wait for the room to close
    # by monitoring the room disconnect event
    disconnect_fut: asyncio.Future[None] = asyncio.get_event_loop().create_future()

    @ctx.room.on("disconnected")
    def _on_disconnect(*_args: object) -> None:
        if not disconnect_fut.done():
            disconnect_fut.set_result(None)

    await disconnect_fut
    logger.info("Room disconnected — saving call log for %s", ctx.room.name)

    # Persist call log to database (best-effort)
    try:
        from db.models import CallIntent, CallLog, CallOutcome
        from db.session import get_db_context

        ended_at = datetime.now(UTC)
        duration = int((ended_at - started_at).total_seconds())

        transcript: list[dict] = []
        if hasattr(session, "history") and session.history is not None:
            for msg in session.history.messages():
                text = getattr(msg, "text_content", None)
                if text:
                    transcript.append({"role": str(msg.role), "text": text})

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
                primary_intent=CallIntent.UNKNOWN,
            )
            db.add(log)
        logger.info("Saved call log for room %s", ctx.room.name)
    except Exception as exc:
        logger.warning("Could not save call log (non-fatal): %s", exc)


if __name__ == "__main__":
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
