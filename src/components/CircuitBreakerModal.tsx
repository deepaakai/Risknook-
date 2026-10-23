import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Lock, RefreshCw, HeartPulse, Sparkles } from 'lucide-react';
import { formatINR } from '../utils/calculations';
import { playCircuitBreakerSiren } from '../utils/soundEffects';

interface CircuitBreakerModalProps {
  isOpen: boolean;
  realizedPnL: number;
  dailyMaxLossLimit: number;
  cooldownUntil: number | null;
  onResetCooldown: () => void;
  onEmergencyOverride: () => void;
}

export const CircuitBreakerModal: React.FC<CircuitBreakerModalProps> = ({
  isOpen,
  realizedPnL,
  dailyMaxLossLimit,
  cooldownUntil,
  onResetCooldown,
  onEmergencyOverride,
}) => {
  const [timeLeft, setTimeLeft] = useState<string>('04:00:00');
  const [overrideInput, setOverrideInput] = useState<string>('');
  const [showOverrideInput, setShowOverrideInput] = useState<boolean>(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale'>('Inhale');

  useEffect(() => {
    if (!isOpen) return;
    playCircuitBreakerSiren();
  }, [isOpen]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const targetTime = cooldownUntil || (Date.now() + 4 * 60 * 60 * 1000);
      const diff = targetTime - Date.now();

      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, cooldownUntil]);

  // Breathing pacer effect (4s inhale, 4s hold, 4s exhale)
  useEffect(() => {
    if (!isOpen) return;
    const pacer = setInterval(() => {
      setBreathPhase((prev) => (prev === 'Inhale' ? 'Hold' : prev === 'Hold' ? 'Exhale' : 'Inhale'));
    }, 4000);
    return () => clearInterval(pacer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmOverride = () => {
    if (overrideInput.trim().toUpperCase() === 'I WILL NOT REVENGE TRADE') {
      onEmergencyOverride();
      setShowOverrideInput(false);
      setOverrideInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-siren-strobe font-mono">
      <div className="bg-[#0A0D17] border-2 border-rose-600 rounded-xl max-w-xl w-full p-6 text-white shadow-2xl flex flex-col gap-5 relative overflow-hidden">
        {/* Top Emergency Strobe Banner */}
        <div className="flex items-center gap-3 border-b border-rose-900/60 pb-4">
          <div className="w-12 h-12 rounded-lg bg-rose-600/30 border border-rose-500 flex items-center justify-center shrink-0 animate-pulse">
            <ShieldAlert className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-rose-400 uppercase">
              BEHAVIORAL CIRCUIT BREAKER ENGAGED
            </h1>
            <p className="text-xs text-slate-300">
              Terminal locked. Capital preservation protocol activated.
            </p>
          </div>
        </div>

        {/* Breach Telemetry Card */}
        <div className="grid grid-cols-2 gap-3 bg-[#050810] p-4 rounded-lg border border-rose-950">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Daily Max Loss Limit</span>
            <span className="text-base font-bold text-slate-200 tabular-nums">
              {formatINR(dailyMaxLossLimit)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-rose-400 uppercase block font-semibold">Realized Loss Breached</span>
            <span className="text-base font-bold text-rose-400 tabular-nums">
              {formatINR(realizedPnL)}
            </span>
          </div>
        </div>

        {/* Cooldown Lock Countdown */}
        <div className="bg-[#0F1424] p-4 rounded-lg border border-[#1E2A47] text-center flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
            <Lock className="w-4 h-4" />
            <span>MANDATORY 4-HOUR PSYCHOLOGICAL COOLDOWN LOCK</span>
          </div>
          <div className="text-3xl font-black text-white tracking-widest tabular-nums mt-1 text-emerald-400">
            {timeLeft}
          </div>
          <span className="text-[10px] text-slate-400">
            Trading is disabled to protect remaining capital from revenge trading spirals.
          </span>
        </div>

        {/* Biological Reset & Breathing Pacer */}
        <div className="bg-[#070B14] p-3.5 rounded-lg border border-[#18233B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HeartPulse className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-xs font-bold text-slate-200 block">Vagus Nerve Reset Pacer</span>
              <span className="text-[10px] text-slate-400">Lower cortisol & heart rate before making any decisions.</span>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-700 text-indigo-300 text-xs font-bold animate-pulse">
            {breathPhase} (4s)
          </div>
        </div>

        {/* Actions / Override */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[#18233B]">
          {!showOverrideInput ? (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                Breach logged to risk audit journal.
              </span>
              <button
                onClick={() => setShowOverrideInput(true)}
                className="text-[11px] text-rose-400 hover:text-rose-300 underline font-semibold"
              >
                Emergency Manual Unlock Override
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 bg-[#050810] p-3 rounded border border-rose-900/60">
              <span className="text-[10px] text-rose-300">
                To unlock, type exact phrase: <strong className="text-white">I WILL NOT REVENGE TRADE</strong>
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={overrideInput}
                  onChange={(e) => setOverrideInput(e.target.value)}
                  placeholder="Type phrase here..."
                  className="w-full bg-[#070A11] border border-[#1B253B] rounded px-2.5 py-1 text-xs text-white uppercase"
                />
                <button
                  onClick={handleConfirmOverride}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded shrink-0"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
