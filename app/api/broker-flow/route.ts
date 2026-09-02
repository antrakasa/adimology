import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketDetector, fetchRunningTradeChartByBrokers } from '@/lib/stockbit';
import { transformRunningTradeChartToBrokerFlow, pickTopBrokerCodes, finalizeBrokerFlow } from '@/lib/broker-flow-transform';
import type { BrokerFlowPeriod, BrokerFlowResponse } from '@/lib/types';

const VALID_PERIODS: BrokerFlowPeriod[] = ['1D', '7D', '14D', '21D'];
const PERIOD_DAYS: Record<BrokerFlowPeriod, number> = { '1D': 1, '7D': 7, '14D': 14, '21D': 21 };
// Stockbit's running-trade-chart endpoint rejects requests for more than 7
// broker codes at once ("Broker limit exceeded: a maximum of 7 brokers are
// allowed", confirmed empirically — not documented anywhere).
const TOP_N_BROKERS = 7;

// IDX trades in WIB (UTC+7); shift before formatting so the date boundary
// matches Jakarta's calendar day regardless of the server's own timezone.
function jakartaNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// This endpoint variant (explicit broker_code + from/to) only serves
// completed trading sessions — passing today's date as `to` gets rejected
// with a 400 regardless of broker codes (confirmed empirically; the
// period-enum variant is the one that supports live/current-session data).
// So the window is anchored to the most recent completed day, not today.
function mostRecentCompletedDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const emiten = searchParams.get('emiten');
  const periodParam = searchParams.get('period') || '7D';
  const brokerStatus = searchParams.get('broker_status') || 'Bandar,Whale,Retail,Mix';

  if (!emiten) {
    return NextResponse.json(
      { success: false, error: 'Missing emiten parameter' },
      { status: 400 }
    );
  }

  const period: BrokerFlowPeriod = VALID_PERIODS.includes(periodParam as BrokerFlowPeriod)
    ? (periodParam as BrokerFlowPeriod)
    : '7D';

  try {
    const emitenUpper = emiten.toUpperCase();

    const toDate = mostRecentCompletedDay(jakartaNow());
    const to = toDateString(toDate);
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - (PERIOD_DAYS[period] - 1));
    const from = toDateString(fromDate);

    // Market Detector ranks active brokers by net value over [from, to] —
    // used only to pick which broker codes to request full daily data for.
    const marketDetector = await fetchMarketDetector(emitenUpper, from, to);
    const brokerCodes = pickTopBrokerCodes(marketDetector, TOP_N_BROKERS);

    let data: BrokerFlowResponse;
    if (brokerCodes.length === 0) {
      data = { trading_dates: [], total_trading_days: 0, sort_by: 'consistency', activities: [] };
    } else {
      const raw = await fetchRunningTradeChartByBrokers(emitenUpper, brokerCodes, from, to);
      data = transformRunningTradeChartToBrokerFlow(raw.data, emitenUpper);
    }

    const brokerStatusFilter = brokerStatus.split(',').map(s => s.trim()).filter(Boolean);
    data = finalizeBrokerFlow(data, brokerStatusFilter, TOP_N_BROKERS);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Broker Flow API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch broker flow data' },
      { status: 500 }
    );
  }
}
