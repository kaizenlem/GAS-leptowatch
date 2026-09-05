"""
Firestore audit logging and protocol caching client for LeptoWatch.
Provides seamless logging to Google Cloud Firestore with local JSON buffer fallback
to ensure reliable audit capture for rural nurses under intermittent network connectivity.
This client does NOT store clinical treatment orders or medication dosing - only
risk-stratified referral guidance derived from verified DOH/WHO sources.
"""

import os
import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from firebase_config import get_firestore_db
from sources import RULESET_VERSION, DOH_FAST_LANE, WHO_GUIDANCE, CDC_OVERVIEW

logger = logging.getLogger("leptowatch.firestore")

LOCAL_AUDIT_LOG_FILE = "local_triage_audit.json"
DOH_PROTOCOLS_CACHE_FILE = "doh_protocols_cache.json"

DEFAULT_DOH_PROTOCOLS = {
    "version": RULESET_VERSION,
    "updated_at": "2026-09-06T00:00:00Z",
    "description": "Risk stratification reference derived from verified Philippine DOH and WHO leptospirosis guidance. Referral guidance only - no medication dosing is prescribed.",
    "protocols": {
        "CRITICAL": {
            "title": "Suspected Severe Leptospirosis / Weil's Disease",
            "criteria": "Floodwater exposure + fever + (jaundice OR oliguria)",
            "action": "URGENT: Suspected severe leptospirosis (Weil's disease). Refer immediately for physician / DOH hospital clinical management via the leptospirosis fast lane. Do not delay transfer.",
            "citations": [
                DOH_FAST_LANE,
                WHO_GUIDANCE
            ]
        },
        "HIGH": {
            "title": "Suspected Moderate/High-Risk Leptospirosis",
            "criteria": "Floodwater exposure + fever + myalgia",
            "action": "Suspected leptospirosis. Refer for physician evaluation and laboratory testing (CBC, creatinine, liver function). Monitor for jaundice, oliguria, and bleeding; follow DOH fast lane referral process.",
            "citations": [
                DOH_FAST_LANE,
                WHO_GUIDANCE
            ]
        },
        "MODERATE": {
            "title": "Moderate Risk / Flood Exposure with Fever Only",
            "criteria": "Floodwater exposure + fever only (no myalgia, jaundice, or oliguria)",
            "action": "Flood exposure with fever. Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately for physician evaluation, including prophylaxis considerations per DOH guidance.",
            "citations": [
                DOH_FAST_LANE,
                WHO_GUIDANCE
            ]
        },
        "LOW": {
            "title": "Low Risk / Unlikely Leptospirosis",
            "criteria": "No flood exposure in last 2-4 weeks",
            "action": "Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2-30 days.",
            "citations": [
                WHO_GUIDANCE,
                CDC_OVERVIEW
            ]
        },
        "INSUFFICIENT_INFORMATION": {
            "title": "Cannot Safely Classify",
            "criteria": "Flood exposure or fever status not recorded",
            "action": "Insufficient information to safely classify this patient. Confirm flood exposure history and fever status before triage; consult with the physician on duty.",
            "citations": [
                WHO_GUIDANCE
            ]
        }
    }
}


def log_triage_decision(
    patient_data: Dict[str, Any],
    result_data: Dict[str, Any],
    nurse_id: str = "anonymous"
) -> Dict[str, Any]:
    """
    Logs every triage decision to Firestore collection 'triage_logs'
    Falls back gracefully to local file logging if Firestore is unreachable or offline.

    Every entry carries a stable client-generated ``log_id`` (uuid4 hex) used both to
    fingerprint the local record and as the Firestore document id, so a later
    ``flush_pending_logs`` cannot create duplicate documents.
    """
    timestamp_iso = datetime.now(timezone.utc).isoformat()
    log_entry = {
        "log_id": uuid.uuid4().hex,
        "timestamp": timestamp_iso,
        "patient_data": patient_data,
        "result": result_data,
        "nurse_id": nurse_id or "anonymous",
        "ruleset_version": RULESET_VERSION,
        "synced_to_cloud": False
    }

    db = get_firestore_db()
    if db is not None:
        try:
            doc_ref = db.collection("triage_logs").document(log_entry["log_id"])
            log_entry["doc_id"] = doc_ref.id
            log_entry["synced_to_cloud"] = True
            doc_ref.set(log_entry)
            logger.info("Decision successfully recorded in Firestore: %s", doc_ref.id)
            return {"status": "success", "synced": True, "log": log_entry}
        except Exception as e:
            logger.warning("Firestore write failed (%s). Saving to local audit buffer.", e)
            log_entry["synced_to_cloud"] = False

    # Fallback to local persistence
    _append_local_log(log_entry)
    return {"status": "success", "synced": False, "log": log_entry}


