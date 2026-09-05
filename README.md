# 🏥 LeptoWatch - Leptospirosis AI Triage Co-Pilot

> **Google Cloud "Meet the Builders" Campaign Submission**  
> *Builder Story: "Enterprise decision systems → rural nurse triage"*  
> Designed for Philippine Rural Health Unit (RHU) nurses facing leptospirosis cases and deaths in flood-prone communities.

---

## ⚠️ Clinical Safety Notice

**LeptoWatch is a referral and risk-stratification decision support tool. It does NOT prescribe medication or dosing.** The deterministic rule engine issues referral guidance only; all treatment decisions are made by the attending physician. Every citation traces to a verified source in [`protocols/leptospirosis_sources.json`](protocols/leptospirosis_sources.json).

---

## 📌 Problem & Context
In Philippine rural municipalities, a single RHU nurse often serves a population of **5,000 to 10,000 residents**. During monsoon and typhoon seasons, floods expose thousands of agricultural and urban-poor families to *Leptospira*-contaminated floodwaters.

Early symptoms are notoriously deceptive and easily mistaken for common viral flu or dengue (fever, body aches, headache). Missing the early window risks rapid progression to **Weil's disease** (acute renal failure, hepatic jaundice, pulmonary hemorrhage) with fatal outcomes.

**LeptoWatch** provides rural nurses with an AI-assisted decision support co-pilot that:
1. Instantly stratifies risk (**CRITICAL**, **HIGH**, **MODERATE**, **LOW**, **INSUFFICIENT_INFORMATION**) using a deterministic rule engine derived from verified Philippine DOH and WHO leptospirosis guidance.
2. Employs **Gemini** as an *explanation layer only* — it explains the deterministic result, flags missing information, and surfaces safety concerns. It can never change the risk level.
3. Enforces strict deterministic **clinical guardrails** so safety-critical cases (e.g. jaundice or oliguria) are never downgraded.
4. Records a traceable audit trail in **Google Cloud Firestore** for epidemiological monitoring and quality assurance without storing sensitive patient PII — including ruleset version and model pedigree.
5. Supports **degraded operation** using locally cached deterministic rules when Gemini or Firestore is unavailable.

---

## 🏗️ Architecture & Google Cloud Tech Stack

```
                 RHU NURSE
                     │
                     ▼
              Clinical Inputs
                     │
                     ▼
        ┌─────────────────────────┐
        │ Deterministic Rule      │
        │ Engine                  │
        │                         │
        │ AUTHORITATIVE           │
        │ risk classification     │
        └────────────┬────────────┘
                     │
              risk + context
                     │
                     ▼
        ┌─────────────────────────┐
        │ Gemini                  │
        │                         │
        │ Explanation             │
        │ Context                 │
        │ Missing information     │
        │ Protocol interpretation │
        └────────────┬────────────┘
                     │
                     ▼
              Nurse Decision
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
      Firestore             Local Queue
      Audit Trail           if offline
```

- **Frontend**: Streamlit (Python) or the bundled React PWA — single-screen, high-contrast, responsive for low-end Android smartphones.
- **AI Explanation Layer**: Google Gemini (`@google/genai`) for low-latency, non-authoritative explanation and clinical context. Gemini is given ONLY the verified source registry and is instructed never to invent guidelines, citations, diagnoses, or medication dosing.
- **Clinical Safety Rules**: Deterministic rule-based engine derived from verified Philippine DOH and WHO leptospirosis guidance. Risk level is always authoritative.
- **Audit & Persistence**: Google Cloud Firestore (`triage_logs` collection) with local JSON buffer fallback during connectivity blackouts. A **sync queue** (`flush_pending_logs`) pushes buffered records to Firestore the moment connectivity returns — idempotent by design, since every record's `log_id` doubles as its Firestore document id, so retries can never duplicate.
- **Container Hosting**: Google Cloud Run (containerized, auto-scaling to zero, deployed in `asia-southeast1`).

---

## 📋 Triage Risk Matrix (referral guidance only)

