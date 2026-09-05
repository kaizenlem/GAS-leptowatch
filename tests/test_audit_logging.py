"""
Audit logging (Firestore-backed, local-buffered) tests.

Audit entries must record who, when, version, and the deterministic result;
never medication orders. Immutability intent is enforced at the Firestore
rules layer (see README) and mirrored in the entry structure here.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sources import RULESET_VERSION
from triage import rule_based_triage
from firestore_client import log_triage_decision, get_recent_audit_logs, DEFAULT_DOH_PROTOCOLS
import firestore_client


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


class TestAuditEntryStructure:
    def test_entry_has_required_immutable_fields(self, firestore_offline):
        patient = _patient(flood_exposure=True, fever=True, jaundice=True)
        resp = log_triage_decision(patient, rule_based_triage(patient).to_dict(), nurse_id="nurse-a1")
        entry = resp["log"]
        assert entry["timestamp"]
        assert entry["nurse_id"] == "nurse-a1"
        assert entry["ruleset_version"] == RULESET_VERSION
        assert entry["synced_to_cloud"] is False
        assert entry["result"]["risk_level"] == "CRITICAL"

    def test_entry_never_contains_pii_keys(self, firestore_offline):
        patient = _patient(flood_exposure=True, fever=True, myalgia=True)
        resp = log_triage_decision(patient, rule_based_triage(patient).to_dict(), nurse_id="nurse-b2")
        entry = resp["log"]
        lowered = json.dumps(entry).lower()
        for forbidden in ("name", "address", "telephone", "phone", "email", "password"):
            assert forbidden not in lowered

    def test_result_carries_model_pedigree(self, firestore_offline):
        patient = _patient(flood_exposure=True, fever=True, myalgia=True)
        resp = log_triage_decision(patient, rule_based_triage(patient).to_dict(), nurse_id="nurse-c3")
        assert RULESET_VERSION in resp["log"]["result"]["model_used"]


class TestLocalBufferBehaviour:
    def test_recent_logs_read_latest_first(self, firestore_offline):
        for nurse in ("first", "second", "third"):
            patient = _patient(flood_exposure=True, fever=True)
            log_triage_decision(
                patient, rule_based_triage(patient).to_dict(), nurse_id=nurse
            )
        logs = get_recent_audit_logs(limit=2)
        assert len(logs) == 2
        assert logs[0]["nurse_id"] == "third"
        assert logs[1]["nurse_id"] == "second"

    def test_logs_are_capped(self, firestore_offline):
        for i in range(510):
            log_triage_decision(
                _patient(flood_exposure=True, fever=True, myalgia=True),
                rule_based_triage(_patient(flood_exposure=True, fever=True, myalgia=True)).to_dict(),
                nurse_id=f"bulk-{i}",
            )
        with open(firestore_client.LOCAL_AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
            stored = json.load(f)
        assert len(stored) <= 500


class TestProtocolCacheIntegrity:
    def test_default_protocols_have_no_dosing(self):
        serialized = str(DEFAULT_DOH_PROTOCOLS).lower()
        assert "doxycycline" not in serialized
        assert "100mg" not in serialized
        assert "200mg" not in serialized

    def test_all_citations_are_verified_source_ids(self):
        from sources import SOURCE_REGISTRY

        for level, protocol in DEFAULT_DOH_PROTOCOLS["protocols"].items():
            for citation in protocol["citations"]:
                assert citation in SOURCE_REGISTRY, f"{level} cites unknown {citation}"

    def test_insufficient_information_protocol_exists(self):
        assert "INSUFFICIENT_INFORMATION" in DEFAULT_DOH_PROTOCOLS["protocols"]

    def test_version_pinned_to_ruleset(self):
        assert DEFAULT_DOH_PROTOCOLS["version"] == RULESET_VERSION