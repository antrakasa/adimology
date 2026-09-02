import type { MarketDetectorResponse, OrderbookResponse, BrokerData, WatchlistResponse, BrokerSummaryData, EmitenInfoResponse, KeyStatsResponse, KeyStatsData, KeyStatsItem, WatchlistGroup, RunningTradeChartResponse } from './types';
import { getSessionValue, updateTokenLastUsed, invalidateToken } from './supabase';

const STOCKBIT_BASE_URL = 'https://exodus.stockbit.com';
const STOCKBIT_AUTH_URL = 'https://stockbit.com';

// Custom error for token expiry - allows UI to detect and show refresh prompt
export class TokenExpiredError extends Error {
  constructor(message: string = 'Token has expired or is invalid. Please login to Stockbit again.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

// Cache token to reduce database calls
let cachedToken: string | null = null;
let tokenLastFetched: number = 0;
const TOKEN_CACHE_DURATION = 60000; // 1 minute

// Cache sector data to reduce API calls
const sectorCache = new Map<string, { sector: string; name?: string; price?: string; timestamp: number }>();
const SECTOR_CACHE_DURATION = 3600000; // 1 hour

// Cache for sectors list
let sectorsListCache: { sectors: string[]; timestamp: number } | null = null;
const SECTORS_LIST_CACHE_DURATION = 86400000; // 24 hours

/**
 * Get JWT token from database or environment
 */
async function getAuthToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && (now - tokenLastFetched) < TOKEN_CACHE_DURATION) {
    return cachedToken;
  }

  // Fetch from database
  const token = await getSessionValue('stockbit_token');

  // Fallback to env if database token not found
  if (!token) {
    const envToken = process.env.STOCKBIT_JWT_TOKEN;
    if (!envToken) {
      throw new Error('STOCKBIT_JWT_TOKEN not found in database or environment');
    }
    return envToken;
  }

  // Update cache
  cachedToken = token;
  tokenLastFetched = now;

  return token;
}

/**
 * Common headers for Stockbit API
 */
async function getHeaders(): Promise<HeadersInit> {
  return {
    'accept': 'application/json',
    'authorization': `Bearer ${await getAuthToken()}`,
    'origin': 'https://stockbit.com',
    'referer': 'https://stockbit.com/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7',
    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };
}

/**
 * Handle API response - check for 401 and update token status
 */
async function handleApiResponse(response: Response, apiName: string): Promise<void> {
  if (response.status === 401) {
    // Token is invalid - mark it and clear cache
    await invalidateToken();
    cachedToken = null;
    throw new TokenExpiredError(`${apiName}: Token expired or invalid (401)`);
  }
  
  if (!response.ok) {
    throw new Error(`${apiName} error: ${response.status} ${response.statusText}`);
  }
  
  // Token is valid - update last used timestamp (fire and forget)
  updateTokenLastUsed().catch(() => {});
}

/**
 * Fetch Market Detector data (broker information)
 */
export async function fetchMarketDetector(
  emiten: string,
  fromDate: string,
  toDate: string
): Promise<MarketDetectorResponse> {
  const url = new URL(`${STOCKBIT_BASE_URL}/marketdetectors/${emiten}`);
  url.searchParams.append('from', fromDate);
  url.searchParams.append('to', toDate);
  url.searchParams.append('transaction_type', 'TRANSACTION_TYPE_NET');
  url.searchParams.append('market_board', 'MARKET_BOARD_REGULER');
  url.searchParams.append('investor_type', 'INVESTOR_TYPE_ALL');
  url.searchParams.append('limit', '25');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Market Detector API');

  return response.json();
}

/**
 * Fetch Orderbook data (market data)
 */
