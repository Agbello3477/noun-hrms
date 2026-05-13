'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import api from '../../../lib/api';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth(); // Destructure user
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
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 border-t-8 border-nounGreen">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl border border-gray-100">

        <div className="flex flex-col items-center mb-8">
          <div className="relative w-24 h-24 mb-4">
            {/* Replaced with actual logo path if available, using placeholder logic for now or expecting /noun_logo.png in public */}
            <img src="/noun_logo.png" alt="NOUN Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/150/006633/FFFFFF?text=NOUN'} />
          </div>
          <h1 className="text-xl font-bold text-nounGreen text-center uppercase tracking-wide">National Open University of Nigeria</h1>
          <p className="text-sm font-semibold text-nounRed mt-1">Human Resource Management System</p>
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600 uppercase" htmlFor="loginType">
              Login Context
            </label>
            <select
              id="loginType"
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-700 focus:border-nounGreen focus:ring-1 focus:ring-nounGreen outline-none transition-all"
              defaultValue="GENERAL"
            >
              <option value="GENERAL">General Staff / Admin</option>
              <option value="HR">HR / Registry</option>
              <option value="BURSARY">Bursary / Audit</option>
              <option value="DIRECTORATE">Directorate / Unit Head</option>
              <option value="CENTER">Study Center Manager</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600 uppercase" htmlFor="email">
              Email Address / Staff ID
            </label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-700 focus:border-nounGreen focus:ring-1 focus:ring-nounGreen outline-none transition-all"
              id="email"
              type="text"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-600 uppercase" htmlFor="password">
              Password
            </label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-gray-700 focus:border-nounGreen focus:ring-1 focus:ring-nounGreen outline-none transition-all"
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="w-full rounded bg-nounGreen px-4 py-2.5 font-bold text-white hover:bg-green-800 transition-colors shadow-sm mt-2"
            type="submit"
          >
            Sign In Securely
          </button>

          <div className="text-center pt-2">
            <p className="text-sm text-gray-600">
              New Staff?{' '}
              <a href="/register" className="font-medium text-nounGreen hover:text-green-800 underline">
                Activate Profile
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
