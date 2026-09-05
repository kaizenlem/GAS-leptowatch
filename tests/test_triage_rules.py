"""
Deterministic rule engine tests.

The rule engine is the AUTHORITATIVE layer for risk classification and
referral. These tests lock in the documented escalation pathways and the
"no medication dosing" guarantee.

Maps to user scenarios:
  Test 1 -> Flood + fever + jaundice            -> CRITICAL escalation
  Test 2 -> Flood + fever + myalgia             -> HIGH-risk pathway
  Test 3 -> No flood exposure + fever           -> appropriate lower risk
  Test 7 -> Insufficient clinical information   -> INSUFFICIENT_INFORMATION
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources import (
    SOURCE_REGISTRY,
    RULESET_VERSION,
    DOH_FAST_LANE,
    WHO_GUIDANCE,
    CDC_OVERVIEW,
)
from triage import rule_based_triage


def _patient(**overrides):
    base = {
        "flood_exposure": False,
        "flood_days_ago": 0,
        "fever": False,
        "myalgia": False,
        "headache": False,
        "red_eyes": False,
        "jaundice": False,
        "oliguria": False,
        "symptom_days": 2,
        "age": 35,
        "comorbidities": "None",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Test 1: Flood + fever + jaundice -> deterministic escalation pathway
# ---------------------------------------------------------------------------
class TestCriticalEscalation:
    def test_flood_fever_jaundice_is_critical(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice=True))
        assert result.risk_level == "CRITICAL"
        assert "URGENT" in result.recommendation
        assert "otional" not in result.recommendation  # safety: no dosing vocabulary
        assert "fast lane" in result.recommendation.lower() or "refer" in result.recommendation.lower()

    def test_flood_fever_oliguria_is_critical(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, oliguria=True))
        assert result.risk_level == "CRITICAL"

    def test_flood_fever_jaundice_and_oliguria_is_critical(self):
        result = rule_based_triage(
            _patient(flood_exposure=True, fever=True, jaundice=True, oliguria=True)
        )
        assert result.risk_level == "CRITICAL"

    def test_reasoning_mentions_organ_involvement(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice=True))
        assert "jaundice" in result.reasoning


# ---------------------------------------------------------------------------
# Test 2: Flood + fever + myalgia -> high-risk pathway
# ---------------------------------------------------------------------------
class TestHighRiskPathway:
    def test_flood_fever_myalgia_is_high(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        assert result.risk_level == "HIGH"
        assert "physician evaluation" in result.recommendation.lower()

    def test_high_includes_lab_referral(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        assert any(token in result.recommendation.lower() for token in ("cbc", "creatinine", "laboratory"))


# ---------------------------------------------------------------------------
# Test 3: No flood exposure + fever -> appropriate lower-risk pathway
# ---------------------------------------------------------------------------
class TestLowerRiskPathway:
    def test_no_flood_with_fever_is_low(self):
        result = rule_based_triage(_patient(flood_exposure=False, fever=True, myalgia=True))
        assert result.risk_level == "LOW"

    def test_no_flood_without_fever_is_low(self):
        result = rule_based_triage(_patient(flood_exposure=False))
        assert result.risk_level == "LOW"

    def test_low_recommendation_is_supportive_care(self):
        result = rule_based_triage(_patient(flood_exposure=False, fever=True))
        assert result.risk_level == "LOW"
        assert "viral illness" in result.recommendation.lower()


# ---------------------------------------------------------------------------
# Test 7: Insufficient clinical information -> INSUFFICIENT_INFORMATION
# ---------------------------------------------------------------------------
class TestInsufficientInformation:
    def test_missing_flood_exposure(self):
        result = rule_based_triage(_patient(flood_exposure=None, fever=True))
        assert result.risk_level == "INSUFFICIENT_INFORMATION"
        assert result.is_ai_generated is False

    def test_missing_fever(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=None))
        assert result.risk_level == "INSUFFICIENT_INFORMATION"

    def test_none_flood_and_fever(self):
        result = rule_based_triage(_patient(flood_exposure=None, fever=None))
        assert result.risk_level == "INSUFFICIENT_INFORMATION"


# ---------------------------------------------------------------------------
# Cross-cutting guarantees
# ---------------------------------------------------------------------------
class TestEngineGuarantees:
    @pytest.mark.parametrize(
        "patient",
        [
            _patient(flood_exposure=True, fever=True, jaundice=True),
            _patient(flood_exposure=True, fever=True, myalgia=True),
            _patient(flood_exposure=True, fever=True),
            _patient(flood_exposure=False, fever=True),
            _patient(),
        ],
    )
    def test_never_prescribes_medication(self, patient):
        result = rule_based_triage(patient)
        lowered = result.recommendation.lower()
        assert "doxycycline" not in lowered
        assert "100mg" not in lowered
        assert "mg" not in lowered
        assert "administer" not in lowered
        assert "prescribe" not in lowered

    @pytest.mark.parametrize(
        "patient",
        [
            _patient(flood_exposure=True, fever=True, jaundice=True),
            _patient(flood_exposure=True, fever=True, myalgia=True),
            _patient(flood_exposure=True, fever=True),
            _patient(flood_exposure=False, fever=True),
            _patient(),
        ],
    )
    def test_citations_exist_in_verified_registry(self, patient):
        result = rule_based_triage(patient)
        for citation in result.citations:
            assert citation in SOURCE_REGISTRY, (
                f"{citation} is not a verified source"
            )
        assert DOH_FAST_LANE in SOURCE_REGISTRY
        assert WHO_GUIDANCE in SOURCE_REGISTRY
        assert CDC_OVERVIEW in SOURCE_REGISTRY

    def test_deterministic_flag_and_ruleset_version(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        assert result.is_ai_generated is False
        assert RULESET_VERSION in result.model_used

    def test_same_input_same_output(self):
        patient = _patient(flood_exposure=True, fever=True, myalgia=True)
        first = rule_based_triage(patient)
        second = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        assert first.risk_level == second.risk_level
        assert first.recommendation == second.recommendation