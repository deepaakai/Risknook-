/**
 * Risknook Institutional Risk & Mathematical Calculations Engine
 * Real reactive formulas for F&O, capital sizing, Greeks, statutory taxes, and behavioral tilt.
 */

import { PreTradeMood, ExecutionGrade, StrikeStatus, OptionType, BuildupType } from '../types/trading';

// Recognized Indian Indices & default lot sizes
export const LOT_SIZES: Record<string, number> = {
  NIFTY: 25,
  BANKNIFTY: 15,
  FINNIFTY: 25,
  MIDCPNIFTY: 50,
  SENSEX: 10,
  BANKEX: 15,
};

/**
 * 1. Dynamic Capital Sizing Engine
 * Position = Floor((Total_Capital * (Risk_Pct / 100)) / Abs(Entry - StopLoss))
 * Then normalized to whole contract lots.
 */
export function calculatePositionSize({
  capital,
  riskPct,
  entry,
  stopLoss,
  lotSize,
}: {
  capital: number;
  riskPct: number;
  entry: number;
  stopLoss: number;
  lotSize: number;
}): {
  rawUnits: number;
  lots: number;
  normalizedUnits: number;
  capitalAtRisk: number;
  riskPerShare: number;
} {
  const riskPerShare = Math.abs(entry - stopLoss);
  if (riskPerShare <= 0 || capital <= 0 || riskPct <= 0) {
    return {
      rawUnits: 0,
      lots: 0,
      normalizedUnits: 0,
      capitalAtRisk: 0,
      riskPerShare: 0,
    };
  }

  const maxAllowedRiskRupees = capital * (riskPct / 100);
  const rawUnits = Math.floor(maxAllowedRiskRupees / riskPerShare);
  
  // Normalize to integer multiple of lot size (Floor)
  // If rawUnits < lotSize, floor is 0 lots, but we also indicate minimum 1 lot risk
  const lots = Math.max(0, Math.floor(rawUnits / lotSize));
  const normalizedUnits = lots * lotSize;
  const capitalAtRisk = normalizedUnits * riskPerShare;

  return {
    rawUnits,
    lots,
    normalizedUnits,
    capitalAtRisk,
    riskPerShare,
  };
}

/**
 * 2. Risk:Reward Gatekeeper & Break-Even Win Rate Engine
 * Gatekeeper criteria: Target - Entry < 1.5 * (Entry - SL) triggers REJECT
 */
export function calculateRiskReward({
  entry,
  stopLoss,
  target,
  action = 'BUY',
}: {
  entry: number;
  stopLoss: number;
  target: number;
  action?: 'BUY' | 'SELL';
}): {
  riskPoints: number;
  rewardPoints: number;
  ratio: number;
  isOptimal: boolean;
  breakEvenWinRatePct: number;
  rejectionMessage: string | null;
} {
  const riskPoints = action === 'BUY' ? Math.max(0, entry - stopLoss) : Math.max(0, stopLoss - entry);
  const rewardPoints = action === 'BUY' ? Math.max(0, target - entry) : Math.max(0, entry - target);

  if (riskPoints <= 0) {
    return {
      riskPoints: 0,
      rewardPoints,
      ratio: 0,
      isOptimal: false,
      breakEvenWinRatePct: 100,
      rejectionMessage: 'INVALID STOP LOSS: Must be lower than Entry for Longs',
    };
  }

  const ratio = Number((rewardPoints / riskPoints).toFixed(2));
  const isOptimal = ratio >= 1.5;
  const breakEvenWinRatePct = ratio > 0 ? Number(((1 / (1 + ratio)) * 100).toFixed(1)) : 100;

  let rejectionMessage: string | null = null;
  if (!isOptimal) {
    rejectionMessage = `REJECT: SUB-OPTIMAL R:R (1:${ratio}). Required: >= 1:1.50`;
  }

  return {
    riskPoints,
    rewardPoints,
    ratio,
    isOptimal,
    breakEvenWinRatePct,
    rejectionMessage,
  };
}

/**
 * 3. Strike Status Analyzer (ITM / ATM / OTM)
 */
