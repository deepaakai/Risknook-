import React, { useState } from 'react';
import { Settings, Shield, RotateCcw, Check, X } from 'lucide-react';
import { AccountState } from '../types/trading';
import { formatINR } from '../utils/calculations';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountState;
  onSaveAccount: (updated: Partial<AccountState>) => void;
  onResetSession: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
  account,
  onSaveAccount,
  onResetSession,
}) => {
  const [capital, setCapital] = useState<number>(account.totalCapital);
  const [maxLoss, setMaxLoss] = useState<number>(account.dailyMaxLossLimit);
  const [riskPct, setRiskPct] = useState<number>(account.riskPctPerTrade);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveAccount({
      totalCapital: capital,
      dailyMaxLossLimit: maxLoss,
      riskPctPerTrade: riskPct,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
      <div className="bg-[#0D1322] border border-[#1B253B] rounded-xl max-w-md w-full p-5 text-white shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#1B253B] pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Institutional Risk Configuration
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
              Total Account Capital (₹)
            </label>
            <input
              type="number"
              step="10000"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              className="w-full bg-[#070A11] border border-[#1B253B] rounded px-3 py-2 text-white font-bold tabular-nums"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Active: {formatINR(capital)}
            </span>
          </div>

          <div>
            <label className="text-[10px] text-rose-400 uppercase tracking-wider block mb-1">
              Daily Hard Max Loss Limit (₹)
            </label>
            <input
              type="number"
              step="1000"
              value={maxLoss}
              onChange={(e) => setMaxLoss(Number(e.target.value))}
              className="w-full bg-[#070A11] border border-rose-900/60 rounded px-3 py-2 text-rose-300 font-bold tabular-nums"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Circuit breaker will lock at {formatINR(maxLoss)} loss.
            </span>
          </div>

          <div>
            <label className="text-[10px] text-indigo-400 uppercase tracking-wider block mb-1">
              Max Risk Per Trade (%)
            </label>
            <div className="grid grid-cols-4 gap-1.5 mb-1.5">
              {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRiskPct(pct)}
                  className={`py-1 text-center rounded border text-xs font-bold ${
                    riskPct === pct
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-[#070A11] border-[#1B253B] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.1"
              value={riskPct}
              onChange={(e) => setRiskPct(Number(e.target.value))}
              className="w-full bg-[#070A11] border border-[#1B253B] rounded px-3 py-1.5 text-white font-bold tabular-nums"
            />
          </div>
        </div>

        {/* Reset Session Option */}
        <div className="bg-[#080D1A] p-3 rounded border border-[#18233B] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-200 block">New Trading Day Reset</span>
            <span className="text-[10px] text-slate-400">Reset session P&L and tilt score to 100</span>
          </div>
          <button
            onClick={() => {
              onResetSession();
              onClose();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1B253B]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Apply Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
};
