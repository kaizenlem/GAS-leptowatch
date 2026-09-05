import React, { useState, useEffect } from "react";
import { PatientFormData, TriageFactor } from "../types";
import {
  AlertTriangle,
  Flame,
  Activity,
  HeartPulse,
  Sparkles,
  Zap,
  RotateCcw,
} from "lucide-react";

const DEFAULT_FORM_DATA: PatientFormData = {
  flood_exposure: "unknown",
  flood_days_ago: 0,
  fever: "unknown",
  myalgia: "unknown",
  headache: "unknown",
  red_eyes: "unknown",
  jaundice: "unknown",
  oliguria: "unknown",
  symptom_days: 1,
  age: 35,
  comorbidities: "",
};

const TRI_OPTIONS = ["yes", "no", "unknown"] as const;

function TriToggle({
  value,
  onChange,
  id,
}: {
  value: TriageFactor;
  onChange: (v: TriageFactor) => void;
  id: string;
}) {
  return (
    <div className="flex gap-1 shrink-0" role="radiogroup" aria-label={id}>
      {TRI_OPTIONS.map((opt) => {
        const active = value === opt;
        const base =
          "text-[11px] font-bold px-2.5 py-1 rounded-md border transition-colors cursor-pointer";
        let style: string;
        if (opt === "yes") {
          style = active
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-white text-emerald-700 border-slate-200 hover:bg-emerald-50";
        } else if (opt === "no") {
          style = active
            ? "bg-slate-600 text-white border-slate-600"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
        } else {
          style = active
            ? "bg-amber-500 text-white border-amber-500"
            : "bg-white text-amber-700 border-slate-200 hover:bg-amber-50";
        }
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`${base} ${style}`}
          >
            {opt === "yes" ? "Yes" : opt === "no" ? "No" : "Unknown"}
          </button>
        );
      })}
    </div>
  );
}

interface TriageFormProps {
  onSubmit: (data: PatientFormData) => void;
  isLoading: boolean;
  isOffline: boolean;
  onClear?: () => void;
  resetSignal?: number;
}

const SYMPTOM_ITEMS: {
  key: "fever" | "myalgia" | "headache" | "red_eyes" | "jaundice" | "oliguria";
  label: string;
  detail: string;
  redFlag?: boolean;
}[] = [
  {
    key: "fever",
    label: "Fever",
    detail: "Acute high fever (≥38°C)",
  },
  {
    key: "myalgia",
    label: "Severe muscle pain (calves/lower back)",
    detail: "High-specificity hallmark of Leptospira",
  },
  {
    key: "headache",
    label: "Headache",
    detail: "Frontal or retro-orbital aching",
  },
  {
    key: "red_eyes",
    label: "Red eyes",
    detail: "Conjunctival suffusion without purulent discharge",
  },
  {
    key: "jaundice",
    label: "Yellowing of skin/eyes (jaundice)",
    detail: "Sign of hepatic dysfunction / Weil's disease",
    redFlag: true,
  },
  {
    key: "oliguria",
    label: "Decreased urination (oliguria)",
    detail: "Sign of acute kidney injury (<0.5 mL/kg/h)",
    redFlag: true,
  },
];