export function analyzeStrikeStatus(
  spotPrice: number,
  strike: number,
  type: OptionType,
  strikeStep: number = 50
): {
  status: StrikeStatus;
  distancePoints: number;
  moneynessPct: number;
} {
  const distancePoints = strike - spotPrice;
  const moneynessPct = Number((((strike - spotPrice) / spotPrice) * 100).toFixed(2));
  const halfStep = strikeStep / 2;

  if (Math.abs(distancePoints) <= halfStep) {
    return { status: 'ATM', distancePoints, moneynessPct };
  }

  if (type === 'CE') {
    // For Calls: Strike < Spot is ITM; Strike > Spot is OTM
    return {
      status: strike < spotPrice ? 'ITM' : 'OTM',
      distancePoints,
      moneynessPct,
    };
  } else {
    // For Puts: Strike > Spot is ITM; Strike < Spot is OTM
    return {
      status: strike > spotPrice ? 'ITM' : 'OTM',
      distancePoints,
      moneynessPct,
    };
  }
}

/**
 * 4. Greeks Risk Desk Calculations
 * - Delta ₹ Exposure per 100 pt move = Delta * Quantity * 100
 * - Theta Decay per day = Theta * Quantity (in ₹)
 */
export function calculateGreeksExposure({
  delta,
  theta,
  quantity,
}: {
  delta: number;
  theta: number;
  quantity: number;
}): {
  deltaExposure100pt: number;
  thetaDailyDecayRupees: number;
} {
  const deltaExposure100pt = Number((delta * quantity * 100).toFixed(0));
  const thetaDailyDecayRupees = Number((Math.abs(theta) * quantity).toFixed(0));

  return {
    deltaExposure100pt,
    thetaDailyDecayRupees,
  };
}

/**
 * 5. Open Interest Buildup Engine & Trap Radar
 */
export function detectBuildup(
  priceChange: number,
  oiChange: number
): {
  buildup: BuildupType;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  description: string;
} {
  if (priceChange >= 0 && oiChange >= 0) {
    return {
      buildup: 'LONG_BUILDUP',
      sentiment: 'BULLISH',
      description: 'Price ↑ & OI ↑: Aggressive long positions added by institutional desks.',
    };
  }
  if (priceChange < 0 && oiChange >= 0) {
    return {
      buildup: 'SHORT_BUILDUP',
      sentiment: 'BEARISH',
      description: 'Price ↓ & OI ↑: Aggressive short selling, call writing pressure building.',
    };
  }
  if (priceChange >= 0 && oiChange < 0) {
    return {
      buildup: 'SHORT_COVERING',
      sentiment: 'BULLISH',
      description: 'Price ↑ & OI ↓: Shorts forced to cover, sharp short squeeze rally.',
    };
  }
  return {
    buildup: 'LONG_UNWINDING',
    sentiment: 'BEARISH',
    description: 'Price ↓ & OI ↓: Longs closing positions due to lack of follow-through.',
  };
}

/**
 * 6. Behavioral Tilt Score Algorithm (0 to 100)
 * Starts at 100.
 * -20 for Revenge trade
 * -15 for FOMO trade
 * -10 for breaking max risk %
 * -15 for taking >5 trades in 30 minutes (Overtrading)
 * -10 for Stressed/Depressed trade
 */
