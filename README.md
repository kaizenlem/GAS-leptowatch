# 🏥 LeptoWatch - Leptospirosis AI Triage Co-Pilot

> **Google Cloud "Meet the Builders" Campaign Submission**  
> *Builder Story: "Enterprise decision systems → rural nurse triage"*  
> Designed for Philippine Rural Health Unit (RHU) nurses facing 6,253 leptospirosis cases and 378 deaths in flood-prone communities.

---

## 📌 Problem & Context
In Philippine rural municipalities, a single RHU nurse often serves a population of **5,000 to 10,000 residents**. During monsoon and typhoon seasons, floods expose thousands of agricultural and urban-poor families to *Leptospira*-contaminated floodwaters.

Early symptoms are notoriously deceptive and easily mistaken for common viral flu or dengue (fever, body aches, headache). Missing the early 48-hour window risks rapid progression to **Weil's disease** (acute renal failure, hepatic jaundice, pulmonary hemorrhage) with fatal outcomes.

**LeptoWatch** provides rural nurses with an AI-augmented decision support co-pilot that:
1. Instantly stratifies risk (**CRITICAL**, **HIGH**, **MODERATE**, **LOW**) using Department of Health (DOH) Philippines 2026 Clinical Protocols.
2. Employs **Gemini 2.0 Flash** for nuanced reasoning on symptom duration, comorbidities, and incubation timelines.
3. Automatically enforces strict deterministic **clinical guardrails** so safety-critical cases (e.g. jaundice or oliguria) can never be downgraded.
4. Maintains an immutable audit trail in **Google Cloud Firestore** for epidemiological monitoring and quality assurance without storing sensitive patient PII.
5. Works seamlessly on low-end Android mobile phones over intermittent 3G or offline conditions using cached DOH protocols.

---

## 🏗️ Architecture & Google Cloud Tech Stack

```
   [ Low-End Android Phone / 3G Browser ]
                      │
                      ▼
     ┌──────────────────────────────────┐
     │   Google Cloud Run (asia-se1)    │
     │      (Streamlit Python 3.11)     │
     └─────────────────┬────────────────┘
                       │
       ┌───────────────┴────────────────┐
       ▼                                ▼
┌───────────────┐              ┌─────────────────┐
│ Gemini 2.0    │              │ Cloud Firestore │
│ Flash API     │              │ Audit Logs &    │
│ (AI Studio)   │              │ Protocol Cache  │
└───────────────┘              └─────────────────┘
```

- **Frontend & App Engine**: Streamlit (Python) - Single-screen, high-contrast, responsive for low-end Android smartphones.
- **AI Co-Pilot**: Google Gemini 2.0 Flash (`@google/genai`) for fast, low-latency reasoning and clinical explanations.
- **Clinical Safety Rules**: Deterministic rule-based engine strictly implementing Philippine DOH 2026 Guidelines.
- **Audit & Persistence**: Google Cloud Firestore (`triage_logs` collection) with local JSON buffer fallback during connectivity blackouts.
- **Container Hosting**: Google Cloud Run (containerized, auto-scaling to zero, deployed in `asia-southeast1`).

---

## 📋 Triage Risk Matrix (DOH Philippines 2026 Guidelines)

| Risk Level | Clinical Criteria | Mandatory Action | Citations |
| :--- | :--- | :--- | :--- |
| 🔴 **CRITICAL** | Flood exposure + fever + (**jaundice** OR **oliguria**) | **URGENT**: Suspected Weil's disease. Administer doxycycline 100mg BID. Refer immediately to DOH hospital with leptospirosis fast lane. | DOH Leptospirosis Fast Lane Protocol 2026, WHO Severe Guidelines |
| 🟠 **HIGH** | Flood exposure + fever + **severe myalgia** (calves/lower back) | Suspected leptospirosis. Administer doxycycline 100mg BID. Refer for labs (CBC, creatinine, LFT). Monitor for jaundice, oliguria, bleeding. | DOH Leptospirosis Clinical Guidelines 2026, WHO Case Definition |
| 🟡 **MODERATE** | Flood exposure + fever only (no myalgia/jaundice/oliguria) | Monitor closely for 48 hours. If symptoms worsen (myalgia, red eyes, jaundice), return immediately. Consider doxycycline prophylaxis per DOH guidelines. | DOH Prophylaxis Guidelines 2026 |
| 🟢 **LOW** | No flood exposure in last 2–4 weeks | Likely viral illness. Home care: rest, fluids, paracetamol for fever. Return if fever persists >3 days OR if flood exposure occurred within 2–30 days. | DOH Primary Care Guidelines, CDC Epidemiology |

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
- **Audit Collection**: Stored under `/triage_logs` with timestamps, nurse badge IDs, and clinical criteria for DOH surveillance.
- **Firestore Security Rules**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /triage_logs/{logId} {
      allow create: if request.resource.data.keys().hasAll(['timestamp', 'patient_data', 'result']);
      allow read: if request.auth != null;
    }
    match /doh_protocol_cache/{version} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
  }
}
```

---

## 🌟 Meet the Builders Story
*"Enterprise decision systems → rural nurse triage"*

In the Philippines, extreme weather and typhoons routinely submerge communities. When waters recede, rural nurses face dozens of patients presenting with non-specific fevers. Missing leptospirosis causes Weil's disease; over-prescribing strains limited rural medicine supplies.

By pairing Google Cloud Run's cost-effective serverless scale with Gemini 2.0 Flash's clinical reasoning and Firestore's zero-friction document logging, **LeptoWatch** brings enterprise-grade decision support directly to the frontline nurse's pocket phone. Even when cellular towers drop out, the cached DOH 2026 rule engine continues saving lives.
