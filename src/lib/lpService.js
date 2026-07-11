import { supabase, isSupabaseConfigured } from './supabase.js';

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

  if (error) throw error;
  return data;
}

/**
 * Individual Row Purge: Permanently drops a single target record 
 * from the table when its specific delete button is clicked.
 */
export async function deleteLpRecord(id) {
  if (!isSupabaseConfigured) return;
  
  const { error } = await supabase
    .from('lp_tracker')
    .delete()
    .eq('id', id); // Targeted single record matching
    
  if (error) throw error;
}
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

/* ==========================================================================
   MANUAL HUB OVER-THE-COUNTER DELIVERY WORKSPACE METHODS
   ========================================================================== */

export async function fetchManualDeliveries() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('manual_deliveries')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createManualDelivery(payload) {
  if (!isSupabaseConfigured) return payload;
  const { data, error } = await supabase
    .from('manual_deliveries')
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateManualDelivery(id, updates) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('manual_deliveries')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data?.[0] ?? null;
}

/**
 * Syncs a cancelled manual pickup row straight into the main LP Tracker table as a Shipment Loss
 * FIXED: Uses .upsert() to gracefully overwrite constraints and handle 409 conflict responses.
 */
export async function syncManualDeliveryToLpLoss(deliveryItem) {
  if (!isSupabaseConfigured) return true;
  
  // 1. Build an official row payload matching the LP architecture
  const lpPayload = {
    tracking_id: deliveryItem.tracking_id.toUpperCase(),
    wishmaster_name: "MANUAL HUB ORDER (UNRESOLVED)",
    aging_days: 1,
    priority: "CRITICAL",
    status: "LOSS",
    details: `Source: Counter Pickup. Customer Phone: ${deliveryItem.customer_phone}. Notes: ${deliveryItem.notes || 'None provided'}`,
    resolved_at: new Date().toISOString()
  };

  // 2. Upsert transaction block into lp_tracker table to handle duplicate tracking entries cleanly
  const { error: upsertError } = await supabase
    .from('lp_tracker')
    .upsert(lpPayload, {
      onConflict: 'tracking_id',
      ignoreDuplicates: false
    });

  if (upsertError) throw upsertError;

  // 3. Update status flags inside origin record so it locks out multi-sync triggers
  const { data: updatedDelivery, error: updateError } = await supabase
    .from('manual_deliveries')
    .update({ 
      delivery_status: 'CANCELLED_DELAYED',
      synced_to_lp: true 
    })
    .eq('id', deliveryItem.id)
    .select();

  if (updateError) throw updateError;
  return updatedDelivery?.[0] ?? null;
}

/**
 * Destructive Operation: Flushes the main LP Tracker logs for a clean day's run
 */
/**
 * Safe Operation: Flushes the main LP Tracker logs for standard entries
 * PRESERVES manual counter overruns permanently unless individually purged.
 */
export async function clearAllLpRecords() {
  if (!isSupabaseConfigured) return true;
  
  const { error } = await supabase
    .from('lp_tracker')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Safe catch-all UUID filter
    .neq('wishmaster_name', 'MANUAL HUB ORDER (UNRESOLVED)'); // 🔥 NEW: Protects synced loss entries from bulk clear

  if (error) {
    console.error("Failed to safely flush standard LP workspace:", error.message);
    throw error;
  }
  return true;
}

/**
 * Deletes a manual delivery record by its primary ID
 */
export async function deleteManualDelivery(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('manual_deliveries')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}