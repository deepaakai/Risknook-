/**
 * Risknook Institutional Trading Workstation - Domain Data Models & Enums
 * 59-Point Quantitative & Psychological Trading Engine Architecture
 */

export type MarketSegment = 'EQUITY' | 'FUTURES' | 'OPTIONS';

export type TradingStyle = 'SCALP' | 'INTRADAY' | 'BTST' | 'STBT' | 'SWING' | 'POSITIONAL';

export type OrderType = 'REGULAR_MARKET' | 'REGULAR_LIMIT' | 'GTT_OCO' | 'AMO';

export type OptionType = 'CE' | 'PE';

export type StrikeStatus = 'ITM' | 'ATM' | 'OTM';

export type BuildupType = 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING';

export type MarketRegime = 'BULL_TREND' | 'BEAR_TREND' | 'SIDEWAYS_CHOP';

export type ChartMode = 'CANDLESTICK' | 'HEIKIN_ASHI' | 'OHLC';

export type PricePattern = 
  | 'SR_BREAKOUT'
  | 'FALSE_TRAP_SWEEP'
  | 'HEAD_SHOULDERS'
  | 'DOUBLE_BOTTOM'
  | 'PIN_BAR_REJECTION'
  | 'INSIDE_BAR'
  | 'FVG_RETEST';

export type PreTradeMood = 
  | 'FLOW' 
  | 'FOMO' 
  | 'REVENGE' 
  | 'STRESSED' 
  | 'OVERCONFIDENT';

export type ExecutionGrade = 'A+' | 'B' | 'F';

export type TradeStatus = 'OPEN' | 'TARGET_HIT' | 'SL_HIT' | 'TRAILING_SL_HIT' | 'CLOSED_MANUAL' | 'AMO_PENDING';

export interface UnderlyingIndex {
  symbol: string;
  name: string;
  lotSize: number;
  spotPrice: number;
  strikeStep: number;
  change: number;
  changePct: number;
}

export interface OptionGreeks {
  delta: number;      // e.g. 0.54
  theta: number;      // e.g. -14.2 (points/day)
  gamma: number;      // e.g. 0.0025
  vega: number;       // e.g. 8.1
  iv: number;         // e.g. 15.2%
  beta: number;       // e.g. 1.15 relative to NIFTY
}

export interface ConfluenceTimeframe {
  tf: '1m/3m' | '5m/15m' | '1h/Daily' | 'Weekly';
  label: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  emaStatus: 'ABOVE_20EMA' | 'BELOW_20EMA' | 'CHOP';
}

export interface TradeOrder {
  id: string;
  timestamp: string;
  timestampEpoch: number;
  symbol: string;
  underlying: string;
  segment: MarketSegment;
  style: TradingStyle;
  orderType: OrderType;
  action: 'BUY' | 'SELL';
  optionType?: OptionType;
  strike?: number;
  strikeStatus?: StrikeStatus;
  
  // Prices
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  currentPrice: number;
  exitPrice?: number;
  
  // Trailing SL
  useTrailingSL: boolean;
  trailingStep: number;
  trailingSLTriggerPrice?: number;
  
  // GTT OCO triggers
  gttStopTrigger?: number;
  gttTargetTrigger?: number;
  
  // Sizing & Risk
  lots: number;
  quantity: number;
  capitalAtRisk: number;
  expectedReward: number;
  riskRewardRatio: number;
  breakEvenWinRate: number;
  
  // Derivatives Greeks
  greeks: OptionGreeks;
  buildup: BuildupType;
  trapWarning?: string;
  
  // Psychology & Audit
  mood: PreTradeMood;
  setupPattern: PricePattern;
  status: TradeStatus;
  realizedPnL: number;
  netPnL: number; // after taxes & brokerage
  brokerageAndTaxes: number;
  executionGrade: ExecutionGrade;
  isEmotionalTrade: boolean;
  
  // Post-trade reflection notes
  reflectionNotes?: string;
  followedRules: boolean;
  isBacktest?: boolean;
}

export interface AccountState {
  totalCapital: number;
  dailyMaxLossLimit: number;
  riskPctPerTrade: number;
  realizedPnL: number;
  unrealizedPnL: number;
  totalBrokerage: number;
  isCircuitBreakerTripped: boolean;
  cooldownUntil: number | null; // epoch ms
  tiltScore: number; // 0 to 100
  avoidableEmotionalLosses: number;
  tradesTodayCount: number;
  recentTradesTimestamps: number[]; // for overtrading check (last 30 mins)
}

export interface MarketContextState {
  regime: MarketRegime;
  indiaVix: number;
  vixBand: 'LOW' | 'SAFE' | 'DANGER';
  giftNiftyChange: number;
  pcr: number;
  pcrSentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  rvol: number; // relative volume
  niftySpot: number;
  bankNiftySpot: number;
  sensexSpot: number;
  finniftySpot: number;
}
