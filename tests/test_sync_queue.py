"""
Offline-buffer sync queue tests (P1-1).

Records buffered while Firestore is unreachable must be pushed to Firestore once
connectivity returns, idempotently (log_id == Firestore document id), without
losing anything on partial failure, and only after a real network transition.
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import firestore_client
from firestore_client import log_triage_decision, flush_pending_logs
from triage import rule_based_triage


class _FakeDoc:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def set(self, data):
        if self.id in self._store.fail_ids:
            raise ConnectionRefusedError(f"simulated failure for {self.id}")
        self._store.docs[self.id] = data


class _FakeCollection:
    def __init__(self, store, name):
        self._name = name
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            doc_id = f"auto-{len(self._store.docs)}"
            self._store.fail_ids.discard(doc_id)  # auto ids never fail
        return _FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, fail_ids=None):
        self.docs = {}
        self.fail_ids = set(fail_ids or ())

    def collection(self, name):
        return _FakeCollection(self, name)


def _patient(**overrides):
    base = {
        "flood_exposure": "yes",
        "fever": "yes",
        "myalgia": "no",
        "jaundice": "no",
        "oliguria": "no",
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _isolate_local_file(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "firestore_client.LOCAL_AUDIT_LOG_FILE",
        str(tmp_path / "local_triage_audit.json"),
    )


@pytest.fixture
def firestore_offline(monkeypatch):
    monkeypatch.setattr("firestore_client.get_firestore_db", lambda: None)


@pytest.fixture
def firestore_online(monkeypatch):
    store = FakeFirestore()
    monkeypatch.setattr("firestore_client.get_firestore_db", lambda: store)
    return store


@pytest.fixture
def connectivity(monkeypatch):
    """Controllable offline/online toggle so a test can simulate losing and
    regaining network without touching the patched attribute twice."""
    state = {"online": False}
    store = FakeFirestore()

    def get_db():
        return store if state["online"] else None

    monkeypatch.setattr("firestore_client.get_firestore_db", get_db)
    return state, store


def _write_buffer(entries):
    with open(firestore_client.LOCAL_AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f)


def _read_buffer():
    if not Path(firestore_client.LOCAL_AUDIT_LOG_FILE).exists():
        return []
    with open(firestore_client.LOCAL_AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


class TestDirectSync:
    def test_online_log_uses_log_id_as_doc_id(self, firestore_online):
        resp = log_triage_decision(_patient(), rule_based_triage(_patient()).to_dict())
        entry = resp["log"]
        assert resp["synced"] is True
        assert entry["doc_id"] == entry["log_id"]
        assert len(entry["log_id"]) == 32
        assert entry["log_id"] in firestore_online.docs
        assert firestore_online.docs[entry["log_id"]]["synced_to_cloud"] is True
        assert _read_buffer() == []  # never buffered locally


class TestOfflineToOnlineFlush:
    def test_buffer_flushes_when_connectivity_returns(self, connectivity):
        state, store = connectivity
        for nurse in ("n1", "n2", "n3"):
            log_triage_decision(_patient(), rule_based_triage(_patient()).to_dict(), nurse_id=nurse)

        buffered = _read_buffer()
        assert len(buffered) == 3
        assert all(e["synced_to_cloud"] is False for e in buffered)
        log_ids = {e["log_id"] for e in buffered}
        assert len(log_ids) == 3

        state["online"] = True
        flushed = flush_pending_logs()

        assert flushed == 3
        assert _read_buffer() == []
        assert set(store.docs.keys()) == log_ids
        for doc_id, doc in store.docs.items():
            assert doc["synced_to_cloud"] is True
            assert doc["doc_id"] == doc_id == doc["log_id"]

    def test_flush_is_idempotent(self, connectivity):
        state, store = connectivity
        log_triage_decision(_patient(), rule_based_triage(_patient()).to_dict())
        assert _read_buffer()  # buffered while offline

        state["online"] = True
        assert flush_pending_logs() == 1
        assert flush_pending_logs() == 0  # nothing pending left
        assert len(store.docs) == 1  # no duplicate documents

    def test_flush_while_still_offline_does_nothing(self, firestore_offline):
        log_triage_decision(_patient(), rule_based_triage(_patient()).to_dict())
        before = _read_buffer()
        assert flush_pending_logs() == 0
        assert _read_buffer() == before

    def test_no_buffer_means_no_work(self, firestore_online):
        assert flush_pending_logs() == 0
        assert firestore_online.docs == {}

    def test_partial_failure_keeps_failed_entries_local(self, firestore_offline):
        # Simulate two buffered records; only the 'bad' one fails on the retry.
        _write_buffer(
            [
                {"log_id": "0000000000000000000000000000000a", "synced_to_cloud": False, "timestamp": "t1", "patient_data": {}, "result": {}},
                {"log_id": "0000000000000000000000000000000b", "synced_to_cloud": False, "timestamp": "t2", "patient_data": {}, "result": {}},
            ]
        )
        store = FakeFirestore(fail_ids=["0000000000000000000000000000000a"])
        firestore_client.get_firestore_db = lambda: store

        flushed = flush_pending_logs()

        assert flushed == 1
        remaining = _read_buffer()
        assert len(remaining) == 1
        assert remaining[0]["log_id"] == "0000000000000000000000000000000a"
        assert set(store.docs.keys()) == {"0000000000000000000000000000000b"}

    def test_already_synced_records_are_dropped_from_buffer(self, firestore_online):
        _write_buffer(
            [
                {"log_id": "already", "synced_to_cloud": True, "timestamp": "t1"},
                {"log_id": "pending-too", "synced_to_cloud": False, "timestamp": "t2"},
            ]
        )
        assert flush_pending_logs() == 1
        assert set(firestore_online.docs.keys()) == {"pending-too"}


class TestBackCompatWithLegacyDocuments:
    def test_legacy_entry_without_log_id_gets_one(self, firestore_offline, firestore_online):
        _write_buffer(
            [{"timestamp": "legacy", "synced_to_cloud": False, "patient_data": {}, "result": {}}]
        )
        assert flush_pending_logs() == 1
        remaining = _read_buffer()
        assert remaining == []
        doc = next(iter(firestore_online.docs.values()))
        assert doc["log_id"]
        assert doc["doc_id"] == doc["log_id"]