"""
Verified source registry for LeptoWatch.

Every citation produced by the system must reference a source_id present here.
Gemini is given ONLY these sources and must not invent others.
"""

import json
import os

DEFAULT_SOURCES = {
    "version": "1.0.0",
    "updated_at": "2026-09-06T00:00:00Z",
    "description": "Verified source registry for LeptoWatch.",
    "sources": [
        {
            "source_id": "DOH-LEPTO-001",
            "organization": "Philippine Department of Health (DOH)",
            "title": "Leptospirosis Fast Lanes - DOH public advisories",
            "reference": "DOH advisories / Philippine Information Agency coverage (2025-2026)",
            "url": "https://pia.gov.ph/news/doh-strengthens-hospital-referral-system-activates-leptospirosis-fast-lanes-in-33-facilities/",
            "verified": True,
        },
        {
            "source_id": "WHO-LEPTO-001",
            "organization": "World Health Organization (WHO)",
            "title": "Human leptospirosis: guidance for diagnosis, surveillance and control",
            "reference": "WHO/CDS/CSR/EPH 2002.23, WHO 2003",
            "url": "https://www.who.int/publications/i/item/human-leptospirosis-guidance-for-diagnosis-surveillance-and-control",
            "verified": True,
        },
        {
            "source_id": "CDC-LEPTO-001",
            "organization": "US Centers for Disease Control and Prevention (CDC)",
            "title": "Clinical Overview of Leptospirosis",
            "reference": "CDC Leptospirosis Healthcare Professionals, updated June 2026",
            "url": "https://www.cdc.gov/leptospirosis/hcp/clinical-overview/index.html",
            "verified": True,
        },
    ],
}

RULESET_VERSION = "1.0.0"

DOH_FAST_LANE = "DOH-LEPTO-001"
WHO_GUIDANCE = "WHO-LEPTO-001"
CDC_OVERVIEW = "CDC-LEPTO-001"

VERIFIED_SOURCES = DEFAULT_SOURCES
SOURCE_REGISTRY = {s["source_id"]: s for s in DEFAULT_SOURCES["sources"]}

# Clinical factors are collected as Yes / No / Unknown. A decisive unknown
# (flood exposure, fever) must NOT be silently treated as "absent".
UNKNOWN_DECLARATIONS = {"unknown", "unclear", "not sure", "na", "n/a", "n/k", "none recorded", "?"}


def tri_state(value):
    """Normalize a Yes/No/Unknown clinical factor.

    Accepts the string forms "yes"/"no"/"unknown" (and case variants) as well
    as booleans/numbers/legacy inputs for backwards compatibility.

    Returns:
        True  -> factor reported present
        False -> factor reported absent
        None  -> factor not recorded / unknown
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in UNKNOWN_DECLARATIONS:
            return None
        if v in ("yes", "true", "1", "y", "on"):
            return True
        if v in ("no", "false", "0", "n", "off"):
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return bool(value)


def tri_label(value) -> str:
    """Render a clinical factor as Yes / No / Unknown for prompts and audit display."""
    t = tri_state(value)
    if t is None:
        return "Unknown"
    return "Yes" if t else "No"


def _load_sources_file() -> None:
    """Overlay the JSON registry file if present (allows updating sources without code changes)."""
    global VERIFIED_SOURCES, SOURCE_REGISTRY
    path = os.path.join(os.path.dirname(__file__), "protocols", "leptospirosis_sources.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        sources = data.get("sources", [])
        if sources:
            VERIFIED_SOURCES = data
            SOURCE_REGISTRY = {s["source_id"]: s for s in sources}
    except Exception:
        pass


_load_sources_file()