export async function fetchOrderbook(emiten: string): Promise<OrderbookResponse> {
  const url = `${STOCKBIT_BASE_URL}/company-price-feed/v2/orderbook/companies/${emiten}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Orderbook API');

  return response.json();
}

/**
 * Fetch Emiten Info (including sector)
 */
export async function fetchEmitenInfo(emiten: string): Promise<EmitenInfoResponse> {
  // Check cache first
  const cached = sectorCache.get(emiten.toUpperCase());
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < SECTOR_CACHE_DURATION) {
    // Return cached data in the expected format
    return {
      data: {
        sector: cached.sector,
        sub_sector: '',
        symbol: emiten,
        name: cached.name || '',
        price: cached.price || '0',
        change: '0',
        percentage: 0,
      },
      message: 'Successfully retrieved company data (cached)',
    };
  }

  const url = `${STOCKBIT_BASE_URL}/emitten/${emiten}/info`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Emiten Info API');

  const data: EmitenInfoResponse = await response.json();
  
  // Cache the sector data
  if (data.data?.sector) {
    sectorCache.set(emiten.toUpperCase(), {
      sector: data.data.sector,
      name: data.data.name,
      price: data.data.price,
      timestamp: now,
    });
  }

  return data;
}

/**
 * Fetch all sectors list
 */
export async function fetchSectors(): Promise<string[]> {
  const now = Date.now();
  
  // Check cache first
  if (sectorsListCache && (now - sectorsListCache.timestamp) < SECTORS_LIST_CACHE_DURATION) {
    return sectorsListCache.sectors;
  }

  const url = `${STOCKBIT_BASE_URL}/emitten/sectors`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Sectors API');

  const data = await response.json();
  const sectors: string[] = (data.data || []).map((item: { name: string }) => item.name).filter(Boolean);
  
  // Cache the sectors list
  sectorsListCache = {
    sectors,
    timestamp: now,
  };

  return sectors;
}


/**
 * Fetch all watchlist groups
 */
export async function fetchWatchlistGroups(): Promise<WatchlistGroup[]> {
  const url = `${STOCKBIT_BASE_URL}/watchlist?page=1&limit=500`;
  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Watchlist Groups API');

  const json = await response.json();
  return Array.isArray(json.data) ? json.data : [];
}

/**
 * Fetch Watchlist data by ID (or default if not provided)
 */
export async function fetchWatchlist(watchlistId?: number): Promise<WatchlistResponse> {
  let id = watchlistId;

  // If no ID provided, get default watchlist ID
  if (!id) {
    const groups = await fetchWatchlistGroups();
    const defaultGroup = groups.find(w => w.is_default) || groups[0];
    id = defaultGroup?.watchlist_id;
    if (!id) throw new Error('No watchlist found');
  }

  // Fetch watchlist details
  const detailUrl = `${STOCKBIT_BASE_URL}/watchlist/${id}?page=1&limit=500`;
  const response = await fetch(detailUrl, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Watchlist Detail API');

  const json = await response.json();

  // Map symbol to company_code for compatibility
  if (json.data?.result) {
    json.data.result = json.data.result.map((item: any) => ({
      ...item,
      company_code: item.symbol || item.company_code
    }));
  }

  return json;
}

/**
 * Get top broker by BVAL from Market Detector response
 */
export function getTopBroker(marketDetectorData: MarketDetectorResponse): BrokerData | null {
  // Debug log to see actual API response structure
  // console.log('Market Detector API Response:', JSON.stringify(marketDetectorData, null, 2));

  // The actual data is wrapped in 'data' property
  const brokers = marketDetectorData?.data?.broker_summary?.brokers_buy;

  if (!brokers || !Array.isArray(brokers) || brokers.length === 0) {
    // Return null instead of throwing error to allow caller to handle gracefully
    return null;
  }

  // Sort by bval descending and get the first one
  // Note: bval is a string in the API response, so we convert to Number
  const topBroker = [...brokers].sort((a, b) => Number(b.bval) - Number(a.bval))[0];

  return {
    bandar: topBroker.netbs_broker_code,
    barangBandar: Math.round(Number(topBroker.blot)),
    rataRataBandar: Math.round(Number(topBroker.netbs_buy_avg_price)),
  };
}

/**
 * Helper to parse lot string (e.g., "25,322,000" -> 25322000)
 */
export function parseLot(lotStr: string): number {
  if (!lotStr) return 0;
  return Number(lotStr.replace(/,/g, ''));
}

/**
 * Get broker summary data from Market Detector response
 */
export function getBrokerSummary(marketDetectorData: MarketDetectorResponse): BrokerSummaryData {
  const detector = marketDetectorData?.data?.bandar_detector;
  const brokerSummary = marketDetectorData?.data?.broker_summary;

  // Provide safe defaults if data is missing
  return {
    detector: {
      top1: detector?.top1 || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      top3: detector?.top3 || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      top5: detector?.top5 || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      avg: detector?.avg || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      total_buyer: detector?.total_buyer || 0,
      total_seller: detector?.total_seller || 0,
      number_broker_buysell: detector?.number_broker_buysell || 0,
      broker_accdist: detector?.broker_accdist || '-',
      volume: detector?.volume || 0,
      value: detector?.value || 0,
      average: detector?.average || 0,
    },
    topBuyers: brokerSummary?.brokers_buy?.slice(0, 4) || [],
    topSellers: brokerSummary?.brokers_sell?.slice(0, 4) || [],
  };
}

/**
 * Parse KeyStats API response into structured data
 */
function parseKeyStatsResponse(json: KeyStatsResponse): KeyStatsData {
  const categories = json.data?.closure_fin_items_results || [];
  
  const findCategory = (name: string): KeyStatsItem[] => {
    const category = categories.find(c => c.keystats_name === name);
    if (!category) return [];
    return category.fin_name_results.map(r => r.fitem);
  };

  return {
    currentValuation: findCategory('Current Valuation'),
    incomeStatement: findCategory('Income Statement'),
    balanceSheet: findCategory('Balance Sheet'),
    profitability: findCategory('Profitability'),
    growth: findCategory('Growth'),
  };
}

/**
 * Fetch KeyStats data for a stock
 */
export async function fetchKeyStats(emiten: string): Promise<KeyStatsData> {
  const url = `${STOCKBIT_BASE_URL}/keystats/ratio/v1/${emiten}?year_limit=10`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'KeyStats API');

  const json: KeyStatsResponse = await response.json();
  return parseKeyStatsResponse(json);
}

/**
 * Historical summary item from Stockbit API
 */
export interface HistoricalSummaryItem {
  date: string;
  close: number;
  change: number;
  value: number;
  volume: number;
  frequency: number;
  foreign_buy: number;
  foreign_sell: number;
  net_foreign: number;
  open: number;
  high: number;
  low: number;
  average: number;
  change_percentage: number;
}

/**
 * Fetch historical price summary from Stockbit
 * Returns daily price data including open, high, low, close
 */
export async function fetchHistoricalSummary(
  emiten: string,
  startDate: string,
  endDate: string,
  limit: number = 12
): Promise<HistoricalSummaryItem[]> {
  const url = `${STOCKBIT_BASE_URL}/company-price-feed/historical/summary/${emiten}?period=HS_PERIOD_DAILY&start_date=${startDate}&end_date=${endDate}&limit=${limit}&page=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Historical Summary API');

  const json = await response.json();
  return json.data?.result || [];
}

