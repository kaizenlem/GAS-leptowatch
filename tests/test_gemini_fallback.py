"""
Gemini guardrail tests.

Gemini is the EXPLANATION layer only and may never change the deterministic
classification. These tests verify:
  Test 4 -> Gemini unavailable                -> same deterministic classification
  Test 5 -> Gemini returns malformed JSON     -> graceful rule-based fallback
  Test 6 -> Gemini contradicts the rule engine -> deterministic rule wins
Plus: invented citations are rejected against the verified source registry.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources import SOURCE_REGISTRY, RULESET_VERSION, DOH_FAST_LANE, WHO_GUIDANCE
from triage import assess_patient, rule_based_triage
from gemini_client import GeminiTriageClient


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


class FakeResponse:
    def __init__(self, text):
        self.text = text


class FakeModels:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def generate_content(self, model, contents, config):
        self.calls.append(model)
        if self.responses:
            return FakeResponse(self.responses.pop(0))
        raise RuntimeError("no more mocked responses")


class FakeClient:
    def __init__(self, responses):
        self.models = FakeModels(responses)

    def generate_content(self, model, contents, config):
        return self.models.generate_content(model, contents, config)


@pytest.fixture
def gemini_client(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    client = GeminiTriageClient(api_key="test-key")
    return client


# ---------------------------------------------------------------------------
# Test 4: Gemini unavailable -> same deterministic classification
# ---------------------------------------------------------------------------
class TestGeminiUnavailable:
    def test_no_api_key_returns_none_from_explain(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        client = GeminiTriageClient(api_key=None)
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        assert client.explain_result(_patient(flood_exposure=True, fever=True, myalgia=True), rule_result) is None

    def test_assess_patient_falls_back_deterministically(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        result, fallback = assess_patient(_patient(flood_exposure=True, fever=True, jaundice=True), use_ai=True)
        assert fallback is True
        assert result.risk_level == "CRITICAL"
        assert result.recommendation == rule_based_triage(
            _patient(flood_exposure=True, fever=True, jaundice=True)
        ).recommendation

    def test_use_ai_false_skips_gemini(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        result, fallback = assess_patient(_patient(flood_exposure=True, fever=True, myalgia=True), use_ai=False)
        assert fallback is True
        assert result.is_ai_generated is False
        assert result.risk_level == "HIGH"

    def test_exception_from_mocked_client_is_non_fatal(self):
        client = GeminiTriageClient(api_key="test-key")
        client.client = FakeClient([])  # generate_content raises -> fallback
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice=True))
        assert client.explain_result(_patient(flood_exposure=True, fever=True, jaundice=True), rule_result) is None


# ---------------------------------------------------------------------------
# Test 5: Gemini returns malformed JSON -> graceful fallback
# ---------------------------------------------------------------------------
class TestMalformedJson:
    def test_garbage_text_returns_rule_result(self, gemini_client):
        gemini_client.client = FakeClient(["This is not JSON at all: [invalid"])
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        enriched = gemini_client.explain_result(
            _patient(flood_exposure=True, fever=True, myalgia=True), rule_result
        )
        assert enriched is None  # caller falls back to pure rule engine
        assert rule_result.risk_level == "HIGH"

    def test_markdown_fenced_json_is_parsed(self, gemini_client):
        payload = {
            "reasoning": "Fever plus jaundice warrants escalation.",
            "missing_information": [],
            "safety_flags": ["Monitor for bleeding tendency"],
            "protocol_references": [DOH_FAST_LANE],
        }
        text = "```json\n%s\n```" % json.dumps(payload)
        assert gemini_client._extract_json(text) == payload

    def test_braces_inside_garbage_are_recovered(self, gemini_client):
        payload = {"reasoning": "ok", "missing_information": [], "safety_flags": [], "protocol_references": []}
        text = "prefix junk %s suffix junk" % json.dumps(payload)
        assert gemini_client._extract_json(text) == payload

    def test_all_models_busy_returns_none(self, gemini_client):
        gemini_client.client = FakeClient(["bad json", "also bad", "nope", "still bad"])
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice=True))
        out = gemini_client.explain_result(_patient(flood_exposure=True, fever=True, jaundice=True), rule_result)
        assert out is None
        assert len(gemini_client.client.models.calls) > 1  # exhausted fallback chain


# ---------------------------------------------------------------------------
# Test 6: Gemini contradicts deterministic rule -> deterministic rule wins
# ---------------------------------------------------------------------------
class TestGeminiCannotOverride:
    def test_ai_claiming_low_does_not_downgrade_critical(self, gemini_client):
        payload = json.dumps(
            {
                "reasoning": "I think this is actually mild and can go home.",
                "missing_information": [],
                "safety_flags": [],
                "protocol_references": [],
                "risk_level": "LOW",  # malicious/confused attempt to downgrade
                "recommendation": "Send patient home with no referral.",
            }
        )
        gemini_client.client = FakeClient([payload])

        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice=True))
        assert rule_result.risk_level == "CRITICAL"

        enriched = gemini_client.explain_result(
            _patient(flood_exposure=True, fever=True, jaundice=True), rule_result
        )
        assert enriched is not None
        assert enriched.risk_level == "CRITICAL"
        assert enriched.recommendation == rule_result.recommendation

    def test_ai_claiming_critical_does_not_upgrade_low(self, gemini_client):
        payload = json.dumps(
            {
                "reasoning": "Looks severe, escalate immediately.",
                "missing_information": [],
                "safety_flags": [],
                "protocol_references": [],
                "risk_level": "CRITICAL",
            }
        )
        gemini_client.client = FakeClient([payload])

        rule_result = rule_based_triage(_patient(flood_exposure=False, fever=True))
        assert rule_result.risk_level == "LOW"

        enriched = gemini_client.explain_result(_patient(flood_exposure=False, fever=True), rule_result)
        assert enriched.risk_level == "LOW"
        assert enriched.recommendation == rule_result.recommendation

    def test_ai_recommendation_field_is_ignored(self, gemini_client):
        payload = json.dumps(
            {
                "reasoning": "Explain.",
                "missing_information": [],
                "safety_flags": [],
                "protocol_references": [],
                "recommendation": "Administer Doxycycline 100mg BID for 7 days",
            }
        )
        gemini_client.client = FakeClient([payload])
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        enriched = gemini_client.explain_result(
            _patient(flood_exposure=True, fever=True, myalgia=True), rule_result
        )
        assert "doxycycline" not in enriched.recommendation.lower()
        assert enriched.recommendation == rule_result.recommendation


# ---------------------------------------------------------------------------
# Citation validation: only verified source IDs survive
# ---------------------------------------------------------------------------
class TestCitationValidation:
    def test_invented_source_is_rejected(self, gemini_client):
        refs = ["DOH-2026-BOGUS", WHO_GUIDANCE, "WHO-MADE-UP-001", "https://not.a.real.source/"]
        validated = gemini_client._validate_source_refs(refs)
        assert validated == [WHO_GUIDANCE]
        assert all(r in SOURCE_REGISTRY for r in validated)

    def test_non_list_refs_rejected(self, gemini_client):
        assert gemini_client._validate_source_refs("WHO-LEPTO-001") == []
        assert gemini_client._validate_source_refs(None) == []
        assert gemini_client._validate_source_refs(12345) == []

    def test_ai_refs_are_deduplicated_on_merge(self, gemini_client):
        payload = json.dumps(
            {
                "reasoning": "ok",
                "missing_information": [],
                "safety_flags": [],
                "protocol_references": [DOH_FAST_LANE, DOH_FAST_LANE],
            }
        )
        gemini_client.client = FakeClient([payload])
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        enriched = gemini_client.explain_result(
            _patient(flood_exposure=True, fever=True, myalgia=True), rule_result
        )
        assert enriched.citations.count(DOH_FAST_LANE) == 1

    def test_model_pedigree_recorded(self, gemini_client):
        payload = json.dumps(
            {"reasoning": "x", "missing_information": [], "safety_flags": [], "protocol_references": []}
        )
        gemini_client.client = FakeClient([payload])
        rule_result = rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True))
        enriched = gemini_client.explain_result(
            _patient(flood_exposure=True, fever=True, myalgia=True), rule_result
        )
        assert enriched.is_ai_generated is True
        assert RULESET_VERSION in enriched.model_used
        assert "gemini" in enriched.model_used.lower()