export function calculateTiltScore({
  trades,
  currentMood,
  currentRiskPct,
  maxRiskPct = 1.5,
}: {
  trades: Array<{ mood: PreTradeMood; timestampEpoch: number; capitalAtRisk: number }>;
  currentMood: PreTradeMood;
  currentRiskPct: number;
  maxRiskPct?: number;
}): {
  score: number;
  level: 'ZEN' | 'CAUTION' | 'TILTED' | 'DANGER';
  deductions: Array<{ reason: string; points: number }>;
  tradesInLast30m: number;
} {
  let score = 100;
  const deductions: Array<{ reason: string; points: number }> = [];

  // Check recent trades (last 30 minutes)
  const now = Date.now();
  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  const recentTrades = trades.filter((t) => t.timestampEpoch >= thirtyMinutesAgo);
  const tradesInLast30m = recentTrades.length;

  // Deductions from current pending trade configuration
  if (currentMood === 'REVENGE') {
    deductions.push({ reason: 'Revenge Trade Tagged', points: 20 });
    score -= 20;
  } else if (currentMood === 'FOMO') {
    deductions.push({ reason: 'FOMO / Chasing Setup Tagged', points: 15 });
    score -= 15;
  } else if (currentMood === 'STRESSED') {
    deductions.push({ reason: 'Stressed / Burnout Trading State', points: 10 });
    score -= 10;
  } else if (currentMood === 'OVERCONFIDENT') {
    deductions.push({ reason: 'Overconfidence Bias Warning', points: 5 });
    score -= 5;
  }

  // Risk % breach
  if (currentRiskPct > maxRiskPct) {
    const penalty = 10;
    deductions.push({ reason: `Risk (${currentRiskPct}%) exceeds max threshold (${maxRiskPct}%)`, points: penalty });
    score -= penalty;
  }

  // Overtrading in historical session
  if (tradesInLast30m >= 5) {
    const penalty = 15;
    deductions.push({ reason: `High-frequency overtrading (>5 trades in 30m: ${tradesInLast30m})`, points: penalty });
    score -= penalty;
  }

  // Accumulated historical emotional trades in current session
  const fomoCount = trades.filter((t) => t.mood === 'FOMO').length;
  const revengeCount = trades.filter((t) => t.mood === 'REVENGE').length;
  if (revengeCount > 0) {
    const penalty = Math.min(30, revengeCount * 15);
    deductions.push({ reason: `Previous ${revengeCount} revenge trades in session`, points: penalty });
    score -= penalty;
  }
  if (fomoCount > 0) {
    const penalty = Math.min(25, fomoCount * 10);
    deductions.push({ reason: `Previous ${fomoCount} FOMO trades in session`, points: penalty });
    score -= penalty;
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let level: 'ZEN' | 'CAUTION' | 'TILTED' | 'DANGER' = 'ZEN';
  if (finalScore >= 80) level = 'ZEN';
  else if (finalScore >= 60) level = 'CAUTION';
  else if (finalScore >= 40) level = 'TILTED';
  else level = 'DANGER';

  return {
    score: finalScore,
    level,
    deductions,
    tradesInLast30m,
  };
}

/**
 * 7. Indian Statutory F&O Brokerage & Taxes Calculator
 * Accurately models Zerodha/NSE/BSE Indian derivatives fee structure
 */
export function calculateIndianBrokerageAndTaxes({
  buyPrice,
  sellPrice,
  quantity,
  segment = 'OPTIONS',
}: {
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  segment?: 'EQUITY' | 'FUTURES' | 'OPTIONS';
}): {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiCharges: number;
  stampDuty: number;
  gst: number;
  totalDeductions: number;
} {
  const buyTurnover = buyPrice * quantity;
  const sellTurnover = sellPrice * quantity;
  const totalTurnover = buyTurnover + sellTurnover;

  // Standard discount broker ₹20 per executed order (Buy + Sell = 2 orders = ₹40)
  const brokerage = 40;

  let stt = 0;
  if (segment === 'OPTIONS') {
    // 0.0625% on sell turnover (options premium)
    stt = Math.round(sellTurnover * 0.000625);
  } else if (segment === 'FUTURES') {
    // 0.02% on sell turnover
    stt = Math.round(sellTurnover * 0.0002);
  } else {
    // Equity Intraday 0.025% on sell turnover
    stt = Math.round(sellTurnover * 0.00025);
  }

  // NSE / BSE Exchange Transaction Charges: 0.05% approx on premium
  const exchangeCharges = Number((totalTurnover * 0.0005).toFixed(2));

  // SEBI turnover charges: ₹10 per crore (0.0001%)
  const sebiCharges = Number((totalTurnover * 0.000001).toFixed(2));

  // Stamp Duty (on buy leg only): 0.003% for Options
  const stampDuty = Number((buyTurnover * 0.00003).toFixed(2));

  // GST 18% on (Brokerage + Exchange Charges + SEBI Charges)
  const taxableServices = brokerage + exchangeCharges + sebiCharges;
  const gst = Number((taxableServices * 0.18).toFixed(2));

  const totalDeductions = Number((brokerage + stt + exchangeCharges + sebiCharges + stampDuty + gst).toFixed(2));

  return {
    brokerage,
    stt,
    exchangeCharges,
    sebiCharges,
    stampDuty,
    gst,
    totalDeductions,
  };
}

/**
 * 8. Trade Quality Grade
 * A+: Followed plan & reached target (disciplined execution)
 * B: Followed plan, hit SL or trailing SL with proper size (good risk control)
 * F: Broken rules, FOMO/Revenge/Stressed regardless of P&L!
 */
export function evaluateTradeGrade(
  mood: PreTradeMood,
  status: string,
  followedRules: boolean
): ExecutionGrade {
  if (mood === 'FOMO' || mood === 'REVENGE' || !followedRules) {
    return 'F';
  }
  if (status === 'TARGET_HIT') {
    return 'A+';
  }
  return 'B';
}

/**
 * 9. Indian Rupee (INR) Formatter
 * Uses standard Lakhs and Crores grouping (en-IN)
 */
export function formatINR(amount: number, includeDecimals = false): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(absAmount);

  return `${isNegative ? '-' : ''}₹${formatted}`;
}
