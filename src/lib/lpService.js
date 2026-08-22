import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Fetch all records strictly from lp_tracker
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
 * Fetch records strictly from loss_ledger
 */
export async function fetchLossLedgerRecords() {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await supabase
      .from('loss_ledger')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("fetchLossLedgerRecords error:", err);
    throw err;
  }
}

/**
 * Create or Upsert a record directly into lp_tracker
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
    tracking_id: input.tracking_id.toUpperCase().trim(),
    wishmaster_name: input.wishmaster_name,
    aging_days: input.aging_days,
    priority: input.status === 'ALREADY MARKED LOSS' ? 'CRITICAL' : input.priority,
    status: input.status,
    details: input.details || null, 
    resolved_at: input.resolved_at || (input.status === 'CLEARING TODAY' || input.status === 'ALREADY MARKED LOSS' ? new Date().toISOString() : null)
  };

  const { data, error } = await supabase
    .from('lp_tracker')
    .upsert([payload], { onConflict: 'tracking_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing record in lp_tracker or loss_ledger
 */
export async function updateLpRecord(id, updates, isLossLedger = false) {
  if (!isSupabaseConfigured) return null;
  try {
    const targetTable = isLossLedger ? 'loss_ledger' : 'lp_tracker';
    const { data, error } = await supabase
      .from(targetTable)
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] ?? null;
  } catch (err) {
    console.error(`Error updating record ${id}:`, err);
    throw err;
  }
}

/**
 * Bulk import records directly into lp_tracker
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

  const uniquePayloadMap = new Map();
  recordsArray.forEach(record => {
    const cleanKey = record.tracking_id.trim().toUpperCase();
    uniquePayloadMap.set(cleanKey, {
      tracking_id: cleanKey,
      wishmaster_name: record.wishmaster_name,
      aging_days: record.aging_days,
      priority: record.status === 'ALREADY MARKED LOSS' ? 'CRITICAL' : record.priority,
      status: record.status,
      details: record.details ?? null, 
      resolved_at: record.resolved_at || (record.status === 'CLEARING TODAY' || record.status === 'ALREADY MARKED LOSS' ? new Date().toISOString() : null)
    });
  });

  const sanitizedRecords = Array.from(uniquePayloadMap.values());
  if (sanitizedRecords.length === 0) return [];

  const chunkSize = 150;
  let allInserted = [];

  for (let i = 0; i < sanitizedRecords.length; i += chunkSize) {
    const chunk = sanitizedRecords.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('lp_tracker')
      .upsert(chunk, { onConflict: 'tracking_id' })
      .select();

    if (error) throw error;
    if (data) allInserted = allInserted.concat(data);
  }

  return allInserted;
}

/**
 * Delete a single record from its table
 */
export async function deleteLpRecord(id, isLossLedger = false) {
  if (!isSupabaseConfigured) return;
  const targetTable = isLossLedger ? 'loss_ledger' : 'lp_tracker';
  
  const { error } = await supabase
    .from(targetTable)
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}

/**
 * Day Reset: Clears lp_tracker table completely.
 * loss_ledger is 100% untouched.
 */
export async function clearAllLpRecords() {
  if (!isSupabaseConfigured) return true;
  
  const { error } = await supabase
    .from('lp_tracker')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error("Failed to reset active LP tracker workspace:", error.message);
    throw error;
  }
  return true;
}

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

export async function syncManualDeliveryToLpLoss(deliveryItem) {
  if (!isSupabaseConfigured) return true;
  
  const lpPayload = {
    tracking_id: deliveryItem.tracking_id.toUpperCase().trim(),
    wishmaster_name: "MANUAL HUB ORDER (UNRESOLVED)",
    aging_days: 1,
    priority: "CRITICAL",
    status: "LOSS",
    details: `Source: Counter Pickup. Customer Phone: ${deliveryItem.customer_phone}. Notes: ${deliveryItem.notes || 'None provided'}`,
    resolved_at: new Date().toISOString()
  };

  const { error: upsertError } = await supabase
    .from('loss_ledger')
    .upsert(lpPayload, { onConflict: 'tracking_id' });

  if (upsertError) throw upsertError;

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

export async function deleteManualDelivery(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('manual_deliveries')
    .delete()
    .eq('id', id);
    
  if (error) throw error;
}