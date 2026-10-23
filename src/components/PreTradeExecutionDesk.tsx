import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  ArrowRight, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  SlidersHorizontal,
  Flame,
  BrainCircuit,
  Coins
} from 'lucide-react';
import { 
  MarketSegment, 
  TradingStyle, 
  OrderType, 
  OptionType, 
  PreTradeMood, 
  PricePattern, 
  TradeOrder, 
  UnderlyingIndex,
  AccountState
} from '../types/trading';
import { 
  calculatePositionSize, 
  calculateRiskReward, 
  analyzeStrikeStatus, 
  calculateGreeksExposure, 
  calculateIndianBrokerageAndTaxes,
  formatINR,
  LOT_SIZES 
} from '../utils/calculations';
import { playOrderCommitSound } from '../utils/soundEffects';

interface PreTradeExecutionDeskProps {
  account: AccountState;
  indices: UnderlyingIndex[];
  selectedUnderlying: string;
  onCommitTrade: (trade: TradeOrder) => void;
  isCircuitBreakerActive: boolean;
}

export const PreTradeExecutionDesk: React.FC<PreTradeExecutionDeskProps> = ({
  account,
  indices,
  selectedUnderlying,
  onCommitTrade,
  isCircuitBreakerActive,
}) => {
  // Underlying and contract
  const [underlying, setUnderlying] = useState<string>(selectedUnderlying || 'NIFTY');
  const [segment, setSegment] = useState<MarketSegment>('OPTIONS');
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY');
  const [optionType, setOptionType] = useState<OptionType>('CE');
  const [style, setStyle] = useState<TradingStyle>('INTRADAY');
  const [orderType, setOrderType] = useState<OrderType>('REGULAR_LIMIT');
  
  // Buyer vs Seller sandbox
  const [deskMode, setDeskMode] = useState<'BUYER' | 'SELLER'>('BUYER');

  // Active underlying details
  const activeIndex = useMemo(() => {
    return indices.find((idx) => idx.symbol === underlying) || indices[0];
  }, [indices, underlying]);

  const lotSize = LOT_SIZES[underlying] || 25;

  // Strike selection relative to spot
  const [strike, setStrike] = useState<number>(24500);
  const [entryPrice, setEntryPrice] = useState<number>(120);
  const [stopLossPrice, setStopLossPrice] = useState<number>(98);
  const [targetPrice, setTargetPrice] = useState<number>(165);

  // Trailing SL
  const [useTrailingSL, setUseTrailingSL] = useState<boolean>(true);
  const [trailingType, setTrailingType] = useState<'STEP' | 'ATR'>('STEP');
  const [trailingStep, setTrailingStep] = useState<number>(5);

  // GTT OCO
  const [gttStopTrigger, setGttStopTrigger] = useState<number>(98);
  const [gttTargetTrigger, setGttTargetTrigger] = useState<number>(165);

  // Pattern & Psychology
  const [pattern, setPattern] = useState<PricePattern>('SR_BREAKOUT');
  const [mood, setMood] = useState<PreTradeMood>('FLOW');
  const [notes, setNotes] = useState<string>('');

  // Update strike default when underlying changes
  React.useEffect(() => {
    if (activeIndex) {
      const roundedStrike = Math.round(activeIndex.spotPrice / activeIndex.strikeStep) * activeIndex.strikeStep;
      setStrike(roundedStrike);
    }
  }, [underlying, activeIndex]);

  // Derived Symbol name
  const contractSymbol = useMemo(() => {
    if (segment === 'OPTIONS') {
      return `${underlying} ${strike} ${optionType}`;
    } else if (segment === 'FUTURES') {
      return `${underlying} FUT`;
    }
    return `${underlying} EQ`;
  }, [underlying, strike, optionType, segment]);

  // Strike Analysis (ITM / ATM / OTM)
  const strikeAnalysis = useMemo(() => {
    return analyzeStrikeStatus(activeIndex.spotPrice, strike, optionType, activeIndex.strikeStep);
  }, [activeIndex.spotPrice, strike, optionType, activeIndex.strikeStep]);

  // Mathematical Sizing Engine
  const sizing = useMemo(() => {
    return calculatePositionSize({
      capital: account.totalCapital,
      riskPct: account.riskPctPerTrade,
      entry: entryPrice,
      stopLoss: stopLossPrice,
      lotSize,
    });
  }, [account.totalCapital, account.riskPctPerTrade, entryPrice, stopLossPrice, lotSize]);

  // R:R Gatekeeper
  const rr = useMemo(() => {
    return calculateRiskReward({
      entry: entryPrice,
      stopLoss: stopLossPrice,
      target: targetPrice,
      action,
    });
  }, [entryPrice, stopLossPrice, targetPrice, action]);

  // Expected Greeks (interpolated realistic approximation for Indian F&O strikes)
  const greeks = useMemo(() => {
    const isCE = optionType === 'CE';
    let baseDelta = 0.5;
    if (strikeAnalysis.status === 'ITM') {
      baseDelta = isCE ? 0.65 : -0.65;
    } else if (strikeAnalysis.status === 'OTM') {
      baseDelta = isCE ? 0.35 : -0.35;
    } else {
      baseDelta = isCE ? 0.50 : -0.50;
    }

    const thetaPoints = -12.5; // points/day
    const gamma = 0.0024;
    const vega = 7.5;
    const iv = 14.5;
    const beta = underlying === 'BANKNIFTY' ? 1.25 : 1.05;

    return {
      delta: baseDelta,
      theta: thetaPoints,
      gamma,
      vega,
      iv,
      beta,
    };
  }, [optionType, strikeAnalysis.status, underlying]);

  const greeksExposure = useMemo(() => {
    return calculateGreeksExposure({
      delta: greeks.delta,
      theta: greeks.theta,
      quantity: sizing.normalizedUnits,
    });
  }, [greeks.delta, greeks.theta, sizing.normalizedUnits]);

  // Seller mode estimated margin
  const sellerMarginPerLot = underlying === 'NIFTY' ? 128000 : underlying === 'BANKNIFTY' ? 142000 : 110000;
  const totalSellerMarginRequired = sizing.lots * sellerMarginPerLot;

  // Indian taxes on planned trade
  const estimatedTaxes = useMemo(() => {
    if (sizing.normalizedUnits === 0) return { totalDeductions: 0 };
    return calculateIndianBrokerageAndTaxes({
      buyPrice: entryPrice,
      sellPrice: targetPrice,
      quantity: sizing.normalizedUnits,
      segment,
    });
  }, [entryPrice, targetPrice, sizing.normalizedUnits, segment]);

  // Trap Radar warning
  const trapWarning = useMemo(() => {
    if (pattern === 'FALSE_TRAP_SWEEP') {
      return 'Institutional Trap Radar: Liquidity sweep above resistance detected! High failure rate for late buyers.';
    }
    if (mood === 'FOMO') {
      return 'Psychology Warning: Entering after a vertical impulse without a confirmed base retest.';
    }
    if (strikeAnalysis.status === 'OTM' && Math.abs(strikeAnalysis.distancePoints) > 300) {
      return 'Deep OTM Warning: High Theta decay erosion rate (>90% probability of expiring worthless).';
    }
    return null;
  }, [pattern, mood, strikeAnalysis]);

  const handleCommit = () => {
    if (isCircuitBreakerActive) return;
    if (sizing.normalizedUnits <= 0) return;

    const newTrade: TradeOrder = {
      id: `TRD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      timestampEpoch: Date.now(),
      symbol: contractSymbol,
      underlying,
      segment,
      style,
      orderType,
      action,
      optionType: segment === 'OPTIONS' ? optionType : undefined,
      strike: segment === 'OPTIONS' ? strike : undefined,
      strikeStatus: segment === 'OPTIONS' ? strikeAnalysis.status : undefined,
      entryPrice,
      stopLossPrice,
      targetPrice,
      currentPrice: entryPrice,
      useTrailingSL,
      trailingStep,
      trailingSLTriggerPrice: useTrailingSL ? entryPrice + trailingStep : undefined,
      gttStopTrigger: orderType === 'GTT_OCO' ? gttStopTrigger : undefined,
      gttTargetTrigger: orderType === 'GTT_OCO' ? gttTargetTrigger : undefined,
      lots: sizing.lots,
      quantity: sizing.normalizedUnits,
      capitalAtRisk: sizing.capitalAtRisk,
      expectedReward: sizing.normalizedUnits * rr.rewardPoints,
      riskRewardRatio: rr.ratio,
      breakEvenWinRate: rr.breakEvenWinRatePct,
      greeks,
      buildup: action === 'BUY' ? 'LONG_BUILDUP' : 'SHORT_BUILDUP',
      trapWarning: trapWarning || undefined,
      mood,
      setupPattern: pattern,
      status: orderType === 'AMO' ? 'AMO_PENDING' : 'OPEN',
      realizedPnL: 0,
      netPnL: 0,
      brokerageAndTaxes: estimatedTaxes.totalDeductions,
      executionGrade: mood === 'FLOW' && rr.isOptimal ? 'A+' : 'F',
      isEmotionalTrade: mood !== 'FLOW',
      reflectionNotes: notes || (mood === 'FLOW' ? 'Systematic plan followed.' : `Executed with ${mood} bias.`),
      followedRules: mood === 'FLOW' && rr.isOptimal,
    };

    playOrderCommitSound();
    onCommitTrade(newTrade);
  };

  return (
    <div className="bg-[#0D1322] border border-[#1B253B] rounded-lg p-4 flex flex-col gap-4 text-xs font-mono">
      {/* Panel Title & Active Underlying Indicator */}
      <div className="flex items-center justify-between border-b border-[#1B253B] pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Pre-Trade Execution Desk
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Buyer vs Seller Sandbox Toggle */}
          <div className="flex items-center bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
            <button
              onClick={() => setDeskMode('BUYER')}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                deskMode === 'BUYER' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Option Buyer
            </button>
            <button
              onClick={() => setDeskMode('SELLER')}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                deskMode === 'SELLER' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Option Seller
            </button>
          </div>
        </div>
      </div>

      {/* Row 1: Segment, Underlying Index, Action */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Underlying Selector */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Underlying Index
          </label>
          <select
            value={underlying}
            onChange={(e) => setUnderlying(e.target.value)}
            className="w-full bg-[#070A11] border border-[#1B253B] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="NIFTY">NIFTY 50 (Lot: 25)</option>
            <option value="BANKNIFTY">BANKNIFTY (Lot: 15)</option>
            <option value="FINNIFTY">FINNIFTY (Lot: 25)</option>
            <option value="MIDCPNIFTY">MIDCPNIFTY (Lot: 50)</option>
            <option value="SENSEX">SENSEX (Lot: 10)</option>
          </select>
        </div>

        {/* Segment Toggle */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Segment
          </label>
          <div className="grid grid-cols-3 gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
            {(['OPTIONS', 'FUTURES', 'EQUITY'] as MarketSegment[]).map((seg) => (
              <button
                key={seg}
                onClick={() => setSegment(seg)}
                className={`py-1 text-[10px] font-semibold rounded transition-colors ${
                  segment === seg ? 'bg-[#1E293B] text-white border border-slate-600' : 'text-slate-400'
                }`}
              >
                {seg === 'OPTIONS' ? 'OPT' : seg === 'FUTURES' ? 'FUT' : 'EQ'}
              </button>
            ))}
          </div>
        </div>

        {/* Action Toggle (BUY / SELL) */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Action
          </label>
          <div className="grid grid-cols-2 gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
            <button
              onClick={() => setAction('BUY')}
              className={`py-1 text-[11px] font-bold rounded transition-colors ${
                action === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LONG / BUY
            </button>
            <button
              onClick={() => setAction('SELL')}
              className={`py-1 text-[11px] font-bold rounded transition-colors ${
                action === 'SELL'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SHORT / SELL
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: F&O Strike & Greeks Desk (Visible for Options) */}
      {segment === 'OPTIONS' && (
        <div className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#18233B] pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">Option Type:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setOptionType('CE')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    optionType === 'CE' ? 'bg-emerald-600 text-white' : 'bg-[#0F172A] text-slate-400'
                  }`}
                >
                  CALL (CE)
                </button>
                <button
                  onClick={() => setOptionType('PE')}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                    optionType === 'PE' ? 'bg-rose-600 text-white' : 'bg-[#0F172A] text-slate-400'
                  }`}
                >
                  PUT (PE)
                </button>
              </div>
            </div>

            {/* Strike Status Analyzer (ITM / ATM / OTM) */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase">Moneyness:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  strikeAnalysis.status === 'ATM'
                    ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                    : strikeAnalysis.status === 'ITM'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-amber-950 text-amber-300 border-amber-700'
                }`}
              >
                {strikeAnalysis.status} ({Math.abs(strikeAnalysis.distancePoints)} pts)
              </span>
            </div>
          </div>

          {/* Strike Controls & Quick Steps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-slate-400 block mb-1">
                Strike Price (Spot: {activeIndex.spotPrice.toLocaleString('en-IN')})
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setStrike((s) => s - activeIndex.strikeStep)}
                  className="px-2 py-1.5 bg-[#141C30] hover:bg-[#1C2845] rounded text-slate-300 border border-[#1B253B]"
                >
                  -{activeIndex.strikeStep}
                </button>
                <input
                  type="number"
                  step={activeIndex.strikeStep}
                  value={strike}
                  onChange={(e) => setStrike(Number(e.target.value))}
                  className="w-full bg-[#070A11] border border-[#1B253B] rounded px-2.5 py-1 text-center font-bold text-white text-xs"
                />
                <button
                  onClick={() => setStrike((s) => s + activeIndex.strikeStep)}
                  className="px-2 py-1.5 bg-[#141C30] hover:bg-[#1C2845] rounded text-slate-300 border border-[#1B253B]"
                >
                  +{activeIndex.strikeStep}
                </button>
              </div>
            </div>

            {/* Greeks Display */}
            <div className="bg-[#050810] p-2 rounded border border-[#151F33]">
              <span className="text-[10px] text-slate-500 block">Delta Exposure</span>
              <span className="font-semibold text-slate-200 tabular-nums">
                {greeks.delta > 0 ? '+' : ''}{greeks.delta.toFixed(2)}
              </span>
              <span className="text-[9px] text-slate-400 block">
                {sizing.normalizedUnits > 0 ? formatINR(greeksExposure.deltaExposure100pt) : '₹0'} / 100pt
              </span>
            </div>

            <div className="bg-[#050810] p-2 rounded border border-[#151F33]">
              <span className="text-[10px] text-slate-500 block">Theta Decay</span>
              <span className="font-semibold text-rose-400 tabular-nums">
                {greeks.theta.toFixed(1)} pts/day
              </span>
              <span className="text-[9px] text-slate-400 block">
                {sizing.normalizedUnits > 0 ? `-${formatINR(greeksExposure.thetaDailyDecayRupees)}/day` : '₹0'}
              </span>
            </div>
          </div>

          {/* Buyer vs Seller Specific Warnings */}
          {deskMode === 'BUYER' ? (
            <div className="text-[10px] text-amber-300/90 bg-amber-950/20 border border-amber-900/40 p-1.5 rounded flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>
                <strong>Option Buyer Risk:</strong> Theta decay will erode {formatINR(greeksExposure.thetaDailyDecayRupees || 120)} daily if underlying consolidates. Avoid holding overnight unless swing setup.
              </span>
            </div>
          ) : (
            <div className="text-[10px] text-rose-300/90 bg-rose-950/20 border border-rose-900/40 p-1.5 rounded flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>
                  <strong>Option Seller Desk:</strong> Estimated margin req: {formatINR(totalSellerMarginRequired || sellerMarginPerLot)}. Black Swan unlimited tail risk. Hard SL mandatory.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 3: Trading Style & Order Types (Regular, GTT OCO, AMO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Trading Style
          </label>
          <div className="grid grid-cols-3 gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
            {(['SCALP', 'INTRADAY', 'SWING'] as TradingStyle[]).map((st) => (
              <button
                key={st}
                onClick={() => setStyle(st)}
                className={`py-1 text-[10px] font-medium rounded transition-colors ${
                  style === st ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Order Protocol
          </label>
          <div className="grid grid-cols-3 gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
            {(['REGULAR_LIMIT', 'GTT_OCO', 'AMO'] as OrderType[]).map((ot) => (
              <button
                key={ot}
                onClick={() => setOrderType(ot)}
                className={`py-1 text-[10px] font-medium rounded transition-colors ${
                  orderType === ot ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ot === 'REGULAR_LIMIT' ? 'Regular' : ot === 'GTT_OCO' ? 'GTT (OCO)' : 'AMO'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Parameters: Entry, StopLoss, Target */}
      <div className="grid grid-cols-3 gap-2 bg-[#080D1A] p-2.5 rounded border border-[#18233B]">
        <div>
          <label className="text-[10px] text-slate-400 block mb-1">
            Entry Price (₹)
          </label>
          <input
            type="number"
            step="0.5"
            value={entryPrice}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            className="w-full bg-[#070A11] border border-[#1B253B] rounded px-2.5 py-1 text-slate-100 font-bold tabular-nums text-xs"
          />
        </div>

        <div>
          <label className="text-[10px] text-rose-400 block mb-1">
            Stop Loss (₹)
          </label>
          <input
            type="number"
            step="0.5"
            value={stopLossPrice}
            onChange={(e) => {
              const val = Number(e.target.value);
              setStopLossPrice(val);
              setGttStopTrigger(val);
            }}
            className="w-full bg-[#070A11] border border-rose-900/60 rounded px-2.5 py-1 text-rose-300 font-bold tabular-nums text-xs"
          />
        </div>

        <div>
          <label className="text-[10px] text-emerald-400 block mb-1">
            Target Price (₹)
          </label>
          <input
            type="number"
            step="0.5"
            value={targetPrice}
            onChange={(e) => {
              const val = Number(e.target.value);
              setTargetPrice(val);
              setGttTargetTrigger(val);
            }}
            className="w-full bg-[#070A11] border border-emerald-900/60 rounded px-2.5 py-1 text-emerald-300 font-bold tabular-nums text-xs"
          />
        </div>
      </div>

      {/* Trailing Stop Loss Engine */}
      <div className="bg-[#080D1A] p-2 rounded border border-[#18233B] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="trailingSlToggle"
            checked={useTrailingSL}
            onChange={(e) => setUseTrailingSL(e.target.checked)}
            className="rounded border-[#1B253B] bg-[#070A11] text-indigo-500 focus:ring-0"
          />
          <label htmlFor="trailingSlToggle" className="text-[11px] text-slate-300 cursor-pointer">
            Trailing SL Engine
          </label>
        </div>

        {useTrailingSL && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">Step:</span>
            {[5, 10, 20].map((step) => (
              <button
                key={step}
                onClick={() => setTrailingStep(step)}
                className={`px-2 py-0.5 rounded text-[10px] border ${
                  trailingStep === step
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-[#070A11] text-slate-400 border-[#1B253B]'
                }`}
              >
                ₹{step}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* GTT OCO Triggers Display when GTT selected */}
      {orderType === 'GTT_OCO' && (
        <div className="p-2 rounded bg-indigo-950/20 border border-indigo-900/40 text-[10px] flex items-center justify-between text-indigo-300">
          <span>GTT OCO Armed: SL Trigger @ ₹{gttStopTrigger} | Target Trigger @ ₹{gttTargetTrigger}</span>
          <span className="font-semibold text-emerald-400">Valid For 365 Days</span>
        </div>
      )}

      {/* Setup Pattern Tagging Engine */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
          Technical Setup / Price Pattern
        </label>
        <select
          value={pattern}
          onChange={(e) => setPattern(e.target.value as PricePattern)}
          className="w-full bg-[#070A11] border border-[#1B253B] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="SR_BREAKOUT">Support / Resistance Breakout + Retest</option>
          <option value="FALSE_TRAP_SWEEP">False Trap / Liquidity Sweep & Reversal</option>
          <option value="FVG_RETEST">Fair Value Gap (FVG) Retest</option>
          <option value="PIN_BAR_REJECTION">Pin Bar Rejection at Key Level</option>
          <option value="DOUBLE_BOTTOM">Double Bottom (W-Pattern) Base</option>
          <option value="HEAD_SHOULDERS">Head & Shoulders Breakdown</option>
          <option value="INSIDE_BAR">Inside Bar Mother-Candle Expansion</option>
        </select>
      </div>

      {/* Trap Warning Badge (if active) */}
      {trapWarning && (
        <div className="p-2 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[10px] flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
          <span>{trapWarning}</span>
        </div>
      )}

      {/* Psychology Pre-Check: Compulsory 5-State Mood Barometer */}
      <div className="border border-[#1B253B] rounded p-2.5 bg-[#080D1A]">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
            Pre-Trade Emotional Audit (Compulsory Gate)
          </label>
          <span className="text-[9px] text-slate-500">Affects Tilt Score</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
          {[
            { id: 'FLOW', label: '1. Flow', desc: 'Disciplined', style: 'text-emerald-400 border-emerald-800/60' },
            { id: 'FOMO', label: '2. FOMO', desc: 'Chasing', style: 'text-amber-400 border-amber-800/60' },
            { id: 'REVENGE', label: '3. Revenge', desc: 'Recovery', style: 'text-rose-400 border-rose-800/60' },
            { id: 'STRESSED', label: '4. Stress', desc: 'Depression', style: 'text-purple-400 border-purple-800/60' },
            { id: 'OVERCONFIDENT', label: '5. Cocky', desc: 'Overconfident', style: 'text-blue-400 border-blue-800/60' },
          ].map((m) => {
            const isSelected = mood === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMood(m.id as PreTradeMood)}
                className={`p-1.5 rounded border text-left transition-all ${
                  isSelected
                    ? 'bg-[#151D30] border-indigo-500 shadow-sm'
                    : 'bg-[#070A11] border-[#1B253B] text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className={`font-semibold text-[10px] ${m.style}`}>{m.label}</div>
                <div className="text-[9px] text-slate-500 truncate">{m.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Real-Time Calculated Risk Box */}
      <div className="bg-[#050810] border border-[#18233B] rounded p-3 flex flex-col gap-2.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#18233B] pb-1 flex items-center justify-between">
          <span>Mathematical Sizing & Gatekeeper</span>
          <span className="text-slate-500">Max Risk {account.riskPctPerTrade}%</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="bg-[#080D1A] p-2 rounded border border-[#1B253B]">
            <span className="text-[9px] text-slate-500 block">Sized Quantity</span>
            <span className="font-bold text-white text-xs tabular-nums">
              {sizing.lots} Lots ({sizing.normalizedUnits} units)
            </span>
          </div>

          <div className="bg-[#080D1A] p-2 rounded border border-[#1B253B]">
            <span className="text-[9px] text-slate-500 block">Capital At Risk</span>
            <span className="font-bold text-rose-400 text-xs tabular-nums">
              {formatINR(sizing.capitalAtRisk)}
            </span>
          </div>

          <div className="bg-[#080D1A] p-2 rounded border border-[#1B253B]">
            <span className="text-[9px] text-slate-500 block">Expected Reward</span>
            <span className="font-bold text-emerald-400 text-xs tabular-nums">
              {formatINR(sizing.normalizedUnits * rr.rewardPoints)}
            </span>
          </div>

          <div className="bg-[#080D1A] p-2 rounded border border-[#1B253B]">
            <span className="text-[9px] text-slate-500 block">Computed R:R</span>
            <span
              className={`font-bold text-xs tabular-nums ${
                rr.isOptimal ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              1 : {rr.ratio.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Break-Even Win Rate & Statutory Deductions */}
        <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 border-t border-[#18233B] pt-2">
          <span>
            Required Break-Even Win Rate: <strong className="text-slate-200">{rr.breakEvenWinRatePct}%</strong>
          </span>
          <span>
            Est. Brokerage & Taxes: <strong className="text-amber-300">{formatINR(estimatedTaxes.totalDeductions)}</strong>
          </span>
        </div>

        {/* Risk:Reward Gatekeeper Warning Badge */}
        {!rr.isOptimal && (
          <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[10px] flex items-center gap-1.5 font-bold animate-pulse">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{rr.rejectionMessage}</span>
          </div>
        )}
      </div>

      {/* Commit Action Button */}
      <button
        onClick={handleCommit}
        disabled={isCircuitBreakerActive || sizing.normalizedUnits <= 0}
        className={`w-full py-2.5 px-4 rounded font-bold text-xs flex items-center justify-center gap-2 transition-all ${
          isCircuitBreakerActive
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            : !rr.isOptimal || mood !== 'FLOW'
            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/30'
        }`}
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>
          {isCircuitBreakerActive
            ? 'CIRCUIT BREAKER ENGAGED - TRADING LOCKED'
            : sizing.normalizedUnits <= 0
            ? 'INVALID STOP LOSS / RISK PER SHARE'
            : !rr.isOptimal
            ? `OVERRIDE & COMMIT SUB-OPTIMAL TRADE (1:${rr.ratio})`
            : mood !== 'FLOW'
            ? `COMMIT TRADE WITH ${mood} FLAG`
            : `EXECUTE & LOG SYSTEM TRADE (${contractSymbol})`}
        </span>
      </button>
    </div>
  );
};
