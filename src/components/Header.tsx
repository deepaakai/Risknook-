import React from 'react';
import { Shield, ShieldAlert, AlertTriangle, Settings, Volume2, VolumeX, Lock } from 'lucide-react';
import { AccountState } from '../types/trading';
import { formatINR } from '../utils/calculations';

interface HeaderProps {
  account: AccountState;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onEmergencyLockdown: () => void;
  onOpenSettings: () => void;
  soundOn: boolean;
  setSoundOn: (enabled: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  activeTab,
  setActiveTab,
  onEmergencyLockdown,
  onOpenSettings,
  soundOn,
  setSoundOn,
}) => {
  const isLossBreached = account.realizedPnL <= -account.dailyMaxLossLimit;
  const isTripped = account.isCircuitBreakerTripped || isLossBreached;

  return (
    <header className="border-b border-[#1B253B] bg-[#070A11] px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between gap-6">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white font-mono">
                RISKNOOK
              </span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-mono tracking-wider text-slate-400">
                CAPITAL SHIELD
              </span>
            </div>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono border border-emerald-950/60 bg-emerald-950/20 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            PROTOCOL ARMED
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium">
          {[
            { id: 'terminal', label: 'Trading Workstation' },
            { id: 'journal', label: 'Execution Journal' },
            { id: 'psychology', label: 'Tilt & Emotional Audit' },
            { id: 'derivatives', label: 'Options Greeks Desk' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap font-medium ${
                  isActive
                    ? 'bg-[#151D30] text-indigo-300 border border-[#233252]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0D1322]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account Strip & Fast Action */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Account Metrics Strip (Clean unboxed metadata) */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-300 font-mono">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Capital</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {formatINR(account.totalCapital)}
              </span>
            </div>
            <span className="text-slate-700" aria-hidden="true">|</span>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Max Loss</span>
              <span className="text-rose-400 font-medium tabular-nums">
                {formatINR(account.dailyMaxLossLimit)}
              </span>
            </div>
            <span className="text-slate-700" aria-hidden="true">|</span>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Realized P&L</span>
              <span
                className={`font-bold tabular-nums ${
                  account.realizedPnL > 0
                    ? 'text-emerald-400'
                    : account.realizedPnL < 0
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {formatINR(account.realizedPnL)}
              </span>
            </div>
            <span className="text-slate-700" aria-hidden="true">|</span>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Breaker</span>
              <span
                className={`flex items-center gap-1 font-semibold text-[11px] ${
                  isTripped ? 'text-rose-400 animate-pulse' : 'text-emerald-400'
                }`}
              >
                {isTripped ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {isTripped ? 'TRIPPED' : 'ARMED'}
              </span>
            </div>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundOn(!soundOn)}
            className="p-1.5 rounded border border-[#1B253B] bg-[#0D1322] text-slate-400 hover:text-slate-200 transition-colors"
            title={soundOn ? 'Sound Muted' : 'Sound Enabled'}
            aria-label="Toggle Sound Effects"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded border border-[#1B253B] bg-[#0D1322] text-slate-400 hover:text-slate-200 transition-colors"
            title="Configure Risk Limits & Capital"
            aria-label="Risk Parameters & Capital Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Emergency Tilt Lockdown Button */}
          <button
            onClick={onEmergencyLockdown}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white font-mono text-xs font-semibold rounded border border-rose-500 shadow-sm shadow-rose-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap"
            title="Instantly trigger circuit breaker and lock terminal for cooldown"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>TILT LOCKDOWN</span>
          </button>
        </div>
      </div>
    </header>
  );
};
