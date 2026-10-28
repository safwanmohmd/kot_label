import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

const CACHE_PROFILE_KEY = 'kot_cached_profile';
const ALL_MODULE_IDS = [
  'dashboard', 'create', 'create_prn', 'bulk', 'unmask', 'lp',
  'eod', 'vendors', 'history', 'lossgen', 'manualdelivery',
  'verifytid', 'sort', 'gdrive', 'bags', 'search', 'chromebook', 'settings'
];

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  // Read instant cached profile from localStorage for 0ms load
  const [profile, setProfile] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_PROFILE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!profile);
  const [isBuffering, setIsBuffering] = useState(false);
  const isSyncingRef = useRef(false);

  // Fallback profile builder so the operator is NEVER locked out
  const buildFallbackProfile = (authUser) => {
    const isAdmin = authUser?.email === 'admin@gmail.com';
    return {
      id: authUser?.id,
      email: authUser?.email,
      username: authUser?.email?.split('@')[0] || 'Operator',
      is_admin: isAdmin,
      allowed_routes: ALL_MODULE_IDS,
      show_all_nav_items: true,
    };
  };

  // Sync profile from Supabase with an aggressive 800ms timeout race
  const syncProfile = async (authUser) => {
    if (!authUser || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsBuffering(true);

    try {
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 800)
      );

      const queryPromise = supabase
        .from('profiles')
        .select('id, email, username, is_admin, allowed_routes, show_all_nav_items')
        .eq('id', authUser.id)
        .maybeSingle()
        .then(({ data, error }) => ({ data, error }));

      const result = await Promise.race([queryPromise, timeoutPromise]);

      if (result && !result.timeout && !result.error && result.data) {
        setProfile(result.data);
        localStorage.setItem(CACHE_PROFILE_KEY, JSON.stringify(result.data));
      } else if (!profile) {
        // Stalled or timed out: use fallback immediately so UI renders
        const fallback = buildFallbackProfile(authUser);
        setProfile(fallback);
        localStorage.setItem(CACHE_PROFILE_KEY, JSON.stringify(fallback));
      }
    } catch (err) {
      console.warn('Profile sync fallback:', err);
      if (!profile) {
        const fallback = buildFallbackProfile(authUser);
        setProfile(fallback);
        localStorage.setItem(CACHE_PROFILE_KEY, JSON.stringify(fallback));
      }
    } finally {
      isSyncingRef.current = false;
      setIsBuffering(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Initial local session validation
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        setUser(session.user);
        syncProfile(session.user);
      } else {
        localStorage.removeItem(CACHE_PROFILE_KEY);
        setProfile(null);
        setUser(null);
        setLoading(false);
      }
    });

    // 2. Real-time auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user);
            syncProfile(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          localStorage.removeItem(CACHE_PROFILE_KEY);
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const hasAccess = (routeId) => {
    if (!profile) return false;
    if (profile.is_admin) return true;
    return (profile.allowed_routes || []).includes(routeId);
  };

  const canSeeInNav = (routeId) => {
    if (!profile) return false;
    if (profile.is_admin || profile.show_all_nav_items) return true;
    return hasAccess(routeId);
  };

  const signOut = async () => {
    localStorage.removeItem(CACHE_PROFILE_KEY);
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isBuffering,
        hasAccess,
        canSeeInNav,
        signOut,
        reloadProfile: () => syncProfile(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);