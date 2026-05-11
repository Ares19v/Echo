"""Echo – pytest fixtures shared across all tests."""
import pytest
import pytest_asyncio
from agent.hms.mock_adapter import MockHMSAdapter
from agent.core.dialogue_manager import DialogueState
from agent.core.escalation import EscalationEngine
from agent.core.language_router import Lang


@pytest.fixture
def mock_hms():
    return MockHMSAdapter()


@pytest.fixture
def dialogue_state():
    return DialogueState(call_id="test-001", patient_phone="+919876543210")


@pytest.fixture
def escalation_engine():
    return EscalationEngine()
