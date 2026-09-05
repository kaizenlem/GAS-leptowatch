import React from "react";
import {
  X,
  Languages,
  Pill,
  AlertTriangle,
  HeartPulse,
  BookOpen,
} from "lucide-react";

interface NurseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NurseGuideModal: React.FC<NurseGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                RHU Nurse Clinical &amp; Translation Guide
              </h3>
              <p className="text-xs text-slate-500">
                Philippine DOH 2026 Guidelines &amp; Patient Interview Screening
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Section 1: Tagalog Patient Screening Phrases */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-2 text-blue-800">
              <Languages className="w-4 h-4 text-blue-600" />
              Tagalog Patient Interview Prompts (Pag-tatanong sa Pasyente)
            </h4>
            <div className="space-y-2">
              <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-100">
                <p className="font-semibold text-xs text-blue-950">
                  🌊 1. Paglusong sa Baha (Flood Exposure):
                </p>
                <p className="text-xs italic text-blue-900 mt-0.5">
                  &quot;Nanay/Tatay, nalusong po ba kayo o nagbabad sa baha o
                  maruming kanal nitong nakaraang dalawa hanggang apat na
                  linggo? Mayroon po ba kayong sugat sa paa o binti nang
                  lumusong?&quot;
                </p>
              </div>

              <div className="p-3 bg-orange-50/70 rounded-lg border border-orange-100">
                <p className="font-semibold text-xs text-orange-950">
                  🦵 2. Pananakit ng Kalamnan / Binti (Calf Myalgia):
                </p>
                <p className="text-xs italic text-orange-900 mt-0.5">
                  &quot;Sumasakit po ba nang matindi ang inyong mga binti o
                  alak-alakan, lalo na kapag hinahawakan o naglalakad? Sumasakit
                  din po ba ang ibabang bahagi ng inyong likod?&quot;
                </p>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-100">
                <p className="font-semibold text-xs text-amber-950">
                  ⚠️ 3. Paninilaw ng Balat at Mata (Jaundice):
                </p>
                <p className="text-xs italic text-amber-900 mt-0.5">
                  &quot;Napansin po ba ninyo o ng inyong pamilya na naninilaw ang
                  puti ng inyong mga mata o ang inyong balat nitong mga huling
                  araw?&quot;
                </p>
              </div>

              <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-100">
                <p className="font-semibold text-xs text-rose-950">
                  💧 4. Pagbawas o Kulay ng Ihi (Oliguria):
                </p>
                <p className="text-xs italic text-rose-900 mt-0.5">
                  &quot;Kumonti po ba ang inyong pag-ihi? Gaano kadalas kayo
                  umihi ngayon kumpara sa dati? Parang kulay tsaa ba o maitim ang
                  inyong ihi?&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Doxycycline Guidelines */}
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-2 text-emerald-800">
              <Pill className="w-4 h-4 text-emerald-600" />
              DOH 2026 Doxycycline Dosing Reference Card
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <div className="grid grid-cols-3 bg-slate-100 font-bold p-2.5 text-slate-800 border-b border-slate-200">
                <div>Indication</div>
                <div>Regimen</div>
                <div>Precaution</div>
              </div>
              <div className="grid grid-cols-3 p-2.5 border-b border-slate-100 bg-white">
                <div className="font-semibold text-slate-900">
                  Therapeutic Treatment (Suspected Leptospirosis)
                </div>
                <div className="font-mono text-blue-700">
                  Doxycycline 100mg BID x 7 days
                </div>
                <div className="text-slate-600">
                  Take with full glass of water after food.
                </div>
              </div>
              <div className="grid grid-cols-3 p-2.5 border-b border-slate-100 bg-slate-50">
                <div className="font-semibold text-slate-900">
                  Post-Exposure Prophylaxis (Moderate / Low Risk)
                </div>
                <div className="font-mono text-emerald-700">
                  Doxycycline 200mg single dose
                </div>
                <div className="text-slate-600">
                  Take within 24–72 hours of floodwater exposure.
                </div>
              </div>
              <div className="grid grid-cols-3 p-2.5 bg-rose-50/50">
                <div className="font-semibold text-rose-900">
                  Absolute Contraindications
                </div>
                <div className="text-rose-800">
                  Pregnant or lactating mothers, children &lt;8 years
                </div>
                <div className="text-rose-700">
                  Use Amoxicillin (500mg TID) or Azithromycin as alternative.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Weil's Disease Triad */}
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
            <h4 className="font-bold text-xs uppercase tracking-wider text-rose-900 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Weil&apos;s Disease Red Flag Triad (Immediate Fast Lane Transfer)
            </h4>
            <p className="text-xs text-rose-950 leading-relaxed">
              When a patient exhibits <strong>Jaundice</strong> (hepatic
              compromise), <strong>Oliguria</strong> (renal failure), and/or{" "}
              <strong>Hemoptysis/Bleeding</strong> after flood exposure, they are
              in severe toxic phase. Immediate transfer to a tertiary hospital
              with dialysis and ICU capability is lifesaving.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
