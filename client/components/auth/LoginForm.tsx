'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface LoginFormProps {
    onSwitchView: (view: 'hero' | 'register') => void;
}

export default function LoginForm({ onSwitchView }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/api/auth/login', { email, password });
      login(response.data.token, response.data.user);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 
        (err.code === 'ECONNABORTED' || !err.response 
          ? 'Cannot connect to the server. Please verify your internet connection or try again shortly.'
          : 'Login failed');
      setError(errorMessage);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white/90 backdrop-blur-xl p-8 shadow-2xl border border-white/40 relative animate-in fade-in zoom-in-95 duration-300">
        
        <button 
            onClick={() => onSwitchView('hero')}
            className="absolute top-4 left-4 text-gray-400 hover:text-gray-700 transition-colors"
            title="Back to Home"
        >
            <ArrowLeft size={20} />
        </button>

        <div className="flex flex-col items-center mb-8 pt-4">
          <div className="relative w-20 h-20 mb-4 bg-white rounded-full p-2 shadow-sm">
            <img src="/noun_logo.png" alt="NOUN Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/150/006633/FFFFFF?text=N'} />
          </div>
          <h2 className="text-xl font-extrabold text-nounGreen text-center uppercase tracking-wide">Welcome Back</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Sign in to the HRMS Portal</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="email">
              Staff ID / Email
            </label>
            <input
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-700 focus:border-nounGreen focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none transition-all"
              id="email"
              type="text"
              placeholder="e.g. NOUN/01005 or name@noun.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="password">
              Password
            </label>
            <input
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-700 focus:border-nounGreen focus:bg-white focus:ring-2 focus:ring-nounGreen/20 outline-none transition-all"
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="w-full rounded-xl bg-nounGreen px-4 py-3.5 font-bold text-white hover:bg-green-800 transition-all shadow-lg shadow-green-900/20 hover:-translate-y-0.5 mt-4"
            type="submit"
          >
            Sign In Securely
          </button>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-500">
              New Staff Member?{' '}
              <button 
                type="button" 
                onClick={() => onSwitchView('register')}
                className="font-bold text-nounGreen hover:text-green-800 transition-colors"
              >
                Activate Profile
              </button>
            </p>
          </div>
        </form>
    </div>
  );
}
