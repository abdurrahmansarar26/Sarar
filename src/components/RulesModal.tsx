import React from "react";
import { DIVISIBILITY_RULES, RULE_KEYS } from "../data/rules";
import { BookOpen, X, CheckCircle2 } from "lucide-react";

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.35)] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-yellow-300 to-amber-400 uppercase tracking-wider font-['Chakra_Petch']">
                6. Sınıf Bölünebilme Kuralları Rehberi
              </h2>
              <p className="text-xs text-slate-400">
                Yarışta turbo hızına ulaşmak için kuralları iyi öğren!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-3.5 divide-y divide-slate-800/60 font-['Outfit']">
          {RULE_KEYS.map((k) => {
            const rule = DIVISIBILITY_RULES[k];
            return (
              <div key={k} className="pt-3.5 first:pt-0">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-lg font-['Chakra_Petch'] shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                    {k}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base font-['Chakra_Petch']">
                        {rule.title}
                      </h3>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Müfredat
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                      {rule.tip}
                    </p>
                    <div className="mt-2 text-xs bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2 text-amber-300">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-amber-400" />
                      <span>
                        <strong>Hızlı İpucu:</strong> {rule.shortTip}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-['Chakra_Petch'] uppercase tracking-wider text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
          >
            Anladım, Yarışa Dön
          </button>
        </div>
      </div>
    </div>
  );
};
