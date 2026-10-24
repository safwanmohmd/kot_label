// src/lib/activityLogger.js
import { supabase } from './supabase';

export const logUserActivity = async ({ user, profile, routeId, routeLabel, action = 'PAGE_VIEW' }) => {
  if (!user) return;
  try {
    await supabase.from('user_activity_logs').insert([
      {
        user_id: user.id,
        email: profile?.email || user.email,
        username: profile?.username || user.email?.split('@')[0],
        route_id: routeId,
        route_label: routeLabel,
        action: action,
      },
    ]);
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};