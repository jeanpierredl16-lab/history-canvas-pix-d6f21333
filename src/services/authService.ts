import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export const authService = {
  getSession: () => supabase.auth.getSession(),
  onAuthStateChange: (cb: (session: Session | null) => void) =>
    supabase.auth.onAuthStateChange((_e, s) => cb(s)),
  signInWithPassword: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  signOut: () => supabase.auth.signOut(),
};