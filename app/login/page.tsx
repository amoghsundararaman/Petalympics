"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginOrSignup = async () => {
    setLoading(true);
    setError(null);

    // 1️⃣ Try login first
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // ✅ Logged in successfully
    if (!loginError) {
      window.location.href = "/";
      return;
    }

    // 2️⃣ If login failed → create account
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    // ✅ Account created + logged in
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50">
      <div className="bg-white p-6 rounded-xl shadow w-80 space-y-4">
        <h1 className="text-xl font-bold">🌱 BloomQuest</h1>

        <p className="text-sm text-gray-600">
          Enter your email & password to begin or continue your journey ✨
        </p>

        <input
          className="border p-2 rounded w-full"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="border p-2 rounded w-full"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          onClick={loginOrSignup}
          disabled={loading}
          className="bg-emerald-500 text-white py-2 rounded-xl cursor-pointer hover:bg-emerald-600 active:scale-95 transition disabled:opacity-50"
        >
          {loading ? "Entering..." : "Enter World"}
        </button>
      </div>
    </div>
  );
}
