import type {
  BrokerFlowActivity,
  BrokerFlowDailyData,
  BrokerFlowResponse,
  RunningTradeChartData,
  StockbitBrokerChartPoint,
  MarketDetectorResponse,
} from './types';
import { getBrokerInfo } from './brokers';

type BrokerStatus = 'Bandar' | 'Whale' | 'Retail' | 'Mix';

function classifyBrokerStatus(brokerCode: string): BrokerStatus {
  const info = getBrokerInfo(brokerCode);
  switch (info.type) {
    case 'Smartmoney':
      return 'Bandar';
    case 'Whale':
      return 'Whale';
    case 'Retail':
      return 'Retail';
    default:
      // 'Mix' and 'Unknown' both fold into 'Mix' — there is no
      // '.broker-code-badge.unknown' CSS variant to render against.
      return 'Mix';
  }
}

// Group chart points by date, keeping the LAST point's cumulative value
// per date (the running total as of the end of that date's data).
function cumulativeByDate(points: StockbitBrokerChartPoint[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const point of points) {
    result.set(point.date, Number(point.value.raw));
  }
  return result;
}

// Transforms Stockbit's running-trade-chart response (per-broker cumulative
// net value time series) into the BrokerFlowResponse shape. Works the same
// whether the raw data came from an explicit broker_code list or Stockbit's
// own default top-N selection. Unfiltered/unsorted — the caller finalizes
// with finalizeBrokerFlow.
export function transformRunningTradeChartToBrokerFlow(
  raw: RunningTradeChartData,
  emiten: string
): BrokerFlowResponse {
  // End-of-window closing price per date, from the shared price series.
  const priceByDate = new Map<string, number>();
  for (const point of raw.price_chart_data || []) {
    priceByDate.set(point.date, Number(point.value.raw));
  }

  const valueChart = (raw.broker_chart_data || []).find(c => c.type === 'TYPE_CHART_VALUE');
  const charts = valueChart?.charts || [];

  // Union of distinct dates across all brokers. Kept ascending internally
  // (oldest-first) so the diffing loop below accumulates chronologically.
  const dateSet = new Set<string>();
  for (const brokerChart of charts) {
    for (const point of brokerChart.chart) {
      dateSet.add(point.date);
    }
  }
  const datesAscending = Array.from(dateSet).sort();

  // DailyHeatmap renders `tradingDates.slice().reverse()` left-to-right with
  // "D-{n}" labeled on the left and "D0" on the right — so for the reversed
  // (ascending) render order to end at the newest date on the right, the
  // trading_dates OUTPUT field itself must be descending (newest first).
  const tradingDates = [...datesAscending].reverse();

  const activities: BrokerFlowActivity[] = charts.map(brokerChart => {
    const cumByDate = cumulativeByDate(brokerChart.chart);
    const orderedDates = datesAscending.filter(d => cumByDate.has(d));

    let prevCumulative = 0;
    const dailyData: BrokerFlowDailyData[] = [];
    for (const date of orderedDates) {
      const cumulative = cumByDate.get(date) as number;
      const netForDay = cumulative - prevCumulative;
      dailyData.push({
        d: date,
        n: netForDay,
        p: priceByDate.get(date) ?? 0,
        a: 0,
      });
      prevCumulative = cumulative;
    }

    const buyDays = dailyData.filter(d => d.n > 0).length;
    const activeDays = dailyData.length;
    const consistencyPct = activeDays > 0 ? Math.round((buyDays / activeDays) * 100) : 0;
    const totalBuyValue = dailyData.reduce((sum, d) => (d.n > 0 ? sum + d.n : sum), 0);
    const lastDate = orderedDates[orderedDates.length - 1];

    const activity: BrokerFlowActivity = {
      broker_code: brokerChart.broker_code,
      stock_code: emiten,
      broker_status: classifyBrokerStatus(brokerChart.broker_code),
      stock_name: emiten,
      net_value: String(prevCumulative),
      total_buy_value: String(totalBuyValue),
      total_buy_volume: '0',
      buy_days: String(buyDays),
      active_days: String(activeDays),
      consistency_pct: String(consistencyPct),
      daily_data: dailyData,
      current_price: String(lastDate ? priceByDate.get(lastDate) ?? 0 : 0),
      float_pl_pct: '0',
    };

    return activity;
  });

  return {
    trading_dates: tradingDates,
    total_trading_days: tradingDates.length,
    sort_by: 'consistency',
    activities,
  };
}

// Market Detector returns a broker's NET buy/sell value for a date range —
// used only to rank and pick which broker codes to request full daily data
// for via fetchRunningTradeChartByBrokers (its own accompanying period-enum
// endpoint variant caps out at Stockbit's ~5 "top mover" picks).
export function pickTopBrokerCodes(marketDetector: MarketDetectorResponse, topN: number = 10): string[] {
  const buyers = marketDetector.data?.broker_summary?.brokers_buy || [];
  const sellers = marketDetector.data?.broker_summary?.brokers_sell || [];

  const netValueByCode = new Map<string, number>();
  for (const buyer of buyers) {
    netValueByCode.set(buyer.netbs_broker_code, Number(buyer.bval) || 0);
  }
  for (const seller of sellers) {
    netValueByCode.set(seller.netbs_broker_code, -Math.abs(Number(seller.sval) || 0));
  }

  return Array.from(netValueByCode.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, topN)
    .map(([code]) => code);
}

// Applies the broker_status filter, ranks by net value magnitude, and caps
// to topN rows.
export function finalizeBrokerFlow(
  brokerFlow: BrokerFlowResponse,
  brokerStatusFilter: string[],
  topN: number = 10
): BrokerFlowResponse {
  const filtered = brokerFlow.activities.filter(a => brokerStatusFilter.includes(a.broker_status));
  filtered.sort((a, b) => Math.abs(Number(b.net_value)) - Math.abs(Number(a.net_value)));

  return {
    ...brokerFlow,
    activities: filtered.slice(0, topN),
  };
}
