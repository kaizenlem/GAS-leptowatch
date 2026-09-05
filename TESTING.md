# LeptoWatch Testing Guide

Two layers of verification:

1. **Automated suite** — `tests/` (124 tests). Run with:
   ```bash
   ./venv/bin/python -m pytest tests/ -v
   # or, from a fresh setup:
   pip install -r requirements-dev.txt
   python -m pytest tests/ -v
   ```
2. **Manual QA checklist** below — verify the live app (Streamlit Cloud or `streamlit run app.py`; React via `npm run dev`).

---

## Automated suite → what it covers

| File | Covers |
| --- | --- |
| `test_triage_rules.py` | Risk stratification (CRITICAL/HIGH/MODERATE/LOW/INSUFFICIENT_INFORMATION), no-medication-dosing guarantee, verified citations, determinism |
| `test_gemini_fallback.py` | Gemini unavailable / malformed JSON / contradiction → rule engine wins; invented citations rejected |
| `test_invalid_inputs.py` | Missing / None / falsey / truthy edge inputs (safe-fail behaviour) |
| `test_offline_mode.py` | Degraded Gemini + Firestore: identical classification, local buffer persistence, no dosing in cached protocols |
| `test_audit_logging.py` | Audit entry structure, no PII, latest-first ordering, 500 cap, verified citations, ruleset version |
| `test_tri_state_inputs.py` | Yes/No/Unknown normalizer, decisive unknowns → INSUFFICIENT_INFORMATION, non-decisive unknowns don't escalate |

---

## Manual QA checklist (most important first)

### 1. Critical escalation must never downgrade
| Input | Expected |
| --- | --- |
| Flood=Yes, Fever=Yes, Jaundice=Yes (or Oliguria=Yes) | **CRITICAL** red badge; action = "URGENT… refer immediately…"; no medication/dosing text; citations = DOH-LEPTO-001, WHO-LEPTO-001 |

### 2. Gemini cannot override the rules
| Input | Expected |
| --- | --- |
| Flood=Yes, Fever=Yes, Myalgia=Yes (Gemini explanation enabled) | Risk stays **HIGH**; recommendation identical; Gemini output limited to reasoning / missing information / safety flags |
| Flood=No, Fever=Yes (Gemini tries to "escalate") | Stays **LOW** — no upgrade |

### 3. Unknown = not "absent" (tri-state behaviour)
| Input | Expected |
| --- | --- |
| Flood=Unknown or Fever=Unknown (anything else) | **INSUFFICIENT INFORMATION** — prompt to confirm exposure/fever; consult guidance shown |
| Flood=Yes, Fever=Yes, Myalgia=Unknown, Jaundice=Unknown | **MODERATE** (48h watch); NOT HIGH/CRITICAL |
| Open fresh form, hit Assess Risk with all defaults (Unknown) | **INSUFFICIENT INFORMATION** |

### 4. No medication / dosing anywhere
| Where | Expected |
| --- | --- |
| Page, README, audit trail, cached protocols: search "doxycycline", "100mg", "200mg", "administer" | **Zero results**; referral-only language |

### 5. Offline / degraded mode
| Input | Expected |
| --- | --- |
| `GEMINI_API_KEY` unset → triage | Warning "Gemini unavailable – deterministic rule engine only"; same classification as online for same inputs |
| Simulated offline (React client) | "Degraded mode" banner; decision computed locally; note "Saved to local offline buffer" |

### 6. Verified citations only
| Input | Expected |
| --- | --- |
| Any result's citation block | Only `DOH-LEPTO-001`, `WHO-LEPTO-001`, `CDC-LEPTO-001`; never a made-up string |

### 7. Audit trail integrity
| Input | Expected |
| --- | --- |
| Run a CRITICAL case → open Audit Trail | Entry with nurse ID, timestamp, `ruleset_version 1.0.0`, "Deterministic Rule Engine" pedigree; risk=CRITICAL; unknown symptoms shown as "Unknown" |
| CSV export | Matching values; no PII keys |

### 8. Streamlit smoke path (submission demo)
| Input | Expected |
| --- | --- |
| Deploy on Streamlit Cloud with `GEMINI_API_KEY` secret | App loads; every scenario above renders correctly; "Decision logged to audit trail" shown; badge colors correct |
| Set `FIREBASE_CREDENTIALS` (optional) | Audit entries report "Synced to Cloud Firestore" |

---

## Test data quick-reference

| Preset | Values | Expected risk |
| --- | --- | --- |
| Critical (Weil's) | Flood=yes, Fever=yes, Jaundice=yes, Oliguria=yes | CRITICAL |
| High (Calf Myalgia) | Flood=yes, Fever=yes, Myalgia=yes | HIGH |
| Moderate (Fever Only) | Flood=yes, Fever=yes, everything else=no | MODERATE |
| Low (No Flood) | Flood=no, Fever=yes | LOW |
| Unsure nurse | all/any = Unknown | INSUFFICIENT_INFORMATION |