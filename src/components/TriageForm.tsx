import React, { useState } from "react";
import { PatientFormData } from "../types";
import {
  AlertTriangle,
  Flame,
  Activity,
  HeartPulse,
  Sparkles,
  Zap,
  HelpCircle,
} from "lucide-react";

interface TriageFormProps {
  onSubmit: (data: PatientFormData) => void;
  isLoading: boolean;
  isOffline: boolean;
}

export const TriageForm: React.FC<TriageFormProps> = ({
  onSubmit,
  isLoading,
  isOffline,
}) => {
  const [formData, setFormData] = useState<PatientFormData>({
    flood_exposure: true,
    flood_days_ago: 7,
    fever: true,
    myalgia: true,
    headache: false,
    red_eyes: false,
    jaundice: false,
    oliguria: false,
    symptom_days: 2,
    age: 35,
    comorbidities: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const applyPreset = (presetType: "critical" | "high" | "moderate" | "low") => {
    if (presetType === "critical") {
      setFormData({
        flood_exposure: true,
        flood_days_ago: 6,
        fever: true,
        myalgia: true,
        headache: true,
        red_eyes: true,
        jaundice: true,
        oliguria: true,
        symptom_days: 4,
        age: 48,
        comorbidities: "Hypertension, CKD stage 1",
      });
    } else if (presetType === "high") {
      setFormData({
        flood_exposure: true,
        flood_days_ago: 7,
        fever: true,
        myalgia: true,
        headache: true,
        red_eyes: true,
        jaundice: false,
        oliguria: false,
        symptom_days: 3,
        age: 36,
        comorbidities: "None",
      });
    } else if (presetType === "moderate") {
      setFormData({
        flood_exposure: true,
        flood_days_ago: 4,
        fever: true,
        myalgia: false,
        headache: false,
        red_eyes: false,
        jaundice: false,
        oliguria: false,
        symptom_days: 1,
        age: 29,
        comorbidities: "None",
      });
    } else {
      setFormData({
        flood_exposure: false,
        flood_days_ago: 0,
        fever: true,
        myalgia: false,
        headache: true,
        red_eyes: false,
        jaundice: false,
        oliguria: false,
        symptom_days: 2,
        age: 24,
        comorbidities: "None",
      });
    }
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
          <span className="text-xs text-slate-400">Click to autofill</span>
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
          <label
            htmlFor="field-flood-exposure"
            className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
              formData.flood_exposure
                ? "bg-blue-50/70 border-blue-300 text-blue-950 font-medium"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-flood-exposure"
              checked={formData.flood_exposure}
              onChange={(e) =>
                setFormData({ ...formData, flood_exposure: e.target.checked })
              }
              className="mt-1 w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <div className="text-sm leading-relaxed">
              <span className="font-semibold block text-slate-900">
                Has the patient waded through floodwater in the last 2–4 weeks?
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                Tagalog: &quot;Nalusong ka ba sa tubig-baha o maruming tubig
                nitong nakaraang 2 hanggang 4 na linggo?&quot;
              </span>
            </div>
          </label>

          {formData.flood_exposure && (
            <div className="ml-2 sm:ml-8 pl-3 border-l-2 border-blue-200">
              <label
                htmlFor="field-flood-days"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Days since flood exposure (0–30, default 7)
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

      {/* Section 2: Clinical Symptoms */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-600" />
          2. Clinical Symptoms Checklist
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Fever */}
          <label
            htmlFor="field-fever"
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              formData.fever
                ? "bg-amber-50/80 border-amber-300 text-amber-950 font-medium"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-fever"
              checked={formData.fever}
              onChange={(e) =>
                setFormData({ ...formData, fever: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block">Fever</span>
              <span className="text-[11px] text-slate-500">
                Acute high fever (≥38°C)
              </span>
            </div>
          </label>

          {/* Severe Muscle Pain */}
          <label
            htmlFor="field-myalgia"
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              formData.myalgia
                ? "bg-orange-50/80 border-orange-300 text-orange-950 font-medium"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-myalgia"
              checked={formData.myalgia}
              onChange={(e) =>
                setFormData({ ...formData, myalgia: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block">
                Severe muscle pain (especially calves/lower back)
              </span>
              <span className="text-[11px] text-slate-500">
                High-specificity hallmark of Leptospira
              </span>
            </div>
          </label>

          {/* Headache */}
          <label
            htmlFor="field-headache"
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              formData.headache
                ? "bg-slate-100 border-slate-300 text-slate-900 font-medium"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-headache"
              checked={formData.headache}
              onChange={(e) =>
                setFormData({ ...formData, headache: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-slate-600 rounded border-slate-300 focus:ring-slate-500"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block">Headache</span>
              <span className="text-[11px] text-slate-500">
                Frontal or retro-orbital aching
              </span>
            </div>
          </label>

          {/* Red Eyes */}
          <label
            htmlFor="field-red-eyes"
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              formData.red_eyes
                ? "bg-rose-50/80 border-rose-300 text-rose-950 font-medium"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-red-eyes"
              checked={formData.red_eyes}
              onChange={(e) =>
                setFormData({ ...formData, red_eyes: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block">Red eyes</span>
              <span className="text-[11px] text-slate-500">
                Conjunctival suffusion without purulent discharge
              </span>
            </div>
          </label>

          {/* Yellowing of skin/eyes (Jaundice) */}
          <label
            htmlFor="field-jaundice"
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              formData.jaundice
                ? "bg-amber-100 border-amber-400 text-amber-950 font-semibold ring-1 ring-amber-400"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-jaundice"
              checked={formData.jaundice}
              onChange={(e) =>
                setFormData({ ...formData, jaundice: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block flex items-center gap-1">
                Yellowing of skin/eyes (jaundice)
                <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                  RED FLAG
                </span>
              </span>
              <span className="text-[11px] text-slate-500">
                Sign of hepatic dysfunction / Weil&apos;s disease
              </span>
            </div>
          </label>

          {/* Decreased Urination (Oliguria) */}
          <label
            htmlFor="field-oliguria"
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
              formData.oliguria
                ? "bg-rose-100 border-rose-400 text-rose-950 font-semibold ring-1 ring-rose-400"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="checkbox"
              id="field-oliguria"
              checked={formData.oliguria}
              onChange={(e) =>
                setFormData({ ...formData, oliguria: e.target.checked })
              }
              className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
            />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-slate-900 block flex items-center gap-1">
                Decreased urination (oliguria)
                <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.2 rounded font-bold">
                  RED FLAG
                </span>
              </span>
              <span className="text-[11px] text-slate-500">
                Sign of acute kidney injury (&lt;0.5 mL/kg/h)
              </span>
            </div>
          </label>
        </div>
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

      {/* Submit Button */}
      <button
        type="submit"
        id="btn-assess-risk"
        disabled={isLoading}
        className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Evaluating DOH Protocols &amp; AI Analysis...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 text-blue-200" />
            <span>Assess Risk</span>
          </>
        )}
      </button>

      {isOffline && (
        <p className="text-center text-xs text-amber-700 mt-3 flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          Offline mode active — instant deterministic DOH 2026 rule assessment
        </p>
      )}
    </form>
  );
};
