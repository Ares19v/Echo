"""
Echo – Sarvam TTS plugin for LiveKit Agents.
Wraps Sarvam's Bulbul v2 TTS into the livekit-agents TTS interface.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import uuid
import wave
from dataclasses import dataclass

import httpx
from livekit import rtc
from livekit.agents import APIConnectOptions, DEFAULT_API_CONNECT_OPTIONS
from livekit.agents import tts
from livekit.agents.tts import ChunkedStream, SynthesizedAudio

logger = logging.getLogger(__name__)

_SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"
_SAMPLE_RATE = 22050  # Sarvam returns 22050 Hz
_NUM_CHANNELS = 1


@dataclass
class SarvamTTSOptions:
    api_key: str
    model: str = "bulbul:v2"
    voice: str = "meera"
    language_code: str = "en-IN"
    speed: float = 0.92


class SarvamChunkedStream(ChunkedStream):
    """Single-shot Sarvam TTS request wrapped as a ChunkedStream."""

    def __init__(self, *, tts: "SarvamTTS", input_text: str, conn_options: APIConnectOptions) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._tts_ref: SarvamTTS = tts  # type: ignore[assignment]

    async def _run(self) -> None:
        request_id = str(uuid.uuid4())
        opts = self._tts_ref._opts
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    _SARVAM_TTS_URL,
                    headers={
                        "api-subscription-key": opts.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "inputs": [self._input_text],
                        "target_language_code": opts.language_code,
                        "speaker": opts.voice,
                        "model": opts.model,
                        "speech_sample_rate": _SAMPLE_RATE,
                        "enable_preprocessing": True,
                        "pace": opts.speed,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                audio_b64 = data["audios"][0]
                pcm_bytes = self._wav_b64_to_pcm(audio_b64)

            frame = rtc.AudioFrame(
                data=pcm_bytes,
                sample_rate=_SAMPLE_RATE,
                num_channels=_NUM_CHANNELS,
                samples_per_channel=len(pcm_bytes) // 2,
            )
            self._event_ch.send_nowait(
                SynthesizedAudio(
                    frame=frame,
                    request_id=request_id,
                    is_final=True,
                    segment_id=request_id,
                    delta_text=self._input_text,
                )
            )
            logger.debug("Sarvam TTS: %r → %d bytes PCM", self._input_text[:60], len(pcm_bytes))

        except Exception as e:
            logger.warning("Sarvam TTS error: %s", e)
            # Send silence on failure so the pipeline doesn't hang
            silence = bytes(int(_SAMPLE_RATE * 0.5) * 2)  # 0.5s silence
            frame = rtc.AudioFrame(
                data=silence,
                sample_rate=_SAMPLE_RATE,
                num_channels=_NUM_CHANNELS,
                samples_per_channel=len(silence) // 2,
            )
            self._event_ch.send_nowait(
                SynthesizedAudio(frame=frame, request_id=request_id, is_final=True)
            )

    @staticmethod
    def _wav_b64_to_pcm(b64: str) -> bytes:
        """Decode base64 WAV and extract raw PCM bytes."""
        wav_bytes = base64.b64decode(b64)
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            return wf.readframes(wf.getnframes())


class SarvamTTS(tts.TTS):
    """LiveKit-compatible Sarvam TTS plugin using Bulbul v2."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "bulbul:v2",
        voice: str = "meera",
        language: str = "en-IN",
        speed: float = 0.92,
    ) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=_SAMPLE_RATE,
            num_channels=_NUM_CHANNELS,
        )
        self._opts = SarvamTTSOptions(
            api_key=api_key,
            model=model,
            voice=voice,
            language_code=language,
            speed=speed,
        )

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
    ) -> SarvamChunkedStream:
        return SarvamChunkedStream(tts=self, input_text=text, conn_options=conn_options)

    async def aclose(self) -> None:
        pass
