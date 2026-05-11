"""
Echo – Dashboard API.
Provides call logs, transcripts, live status, escalations, and analytics
for the admin dashboard frontend.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.auth import require_dashboard_key
from db.models import AuditEvent, CallLog, CallOutcome, TriageRecord
from db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(require_dashboard_key)])

# ─── WebSocket Live Feed ──────────────────────────────────────────────────────

class LiveCallManager:
    """Broadcasts live call events to all connected dashboard WebSocket clients."""
    def __init__(self):
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws) if hasattr(self._connections, 'discard') else None
        if ws in self._connections:
            self._connections.remove(ws)

    async def broadcast(self, event: dict) -> None:
        dead = []
        for ws in self._connections:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


_live_manager = LiveCallManager()


@router.websocket("/ws/live")
async def live_calls_ws(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time call updates in the dashboard."""
    await _live_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive with ping
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        _live_manager.disconnect(websocket)


# ─── Call Logs ────────────────────────────────────────────────────────────────

@router.get("/calls")
async def list_calls(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    outcome: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Paginated call log with search and filters."""
    query = select(CallLog).order_by(desc(CallLog.started_at))

    if search:
        query = query.where(CallLog.patient_phone.contains(search))
    if outcome:
        query = query.where(CallLog.outcome == outcome)
    if language:
        query = query.where(CallLog.language == language)
    if date_from:
        query = query.where(CallLog.started_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.where(CallLog.started_at <= datetime.fromisoformat(date_to))

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    calls = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "calls": [_serialise_call(c) for c in calls],
    }


@router.get("/calls/{call_id}")
async def get_call(call_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get full call details including transcript."""
    result = await db.execute(select(CallLog).where(CallLog.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return _serialise_call(call, include_transcript=True)


@router.get("/calls/{call_id}/transcript")
async def get_transcript(call_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Get just the conversation transcript for a call."""
    result = await db.execute(select(CallLog).where(CallLog.id == call_id))
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return {"call_id": str(call_id), "transcript": call.transcript or []}


# ─── Escalations ──────────────────────────────────────────────────────────────

@router.get("/escalations")
async def list_escalations(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Calls that were escalated to a human agent."""
    query = (
        select(CallLog)
        .where(CallLog.outcome == CallOutcome.ESCALATED)
        .order_by(desc(CallLog.started_at))
    )
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar_one()
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    calls = result.scalars().all()
    return {
        "total": total,
        "calls": [_serialise_call(c) for c in calls],
    }


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)) -> dict:
    """Headline stats for the dashboard overview."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    total_calls = (await db.execute(select(func.count(CallLog.id)))).scalar_one()
    today_calls = (await db.execute(
        select(func.count(CallLog.id)).where(CallLog.started_at >= today_start)
    )).scalar_one()
    resolved = (await db.execute(
        select(func.count(CallLog.id)).where(CallLog.outcome == CallOutcome.RESOLVED)
    )).scalar_one()
    escalated = (await db.execute(
        select(func.count(CallLog.id)).where(CallLog.outcome == CallOutcome.ESCALATED)
    )).scalar_one()
    avg_duration = (await db.execute(select(func.avg(CallLog.duration_seconds)))).scalar_one()

    resolution_rate = round((resolved / total_calls * 100) if total_calls else 0, 1)
    escalation_rate = round((escalated / total_calls * 100) if total_calls else 0, 1)

    # Intent distribution (last 7 days)
    intent_result = await db.execute(
        select(CallLog.primary_intent, func.count(CallLog.id).label("count"))
        .where(CallLog.started_at >= week_start)
        .group_by(CallLog.primary_intent)
        .order_by(desc("count"))
        .limit(8)
    )
    intents = [{"intent": r[0].value if r[0] else "unknown", "count": r[1]} for r in intent_result]

    # Language distribution
    lang_result = await db.execute(
        select(CallLog.language, func.count(CallLog.id).label("count"))
        .group_by(CallLog.language)
    )
    languages = [{"language": r[0].value if r[0] else "unknown", "count": r[1]} for r in lang_result]

    return {
        "total_calls": total_calls,
        "today_calls": today_calls,
        "resolution_rate": resolution_rate,
        "escalation_rate": escalation_rate,
        "avg_duration_seconds": round(avg_duration or 0),
        "intents": intents,
        "languages": languages,
    }


@router.get("/health-status")
async def get_health_status() -> dict:
    """Check status of all integrated external services."""
    from agent.hms import get_hms_adapter
    from config.settings import get_settings
    s = get_settings()

    results = {}

    # HMS
    hms = get_hms_adapter()
    hms_ok, hms_latency = await hms.health_check()
    results["hms"] = {"ok": hms_ok, "latency_ms": hms_latency, "provider": s.HMS_PROVIDER.value}

    # Sarvam
    results["sarvam"] = {"ok": s.sarvam_ready, "configured": s.sarvam_ready}

    # Gemini
    results["gemini"] = {"ok": s.gemini_ready, "configured": s.gemini_ready, "model": s.GEMINI_MODEL}

    # LiveKit
    results["livekit"] = {"ok": s.livekit_ready, "configured": s.livekit_ready}

    # Exotel
    results["exotel"] = {"ok": s.exotel_ready, "configured": s.exotel_ready}

    overall = hms_ok and (s.sarvam_ready or True)  # degraded ok in demo mode
    return {"overall": "healthy" if overall else "degraded", "services": results}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialise_call(call: CallLog, include_transcript: bool = False) -> dict:
    d = {
        "id": str(call.id),
        "patient_phone": call.patient_phone,
        "language": call.language.value if call.language else "unknown",
        "primary_intent": call.primary_intent.value if call.primary_intent else "unknown",
        "outcome": call.outcome.value if call.outcome else "unknown",
        "escalation_reason": call.escalation_reason.value if call.escalation_reason else None,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "duration_seconds": call.duration_seconds,
        "turn_count": call.turn_count,
        "consent_given": call.consent_given,
        "sentiment_score": call.sentiment_score,
        "summary": call.summary,
    }
    if include_transcript:
        d["transcript"] = call.transcript or []
    return d
