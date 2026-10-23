import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  Filter, 
  Download, 
  Sparkles,
  MessageSquare,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { TradeOrder, ExecutionGrade, PreTradeMood } from '../types/trading';
import { formatINR, calculateIndianBrokerageAndTaxes } from '../utils/calculations';

interface ExecutionJournalLedgerProps {
  trades: TradeOrder[];
  onTriggerTarget: (tradeId: string) => void;
  onTriggerSL: (tradeId: string) => void;
  onTriggerTrailingSL: (tradeId: string) => void;
  onCloseManual: (tradeId: string, exitPrice: number) => void;
  onAddBacktestTrade: (trade: TradeOrder) => void;
  onUpdateReflection: (tradeId: string, notes: string) => void;
}

export const ExecutionJournalLedger: React.FC<ExecutionJournalLedgerProps> = ({
  trades,
  onTriggerTarget,
  onTriggerSL,
  onTriggerTrailingSL,
  onCloseManual,
  onAddBacktestTrade,
  onUpdateReflection,
}) => {
  const [activeTab, setActiveTab] = useState<'JOURNAL' | 'BACKTEST' | 'EMOTIONS' | 'TAXES'>('JOURNAL');
  const [filterMood, setFilterMood] = useState<string>('ALL');
  const [selectedTradeForReflection, setSelectedTradeForReflection] = useState<TradeOrder | null>(null);
  const [reflectionInput, setReflectionInput] = useState<string>('');

  // Performance Matrix calculations
  const closedTrades = trades.filter((t) => t.status !== 'OPEN' && t.status !== 'AMO_PENDING');
  const totalRealizedPnL = closedTrades.reduce((acc, t) => acc + t.realizedPnL, 0);
  const totalNetPnL = closedTrades.reduce((acc, t) => acc + t.netPnL, 0);
  const totalBrokerage = closedTrades.reduce((acc, t) => acc + t.brokerageAndTaxes, 0);

  const winningTrades = closedTrades.filter((t) => t.realizedPnL > 0);
  const losingTrades = closedTrades.filter((t) => t.realizedPnL < 0);

  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  
  const grossProfits = winningTrades.reduce((acc, t) => acc + t.realizedPnL, 0);
  const grossLosses = Math.abs(losingTrades.reduce((acc, t) => acc + t.realizedPnL, 0));
  const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : grossProfits > 0 ? '∞' : '0.00';

  const avgWin = winningTrades.length > 0 ? grossProfits / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLosses / losingTrades.length : 0;
  const expectancyScore = closedTrades.length > 0 
    ? (((winRate / 100) * avgWin) - (((100 - winRate) / 100) * avgLoss)).toFixed(0)
    : '0';

  // Filtered rows for the journal
  const displayedTrades = trades.filter((t) => {
    if (activeTab === 'BACKTEST') return t.isBacktest === true;
    if (activeTab === 'JOURNAL') return !t.isBacktest;
    if (filterMood !== 'ALL') return t.mood === filterMood;
    return true;
  });

  const getGradeStyle = (grade: ExecutionGrade) => {
    if (grade === 'A+') return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
    if (grade === 'B') return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80';
    return 'bg-rose-950/80 text-rose-300 border-rose-700/80';
  };

  const getMoodStyle = (mood: PreTradeMood) => {
    if (mood === 'FLOW') return 'text-emerald-400';
    if (mood === 'FOMO') return 'text-amber-400';
    if (mood === 'REVENGE') return 'text-rose-400';
    if (mood === 'STRESSED') return 'text-purple-400';
    return 'text-blue-400';
  };

  const handleOpenReflectionModal = (trade: TradeOrder) => {
    setSelectedTradeForReflection(trade);
    setReflectionInput(trade.reflectionNotes || '');
  };

  const handleSaveReflection = () => {
    if (selectedTradeForReflection) {
      onUpdateReflection(selectedTradeForReflection.id, reflectionInput);
      setSelectedTradeForReflection(null);
    }
  };

  return (
    <div className="bg-[#0D1322] border border-[#1B253B] rounded-lg p-4 flex flex-col gap-4 text-xs font-mono">
      {/* Tab Bar & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1B253B] pb-3">
        <div className="flex items-center gap-1 bg-[#070A11] p-0.5 rounded border border-[#1B253B]">
          <button
            onClick={() => setActiveTab('JOURNAL')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'JOURNAL' ? 'bg-[#151D30] text-indigo-300 border border-[#233252]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Today's Execution Journal ({trades.filter((t) => !t.isBacktest).length})
          </button>
          <button
            onClick={() => setActiveTab('EMOTIONS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'EMOTIONS' ? 'bg-[#151D30] text-indigo-300 border border-[#233252]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Emotional Audit & Reflections
          </button>
          <button
            onClick={() => setActiveTab('TAXES')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'TAXES' ? 'bg-[#151D30] text-indigo-300 border border-[#233252]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            F&O Taxes & Brokerage Breakdown
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase">Filter Mood:</span>
          <select
            value={filterMood}
            onChange={(e) => setFilterMood(e.target.value)}
            className="bg-[#070A11] border border-[#1B253B] rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Moods</option>
            <option value="FLOW">Disciplined Flow</option>
            <option value="FOMO">FOMO / Chasing</option>
            <option value="REVENGE">Revenge / Recovery</option>
            <option value="STRESSED">Stressed / Burnout</option>
          </select>
        </div>
      </div>

      {/* Performance Matrix Bar (Tabular Rigor) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#080D1A] p-3 rounded border border-[#18233B] text-center">
        <div>
          <span className="text-[10px] text-slate-500 block uppercase">Realized Gross P&L</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              totalRealizedPnL > 0 ? 'text-emerald-400' : totalRealizedPnL < 0 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {formatINR(totalRealizedPnL)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block uppercase">Net P&L (Post-Tax)</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              totalNetPnL > 0 ? 'text-emerald-400' : totalNetPnL < 0 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {formatINR(totalNetPnL)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block uppercase">Win Rate %</span>
          <span className="text-sm font-bold text-white tabular-nums">
            {winRate.toFixed(1)}%
          </span>
          <span className="text-[9px] text-slate-500 block">
            {winningTrades.length}W / {losingTrades.length}L
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block uppercase">Profit Factor</span>
          <span className="text-sm font-bold text-indigo-300 tabular-nums">
            {profitFactor}
          </span>
          <span className="text-[9px] text-slate-500 block">
            ₹{grossProfits.toLocaleString()} / ₹{grossLosses.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block uppercase">Expectancy Score</span>
          <span
            className={`text-sm font-bold tabular-nums ${
              Number(expectancyScore) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {Number(expectancyScore) >= 0 ? '+' : ''}{formatINR(Number(expectancyScore))} / trd
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block uppercase">Total Brokerage</span>
          <span className="text-sm font-bold text-amber-300 tabular-nums">
            {formatINR(totalBrokerage)}
          </span>
        </div>
      </div>

      {/* Main View According to Active Tab */}
      {activeTab === 'JOURNAL' && (
        <div className="overflow-x-auto border border-[#18233B] rounded">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#080D1A] text-slate-400 border-b border-[#18233B] text-[10px] uppercase">
                <th className="p-2.5">Time</th>
                <th className="p-2.5">Symbol</th>
                <th className="p-2.5">Style / Type</th>
                <th className="p-2.5">Setup / Pattern</th>
                <th className="p-2.5 text-right">Entry</th>
                <th className="p-2.5 text-right">SL / Target</th>
                <th className="p-2.5 text-right">Lots/Qty</th>
                <th className="p-2.5 text-right">P&L (₹)</th>
                <th className="p-2.5 text-center">R:R</th>
                <th className="p-2.5 text-center">Mood</th>
                <th className="p-2.5 text-center">Grade</th>
                <th className="p-2.5 text-center">Simulation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18233B]">
              {displayedTrades.map((t) => {
                const isOpen = t.status === 'OPEN';
                const isAmo = t.status === 'AMO_PENDING';

                return (
                  <tr key={t.id} className="hover:bg-[#111A2E] transition-colors">
                    <td className="p-2.5 text-slate-400 tabular-nums">{t.timestamp}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-white">{t.symbol}</div>
                      <div className="text-[10px] text-slate-500">
                        {t.segment} · {t.strikeStatus || 'SPOT'}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className="text-slate-300 font-medium">{t.style}</span>
                      <div className="text-[9px] text-slate-500">{t.orderType}</div>
                    </td>
                    <td className="p-2.5">
                      <span className="text-indigo-300 font-semibold">{t.setupPattern}</span>
                      {t.trapWarning && (
                        <div className="text-[8px] text-amber-400 truncate max-w-[140px]" title={t.trapWarning}>
                          ⚠ {t.trapWarning}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-bold text-white tabular-nums">
                      ₹{t.entryPrice.toFixed(1)}
                    </td>
                    <td className="p-2.5 text-right tabular-nums">
                      <span className="text-rose-400">₹{t.stopLossPrice.toFixed(1)}</span>
                      <span className="text-slate-600 mx-1">/</span>
                      <span className="text-emerald-400">₹{t.targetPrice.toFixed(1)}</span>
                    </td>
                    <td className="p-2.5 text-right tabular-nums font-semibold text-slate-200">
                      {t.lots}L ({t.quantity}u)
                    </td>
                    <td className="p-2.5 text-right tabular-nums font-bold">
                      {isOpen ? (
                        <span className="text-indigo-400 animate-pulse">ACTIVE LIVE</span>
                      ) : isAmo ? (
                        <span className="text-amber-400">QUEUED</span>
                      ) : (
                        <div>
                          <div className={t.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.realizedPnL >= 0 ? '+' : ''}{formatINR(t.realizedPnL)}
                          </div>
                          <div className="text-[9px] text-slate-500 font-normal">
                            Net: {formatINR(t.netPnL)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center tabular-nums">
                      <span
                        className={`font-semibold ${
                          t.riskRewardRatio >= 1.5 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        1:{t.riskRewardRatio.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`font-semibold ${getMoodStyle(t.mood)}`}>
                        {t.mood}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getGradeStyle(t.executionGrade)}`}>
                        {t.executionGrade}
                      </span>
                    </td>
                    {/* Interactive Simulation Controls */}
                    <td className="p-2.5 text-center">
                      {isOpen ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onTriggerTarget(t.id)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] shadow-sm"
                            title="Simulate Price Reaching Target"
                          >
                            Target (+)
                          </button>
                          <button
                            onClick={() => onTriggerSL(t.id)}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-[10px] shadow-sm"
                            title="Simulate Stop Loss Trigger"
                          >
                            SL (-)
                          </button>
                          {t.useTrailingSL && (
                            <button
                              onClick={() => onTriggerTrailingSL(t.id)}
                              className="px-1.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-[9px]"
                              title="Simulate Trailing Stop-Loss Hit"
                            >
                              Trail SL
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenReflectionModal(t)}
                          className="px-2 py-1 bg-[#151D30] hover:bg-[#1E293B] text-slate-300 rounded border border-[#233252] text-[10px] flex items-center gap-1 mx-auto"
                        >
                          <MessageSquare className="w-3 h-3 text-indigo-400" />
                          <span>Audit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Emotional Audit & Reflection */}
      {activeTab === 'EMOTIONS' && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded flex items-center justify-between text-indigo-200">
            <div>
              <strong>Behavioral Discipline Ledger</strong>: Institutional trading is won by emotional consistency.
              Review how your emotional state impacted outcome quality.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {trades.map((t) => (
              <div key={t.id} className="bg-[#080D1A] border border-[#18233B] rounded p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#18233B] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{t.symbol}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getGradeStyle(t.executionGrade)}`}>
                      Grade: {t.executionGrade}
                    </span>
                  </div>
                  <span className={`font-semibold ${getMoodStyle(t.mood)}`}>
                    Mood: {t.mood}
                  </span>
                </div>

                <div className="text-[11px] text-slate-300 leading-relaxed italic bg-[#050810] p-2 rounded border border-[#151F33]">
                  "{t.reflectionNotes || 'No reflection recorded yet.'}"
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>P&L: <strong className={t.realizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatINR(t.realizedPnL)}</strong></span>
                  <span>Rules Followed: <strong className={t.followedRules ? 'text-emerald-400' : 'text-rose-400'}>{t.followedRules ? 'YES' : 'NO'}</strong></span>
                  <button
                    onClick={() => handleOpenReflectionModal(t)}
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Edit Reflection
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Indian Statutory F&O Taxes & Brokerage Breakdown */}
      {activeTab === 'TAXES' && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-[#080D1A] border border-[#18233B] rounded">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              Indian Derivatives Statutory Charges & Friction Model (NSE/BSE)
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Every trade incurs mandatory exchange and government charges. Risknook deducts these automatically from gross P&L:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
              <div className="bg-[#050810] p-2 rounded border border-[#18233B]">
                <span className="text-slate-500 block">Brokerage (Buy + Sell)</span>
                <span className="font-bold text-slate-200">₹40 flat (₹20/exec order)</span>
              </div>
              <div className="bg-[#050810] p-2 rounded border border-[#18233B]">
                <span className="text-slate-500 block">STT (Securities Txn Tax)</span>
                <span className="font-bold text-slate-200">0.0625% on sell premium</span>
              </div>
              <div className="bg-[#050810] p-2 rounded border border-[#18233B]">
                <span className="text-slate-500 block">NSE Transaction Fee</span>
                <span className="font-bold text-slate-200">0.05% on total turnover</span>
              </div>
              <div className="bg-[#050810] p-2 rounded border border-[#18233B]">
                <span className="text-slate-500 block">GST on Services</span>
                <span className="font-bold text-slate-200">18% on Brokerage & Txn fee</span>
              </div>
              <div className="bg-[#050810] p-2 rounded border border-[#18233B]">
                <span className="text-slate-500 block">SEBI Charges</span>
                <span className="font-bold text-slate-200">₹10 per crore</span>
              </div>
              <div className="bg-[#050810] p-2 rounded border border-[#18233B]">
                <span className="text-slate-500 block">Stamp Duty (Buy leg)</span>
                <span className="font-bold text-slate-200">0.003%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reflection Edit Modal */}
      {selectedTradeForReflection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0D1322] border border-[#1B253B] rounded-lg max-w-lg w-full p-4 flex flex-col gap-3 font-mono shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1B253B] pb-2">
              <span className="font-bold text-white text-sm">
                Post-Trade Reflection: {selectedTradeForReflection.symbol}
              </span>
              <button
                onClick={() => setSelectedTradeForReflection(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">
                "Did I execute the plan or did emotion rule me? Key lessons:"
              </label>
              <textarea
                value={reflectionInput}
                onChange={(e) => setReflectionInput(e.target.value)}
                rows={4}
                placeholder="Log honesty here. Did you size properly? Did you wait for candle close?"
                className="w-full bg-[#070A11] border border-[#1B253B] rounded p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1B253B]">
              <button
                onClick={() => setSelectedTradeForReflection(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReflection}
                className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 font-bold text-xs"
              >
                Save Reflection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