def flush_pending_logs() -> int:
    """
    Best-effort sync queue: pushes buffered local audit records to Firestore once
    connectivity returns, then drops them from the local file.

    Idempotent by design: each record's ``log_id`` is its Firestore document id, so
    retrying (or running multiple app instances) can never duplicate an entry. Records
    that still cannot be written (still offline, permissions issue) stay in the file.

    Returns the number of records successfully flushed.
    """
    if not os.path.exists(LOCAL_AUDIT_LOG_FILE):
        return 0

    try:
        with open(LOCAL_AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
            logs = json.load(f)
    except Exception as e:
        logger.error("Failed to read local audit buffer: %s", e)
        return 0

    if not logs:
        return 0

    try:
        db = get_firestore_db()
    except Exception as e:
        logger.warning("Firestore unavailable (%s); %d record(s) stay local.", e, len(logs))
        return 0
    if db is None:
        return 0

    pending = [e for e in logs if not e.get("synced_to_cloud", False)]
    if not pending:
        # Everything already synced: the buffer has served its purpose.
        _clear_local_log()
        return 0

    remaining = []
    flushed = 0
    for entry in pending:
        doc_id = entry.get("doc_id") or entry.get("log_id") or uuid.uuid4().hex
        if not entry.get("log_id"):
            entry["log_id"] = doc_id
        try:
            db.collection("triage_logs").document(doc_id).set(entry)
            entry["doc_id"] = doc_id
            entry["synced_to_cloud"] = True
            flushed += 1
            logger.info("Synced buffered decision %s to Firestore", doc_id)
        except Exception as e:
            logger.warning("Sync flush failed for %s (%s); keeping it local.", doc_id, e)
            remaining.append(entry)

    _rewrite_local_log(remaining)
    return flushed


def _clear_local_log():
    try:
        os.remove(LOCAL_AUDIT_LOG_FILE)
    except FileNotFoundError:
        pass
    except Exception as e:
        logger.error("Failed to clear local audit buffer: %s", e)


def _rewrite_local_log(logs: List[Dict[str, Any]]):
    try:
        if not logs:
            _clear_local_log()
            return
        with open(LOCAL_AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs[:500], f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error("Failed to rewrite local audit buffer: %s", e)


def _append_local_log(entry: Dict[str, Any]):
    """Appends audit log to local JSON storage."""
    logs = []
    if os.path.exists(LOCAL_AUDIT_LOG_FILE):
        try:
            with open(LOCAL_AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except Exception:
            logs = []
    logs.insert(0, entry)
    # Keep last 500 records
    logs = logs[:500]
    try:
        with open(LOCAL_AUDIT_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error("Failed to write local audit file: %s", e)


def get_recent_audit_logs(limit: int = 20) -> List[Dict[str, Any]]:
    """Fetches recent audit logs from Firestore or local storage."""
    db = get_firestore_db()
    if db is not None:
        try:
            docs = (
                db.collection("triage_logs")
                .order_by("timestamp", direction="DESCENDING")
                .limit(limit)
                .stream()
            )
            return [doc.to_dict() for doc in docs]
        except Exception as e:
            logger.warning("Failed to read from Firestore: %s. Reading from local cache.", e)

    # Fallback: Read local file
    if os.path.exists(LOCAL_AUDIT_LOG_FILE):
        try:
            with open(LOCAL_AUDIT_LOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data[:limit]
        except Exception:
            return []
    return []


def get_cached_doh_protocols() -> Dict[str, Any]:
    """
    Returns DOH Leptospirosis Protocols 2026.
    Checks Firestore first, then local cache file, then built-in default constants.
    """
    db = get_firestore_db()
    if db is not None:
        try:
            doc = db.collection("doh_protocol_cache").document("v2026").get()
            if doc.exists:
                return doc.to_dict()
            else:
                # Seed Firestore cache on first load
                db.collection("doh_protocol_cache").document("v2026").set(DEFAULT_DOH_PROTOCOLS)
                return DEFAULT_DOH_PROTOCOLS
        except Exception as e:
            logger.warning("Could not fetch remote protocol cache: %s. Using local cache.", e)

    # Check local cache file
    if os.path.exists(DOH_PROTOCOLS_CACHE_FILE):
        try:
            with open(DOH_PROTOCOLS_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Save default to local cache file for offline use
    try:
        with open(DOH_PROTOCOLS_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_DOH_PROTOCOLS, f, indent=2)
    except Exception:
        pass

    return DEFAULT_DOH_PROTOCOLS
