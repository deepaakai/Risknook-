import React from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, Compass } from 'lucide-react';
import { MarketContextState, MarketRegime, UnderlyingIndex } from '../types/trading';

interface MarketRegimeBarProps {
  context: MarketContextState;
  setContext: React.Dispatch<React.SetStateAction<MarketContextState>>;
  indices: UnderlyingIndex[];
  selectedUnderlying: string;
  onSelectUnderlying: (symbol: string) => void;
}

export const MarketRegimeBar: React.FC<MarketRegimeBarProps> = ({
  context,
  setContext,
  indices,
  selectedUnderlying,
  onSelectUnderlying,
}) => {
  const handleRegimeChange = (regime: MarketRegime) => {
    setContext((prev) => ({ ...prev, regime }));
  };

  const getVixBadgeStyle = () => {
    if (context.indiaVix > 20) return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
    if (context.indiaVix >= 12) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
  };

  const getPcrBadgeStyle = () => {
    if (context.pcr >= 1.2) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    if (context.pcr <= 0.75) return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
    return 'text-slate-300 bg-slate-900/60 border-slate-700/60';
  };

  return (
    <div className="border-b border-[#1B253B] bg-[#0A0F1D] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* Market Regime Switchers */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          Regime:
        </span>
        <div className="flex items-center gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
          <button
            onClick={() => handleRegimeChange('BULL_TREND')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
              context.regime === 'BULL_TREND'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            Bull Trend
          </button>
          <button
            onClick={() => handleRegimeChange('BEAR_TREND')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
              context.regime === 'BEAR_TREND'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingDown className="w-3 h-3 text-rose-400" />
            Bear Trend
          </button>
          <button
            onClick={() => handleRegimeChange('SIDEWAYS_CHOP')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
              context.regime === 'SIDEWAYS_CHOP'
                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3 h-3 text-amber-400" />
            Sideways Chop
          </button>
        </div>
      </div>

      {/* Live Market Confluence Radar */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
        {/* India VIX */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">India VIX:</span>
          <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold tabular-nums ${getVixBadgeStyle()}`}>
            {context.indiaVix.toFixed(1)} ({context.indiaVix > 20 ? 'High Danger' : context.indiaVix >= 12 ? 'Safe Zone' : 'Compressed'})
          </span>
        </div>

        {/* GIFT NIFTY */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">GIFT Nifty:</span>
          <span
            className={`font-semibold tabular-nums text-[11px] ${
              context.giftNiftyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {context.giftNiftyChange >= 0 ? '+' : ''}{context.giftNiftyChange.toFixed(0)} pts
          </span>
        </div>

        {/* PCR */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">PCR:</span>
          <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold tabular-nums ${getPcrBadgeStyle()}`}>
            {context.pcr.toFixed(2)} ({context.pcr >= 1.2 ? 'Bullish' : context.pcr <= 0.75 ? 'Bearish' : 'Neutral'})
          </span>
        </div>

        {/* RVOL */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">RVOL:</span>
          <span
            className={`flex items-center gap-1 font-semibold tabular-nums text-[11px] ${
              context.rvol >= 2.0 ? 'text-indigo-400' : 'text-slate-300'
            }`}
          >
            {context.rvol >= 2.0 && <Zap className="w-3 h-3 text-indigo-400 fill-indigo-400" />}
            {context.rvol.toFixed(2)}x {context.rvol >= 2.0 ? '(Institutional Volume)' : ''}
          </span>
        </div>
      </div>

      {/* Index Spot Quick Selector */}
      <div className="hidden xl:flex items-center gap-1">
        {indices.map((idx) => {
          const isSelected = selectedUnderlying === idx.symbol;
          return (
            <button
              key={idx.symbol}
              onClick={() => onSelectUnderlying(idx.symbol)}
              className={`px-2.5 py-1 rounded border text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#151D30] border-indigo-500/80 text-white font-bold'
                  : 'bg-[#070A11] border-[#1B253B] text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{idx.symbol}</span>
              <span className="tabular-nums font-semibold text-slate-200">
                {idx.spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
              </span>
              <span className={`text-[10px] tabular-nums ${idx.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {idx.change >= 0 ? '+' : ''}{idx.changePct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
