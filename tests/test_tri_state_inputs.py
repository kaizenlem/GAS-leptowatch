"""
Yes / No / Unknown tri-state input tests (P1-2 / P1-4).

The UI collects symptoms as tri-state values so "unknown" is never treated as
"absent". Decisive unknowns (flood exposure, fever) force INSUFFICIENT_INFORMATION;
non-decisive unknowns are recorded but do not upgrade the risk level.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources import tri_state, tri_label
from triage import rule_based_triage


def _patient(**overrides):
    base = {
        "flood_exposure": "unknown",
        "flood_days_ago": 0,
        "fever": "unknown",
        "myalgia": "unknown",
        "headache": "unknown",
        "red_eyes": "unknown",
        "jaundice": "unknown",
        "oliguria": "unknown",
        "symptom_days": 2,
        "age": 35,
        "comorbidities": "None",
    }
    base.update(overrides)
    return base


class TestNormalizer:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("yes", True),
            ("no", False),
            ("unknown", None),
            ("Unknown", None),
            ("UNKNOWN", None),
            ("Yes", True),
            ("NO", False),
            ("true", True),
            ("false", False),
            ("1", True),
            ("0", False),
            ("n/a", None),
            ("unclear", None),
            ("not sure", None),
            ("?", None),
            ("", False),
            (True, True),
            (False, False),
            (None, None),
            (1, True),
            (0, False),
            (2, True),
        ],
    )
    def test_mapping(self, raw, expected):
        assert tri_state(raw) is expected

    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("yes", "Yes"),
            ("no", "No"),
            ("unknown", "Unknown"),
            (True, "Yes"),
            (False, "No"),
            (None, "Unknown"),
        ],
    )
    def test_label(self, raw, expected):
        assert tri_label(raw) == expected


class TestDecisiveUnknowns:
    def test_unknown_flood_and_fever_is_insufficient(self):
        result = rule_based_triage(_patient())  # both default to unknown
        assert result.risk_level == "INSUFFICIENT_INFORMATION"
        assert "Confirm flood exposure history and fever status" in result.recommendation

    def test_unknown_flood_with_fever_is_insufficient(self):
        result = rule_based_triage(
            _patient(flood_exposure="unknown", fever="yes", myalgia="yes", jaundice="yes")
        )
        assert result.risk_level == "INSUFFICIENT_INFORMATION"

    def test_unknown_fever_with_flood_is_insufficient(self):
        result = rule_based_triage(
            _patient(flood_exposure="yes", fever="unknown", myalgia="yes")
        )
        assert result.risk_level == "INSUFFICIENT_INFORMATION"


class TestTriStateMappingToLevels:
    def test_yes_yes_with_unknown_other_signs_is_not_upgraded(self):
        # flood + fever known, everything else unknown: must NOT jump to HIGH/CRITICAL
        result = rule_based_triage(_patient(flood_exposure="yes", fever="yes"))
        assert result.risk_level == "MODERATE"

    def test_unknown_jaundice_does_not_trigger_critical(self):
        result = rule_based_triage(
            _patient(flood_exposure="yes", fever="yes", jaundice="unknown", myalgia="no")
        )
        assert result.risk_level == "MODERATE"

    def test_yes_jaundice_triggers_critical(self):
        result = rule_based_triage(
            _patient(flood_exposure="yes", fever="yes", jaundice="yes")
        )
        assert result.risk_level == "CRITICAL"

    def test_yes_myalgia_triggers_high(self):
        result = rule_based_triage(
            _patient(flood_exposure="yes", fever="yes", myalgia="yes")
        )
        assert result.risk_level == "HIGH"

    def test_unknown_myalgia_keeps_moderate(self):
        result = rule_based_triage(
            _patient(flood_exposure="yes", fever="yes", myalgia="unknown", headache="yes")
        )
        assert result.risk_level == "MODERATE"

    def test_explicit_no_myalgia_keeps_moderate(self):
        result = rule_based_triage(
            _patient(flood_exposure="yes", fever="yes", myalgia="no")
        )
        assert result.risk_level == "MODERATE"

    def test_no_flood_is_low_even_with_symptoms(self):
        result = rule_based_triage(
            _patient(flood_exposure="no", fever="yes", myalgia="yes")
        )
        assert result.risk_level == "LOW"


class TestStringVsBooleanCompat:
    def test_boolean_inputs_still_work(self):
        result_strings = rule_based_triage(
            _patient(flood_exposure="yes", fever="yes", jaundice="yes")
        )
        result_bools = rule_based_triage(
            {"flood_exposure": True, "fever": True, "jaundice": True}
        )
        assert result_strings.risk_level == result_bools.risk_level == "CRITICAL"

    def test_mixed_boolean_and_string(self):
        result = rule_based_triage(
            {"flood_exposure": True, "fever": "yes", "myalgia": "no"}
        )
        assert result.risk_level == "MODERATE"

    def test_none_and_unknown_are_equivalent(self):
        result_none = rule_based_triage({"flood_exposure": None, "fever": True})
        result_unknown = rule_based_triage({"flood_exposure": "unknown", "fever": True})
        assert result_none.risk_level == result_unknown.risk_level == "INSUFFICIENT_INFORMATION"

    def test_empty_string_is_falsy_not_unknown(self):
        result = rule_based_triage({"flood_exposure": "", "fever": ""})
        assert result.risk_level == "LOW"