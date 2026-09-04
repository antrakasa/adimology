import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Save stock query to database
 */
export async function saveStockQuery(data: {
  emiten: string;
  sector?: string;
  from_date?: string;
  to_date?: string;
  bandar?: string;
  barang_bandar?: number;
  rata_rata_bandar?: number;
  harga?: number;
  ara?: number;
  arb?: number;
  fraksi?: number;
  total_bid?: number;
  total_offer?: number;
  total_papan?: number;
  rata_rata_bid_ofer?: number;
  a?: number;
  p?: number;
  target_realistis?: number;
  target_max?: number;
}) {
  const { data: result, error } = await supabase
    .from('stock_queries')
    .upsert([data], { onConflict: 'from_date,emiten' })
    .select();

  if (error) {
    console.error('Error saving to Supabase:', error);
    throw error;
  }

  return result;
}

/**
 * Get session value by key
 */
export async function getSessionValue(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('session')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return null;
  return data.value;
}

/**
 * Token status interface
 */
export interface TokenStatus {
  exists: boolean;
  isValid: boolean;
  token?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  updatedAt?: string;
  isExpiringSoon: boolean;  // Within 1 hour of expiry
  isExpired: boolean;
  hoursUntilExpiry?: number;
}

/**
 * Get full token status including expiry information
 */
export async function getTokenStatus(): Promise<TokenStatus> {
  const { data, error } = await supabase
    .from('session')
    .select('value, expires_at, last_used_at, is_valid, updated_at')
    .eq('key', 'stockbit_token')
    .single();

  if (error || !data) {
    return {
      exists: false,
      isValid: false,
      isExpiringSoon: false,
      isExpired: true,
    };
  }

  const now = new Date();
  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  const isExpired = expiresAt ? expiresAt < now : false;
  const hoursUntilExpiry = expiresAt 
    ? (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60) 
    : undefined;
  const isExpiringSoon = hoursUntilExpiry !== undefined && hoursUntilExpiry <= 1 && hoursUntilExpiry > 0;

  return {
    exists: true,
    isValid: data.is_valid !== false && !isExpired,
    token: data.value,
    expiresAt: data.expires_at,
    lastUsedAt: data.last_used_at,
    updatedAt: data.updated_at,
    isExpiringSoon,
    isExpired,
    hoursUntilExpiry,
  };
}

/**
 * Upsert session value with optional expiry
 */