/**
 * Fetch running trade chart data (per-broker daily net value/volume) for an
 * explicit set of broker codes and date range. Unlike the period-enum variant,
 * this returns full daily granularity for exactly the brokers requested,
 * instead of Stockbit's own ~5 "top mover" selection.
 */
export async function fetchRunningTradeChartByBrokers(
  emiten: string,
  brokerCodes: string[],
  fromDate: string,
  toDate: string,
  marketBoard: string = 'BOARD_TYPE_REGULAR'
): Promise<RunningTradeChartResponse> {
  const url = new URL(`${STOCKBIT_BASE_URL}/order-trade/running-trade/chart/${emiten}`);
  for (const code of brokerCodes) {
    url.searchParams.append('broker_code', code);
  }
  url.searchParams.set('from', fromDate);
  url.searchParams.set('to', toDate);
  url.searchParams.set('investor_type', 'INVESTOR_TYPE_ALL');
  url.searchParams.set('market_board', marketBoard);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Running Trade Chart API');

  return response.json();
}

/**
 * Delete item from watchlist
 */
export async function deleteWatchlistItem(watchlistId: number, companyId: number): Promise<void> {
  const url = `${STOCKBIT_BASE_URL}/watchlist/${watchlistId}/company/${companyId}/item`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: await getHeaders(),
  });

  await handleApiResponse(response, 'Delete Watchlist Item API');
}
