"""
🏥 LeptoWatch - Leptospirosis Triage
AI-powered clinical decision support co-pilot for Philippine rural health unit (RHU) nurses.
Adheres strictly to DOH Philippines 2026 Clinical & Fast Lane Protocols.
Runs on Google Cloud Run with Firestore audit logging and Gemini 2.0 Flash co-pilot.
"""

import os
import streamlit as st
from datetime import datetime

from triage import assess_patient, rule_based_triage
from firestore_client import log_triage_decision, get_recent_audit_logs, get_cached_doh_protocols

# Streamlit Page Configuration - optimized for mobile & Android RHU phones
st.set_page_config(
    page_title="LeptoWatch - Leptospirosis Triage",
    page_icon="🏥",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# Custom styling for mobile readability and DOH clinical color cues
st.markdown("""
<style>
    /* Responsive layout tweaks for low-end mobile screens */
    .stApp {
        max-width: 720px;
        margin: 0 auto;
    }
    .badge-critical {
        background-color: #fee2e2;
        color: #991b1b;
        border: 2px solid #ef4444;
        padding: 8px 16px;
        border-radius: 9999px;
        font-weight: 800;
        font-size: 1.25rem;
        display: inline-block;
        text-align: center;
    }
    .badge-high {
        background-color: #ffedd5;
        color: #9a3412;
        border: 2px solid #f97316;
        padding: 8px 16px;
        border-radius: 9999px;
        font-weight: 800;
        font-size: 1.25rem;
        display: inline-block;
        text-align: center;
    }
    .badge-moderate {
        background-color: #fef9c3;
        color: #854d0e;
        border: 2px solid #eab308;
        padding: 8px 16px;
        border-radius: 9999px;
        font-weight: 800;
        font-size: 1.25rem;
        display: inline-block;
        text-align: center;
    }
    .badge-low {
        background-color: #dcfce7;
        color: #166534;
        border: 2px solid #22c55e;
        padding: 8px 16px;
        border-radius: 9999px;
        font-weight: 800;
        font-size: 1.25rem;
        display: inline-block;
        text-align: center;
    }
    .disclaimer-box {
        font-size: 0.8rem;
        color: #64748b;
        border-top: 1px solid #e2e8f0;
        margin-top: 2rem;
        padding-top: 1rem;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)


def main():
    st.title("🏥 LeptoWatch - Leptospirosis Triage")
    st.markdown("**AI-powered decision support for rural PH nurses**")

    # Offline / Online indicator check
    gemini_key_set = bool(os.getenv("GEMINI_API_KEY"))
    if not gemini_key_set:
        st.warning("⚠️ Offline mode - using cached protocols (AI API key not detected, deterministic DOH 2026 rule engine active)")

    with st.expander("ℹ️ Quick Clinical Protocol & Tagalog Translation Guide", expanded=False):
        st.markdown("""
        **Tagalog Screening Guide for Nurse-Patient Interview:**
        - **Flood exposure:** *"Nalusong ka ba o nagbabad sa tubig-baha nitong nakaraang 2 hanggang 4 na linggo?"*
        - **Calf muscle pain:** *"Sumasakit ba ang iyong binti o kalamnan (lalo na sa alak-alakan o likod)?"*
        - **Jaundice / Oliguria:** *"Naninilaw ba ang iyong mga mata o balat? Nabawasan ba o kumonti ang iyong pag-ihi?"*
        - **Red eyes:** *"Namumula ba ang iyong mga mata kahit walang muta?"*
        
        **DOH 2026 Fast Lane Protocol:**
        Patients presenting with flood history + fever + jaundice or low urine output must be routed immediately to DOH designated hospital fast lanes with pre-transfer Doxycycline 100mg BID.
        """)

    # Nurse identifier (optional for RHU access control)
    nurse_col1, nurse_col2 = st.columns([2, 1])
    with nurse_col1:
        nurse_id = st.text_input("RHU Nurse ID / Station", value="RHU-Station-01", help="Identifiers are strictly logged for clinical audit without storing patient names.")
    with nurse_col2:
        use_ai_toggle = st.checkbox("Enable Gemini 2.0 Co-Pilot", value=gemini_key_set)

    st.markdown("---")
    st.subheader("Patient Clinical Assessment")

    with st.form(key="triage_form"):
        st.markdown("### 1. Exposure History")
        flood_exposure = st.checkbox("Has the patient waded through floodwater in the last 2–4 weeks?", value=True)
        flood_days_ago = st.number_input("Days since flood exposure", min_value=0, max_value=30, value=7, step=1)

        st.markdown("### 2. Clinical Symptoms")
        col_symp1, col_symp2 = st.columns(2)
        with col_symp1:
            fever = st.checkbox("Fever", value=True)
            myalgia = st.checkbox("Severe muscle pain (especially calves/lower back)", value=True)
            headache = st.checkbox("Headache", value=False)
        with col_symp2:
            red_eyes = st.checkbox("Red eyes", value=False)
            jaundice = st.checkbox("Yellowing of skin/eyes (jaundice)", value=False)
            oliguria = st.checkbox("Decreased urination (oliguria)", value=False)

        st.markdown("### 3. Patient Vitals & History")
        col_meta1, col_meta2 = st.columns(2)
        with col_meta1:
            symptom_days = st.number_input("Days since symptoms started", min_value=1, max_value=14, value=2, step=1)
        with col_meta2:
            age = st.number_input("Age", min_value=1, max_value=100, value=35, step=1)

        comorbidities = st.text_input("Comorbidities (comma-separated)", value="None", placeholder="e.g. Hypertension, Diabetes, Chronic Kidney Disease")

        submit_btn = st.form_submit_button("Assess Risk", use_container_width=True, type="primary")

    if submit_btn:
        patient_payload = {
            "flood_exposure": flood_exposure,
            "flood_days_ago": flood_days_ago,
            "fever": fever,
            "myalgia": myalgia,
            "headache": headache,
            "red_eyes": red_eyes,
            "jaundice": jaundice,
            "oliguria": oliguria,
            "symptom_days": symptom_days,
            "age": age,
            "comorbidities": comorbidities.strip()
        }

        with st.spinner("Analyzing clinical symptoms against DOH 2026 protocols..."):
            result, was_fallback = assess_patient(patient_payload, use_ai=use_ai_toggle)

        if was_fallback and use_ai_toggle:
            st.warning("⚠️ Offline mode - using cached protocols (AI service was unavailable or offline)")

        st.markdown("---")
        st.subheader("Triage Assessment Result")

        # Risk Level Badge
        risk = result.risk_level.upper()
        if risk == "CRITICAL":
            badge_html = f'<div class="badge-critical">CRITICAL RISK - WEIL\'S DISEASE SUSPECTED</div>'
        elif risk == "HIGH":
            badge_html = f'<div class="badge-high">HIGH RISK - SUSPECTED LEPTOSPIROSIS</div>'
        elif risk == "MODERATE":
            badge_html = f'<div class="badge-moderate">MODERATE RISK - MONITOR 48H</div>'
        else:
            badge_html = f'<div class="badge-low">LOW RISK - UNLIKELY LEPTOSPIROSIS</div>'

        st.markdown(badge_html, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

        # Recommendation Text
        if risk == "CRITICAL":
            st.error(f"**Action Required:**\n\n{result.recommendation}")
        elif risk == "HIGH":
            st.warning(f"**Action Required:**\n\n{result.recommendation}")
        elif risk == "MODERATE":
            st.info(f"**Action Required:**\n\n{result.recommendation}")
        else:
            st.success(f"**Action Required:**\n\n{result.recommendation}")

        # Reasoning
        st.markdown(f"**Reasoning:** {result.reasoning}")

        # Citations
        if result.citations:
            st.markdown("**Guidelines & Citations:**")
            for cit in result.citations:
                st.markdown(f"- 📖 *{cit}*")

        # Firestore Audit Logging
        log_res = log_triage_decision(
            patient_data=patient_payload,
            result_data=result.to_dict(),
            nurse_id=nurse_id
        )

        st.success("✅ Decision logged to audit trail")
        if log_res.get("synced"):
            st.caption(f"Synced to Cloud Firestore | Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        else:
            st.caption(f"Saved to local offline buffer | Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")

    # Audit Trail Viewer
    st.markdown("---")
    with st.expander("📋 View Recent RHU Audit Trail (Last 10 Cases)", expanded=False):
        recent_logs = get_recent_audit_logs(limit=10)
        if not recent_logs:
            st.info("No audit logs recorded yet in this session.")
        else:
            for idx, entry in enumerate(recent_logs):
                res = entry.get("result", {})
                pat = entry.get("patient_data", {})
                risk_lvl = res.get("risk_level", "UNKNOWN")
                ts = entry.get("timestamp", "N/A")[:19].replace("T", " ")
                st.markdown(f"**#{idx+1} [{risk_lvl}]** - Nurse `{entry.get('nurse_id', 'anonymous')}` at `{ts} UTC`")
                st.caption(f"Age: {pat.get('age')}, Flood Exposure: {'Yes' if pat.get('flood_exposure') else 'No'}, Days since flood: {pat.get('flood_days_ago')}d, Symptoms: Fever={pat.get('fever')}, Calves={pat.get('myalgia')}, Jaundice={pat.get('jaundice')}, Oliguria={pat.get('oliguria')}")
                st.markdown(f"> *{res.get('recommendation', '')}*")
                st.markdown("---")

    # Compliance & Legal Disclaimer
    st.markdown("""
    <div class="disclaimer-box">
        <strong>Medical & Compliance Disclaimer:</strong> For clinical decision support only. Not a substitute for professional medical judgment.
        Adheres to Philippine Department of Health (DOH) Administrative Orders and WHO Leptospirosis Management Guidelines.
        No personally identifiable patient information (PII) is stored or transmitted.
    </div>
    """, unsafe_allow_html=True)


if __name__ == "__main__":
    main()
