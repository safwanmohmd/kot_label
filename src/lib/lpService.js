import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Fetch all active and resolved LP tracker records
 */
export async function fetchLpRecords() {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('lp_tracker')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        console.log("🛠️ LP Tracker table missing. Launching automatic RPC schema initialization...");
        const { error: initError } = await supabase.rpc('create_lp_tracker_table_if_missing');
        if (initError) throw initError;

        const { data: retryData, error: retryError } = await supabase
          .from('lp_tracker')
          .select('*')
          .order('created_at', { ascending: false });

        if (retryError) throw retryError;
        return retryData ?? [];
      }
      throw error;
    }
    return data ?? [];
  } catch (err) {
    console.error("fetchLpRecords error:", err);
    throw err;
  }
}

/**
 * Insert a single LP tracker record
 * Logs precise error payload strings to clarify constraint blocks
 */
export async function createLpRecord(input) {
  if (!isSupabaseConfigured) {
    return {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  
  const payload = {
    tracking_id: input.tracking_id,
    wishmaster_name: input.wishmaster_name,
    aging_days: input.aging_days,
    priority: input.priority,
    status: input.status,
    details: input.details || null, 
    resolved_at: input.resolved_at || null
  };

  const { data, error } = await supabase
    .from('lp_tracker')
    .insert([payload])
    .select()
    .single();

  if (error) {
    // 🚨 PRINTS THE EXACT POSTGRES RULE BLOCKING YOUR SAVE TO CONSOLE 🚨
    console.error("--- SUPABASE ERROR DIAGNOSTICS ---");
    console.error("Status Code:", error.status);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.error("Error Details:", error.details);
    console.error("Hint Context:", error.hint);
    console.error("---------------------------------");
    throw error;
  }
  return data;
}

/**
 * Delete a data record from the table entirely
 */
export async function deleteLpRecord(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('lp_tracker').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Updates an existing Loss Prevention record by its ID
 * @param {string|number} id - The database row ID
 * @param {Object} updates - The columns to update (e.g. { status: 'LOSS' })
 */
export async function updateLpRecord(id, updates) {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('lp_tracker')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] ?? null;
  } catch (err) {
    console.error(`Error updating LP record ${id}:`, err);
    throw err;
  }
}

/**
 * Bulk inserts multiple Loss Prevention records in a single database transaction.
 * @param {Array<Object>} recordsArray - Array of case objects to write
 */
export async function createLpRecordsBulk(recordsArray) {
  if (!isSupabaseConfigured) {
    return recordsArray.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
  }

  const sanitizedRecords = recordsArray.map(record => ({
    tracking_id: record.tracking_id,
    wishmaster_name: record.wishmaster_name,
    aging_days: record.aging_days,
    priority: record.priority,
    status: record.status,
    details: record.details ?? null, 
    resolved_at: record.resolved_at || null
  }));

  const { data, error } = await supabase
    .from('lp_tracker')
    .insert(sanitizedRecords)
    .select();

  if (error) throw error;
  return data;
}