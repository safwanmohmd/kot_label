import { supabase, isSupabaseConfigured } from './supabase.js';

export async function fetchVendors() {
  const { data, error } = await supabase
    .from('wishmaster_vendors')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveSingleVendor(wmName, vendorId) {
  const { data, error } = await supabase
    .from('wishmaster_vendors')
    .insert([{ wm_name: wmName.trim(), vendor_id: vendorId.trim().toUpperCase() }])
    .select();
  if (error) throw error;
  return data;
}

export async function saveBulkVendors(vendorList) {
  // payload: Array of { wm_name, vendor_id }
  const formatted = vendorList.map(v => ({
    wm_name: v.wm_name.trim(),
    vendor_id: v.vendor_id.trim().toUpperCase()
  }));

  const { data, error } = await supabase
    .from('wishmaster_vendors')
    .upsert(formatted, { onConflict: 'vendor_id' }) // Avoids crashing on existing duplicates
    .select();
  if (error) throw error;
  return data;
}

export async function deleteVendorRecord(id) {
  const { error } = await supabase
    .from('wishmaster_vendors')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}