import { supabase, isSupabaseConfigured } from './supabase.js';

export async function fetchLabels() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('shipping_labels')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLabel(id) {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('shipping_labels')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createLabel(input) {
  if (!isSupabaseConfigured) {
    return {
      ...input,
      id: crypto.randomUUID(),
      status: 'created',
      print_count: 0,
      last_printed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const { data, error } = await supabase
    .from('shipping_labels')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLabel(id, patch) {
  const payload = { ...patch, updated_at: new Date().toISOString() };
  if (!isSupabaseConfigured) {
    return { id, ...payload };
  }
  const { data, error } = await supabase
    .from('shipping_labels')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLabel(id) {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from('shipping_labels').delete().eq('id', id);
  if (error) throw error;
}

export async function markPrinted(id) {
  if (!isSupabaseConfigured) return;
  try {
    const { error } = await supabase.rpc('increment_print_count', { label_id: id });
    if (!error) return;
  } catch {
    // fall through to read-modify-write
  }
  const { data } = await supabase
    .from('shipping_labels')
    .select('print_count')
    .eq('id', id)
    .maybeSingle();
  const next = (data?.print_count ?? 0) + 1;
  await supabase
    .from('shipping_labels')
    .update({
      print_count: next,
      last_printed_at: new Date().toISOString(),
      status: 'printed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
}
