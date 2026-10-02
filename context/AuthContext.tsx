'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | { id: string; email: string; user_metadata: { full_name: string } } | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => subscription.unsubscribe();
    } else {
      const mockSession = localStorage.getItem('sl_mock_session');
      if (mockSession) setUser(JSON.parse(mockSession));
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string) => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) { setLoading(false); throw error; }
      alert('Verification OTP link dispatched to email.');
      setLoading(false);
    } else {
      const mockUser = { id: 'mock-user-uuid', email, user_metadata: { full_name: 'Strategic Analyst' } };
      localStorage.setItem('sl_mock_session', JSON.stringify(mockUser));
      setUser(mockUser);
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('sl_mock_session');
      setUser(null);
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, isMock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be executed within an AuthProvider wrapper');
  return context;
}