export const TriageForm: React.FC<TriageFormProps> = ({
  onSubmit,
  isLoading,
  isOffline,
  onClear,
  resetSignal = 0,
}) => {
  const [formData, setFormData] = useState<PatientFormData>({
    ...DEFAULT_FORM_DATA,
    symptom_days: 2,
  });

  // Watch for external reset trigger (e.g. from Assess Next Patient button)
  useEffect(() => {
    if (resetSignal > 0) {
      handleReset();
    }
  }, [resetSignal]);

  const handleReset = () => {
    setFormData(DEFAULT_FORM_DATA);
    if (onClear) {
      onClear();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const applyPreset = (presetType: "critical" | "high" | "moderate" | "low") => {
    if (presetType === "critical") {
      setFormData({
        flood_exposure: "yes",
        flood_days_ago: 6,
        fever: "yes",
        myalgia: "yes",
        headache: "yes",
        red_eyes: "yes",
        jaundice: "yes",
        oliguria: "yes",
        symptom_days: 4,
        age: 48,
        comorbidities: "Hypertension, CKD stage 1",
      });
    } else if (presetType === "high") {
      setFormData({
        flood_exposure: "yes",
        flood_days_ago: 7,
        fever: "yes",
        myalgia: "yes",
        headache: "yes",
        red_eyes: "yes",
        jaundice: "no",
        oliguria: "no",
        symptom_days: 3,
        age: 36,
        comorbidities: "None",
      });
    } else if (presetType === "moderate") {
      setFormData({
        flood_exposure: "yes",
        flood_days_ago: 4,
        fever: "yes",
        myalgia: "no",
        headache: "no",
        red_eyes: "no",
        jaundice: "no",
        oliguria: "no",
        symptom_days: 1,
        age: 29,
        comorbidities: "None",
      });
    } else {
      setFormData({
        flood_exposure: "no",
        flood_days_ago: 0,
        fever: "yes",
        myalgia: "no",
        headache: "yes",
        red_eyes: "no",
        jaundice: "no",
        oliguria: "no",
        symptom_days: 2,
        age: 24,
        comorbidities: "None",
      });
    }
  };

  const setFactor = (key: keyof PatientFormData, value: TriageFactor) => {
    setFormData({ ...formData, [key]: value });
  };

  return (
    <form
      id="triage-main-form"
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6"
    >
      {/* Quick Clinical Case Presets */}
      <div className="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Quick Clinical Case Presets for DOH Testing
          </span>
          <button
            type="button"
            id="btn-clear-form-top"
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear / Next Patient</span>
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            id="btn-preset-critical"
            onClick={() => applyPreset("critical")}
            className="text-xs py-1.5 px-2.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium border border-rose-200 transition-colors text-left"
          >
            🔴 Critical (Weil&apos;s)
          </button>
          <button
            type="button"
            id="btn-preset-high"
            onClick={() => applyPreset("high")}
            className="text-xs py-1.5 px-2.5 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium border border-amber-200 transition-colors text-left"
          >
            🟠 High (Calf Myalgia)
          </button>
          <button
            type="button"
            id="btn-preset-moderate"
            onClick={() => applyPreset("moderate")}
            className="text-xs py-1.5 px-2.5 rounded bg-yellow-50 text-yellow-800 hover:bg-yellow-100 font-medium border border-yellow-200 transition-colors text-left"
          >
            🟡 Moderate (Fever Only)
          </button>
          <button
            type="button"
            id="btn-preset-low"
            onClick={() => applyPreset("low")}
            className="text-xs py-1.5 px-2.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-medium border border-emerald-200 transition-colors text-left"
          >
            🟢 Low (No Flood)
          </button>
        </div>
      </div>

      {/* Section 1: Flood Exposure */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          1. Floodwater Exposure History
        </h3>

        <div className="space-y-4">
          <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="text-sm leading-relaxed">
                <span className="font-semibold block text-slate-900">
                  Has the patient waded through floodwater in the last 2–4
                  weeks?
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Tagalog: &quot;Nalusong ka ba sa tubig-baha o maruming tubig
                  nitong nakaraang 2 hanggang 4 na linggo?&quot;
                </span>
              </div>
              <TriToggle
                id="field-flood-exposure"
                value={formData.flood_exposure}
                onChange={(v) => setFactor("flood_exposure", v)}
              />
            </div>

            {formData.flood_exposure === "yes" && (
              <div className="mt-3 ml-0 sm:ml-2 pl-3 border-l-2 border-blue-200">
                <label
                  htmlFor="field-flood-days"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Days since flood exposure (if known, 0–30)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    id="field-flood-days"
                    min={0}
                    max={30}
                    value={formData.flood_days_ago}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        flood_days_ago: Math.max(
                          0,
                          Math.min(30, Number(e.target.value))
                        ),
                      })
                    }
                    className="w-28 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  />
                  <span className="text-xs text-slate-500">
                    Incubation period: Typically 5–14 days (range 2–30 days)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Clinical Symptoms */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-600" />
          2. Clinical Symptoms Checklist
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {SYMPTOM_ITEMS.map((item) => (
            <div
              key={item.key}
              className={`p-3 rounded-lg border bg-white ${
                item.redFlag ? "border-rose-200" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900 block flex items-center gap-1 flex-wrap">
                    {item.label}
                    {item.redFlag && (
                      <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                        RED FLAG
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {item.detail}
                  </span>
                </div>
                <TriToggle
                  id={`field-${item.key}`}
                  value={formData[item.key]}
                  onChange={(v) => setFactor(item.key, v)}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          Mark symptoms as Unknown if not assessed — the tool will NOT treat an
          unanswered symptom as absent.
        </p>
      </div>

      {/* Section 3: History & Vitals */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-emerald-600" />
          3. Patient Profile &amp; Duration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label
              htmlFor="field-symptom-days"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Days since symptoms started (1–14, default 2)
            </label>
            <input
              type="number"
              id="field-symptom-days"
              min={1}
              max={14}
              value={formData.symptom_days}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  symptom_days: Math.max(1, Math.min(14, Number(e.target.value))),
                })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
              required
            />
          </div>

          <div>
            <label
              htmlFor="field-age"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Age (1–100, default 35)
            </label>
            <input
              type="number"
              id="field-age"
              min={1}
              max={100}
              value={formData.age}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  age: Math.max(1, Math.min(100, Number(e.target.value))),
                })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="field-comorbidities"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Comorbidities (comma-separated)
          </label>
          <input
            type="text"
            id="field-comorbidities"
            value={formData.comorbidities}
            onChange={(e) =>
              setFormData({ ...formData, comorbidities: e.target.value })
            }
            placeholder="e.g. Hypertension, Diabetes, Chronic Kidney Disease, None"
            className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>
      </div>

      {/* Action Buttons: Submit & Clear for Next Patient */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          id="btn-clear-form-bottom"
          onClick={handleReset}
          className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-300 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>Clear / Reset Form</span>
        </button>

        <button
          type="submit"
          id="btn-assess-risk"
          disabled={isLoading}
          className="flex-1 w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Evaluating verified protocols &amp; AI context...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-blue-200" />
              <span>Assess Risk</span>
            </>
          )}
        </button>
      </div>

      {isOffline && (
        <p className="text-center text-xs text-amber-700 mt-3 flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Degraded mode active: deterministic rule assessment (Gemini explanation unavailable)
        </p>
      )}
    </form>
  );
};