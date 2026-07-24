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
  const formatted = vendorList.map(v => ({
    wm_name: v.wm_name.trim(),
    vendor_id: v.vendor_id.trim().toUpperCase()
  }));

  const { data, error } = await supabase
    .from('wishmaster_vendors')
    .upsert(formatted, { onConflict: 'vendor_id' })
    .select();

  if (error) throw error;
  return data;
}

export async function deleteVendorRecord(id) {
  if (!id) {
    throw new Error('Cannot delete record: Primary key ID is missing or undefined.');
  }

  // Passing { count: 'exact' } lets us check if Postgres actually deleted any rows
  const { error, count } = await supabase
    .from('wishmaster_vendors')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) {
    console.error('Supabase delete error:', error);
    throw error;
  }

  // If count is 0, RLS blocked the operation or the ID didn't match a row
  if (count === 0) {
    throw new Error(`Deletion failed: 0 rows affected in wishmaster_vendors. Check RLS policies or ID match.`);
  }

  return true;
}