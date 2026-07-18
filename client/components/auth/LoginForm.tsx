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
  const [success, setSuccess] = useState('');
  const { login, user } = useAuth();
  const router = useRouter();

  // 2FA States
  const [twoFactorStep, setTwoFactorStep] = useState<'NONE' | 'VERIFY' | 'SETUP'>('NONE');
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');

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
      
      if (response.data.requires2FA) {
          setTempToken(response.data.tempToken);
          setTwoFactorStep('VERIFY');
      } else if (response.data.requires2FASetup) {
          setTempToken(response.data.tempToken);
          setTwoFactorStep('SETUP');
          // Automatically fetch QR code
          try {
              const setupRes = await api.post('/api/auth/2fa/setup', { tempToken: response.data.tempToken });
              setQrCodeUrl(setupRes.data.qrCodeUrl);
              setSecretKey(setupRes.data.secret);
          } catch (setupErr) {
              setError('Failed to initiate 2FA setup. Please try again.');
          }
      } else {
          login(response.data.token, response.data.user);
      }
    } catch (err: any) {
      console.error('Login Error Object:', err);
      console.error('Network Error Details:', {
          message: err.message,
          code: err.code,
          response: err.response?.data
      });
      const errorMessage = err.response?.data?.message || 
        (err.code === 'ECONNABORTED' || !err.response 
          ? 'Cannot connect to the server. Please verify your internet connection.'
          : 'Login failed');
      setError(errorMessage);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      try {
          const response = await api.post('/api/auth/2fa/verify-login', { tempToken, code: twoFactorCode });
          login(response.data.token, response.data.user);
      } catch (err: any) {
          setError(err.response?.data?.message || 'Invalid 2FA code');
      }
  };

  const handleSetupAndEnable2FA = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      try {
          const response = await api.post('/api/auth/2fa/verify-enable', { tempToken, code: twoFactorCode });
          setSuccess('2FA Setup Successful! Logging you in...');
          setTimeout(() => {
              login(response.data.token, response.data.user);
          }, 1000);
      } catch (err: any) {
          setError(err.response?.data?.message || 'Invalid verification code');
      }
  };

  return (
    <div className="w-full max-w-md mx-auto rounded-2xl bg-white/90 backdrop-blur-xl p-8 shadow-2xl border border-white/40 relative animate-in fade-in zoom-in-95 duration-300">
        
        <button 
            onClick={() => {
                if (twoFactorStep !== 'NONE') {
                    setTwoFactorStep('NONE');
                    setTwoFactorCode('');
                    setError('');
                } else {
                    onSwitchView('hero');
                }
            }}
            className="absolute top-4 left-4 text-gray-400 hover:text-gray-700 transition-colors"
            title="Back"
        >
            <ArrowLeft size={20} />
        </button>

        <div className="flex flex-col items-center mb-8 pt-4">
          <div className="relative w-20 h-20 mb-4 bg-white rounded-full p-2 shadow-sm">
            <img src="/noun_logo.png" alt="NOUN Logo" className="w-full h-full object-contain" onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/150/006633/FFFFFF?text=N'} />
          </div>
          <h2 className="text-xl font-extrabold text-primary text-center uppercase tracking-wide">
              {twoFactorStep === 'NONE' ? 'Welcome Back' : 'Security Check'}
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-1">
              {twoFactorStep === 'NONE' && 'Sign in to the HRMS Portal'}
              {twoFactorStep === 'VERIFY' && 'Enter your Authenticator Code'}
              {twoFactorStep === 'SETUP' && 'Set up Two-Factor Authentication'}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-100 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        {success && (
            <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-700 border border-green-100 text-center font-bold">
                {success}
            </div>
        )}

        {twoFactorStep === 'NONE' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-500 uppercase tracking-wider" htmlFor="email">
                  Staff ID / Email
                </label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-700 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
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
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-gray-700 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button
                className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-white hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5 mt-4"
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
                    className="font-bold text-primary hover:text-primary-dark transition-colors"
                  >
                    Activate Profile
                  </button>
                </p>
              </div>
            </form>
        )}

        {twoFactorStep === 'VERIFY' && (
            <form onSubmit={handleVerify2FA} className="space-y-5">
                <div className="text-center mb-4">
                    <p className="text-sm text-gray-600">Please open Google Authenticator and enter the 6-digit code for your account.</p>
                </div>
                <div>
                    <input
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono text-gray-900 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        id="2fa-code"
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                    />
                </div>
                <button
                    className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-white hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5"
                    type="submit"
                >
                    Verify & Login
                </button>
            </form>
        )}

        {twoFactorStep === 'SETUP' && (
            <form onSubmit={handleSetupAndEnable2FA} className="space-y-5">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-4">
                    <p className="text-xs text-blue-800 font-medium text-center">
                        Your role requires high security. You must enable Two-Factor Authentication to continue.
                    </p>
                </div>
                
                {qrCodeUrl ? (
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-100">
                        <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 mb-2" />
                        <p className="text-xs text-gray-500 text-center">Scan with Google Authenticator or Authy</p>
                        <p className="text-xs font-mono bg-gray-100 px-2 py-1 rounded mt-2 text-gray-600">{secretKey}</p>
                    </div>
                ) : (
                    <div className="flex justify-center items-center h-48 bg-gray-50 rounded-xl">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                )}

                <div>
                    <input
                        className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono text-gray-900 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                        type="text"
                        maxLength={6}
                        placeholder="000000"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                    />
                </div>
                <button
                    className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-white hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 hover:-translate-y-0.5 disabled:opacity-50"
                    type="submit"
                    disabled={twoFactorCode.length !== 6}
                >
                    Confirm & Login
                </button>
            </form>
        )}

    </div>
  );
}