export async function upsertSession(
  key: string, 
  value: string, 
  expiresAt?: Date
) {
  const { data, error } = await supabase
    .from('session')
    .upsert(
      { 
        key, 
        value, 
        updated_at: new Date().toISOString(),
        expires_at: expiresAt?.toISOString() || null,
        is_valid: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select();

  if (error) throw error;
  return data;
}

/**
 * Update token last used timestamp (call after successful API request)
 */
export async function updateTokenLastUsed() {
  const { error } = await supabase
    .from('session')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key', 'stockbit_token');

  if (error) {
    console.error('Error updating token last_used_at:', error);
  }
}

/**
 * Mark token as invalid (call when receiving 401 from Stockbit API)
 */
export async function invalidateToken() {
  const { error } = await supabase
    .from('session')
    .update({ is_valid: false })
    .eq('key', 'stockbit_token');

  if (error) {
    console.error('Error invalidating token:', error);
  }
}

/**
 * Set token expiry time (typically 24 hours from login)
 */
export async function setTokenExpiry(hoursFromNow: number = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hoursFromNow);
  
  const { error } = await supabase
    .from('session')
    .update({ expires_at: expiresAt.toISOString() })
    .eq('key', 'stockbit_token');

  if (error) {
    console.error('Error setting token expiry:', error);
  }
}

/**
 * Save watchlist analysis to database (reusing stock_queries table)
 */
export async function saveWatchlistAnalysis(data: {
  from_date: string;  // analysis date
  to_date: string;    // same as from_date for daily analysis
  emiten: string;
  sector?: string;
  bandar?: string;
  barang_bandar?: number;
  rata_rata_bandar?: number;
  harga?: number;
  ara?: number;       // offer_teratas
  arb?: number;       // bid_terbawah
  fraksi?: number;
  total_bid?: number;
  total_offer?: number;
  total_papan?: number;
  rata_rata_bid_ofer?: number;
  a?: number;
  p?: number;
  target_realistis?: number;
  target_max?: number;
  status?: string;
  error_message?: string;
}) {
  const { data: result, error } = await supabase
    .from('stock_queries')
    .upsert([data], { onConflict: 'from_date,emiten' })
    .select();

  if (error) {
    console.error('Error saving watchlist analysis:', error);
    throw error;
  }

  return result;
}

/**
 * Get watchlist analysis history with optional filters
 */
export async function getWatchlistAnalysisHistory(filters?: {
  emiten?: string;
  sector?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  let query = supabase
    .from('stock_queries')
    .select('*', { count: 'exact' });

  // Handle sorting
  const sortBy = filters?.sortBy || 'from_date';
  const sortOrder = filters?.sortOrder || 'desc';

  if (sortBy === 'combined') {
    // Sort by date then emiten
    query = query
      .order('from_date', { ascending: sortOrder === 'asc' })
      .order('emiten', { ascending: sortOrder === 'asc' });
  } else if (sortBy === 'emiten') {
    // When sorting by emiten, secondary sort by date ascending
    query = query
      .order('emiten', { ascending: sortOrder === 'asc' })
      .order('from_date', { ascending: true });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  if (filters?.emiten) {
    const emitenList = filters.emiten.split(/\s+/).filter(Boolean);
    if (emitenList.length > 0) { // Changed to always use .in() if emitens are present
      query = query.in('emiten', emitenList);
    }
  }
  if (filters?.sector) {
    query = query.eq('sector', filters.sector);
  }
  if (filters?.fromDate) {
    query = query.gte('from_date', filters.fromDate);
  }
  if (filters?.toDate) {
    query = query.lte('from_date', filters.toDate);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching watchlist analysis:', error);
    throw error;
  }

  return { data, count };
}

/**
 * Get latest stock query for a specific emiten
 */
export async function getLatestStockQuery(emiten: string) {
  const { data, error } = await supabase
    .from('stock_queries')
    .select('*')
    .eq('emiten', emiten)
    .eq('status', 'success')
    .order('from_date', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get specific stock query for a given emiten and date range
 */
export async function getSpecificStockQuery(emiten: string, fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from('stock_queries')
    .select('*')
    .eq('emiten', emiten.toUpperCase())
    .eq('from_date', fromDate)
    .eq('to_date', toDate)
    .eq('status', 'success')
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get stock price for a specific emiten on a specific date (matching from_date)
 */
export async function getStockPriceByDate(emiten: string, date: string) {
  const { data, error } = await supabase
    .from('stock_queries')
    .select('harga, ara, arb, total_bid, total_offer, fraksi')
    .eq('emiten', emiten.toUpperCase())
    .eq('from_date', date)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data;
}

/**
 * Update the most recent previous day's real price for an emiten
 */
export async function updatePreviousDayRealPrice(emiten: string, currentDate: string, price: number, maxPrice?: number) {
  // 1. Find the latest successful record before currentDate
  const { data: record, error: findError } = await supabase
    .from('stock_queries')
    .select('id, from_date')
    .eq('emiten', emiten)
    .eq('status', 'success')
    .lt('from_date', currentDate)
    .order('from_date', { ascending: false })
    .limit(1)
    .single();

  if (findError || !record) {
    if (findError && findError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error(`Error finding previous record for ${emiten} before ${currentDate}:`, findError);
    }
    return null;
  }

  // 2. Update that record with the new price
  const updateData: { real_harga: number; max_harga?: number } = { real_harga: price };
  if (maxPrice !== undefined) {
    updateData.max_harga = maxPrice;
  }

  const { data, error: updateError } = await supabase
    .from('stock_queries')
    .update(updateData)
    .eq('id', record.id)
    .select();

  if (updateError) {
    console.error(`Error updating real_harga for ${emiten} on ${record.from_date}:`, updateError);
  }

  return data;
}

/**
 * Create a new agent story record with pending status
 */
export async function createAgentStory(emiten: string) {
  const { data, error } = await supabase
    .from('agent_stories')
    .insert({ emiten, status: 'pending' })
    .select()
    .single();

  if (error) {
    console.error('Error creating agent story:', error);
    throw error;
  }

  return data;
}

/**
 * Update agent story with result or error
 */
export async function updateAgentStory(id: number, data: {
  status: 'processing' | 'completed' | 'error';
  matriks_story?: object[];
  swot_analysis?: object;
  checklist_katalis?: object[];
  keystat_signal?: string;
  strategi_trading?: object;
  kesimpulan?: string;
  error_message?: string;
  sources?: { title: string; uri: string }[];
  model?: string;
  thinking_level?: string;
}) {

  const { data: result, error } = await supabase
    .from('agent_stories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating agent story:', error);
    throw error;
  }

  return result;
}

/**
 * Get latest agent story for an emiten
 */
export async function getAgentStoryByEmiten(emiten: string) {
  const { data, error } = await supabase
    .from('agent_stories')
    .select('*')
    .eq('emiten', emiten.toUpperCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching agent story:', error);
  }

  return data || null;
}

/**
 * Get all agent stories for an emiten
 */
export async function getAgentStoriesByEmiten(emiten: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('agent_stories')
    .select('*')
    .eq('emiten', emiten.toUpperCase())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching agent stories:', error);
    throw error;
  }

  return data || [];
}

/**
 * Create a new background job log entry
 */
export async function createBackgroundJobLog(jobName: string, totalItems: number = 0) {
  const { data, error } = await supabase
    .from('background_job_logs')
    .insert({
      job_name: jobName,
      status: 'running',
      total_items: totalItems,
      log_entries: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating background job log:', error);
    throw error;
  }

  return data;
}

/**
 * Append a log entry to an existing job log
 */
export async function appendBackgroundJobLogEntry(
  jobId: number,
  entry: {
    level: 'info' | 'warn' | 'error';
    message: string;
    emiten?: string;
    details?: Record<string, unknown>;
  }
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  // Use raw SQL to append to JSONB array for atomic operation
  const { error } = await supabase.rpc('append_job_log_entry', {
    p_job_id: jobId,
    p_entry: logEntry,
  });

  // If RPC doesn't exist, fallback to fetch-and-update
  if (error && error.code === 'PGRST202') {
    const { data: current } = await supabase
      .from('background_job_logs')
      .select('log_entries')
      .eq('id', jobId)
      .single();

    const entries = current?.log_entries || [];
    entries.push(logEntry);

    await supabase
      .from('background_job_logs')
      .update({ log_entries: entries })
      .eq('id', jobId);
  } else if (error) {
    console.error('Error appending job log entry:', error);
  }
}

/**
 * Update background job log with final status
 */
export async function updateBackgroundJobLog(
  jobId: number,
  data: {
    status: 'completed' | 'failed';
    success_count?: number;
    error_count?: number;
    error_message?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { data: result, error } = await supabase
    .from('background_job_logs')
    .update({
      ...data,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    console.error('Error updating background job log:', error);
    throw error;
  }

  return result;
}

/**
 * Get background job logs with pagination
 */
export async function getBackgroundJobLogs(filters?: {
  jobName?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('background_job_logs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false });

  if (filters?.jobName) {
    query = query.eq('job_name', filters.jobName);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching background job logs:', error);
    throw error;
  }

  return { data: data || [], count };
}

/**
 * Get the latest job log for a specific job name
 */
export async function getLatestBackgroundJobLog(jobName: string) {
  const { data, error } = await supabase
    .from('background_job_logs')
    .select('*')
    .eq('job_name', jobName)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching latest job log:', error);
  }

  return data || null;
}

/**
 * Get a profile setting by key
 */
export async function getProfileSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profile')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) return null;
  return data.value;
}

/**
 * Set a profile setting (upsert)
 */
export async function setProfileSetting(key: string, value: string) {
  const { data, error } = await supabase
    .from('profile')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving profile setting:', error);
    throw error;
  }

  return data;
}

/**
 * Get emiten summary statistics for hit targets
 */
export async function getEmitenSummaryStats(limit: number = 5) {
  // 1. Get all successful analysis records
  // We need to fetch enough records to cover the 'limit' for each emiten
  // Since we don't know which emitens have recent data, we'll fetch a larger set first
  const { data, error } = await supabase
    .from('stock_queries')
    .select('emiten, sector, target_realistis, target_max, max_harga, status, from_date, bandar')
    .eq('status', 'success')
    .order('from_date', { ascending: false });

  if (error) {
    console.error('Error fetching summary stats:', error);
    throw error;
  }

  // 2. Aggregate data per emiten
  const emitenGroups: Record<string, any[]> = {};
  data.forEach(record => {
    if (!emitenGroups[record.emiten]) {
      emitenGroups[record.emiten] = [];
    }
    if (emitenGroups[record.emiten].length < limit) {
      emitenGroups[record.emiten].push(record);
    }
  });

  // 3. Calculate stats for each emiten
  const stats = Object.entries(emitenGroups).map(([emiten, records]) => {
    const tradingDays = records.length;
    let hitR1 = 0;
    let hitMax = 0;
    const sector = records[0]?.sector; // Take sector from latest record

    // Calculate bandar frequencies
    const bandarCounts: Record<string, number> = {};
    
    records.forEach(r => {
      if (r.max_harga && r.target_realistis && r.max_harga >= r.target_realistis) {
        hitR1++;
      }
      if (r.max_harga && r.target_max && r.max_harga >= r.target_max) {
        hitMax++;
      }
      
      if (r.bandar) {
        bandarCounts[r.bandar] = (bandarCounts[r.bandar] || 0) + 1;
      }
    });

    // Get top 3 bandar with counts
    const topBandars = Object.entries(bandarCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const hitRateR1 = (hitR1 / tradingDays) * 100;
    const hitRateMax = (hitMax / tradingDays) * 100;
    const totalHitRate = (hitRateR1 + hitRateMax) / 2;

    return {
      emiten,
      sector,
      tradingDays,
      hitR1,
      hitMax,
      hitRateR1,
      hitRateMax,
      totalHitRate,
      topBandars
    };
  });

  // 4. Sort by totalHitRate descending
  return stats.sort((a, b) => b.totalHitRate - a.totalHitRate);
}

// ===== Watchlist Cache Functions =====

import type { WatchlistGroup } from './types';

/**
 * Check if there is any watchlist cache in the database
 */
export async function hasWatchlistCache(): Promise<boolean> {
  const { count, error } = await supabase
    .from('watchlist_groups')
    .select('*', { count: 'exact', head: true });

  if (error) return false;
  return (count || 0) > 0;
}

/**
 * Get cached watchlist groups from local database
 */
export async function getCachedWatchlistGroups(): Promise<{ groups: WatchlistGroup[]; synced_at: string | null }> {
  const { data, error } = await supabase
    .from('watchlist_groups')
    .select('*')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching cached watchlist groups:', error);
    return { groups: [], synced_at: null };
  }

  const groups: WatchlistGroup[] = (data || []).map((row: any) => ({
    watchlist_id: row.watchlist_id,
    name: row.name,
    description: row.description || '',
    is_default: row.is_default || false,
    is_favorite: row.is_favorite || false,
    emoji: row.emoji || '',
    category_type: row.category_type || '',
    total_items: row.total_items || 0,
  }));

  const synced_at = data?.[0]?.synced_at || null;

  return { groups, synced_at };
}

/**
 * Save watchlist groups from Stockbit to local database (upsert)
 */
export async function saveCachedWatchlistGroups(groups: WatchlistGroup[]): Promise<void> {
  const now = new Date().toISOString();
  const rows = groups.map(g => ({
    watchlist_id: g.watchlist_id,
    name: g.name,
    description: g.description || '',
    is_default: g.is_default || false,
    is_favorite: g.is_favorite || false,
    emoji: g.emoji || '',
    category_type: g.category_type || '',
    total_items: g.total_items || 0,
    synced_at: now,
  }));

  const { error } = await supabase
    .from('watchlist_groups')
    .upsert(rows, { onConflict: 'watchlist_id' });

  if (error) {
    console.error('Error saving cached watchlist groups:', error);
    throw error;
  }

  // Remove groups that no longer exist in Stockbit
  const activeIds = groups.map(g => g.watchlist_id);
  if (activeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('watchlist_groups')
      .delete()
      .not('watchlist_id', 'in', `(${activeIds.join(',')})`);

    if (deleteError) {
      console.error('Error cleaning up old watchlist groups:', deleteError);
    }
  }
}

/**
 * Get cached watchlist items for a specific group
 */
export async function getCachedWatchlistItems(watchlistId: number): Promise<{ items: any[]; synced_at: string | null }> {
  // First get the internal group id
  const { data: group, error: groupError } = await supabase
    .from('watchlist_groups')
    .select('id, synced_at')
    .eq('watchlist_id', watchlistId)
    .single();

  if (groupError || !group) {
    return { items: [], synced_at: null };
  }

  const { data, error } = await supabase
    .from('watchlist_items')
    .select(`
      stockbit_item_id,
      company_id,
      symbol,
      emiten_cache (
        name,
        sector,
        last_price,
        percent
      )
    `)
    .eq('watchlist_group_id', group.id)
    .order('symbol', { ascending: true });

  if (error) {
    console.error('Error fetching cached watchlist items:', error);
    return { items: [], synced_at: null };
  }

  // Map back to WatchlistItem-like format
  const items = (data || []).map((row: any) => ({
    id: row.stockbit_item_id,
    company_id: row.company_id,
    symbol: row.symbol,
    company_code: row.symbol, // For compatibility
    company_name: row.emiten_cache?.name || '',
    sector: row.emiten_cache?.sector || undefined,
    last_price: row.emiten_cache?.last_price !== null && row.emiten_cache?.last_price !== undefined 
      ? Number(row.emiten_cache.last_price) 
      : 0,
    percent: row.emiten_cache?.percent || '0',
  }));

  return { items, synced_at: group.synced_at };
}

/**
 * Save watchlist items for a specific group (full replace)
 */
export async function saveCachedWatchlistItems(
  watchlistId: number,
  items: any[]
): Promise<void> {
  // Get or create group record
  const { data: group, error: groupError } = await supabase
    .from('watchlist_groups')
    .select('id')
    .eq('watchlist_id', watchlistId)
    .single();

  if (groupError || !group) {
    console.error('Group not found for watchlist_id:', watchlistId);
    return;
  }

  const now = new Date().toISOString();

  // Insert/Update emiten data first
  if (items.length > 0) {
    const symbolsData = items.map((item: any) => ({
      symbol: (item.symbol || item.company_code || '').toUpperCase(),
      name: item.company_name || '',
      sector: item.sector || null,
      last_price: item.last_price ?? item.price ?? null,
      percent: item.percent || String(item.change_percentage || '0'),
      synced_at: now
    }));

    // Upsert into emiten_cache
    const { error: emitenError } = await supabase
      .from('emiten_cache')
      .upsert(symbolsData, { onConflict: 'symbol' });

    if (emitenError) {
      console.error('Error upserting emiten_cache:', emitenError);
      throw emitenError;
    }

    // Associate with group
    const watchlistRows = items.map((item: any) => ({
      watchlist_group_id: group.id,
      stockbit_item_id: String(item.id || ''),
      company_id: item.company_id || null,
      symbol: (item.symbol || item.company_code || '').toUpperCase(),
    }));

    // Reset items for this group and insert new associations
    await supabase.from('watchlist_items').delete().eq('watchlist_group_id', group.id);

    const { error: itemsError } = await supabase
      .from('watchlist_items')
      .insert(watchlistRows);

    if (itemsError) {
      console.error('Error saving cached watchlist items:', itemsError);
      throw itemsError;
    }
  }

  // Update group synced_at
  await supabase
    .from('watchlist_groups')
    .update({ synced_at: now })
    .eq('id', group.id);
}

/**
 * Delete a cached watchlist item by symbol from a group
 */
export async function deleteCachedWatchlistItem(watchlistId: number, symbol: string): Promise<void> {
  const { data: group } = await supabase
    .from('watchlist_groups')
    .select('id')
    .eq('watchlist_id', watchlistId)
    .single();

  if (!group) return;

  const { error } = await supabase
    .from('watchlist_items')
    .delete()
    .eq('watchlist_group_id', group.id)
    .eq('symbol', symbol.toUpperCase());

  if (error) {
    console.error('Error deleting cached watchlist item:', error);
  }
}