| Risk Level | Clinical Criteria | Referral Guidance | Verified Sources |
| :--- | :--- | :--- | :--- |
| 🔴 **CRITICAL** | Flood exposure + fever + (**jaundice** OR **oliguria**) | **URGENT**: Suspected severe leptospirosis (Weil's disease). Refer immediately for physician / DOH hospital clinical management via the leptospirosis fast lane. | DOH-LEPTO-001, WHO-LEPTO-001 |
| 🟠 **HIGH** | Flood exposure + fever + **severe myalgia** (calves/lower back) | Suspected leptospirosis. Refer for physician evaluation and laboratory testing (CBC, creatinine, liver function). Monitor for jaundice, oliguria, bleeding. | DOH-LEPTO-001, WHO-LEPTO-001 |
| 🟡 **MODERATE** | Flood exposure + fever only (no myalgia/jaundice/oliguria) | Monitor closely for 48 hours; return if symptoms worsen for physician evaluation, including prophylaxis considerations per DOH guidance. | DOH-LEPTO-001, WHO-LEPTO-001 |
| 🟢 **LOW** | No flood exposure in last 2–4 weeks | Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2–30 days. | WHO-LEPTO-001, CDC-LEPTO-001 |
| ⚪ **INSUFFICIENT_INFORMATION** | Flood exposure or fever status not recorded | Cannot safely classify. Confirm flood exposure history and fever status; consult with the physician on duty. | WHO-LEPTO-001 |

**Verified source IDs** resolve through `protocols/leptospirosis_sources.json` (mirrored in `src/sources.ts`).

---

## 🚀 Local Development Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/leptowatch.git
cd leptowatch

python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file or export variables:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export FIREBASE_CREDENTIALS="" # Optional: path to serviceAccountKey.json
```

### 3. Run Locally with Streamlit
```bash
streamlit run app.py
```
Open `http://localhost:8501` on your desktop or mobile browser.

### React PWA (alternative frontend)
```bash
npm install
npm run dev   # serves React UI + Node API on http://localhost:3000
```

---

## ☁️ Google Cloud Run Deployment Guide

### Prerequisites
- [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and configured.
- A Google Cloud Project with billing enabled.

### 1. Enable Required Cloud APIs
```bash
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    firestore.googleapis.com \
    cloudbuild.googleapis.com \
    --project YOUR_PROJECT_ID
```

### 2. Build & Deploy to Cloud Run (asia-southeast1)
```bash
# Set default project and region
gcloud config set project YOUR_PROJECT_ID
gcloud config set run/region asia-southeast1

# Deploy directly from source via Cloud Build
gcloud run deploy leptowatch \
    --source . \
    --region asia-southeast1 \
    --platform managed \
    --memory 512Mi \
    --cpu 1 \
    --port 8080 \
    --allow-unauthenticated \
    --set-env-vars GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### 3. Verify Deployment
Cloud Run will output the live Service URL:
```text
Service [leptowatch] revision [leptowatch-00001-abc] has been deployed and is serving 100 percent of traffic.
Service URL: https://leptowatch-xyz-as.a.run.app
```
Test the healthcheck endpoint:
```bash
curl -I https://leptowatch-xyz-as.a.run.app/_stcore/health
```

---

## 🔒 Firestore Security & Compliance
- **Zero Patient PII**: No patient names, telephone numbers, or home addresses are ever collected or stored.
- **Audit Collection**: Stored under `/triage_logs` with timestamps, nurse badge IDs, clinical criteria, `ruleset_version`, and model pedigree.
- **Immutable Audit Trail**: Documents are create-only. Explicit `update` and `delete` are denied for everyone.
- **Firestore Security Rules**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /triage_logs/{logId} {
      allow create: if request.resource.data.keys().hasAll(['timestamp', 'patient_data', 'result', 'nurse_id', 'ruleset_version']);
      allow read: if request.auth != null;
      allow update: if false;
      allow delete: if false;
    }
    match /doh_protocol_cache/{version} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
  }
}
```

---

## ✅ Testing

**Automated suite (132 tests):**
```bash
python -m pytest tests/ -v
```
Covers risk stratification, the tri-state (Yes/No/Unknown) input model, Gemini fallback/contradiction handling, offline + sync-queue behaviour, invalid input safety, audit integrity (no PII, versioned, capped), and the no-medication-dosing guarantee.

**Manual QA checklist:** see [`TESTING.md`](TESTING.md) — safety-first scenarios with expected results for the live Streamlit/React app.

---

## 🌟 Meet the Builders Story
*"Enterprise decision systems → rural nurse triage"*

In the Philippines, extreme weather and typhoons routinely submerge communities. When waters recede, rural nurses face dozens of patients presenting with non-specific fevers. Missing leptospirosis causes Weil's disease; unclear referral criteria strain limited rural health resources.

By pairing Google Cloud Run's cost-effective serverless scale with a deterministic safety-first rule engine, Gemini's explanatory reasoning, and Firestore's zero-friction audit logging, **LeptoWatch** brings enterprise-grade decision support directly to the frontline nurse's pocket phone. Even when connectivity drops out, the locally cached rule engine continues providing authoritative risk stratification — Gemini adds context when available, never overriding the safety layer.