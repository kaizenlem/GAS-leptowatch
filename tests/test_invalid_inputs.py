"""
Invalid and malformed input tests.

The rule engine treats missing or None-valued decisive risk factors as
INSUFFICIENT_INFORMATION rather than guessing. These tests exercise the
safe-fail behaviour of the deterministic engine (Test 7 family plus edges).
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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


class TestMissingKeyFactors:
    def test_empty_patient_dict(self):
        result = rule_based_triage({})
        assert result.risk_level == "INSUFFICIENT_INFORMATION"

    def test_only_irrelevant_keys(self):
        result = rule_based_triage(
            _patient(flood_exposure=None, fever=None, myalgia=True, headache=True, age=80, comorbidities="CKD")
        )
        assert result.risk_level == "INSUFFICIENT_INFORMATION"

    @pytest.mark.parametrize(
        "patient",
        [
            {"fever": True},
            {"flood_exposure": True},
            {"flood_exposure": False},
            {"fever": False},
            _patient(fever=None),
            _patient(flood_exposure=None),
            _patient(flood_exposure=None, fever=None),
            _patient(flood_exposure=True, fever=None),
            _patient(flood_exposure=None, fever=True),
        ],
    )
    def test_any_missing_decisive_factor_is_insufficient(self, patient):
        result = rule_based_triage(patient)
        assert result.risk_level == "INSUFFICIENT_INFORMATION"
        assert result.is_ai_generated is False

    def test_insufficient_result_never_escalates(self):
        result = rule_based_triage(_patient(flood_exposure=None))
        assert result.risk_level == "INSUFFICIENT_INFORMATION"
        assert result.risk_level not in ("CRITICAL", "HIGH", "MODERATE", "LOW")


class TestFalseyAndNonBooleanInputs:
    @pytest.mark.parametrize(
        "patient",
        [
            _patient(flood_exposure=False, fever=False),
            _patient(flood_exposure=0, fever=0),
            _patient(flood_exposure="", fever=""),
            _patient(flood_exposure=[], fever=[]),
        ],
    )
    def test_falsey_inputs_collapse_safely(self, patient):
        result = rule_based_triage(patient)
        assert result.risk_level == "LOW"

    @pytest.mark.parametrize(
        "patient",
        [
            _patient(flood_exposure=True, fever=1),
            _patient(flood_exposure=1, fever=True),
            _patient(flood_exposure="true", fever=True),
        ],
    )
    def test_truthy_inputs_stratify(self, patient):
        result = rule_based_triage(patient)
        assert result.risk_level in ("LOW", "MODERATE", "HIGH", "CRITICAL")

    def test_jaundice_truthy_string_triggers_critical(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice="yes"))
        assert result.risk_level == "CRITICAL"

    def test_symptom_days_default_when_missing(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        assert result.risk_level == "HIGH"


class TestExtremeClients:
    def test_elderly_flood_fever_is_moderate(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, age=91))
        assert result.risk_level == "MODERATE"

    def test_pediatric_flood_fever_with_myalgia_is_high(self):
        result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True, age=6))
        assert result.risk_level == "HIGH"


class TestStructuredGuarantees:
    def test_no_dosing_for_insufficient_information(self):
        result = rule_based_triage({})
        assert "mg" not in result.recommendation.lower()
        assert "doxycycline" not in result.recommendation.lower()

    def test_insufficient_info_is_safe_referral(self):
        result = rule_based_triage(_patient(flood_exposure=None))
        assert "consult" in result.recommendation.lower()
        assert "confirm" in result.recommendation.lower()