import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // User created, trigger should create profile. 
        // Note: Check email confirmation settings in Supabase
        alert("Account created! You can now log in.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Success, parent App.tsx listens to onAuthStateChange and will handle the rest
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-pink-900/20 rounded-full blur-[120px]"></div>

      <div className="relative z-10 w-full max-w-md p-8 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 mb-6 shadow-lg shadow-indigo-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">StyleGenie</h1>
          <p className="text-zinc-400">{isSignUp ? "Create an account" : "Welcome back"}</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition placeholder-zinc-700"
              placeholder="name@example.com"
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition placeholder-zinc-700"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-100 text-zinc-900 font-bold py-4 rounded-xl hover:bg-white transition flex items-center justify-center"
          >
            {loading ? <span className="animate-spin w-5 h-5 border-2 border-zinc-400 border-t-zinc-800 rounded-full"></span> : (isSignUp ? "Sign Up" : "Login")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-sm text-zinc-500 hover:text-white transition"
          >
            {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};
