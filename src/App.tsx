/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MarketRegimeBar } from './components/MarketRegimeBar';
import { PreTradeExecutionDesk } from './components/PreTradeExecutionDesk';
import { PsychologyAndRiskDesk } from './components/PsychologyAndRiskDesk';
import { ExecutionJournalLedger } from './components/ExecutionJournalLedger';
import { CircuitBreakerModal } from './components/CircuitBreakerModal';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { 
  INITIAL_INDICES, 
  INITIAL_MARKET_CONTEXT, 
  INITIAL_CONFLUENCE_TIMEFRAMES, 
  INITIAL_ACCOUNT_STATE, 
  INITIAL_TRADES 
} from './data/mockMarketData';
import { 
  TradeOrder, 
  AccountState, 
  MarketContextState, 
  ConfluenceTimeframe 
} from './types/trading';
import { 
  calculateTiltScore, 
  calculateIndianBrokerageAndTaxes 
} from './utils/calculations';
import { 
  playTargetHitSound, 
  playStopLossSound, 
  playCircuitBreakerSiren, 
  setSoundEnabled 
} from './utils/soundEffects';

export default function App() {
  const [account, setAccount] = useState<AccountState>(INITIAL_ACCOUNT_STATE);
  const [marketContext, setMarketContext] = useState<MarketContextState>(INITIAL_MARKET_CONTEXT);
  const [indices, setIndices] = useState(INITIAL_INDICES);
  const [confluenceTimeframes] = useState<ConfluenceTimeframe[]>(INITIAL_CONFLUENCE_TIMEFRAMES);
  const [trades, setTrades] = useState<TradeOrder[]>(INITIAL_TRADES);
  const [selectedUnderlying, setSelectedUnderlying] = useState<string>('NIFTY');
  
  const [activeTab, setActiveTab] = useState<string>('terminal');
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCircuitBreakerModalOpen, setIsCircuitBreakerModalOpen] = useState<boolean>(false);

  // Sync sound effect state
  useEffect(() => {
    setSoundEnabled(soundOn);
  }, [soundOn]);

  // Recalculate Tilt & Realized P&L whenever trades change
  const refreshAccountMetrics = useCallback((updatedTrades: TradeOrder[]) => {
    const closed = updatedTrades.filter((t) => t.status !== 'OPEN' && t.status !== 'AMO_PENDING');
    const realized = closed.reduce((acc, t) => acc + t.realizedPnL, 0);
    const totalBrokerage = closed.reduce((acc, t) => acc + t.brokerageAndTaxes, 0);

    // Sum avoidable losses: closed trades that lost money and were emotional (FOMO, Revenge, Stressed)
    const emotionalLosses = closed
      .filter((t) => t.isEmotionalTrade && t.realizedPnL < 0)
      .reduce((acc, t) => acc + Math.abs(t.realizedPnL), 0);

    // Calculate live tilt score
    const tiltResult = calculateTiltScore({
      trades: closed,
      currentMood: 'FLOW',
      currentRiskPct: account.riskPctPerTrade,
      maxRiskPct: 1.5,
    });

    const isBreached = realized <= -account.dailyMaxLossLimit;

    setAccount((prev) => ({
      ...prev,
      realizedPnL: realized,
      totalBrokerage,
      avoidableEmotionalLosses: emotionalLosses,
      tiltScore: tiltResult.score,
      isCircuitBreakerTripped: isBreached || prev.isCircuitBreakerTripped,
    }));

    if (isBreached) {
      setIsCircuitBreakerModalOpen(true);
      playCircuitBreakerSiren();
    }
  }, [account.dailyMaxLossLimit, account.riskPctPerTrade]);

  // Commit a new trade from Left Panel
  const handleCommitTrade = (newTrade: TradeOrder) => {
    const updated = [newTrade, ...trades];
    setTrades(updated);

    // If committed trade itself is emotional, adjust tilt immediately
    if (newTrade.isEmotionalTrade) {
      setAccount((prev) => ({
        ...prev,
        tiltScore: Math.max(10, prev.tiltScore - 15),
      }));
    }
  };

  // Simulation: Trigger Target Hit
  const handleTriggerTarget = (tradeId: string) => {
    playTargetHitSound();
    const updated = trades.map((t) => {
      if (t.id === tradeId) {
        const reward = t.expectedReward;
        const tax = calculateIndianBrokerageAndTaxes({
          buyPrice: t.entryPrice,
          sellPrice: t.targetPrice,
          quantity: t.quantity,
          segment: t.segment,
        });

        return {
          ...t,
          status: 'TARGET_HIT' as const,
          exitPrice: t.targetPrice,
          realizedPnL: reward,
          netPnL: reward - tax.totalDeductions,
          brokerageAndTaxes: tax.totalDeductions,
          executionGrade: t.mood === 'FLOW' ? ('A+' as const) : ('F' as const),
        };
      }
      return t;
    });

    setTrades(updated);
    refreshAccountMetrics(updated);
  };

  // Simulation: Trigger Stop Loss Hit
  const handleTriggerSL = (tradeId: string) => {
    playStopLossSound();
    const updated = trades.map((t) => {
      if (t.id === tradeId) {
        const loss = -t.capitalAtRisk;
        const tax = calculateIndianBrokerageAndTaxes({
          buyPrice: t.entryPrice,
          sellPrice: t.stopLossPrice,
          quantity: t.quantity,
          segment: t.segment,
        });

        return {
          ...t,
          status: 'SL_HIT' as const,
          exitPrice: t.stopLossPrice,
          realizedPnL: loss,
          netPnL: loss - tax.totalDeductions,
          brokerageAndTaxes: tax.totalDeductions,
          executionGrade: t.mood === 'FLOW' ? ('B' as const) : ('F' as const),
        };
      }
      return t;
    });

    setTrades(updated);
    refreshAccountMetrics(updated);
  };

  // Simulation: Trigger Trailing SL Hit
  const handleTriggerTrailingSL = (tradeId: string) => {
    playTargetHitSound();
    const updated = trades.map((t) => {
      if (t.id === tradeId) {
        // Trailing SL locked in positive partial points (e.g. entry + trailingStep)
        const exit = t.entryPrice + t.trailingStep;
        const gain = (exit - t.entryPrice) * t.quantity;
        const tax = calculateIndianBrokerageAndTaxes({
          buyPrice: t.entryPrice,
          sellPrice: exit,
          quantity: t.quantity,
          segment: t.segment,
        });

        return {
          ...t,
          status: 'TRAILING_SL_HIT' as const,
          exitPrice: exit,
          realizedPnL: gain,
          netPnL: gain - tax.totalDeductions,
          brokerageAndTaxes: tax.totalDeductions,
          executionGrade: 'A+' as const,
        };
      }
      return t;
    });

    setTrades(updated);
    refreshAccountMetrics(updated);
  };

  // Close Manual
  const handleCloseManual = (tradeId: string, exitPrice: number) => {
    const updated = trades.map((t) => {
      if (t.id === tradeId) {
        const pnl = (exitPrice - t.entryPrice) * t.quantity;
        const tax = calculateIndianBrokerageAndTaxes({
          buyPrice: t.entryPrice,
          sellPrice: exitPrice,
          quantity: t.quantity,
          segment: t.segment,
        });

        return {
          ...t,
          status: 'CLOSED_MANUAL' as const,
          exitPrice,
          realizedPnL: pnl,
          netPnL: pnl - tax.totalDeductions,
          brokerageAndTaxes: tax.totalDeductions,
          executionGrade: t.mood === 'FLOW' ? ('B' as const) : ('F' as const),
        };
      }
      return t;
    });

    setTrades(updated);
    refreshAccountMetrics(updated);
  };

  // Add Backtest Trade
  const handleAddBacktestTrade = (trade: TradeOrder) => {
    setTrades([trade, ...trades]);
  };

  // Update reflection notes
  const handleUpdateReflection = (tradeId: string, notes: string) => {
    setTrades(
      trades.map((t) => (t.id === tradeId ? { ...t, reflectionNotes: notes } : t))
    );
  };

  // Emergency Tilt Lockdown clicked
  const handleEmergencyLockdown = () => {
    setAccount((prev) => ({
      ...prev,
      isCircuitBreakerTripped: true,
      cooldownUntil: Date.now() + 4 * 60 * 60 * 1000,
      tiltScore: Math.min(30, prev.tiltScore),
    }));
    setIsCircuitBreakerModalOpen(true);
    playCircuitBreakerSiren();
  };

  // Unlock override
  const handleEmergencyOverride = () => {
    setAccount((prev) => ({
      ...prev,
      isCircuitBreakerTripped: false,
      cooldownUntil: null,
      tiltScore: 70, // restored to cautious
    }));
    setIsCircuitBreakerModalOpen(false);
  };

  // Reset Session
  const handleResetSession = () => {
    setAccount({
      ...INITIAL_ACCOUNT_STATE,
      realizedPnL: 0,
      avoidableEmotionalLosses: 0,
      tiltScore: 100,
      isCircuitBreakerTripped: false,
      cooldownUntil: null,
    });
    setTrades(INITIAL_TRADES);
    setIsCircuitBreakerModalOpen(false);
  };

  const isCircuitBreakerActive = account.isCircuitBreakerTripped || account.realizedPnL <= -account.dailyMaxLossLimit;

  return (
    <div className="min-h-screen bg-[#070A11] text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 1. Global Header */}
      <Header
        account={account}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onEmergencyLockdown={handleEmergencyLockdown}
        onOpenSettings={() => setIsSettingsOpen(true)}
        soundOn={soundOn}
        setSoundOn={setSoundOn}
      />

      {/* 2. Market Regime & Live Confluence Bar */}
      <MarketRegimeBar
        context={marketContext}
        setContext={setMarketContext}
        indices={indices}
        selectedUnderlying={selectedUnderlying}
        onSelectUnderlying={(sym) => setSelectedUnderlying(sym)}
      />

      {/* 3. Main Workspace Area */}
      <main className="flex-1 p-3 lg:p-5 max-w-[1720px] w-full mx-auto flex flex-col gap-4">
        {/* Main Split Terminal: Left Panel (Pre-Trade Execution) & Right Panel (Psychology Cockpit) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Panel: 7 Columns on Large Screens */}
          <div className="lg:col-span-7">
            <PreTradeExecutionDesk
              account={account}
              indices={indices}
              selectedUnderlying={selectedUnderlying}
              onCommitTrade={handleCommitTrade}
              isCircuitBreakerActive={isCircuitBreakerActive}
            />
          </div>

          {/* Right Panel: 5 Columns on Large Screens */}
          <div className="lg:col-span-5">
            <PsychologyAndRiskDesk
              account={account}
              trades={trades}
              confluenceTimeframes={confluenceTimeframes}
            />
          </div>
        </div>

        {/* 4. Bottom Panel: Deep Journal & Statistical Ledger */}
        <div className="w-full">
          <ExecutionJournalLedger
            trades={trades}
            onTriggerTarget={handleTriggerTarget}
            onTriggerSL={handleTriggerSL}
            onTriggerTrailingSL={handleTriggerTrailingSL}
            onCloseManual={handleCloseManual}
            onAddBacktestTrade={handleAddBacktestTrade}
            onUpdateReflection={handleUpdateReflection}
          />
        </div>
      </main>

      {/* Behavioral Circuit Breaker Emergency Strobe Modal */}
      <CircuitBreakerModal
        isOpen={isCircuitBreakerModalOpen}
        realizedPnL={account.realizedPnL}
        dailyMaxLossLimit={account.dailyMaxLossLimit}
        cooldownUntil={account.cooldownUntil}
        onResetCooldown={handleEmergencyOverride}
        onEmergencyOverride={handleEmergencyOverride}
      />

      {/* Risk Configuration Settings Modal */}
      <AccountSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        account={account}
        onSaveAccount={(updated) => setAccount((prev) => ({ ...prev, ...updated }))}
        onResetSession={handleResetSession}
      />
    </div>
  );
}
