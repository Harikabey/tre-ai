import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

let guestMode = false;
const guestListeners = new Set<() => void>();

export const setGuestMode = (enabled: boolean) => {
  guestMode = enabled;
  guestListeners.forEach((listener) => listener());
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(guestMode);
  const [loading, setLoading] = useState(!guestMode);

  useEffect(() => {
    const onGuestModeChange = () => {
      setIsGuest(guestMode);
      if (guestMode) {
        setUser(null);
        setSession(null);
        setLoading(false);
      }
    };
    guestListeners.add(onGuestModeChange);

    if (guestMode) {
      setLoading(false);
      return () => { guestListeners.delete(onGuestModeChange); };
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!guestMode) setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, username?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: username || email.split('@')[0],
        },
      },
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setGuestMode(false);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (guestMode) {
      setGuestMode(false);
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  return {
    user,
    session,
    isGuest,
    loading,
    signUp,
    signIn,
    signOut,
  };
};
