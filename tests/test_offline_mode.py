"""
Offline / degraded operation tests.

When Gemini or Firestore is unreachable the system must keep functioning on
the locally cached deterministic rules. These tests verify the degraded path
produces the SAME classification and only persists locally.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from triage import assess_patient, rule_based_triage
from firestore_client import (
    log_triage_decision,
    get_cached_doh_protocols,
    get_recent_audit_logs,
    DEFAULT_DOH_PROTOCOLS,
)
from sources import RULESET_VERSION


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


@pytest.fixture(autouse=True)
def _isolate_local_files(tmp_path, monkeypatch):
    """Redirect the local audit/protocol files to a temp dir so the repo stays clean."""
    monkeypatch.setattr(
        "firestore_client.LOCAL_AUDIT_LOG_FILE",
        str(tmp_path / "local_triage_audit.json"),
    )
    monkeypatch.setattr(
        "firestore_client.DOH_PROTOCOLS_CACHE_FILE",
        str(tmp_path / "doh_protocols_cache.json"),
    )


@pytest.fixture
def firestore_offline(monkeypatch):
    monkeypatch.setattr("firestore_client.get_firestore_db", lambda: None)
    return None


class TestGeminiOffline:
    def test_offline_gemini_produces_same_classification(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        online = rule_based_triage(_patient(flood_exposure=True, fever=True, jaundice=True))
        result, fallback = assess_patient(
            _patient(flood_exposure=True, fever=True, jaundice=True), use_ai=True
        )
        assert fallback is True
        assert result.risk_level == online.risk_level
        assert result.recommendation == online.recommendation

    def test_offline_still_escalates_critical(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        result, _ = assess_patient(_patient(flood_exposure=True, fever=True, oliguria=True), use_ai=True)
        assert result.risk_level == "CRITICAL"

    def test_offline_flag(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        _, fallback = assess_patient(_patient(flood_exposure=True, fever=True, myalgia=True), use_ai=True)
        assert fallback is True


class TestFirestoreOffline:
    def test_decision_logs_locally_when_offline(self, firestore_offline):
        patient = _patient(flood_exposure=True, fever=True, myalgia=True)
        result = rule_based_triage(patient).to_dict()
        resp = log_triage_decision(patient, result, nurse_id="nurse-007")
        assert resp["status"] == "success"
        assert resp["synced"] is False
        assert "doc_id" not in resp["log"]
        assert resp["log"]["ruleset_version"] == RULESET_VERSION

    def test_local_buffer_holds_decision(self, firestore_offline):
        patient = _patient(flood_exposure=True, fever=True, jaundice=True)
        rule_result = rule_based_triage(patient).to_dict()
        log_triage_decision(patient, rule_result, nurse_id="nurse-999")

        logs = get_recent_audit_logs(limit=5)
        assert len(logs) >= 1
        found = logs[0]
        assert found["nurse_id"] == "nurse-999"
        assert found["ruleset_version"] == RULESET_VERSION
        assert found["synced_to_cloud"] is False

    def test_protocol_cache_served_when_offline(self, firestore_offline):
        protocols = get_cached_doh_protocols()
        assert protocols is DEFAULT_DOH_PROTOCOLS or protocols["version"] == RULESET_VERSION
        assert "CRITICAL" in protocols["protocols"]

    def test_protocol_cache_has_no_medication_dosing(self, firestore_offline):
        protocols = get_cached_doh_protocols()
        serialized = str(protocols).lower()
        assert "doxycycline" not in serialized
        assert "mg" not in serialized
        assert "administer" not in serialized

    def test_offline_audit_entry_has_no_treatment_orders(self, firestore_offline):
        patient = _patient(flood_exposure=True, fever=True, myalgia=True)
        rule_result = rule_based_triage(patient).to_dict()
        resp = log_triage_decision(patient, rule_result, nurse_id="nurse-123")
        lowered = str(resp["log"]["result"]).lower()
        assert "doxycycline" not in lowered
        assert "mg" not in lowered


class TestDegradedModeGuarantees:
    def test_classification_identical_with_and_without_gemini(self, monkeypatch):
        monkeypatch.delenv("GEMINI_API_KEY", raising=False)
        with_ai, _ = assess_patient(_patient(flood_exposure=True, fever=True, jaundice=True), use_ai=True)
        rules_only, _ = assess_patient(_patient(flood_exposure=True, fever=True, jaundice=True), use_ai=False)
        assert with_ai.risk_level == rules_only.risk_level
        assert with_ai.recommendation == rules_only.recommendation