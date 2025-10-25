"use client";

import { supabase } from "@/app/lib/supabaseClient";

export default function LogoutButton() {
  async function handleLogout() {
    try {
      // 1. Tell Supabase "this user is signed out" on the client
      await supabase.auth.signOut();
    } catch {
      // ignore errors here, we'll still kill server session
    }

    try {
      // 2. Tell our server to clear the auth cookie
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }

    // 3. Kick them to landing page
    location.href = "/";
  }

  return (
    <button
      className="text-sm px-2 py-1 rounded-md border border-white/10 hover:bg-white/5"
      onClick={handleLogout}
    >
      Logout
    </button>
  );
}