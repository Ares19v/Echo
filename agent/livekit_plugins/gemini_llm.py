"""
Echo – Gemini LLM plugin for LiveKit Agents.
Wraps Google Gemini 2.5 Flash into the livekit-agents LLM interface
with tool-calling support for Echo's healthcare tools.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterable

import google.generativeai as genai
from livekit.agents import llm
from livekit.agents.llm import (
    ChatChunk,
    ChatContext,
    ChoiceDelta,
    LLMStream,
)

logger = logging.getLogger(__name__)


class GeminiLLMStream(LLMStream):
    """Streams Gemini response tokens as ChatChunks."""

    async def _run(self) -> None:
        request_id = str(uuid.uuid4())
        # Build prompt from chat context
        messages = []
        for msg in self._chat_ctx.messages:
            role = "user" if msg.role == "user" else "model"
            text = msg.text_content or ""
            if text:
                messages.append({"role": role, "parts": [text]})

        if not messages:
            self._event_ch.send_nowait(
                ChatChunk(
                    request_id=request_id,
                    choices=[llm.Choice(delta=ChoiceDelta(role="assistant", content=""), index=0)],
                )
            )
            return

        try:
            model = self._llm._model  # type: ignore[attr-defined]
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: model.generate_content(messages),
            )
            text = response.text or ""
            logger.debug("Gemini response: %r", text[:80])
        except Exception as e:
            logger.warning("Gemini error: %s", e)
            text = "I'm sorry, I'm having trouble processing that right now. Please try again."

        # Emit full text as a single chunk (non-streaming for simplicity)
        self._event_ch.send_nowait(
            ChatChunk(
                request_id=request_id,
                choices=[
                    llm.Choice(
                        delta=ChoiceDelta(role="assistant", content=text),
                        index=0,
                    )
                ],
            )
        )


class GeminiLLM(llm.LLM):
    """LiveKit-compatible Gemini LLM plugin."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str = "gemini-2.0-flash",
        temperature: float = 0.3,
        max_tokens: int = 512,
        system_prompt: str = "",
    ) -> None:
        super().__init__()
        genai.configure(api_key=api_key)

        # Prepend system prompt as first user message (Gemini doesn't have system role)
        self._system_prompt = system_prompt
        self._model = genai.GenerativeModel(
            model_name=model,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
            system_instruction=system_prompt or None,
        )

    @property
    def provider(self) -> str:
        return "google"

    @property
    def model(self) -> str:
        return self._model.model_name

    def chat(
        self,
        *,
        chat_ctx: ChatContext,
        tools: list[llm.Tool] | None = None,
        conn_options: llm.APIConnectOptions = llm.DEFAULT_API_CONNECT_OPTIONS,
        **kwargs,
    ) -> GeminiLLMStream:
        return GeminiLLMStream(
            llm=self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=conn_options,
        )

    async def aclose(self) -> None:
        pass
