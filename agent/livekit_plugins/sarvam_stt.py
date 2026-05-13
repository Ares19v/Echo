"""
Echo – Sarvam STT plugin for LiveKit Agents.
Wraps Sarvam's Saarika v2 STT into the livekit-agents STT interface.
"""
from __future__ import annotations

import base64
import io
import uuid
import wave
import asyncio
import logging
from dataclasses import dataclass

import httpx
from livekit.agents import APIConnectOptions, stt, utils
from livekit.agents.stt import (
    SpeechData,
    SpeechEvent,
    SpeechEventType,
)
from livekit import rtc

logger = logging.getLogger(__name__)

_SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"


@dataclass
class SarvamSTTOptions:
    api_key: str
    model: str = "saarika:v2"
    language_code: str = "en-IN"


class SarvamSTT(stt.STT):
    """LiveKit-compatible Sarvam STT plugin using Saarika v2."""

    def __init__(self, *, api_key: str, model: str = "saarika:v2", language: str = "en-IN") -> None:
        super().__init__(capabilities=stt.STTCapabilities(streaming=False, interim_results=False))
        self._opts = SarvamSTTOptions(api_key=api_key, model=model, language_code=language)

    async def _recognize_impl(
        self,
        buffer: utils.AudioBuffer,
        *,
        language: str | None = None,
        conn_options: APIConnectOptions | None = None,
    ) -> SpeechEvent:
        """Convert AudioBuffer → WAV bytes → Sarvam STT API → SpeechEvent."""
        lang = language or self._opts.language_code

        # Convert AudioBuffer frames to WAV bytes
        wav_bytes = self._frames_to_wav(buffer)

        request_id = str(uuid.uuid4())
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _SARVAM_STT_URL,
                    headers={"api-subscription-key": self._opts.api_key},
                    data={"model": self._opts.model, "language_code": lang},
                    files={"file": ("audio.wav", wav_bytes, "audio/wav")},
                )
                resp.raise_for_status()
                data = resp.json()

            transcript = data.get("transcript", "")
            confidence = data.get("confidence", 0.85)
            detected_lang = data.get("language_code", lang)
            logger.debug("Sarvam STT: %r (lang=%s, conf=%.2f)", transcript, detected_lang, confidence)

        except Exception as e:
            logger.warning("Sarvam STT error: %s", e)
            transcript = ""
            confidence = 0.0
            detected_lang = lang

        return SpeechEvent(
            type=SpeechEventType.FINAL_TRANSCRIPT,
            request_id=request_id,
            alternatives=[
                SpeechData(
                    language=detected_lang,
                    text=transcript,
                    confidence=confidence,
                )
            ],
        )

    @staticmethod
    def _frames_to_wav(buffer: utils.AudioBuffer) -> bytes:
        """Merge AudioBuffer frames into a WAV byte stream."""
        merged = utils.merge_frames(buffer)
        sample_rate = merged.sample_rate
        num_channels = merged.num_channels
        pcm = bytes(merged.data)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(num_channels)
            wf.setsampwidth(2)  # 16-bit PCM
            wf.setframerate(sample_rate)
            wf.writeframes(pcm)
        return buf.getvalue()

    async def aclose(self) -> None:
        pass
