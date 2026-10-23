import React, { useState } from 'react';
import { 
  HeartPulse, 
  ShieldAlert, 
  TrendingUp, 
  Flame, 
  Brain, 
  BarChart3, 
  Compass, 
  Layers,
  AlertCircle
} from 'lucide-react';
import { 
  AccountState, 
  TradeOrder, 
  ConfluenceTimeframe, 
  ChartMode, 
  PricePattern 
} from '../types/trading';
import { formatINR } from '../utils/calculations';

interface PsychologyAndRiskDeskProps {
  account: AccountState;
  trades: TradeOrder[];
  confluenceTimeframes: ConfluenceTimeframe[];
  onManualTiltReset?: () => void;
}

export const PsychologyAndRiskDesk: React.FC<PsychologyAndRiskDeskProps> = ({
  account,
  trades,
  confluenceTimeframes,
}) => {
  const [chartMode, setChartMode] = useState<ChartMode>('CANDLESTICK');
  const [selectedPatternPreview, setSelectedPatternPreview] = useState<PricePattern>('SR_BREAKOUT');

  // Compute portfolio Greeks exposure across open trades
  const openTrades = trades.filter((t) => t.status === 'OPEN');
  
  const totalOpenDeltaRupees = openTrades.reduce((acc, t) => {
    return acc + (t.greeks.delta * t.quantity * 100);
  }, 0);

  const totalOpenThetaRupees = openTrades.reduce((acc, t) => {
    return acc + (Math.abs(t.greeks.theta) * t.quantity);
  }, 0);

  // Circuit Breaker Calculation
  const currentLoss = Math.max(0, -account.realizedPnL);
  const maxLoss = account.dailyMaxLossLimit;
  const lossPercentage = Math.min(100, Math.round((currentLoss / maxLoss) * 100));
  const remainingLossBuffer = Math.max(0, maxLoss - currentLoss);

  // Confluence Alignment Score
  const bullishCount = confluenceTimeframes.filter((tf) => tf.trend === 'BULLISH').length;
  const alignmentText = bullishCount === 4 ? '4/4 Full Bullish Alignment' : bullishCount === 3 ? '3/4 Bullish Bias' : 'Mixed Timeframe Conflict';

  // Circular gauge parameters for Tilt Meter
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const tiltStrokeDashoffset = circumference - (account.tiltScore / 100) * circumference;

  const getTiltColor = (score: number) => {
    if (score >= 80) return '#10B981'; // Emerald
    if (score >= 60) return '#6366F1'; // Indigo
    if (score >= 40) return '#F59E0B'; // Amber
    return '#F43F5E'; // Rose
  };

  const getTiltLabel = (score: number) => {
    if (score >= 80) return { label: 'OPTIMAL FLOW', sub: 'Calm execution' };
    if (score >= 60) return { label: 'CAUTION', sub: 'Minor impulse detected' };
    if (score >= 40) return { label: 'TILTED', sub: 'Risk threshold breached' };
    return { label: 'DANGER ZONE', sub: 'Destructive spiral imminent' };
  };

  const tiltInfo = getTiltLabel(account.tiltScore);

  return (
    <div className="bg-[#0D1322] border border-[#1B253B] rounded-lg p-4 flex flex-col gap-4 text-xs font-mono">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#1B253B] pb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Psychology Cockpit & Risk Radar
          </h2>
        </div>
        <span className="text-[10px] text-slate-400">Behavioral Telemetry</span>
      </div>

      {/* Row 1: Tilt Meter + Circuit Breaker Gauge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Tilt Meter */}
        <div className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <HeartPulse className="w-3.5 h-3.5 text-indigo-400" />
              Tilt Score (0-100)
            </span>
            <div className="text-lg font-bold text-white tracking-tight">
              {account.tiltScore} / 100
            </div>
            <div className="text-[10px] font-semibold" style={{ color: getTiltColor(account.tiltScore) }}>
              {tiltInfo.label}
            </div>
            <div className="text-[9px] text-slate-500">
              {tiltInfo.sub}
            </div>
          </div>

          {/* Circular SVG Gauge */}
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#1B253B"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={getTiltColor(account.tiltScore)}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={tiltStrokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-xs font-bold text-white tabular-nums">{account.tiltScore}%</span>
            </div>
          </div>
        </div>

        {/* Circuit Breaker Progress Meter */}
        <div className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Daily Circuit Breaker
            </span>
            <span
              className={`text-[10px] font-bold ${
                lossPercentage >= 80 ? 'text-rose-400 animate-pulse' : 'text-slate-300'
              }`}
            >
              {lossPercentage}% Limit Consumed
            </span>
          </div>

          <div className="my-2">
            <div className="w-full bg-[#070A11] h-3 rounded-full border border-[#1B253B] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  lossPercentage >= 80
                    ? 'bg-rose-500'
                    : lossPercentage >= 50
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${lossPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>
              Loss: <strong className="text-rose-400">{formatINR(currentLoss)}</strong>
            </span>
            <span>
              Buffer: <strong className="text-emerald-400">{formatINR(remainingLossBuffer)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: The Cost of Indiscipline Card (Highlight Metric) */}
      <div className="bg-rose-950/20 border border-rose-900/40 rounded p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-rose-900/40 border border-rose-700/60 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-rose-300/80 block font-bold">
              The Cost of Indiscipline (Session Tally)
            </span>
            <span className="text-[9px] text-slate-400 block">
              Cumulative ₹ lost solely to FOMO, revenge, or oversized trades
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-base font-bold text-rose-400 tabular-nums">
            -{formatINR(account.avoidableEmotionalLosses)}
          </span>
          <span className="text-[9px] text-rose-300/70 block">
            Avoidable Losses
          </span>
        </div>
      </div>

      {/* Row 3: Greeks Heatmap & Open Exposures */}
      <div className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-[#18233B] pb-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Open Portfolio Greeks Heatmap
          </span>
          <span className="text-[9px] text-slate-500">
            {openTrades.length} Active Positions
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-[#050810] p-2 rounded border border-[#151F33]">
            <span className="text-[9px] text-slate-500 block">Delta Exposure</span>
            <span
              className={`font-bold text-xs tabular-nums ${
                totalOpenDeltaRupees >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalOpenDeltaRupees >= 0 ? '+' : ''}{formatINR(totalOpenDeltaRupees)}
            </span>
            <span className="text-[8px] text-slate-400 block">per 100 pt index move</span>
          </div>

          <div className="bg-[#050810] p-2 rounded border border-[#151F33]">
            <span className="text-[9px] text-slate-500 block">Theta Bleed</span>
            <span className="font-bold text-xs text-rose-400 tabular-nums">
              -{formatINR(totalOpenThetaRupees)}
            </span>
            <span className="text-[8px] text-slate-400 block">decay loss / day</span>
          </div>

          <div className="bg-[#050810] p-2 rounded border border-[#151F33]">
            <span className="text-[9px] text-slate-500 block">Portfolio Beta</span>
            <span className="font-bold text-xs text-indigo-300 tabular-nums">
              1.14x
            </span>
            <span className="text-[8px] text-slate-400 block">relative to NIFTY 50</span>
          </div>
        </div>
      </div>

      {/* Row 4: Multi-Timeframe Confluence Engine */}
      <div className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-[#18233B] pb-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            Multi-Timeframe Trend Confluence
          </span>
          <span className="text-[9px] text-emerald-400 font-bold">
            {alignmentText}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
          {confluenceTimeframes.map((tf) => (
            <div
              key={tf.tf}
              className={`p-2 rounded border text-left ${
                tf.trend === 'BULLISH'
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                  : tf.trend === 'BEARISH'
                  ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                  : 'bg-slate-900/40 border-slate-800 text-slate-300'
              }`}
            >
              <div className="text-[9px] text-slate-400 font-bold">{tf.tf}</div>
              <div className="text-[10px] font-bold mt-0.5">{tf.trend}</div>
              <div className="text-[8px] text-slate-400 mt-1 flex items-center justify-between">
                <span>RSI: {tf.rsi}</span>
                <span className="text-[7px] text-indigo-300 font-mono">20EMA ↑</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 5: Price Action & Candlestick Modes Mini-Chart View */}
      <div className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-[#18233B] pb-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            Price Action Structure
          </span>
          <div className="flex items-center gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
            {(['CANDLESTICK', 'HEIKIN_ASHI', 'OHLC'] as ChartMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-2 py-0.5 text-[9px] font-medium rounded ${
                  chartMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'CANDLESTICK' ? 'Candles' : mode === 'HEIKIN_ASHI' ? 'Heikin-Ashi' : 'OHLC'}
              </button>
            ))}
          </div>
        </div>

        {/* Simulated High-Density Candlestick Visualizer */}
        <div className="h-28 bg-[#050810] border border-[#151F33] rounded p-2 flex items-end justify-between gap-1 relative overflow-hidden">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between opacity-15 pointer-events-none p-2">
            <div className="border-b border-indigo-400 w-full"></div>
            <div className="border-b border-indigo-400 w-full"></div>
            <div className="border-b border-indigo-400 w-full"></div>
          </div>

          {/* Candle Bars Sequence */}
          {[
            { open: 30, high: 55, low: 25, close: 48, green: true },
            { open: 48, high: 62, low: 40, close: 56, green: true },
            { open: 56, high: 70, low: 52, close: 68, green: true },
            { open: 68, high: 72, low: 45, close: 48, green: false }, // Pin/rejection
            { open: 48, high: 58, low: 42, close: 44, green: false },
            { open: 44, high: 50, low: 36, close: 42, green: false },
            { open: 42, high: 65, low: 40, close: 62, green: true }, // FVG push
            { open: 62, high: 78, low: 58, close: 75, green: true },
            { open: 75, high: 88, low: 72, close: 84, green: true },
            { open: 84, high: 90, low: 80, close: 82, green: false },
            { open: 82, high: 98, low: 81, close: 95, green: true }, // Current breakout
          ].map((c, i) => {
            const isGreen = chartMode === 'HEIKIN_ASHI' ? i > 5 : c.green;
            const bodyHeight = Math.max(6, Math.abs(c.close - c.open));
            const bottomPos = Math.min(c.open, c.close);
            const wickHeight = c.high - c.low;

            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end relative group">
                {/* Upper/Lower Wick */}
                <div
                  className={`w-[1px] absolute ${isGreen ? 'bg-emerald-400' : 'bg-rose-400'}`}
                  style={{
                    bottom: `${c.low}%`,
                    height: `${wickHeight}%`,
                  }}
                />
                {/* Candle Body */}
                <div
                  className={`w-full max-w-[12px] z-10 rounded-xs transition-all ${
                    chartMode === 'OHLC'
                      ? 'bg-transparent border-l-2'
                      : isGreen
                      ? 'bg-emerald-500 border border-emerald-400'
                      : 'bg-rose-500 border border-rose-400'
                  }`}
                  style={{
                    bottom: `${bottomPos}%`,
                    height: `${bodyHeight}%`,
                    position: 'absolute',
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[9px] text-slate-500">
          <span>Active View: {chartMode}</span>
          <span className="text-indigo-400">Institutional FVG Base @ 24,440 Verified</span>
        </div>
      </div>
    </div>
  );
};
