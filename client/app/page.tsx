'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Users, BookOpen, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

export default function Home() {
    const { user } = useAuth();
    const [activeView, setActiveView] = useState<'hero' | 'login' | 'register'>('hero');

    useEffect(() => {
        // Automatically open login or register if specified in URL
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash;
            
            if (searchParams.get('login') === 'true' || hash === '#login') {
                setActiveView('login');
            } else if (searchParams.get('register') === 'true' || hash === '#register') {
                setActiveView('register');
            }
        }
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div 
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => setActiveView('hero')}
                    >
                        <div className="h-12 w-12 relative">
                            <img
                                src="/noun_logo.png"
                                alt="NOUN Logo"
                                className="object-contain h-full w-full"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                            <div className="h-full w-full bg-primary rounded-full hidden items-center justify-center text-white font-bold text-xl">N</div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-extrabold text-primary leading-tight tracking-tight">NATIONAL OPEN UNIVERSITY</span>
                            <span className="text-xs font-bold text-accent tracking-widest">OF NIGERIA</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <Link
                                href="/dashboard"
                                className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary-dark transition-all shadow-md hover:shadow-lg"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <>
                                <button
                                    onClick={() => setActiveView('login')}
                                    className={`text-sm font-semibold transition-colors ${activeView === 'login' ? 'text-primary' : 'text-gray-600 hover:text-primary'}`}
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => alert("Registration is managed centrally by NOUN Registry. Please contact the Registry Department to activate your staff profile.")}
                                    style={{ backgroundColor: '#006533', color: '#ffffff' }}
                                    className="px-5 py-2.5 text-xs font-bold rounded-full transition-all shadow-md hover:opacity-90"
                                >
                                    Contact NOUN Registry to Get Started
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col">
                <section className={`relative transition-all duration-500 ease-in-out ${activeView === 'hero' ? 'py-24 lg:py-36' : 'py-12 flex-1 flex items-center justify-center'} overflow-hidden bg-gradient-to-br from-green-50/40 to-white`}>
                    <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 skew-x-12 transform origin-top-right transition-transform duration-700 ease-in-out"></div>

                    <div className="container mx-auto px-6 relative z-10 flex flex-col items-center justify-center w-full">
                        {activeView === 'hero' && (
                            <div className="max-w-4xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <h1 className="text-4xl lg:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
                                    <span className="block text-primary mb-2">Human Resource</span>
                                    <span className="block text-accent">Management System</span>
                                </h1>
                                <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
                                    The centralized platform for managing staff workflows, academic administration, and payroll services for the <span className="font-semibold text-primary">National Open University of Nigeria</span>.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <button
                                        onClick={() => setActiveView('login')}
                                        className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white font-bold rounded-full hover:bg-primary-dark transition-all shadow-xl shadow-primary/10 hover:-translate-y-1"
                                    >
                                        Log In to Portal <ArrowRight className="ml-2 h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => alert("Registration is managed centrally by NOUN Registry. Please contact the Registry Department to activate your staff profile.")}
                                        className="inline-flex items-center justify-center px-8 py-4 bg-emerald-50 text-emerald-900 border-2 border-emerald-300 font-bold rounded-full hover:bg-emerald-100 transition-all shadow-md cursor-pointer"
                                    >
                                        Contact NOUN Registry to Get Started
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeView === 'login' && (
                            <LoginForm onSwitchView={setActiveView} />
                        )}

                        {activeView === 'register' && (
                            <RegisterForm onSwitchView={setActiveView} />
                        )}
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-24 bg-white relative">
                    <div className="container mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">Comprehensive Staff Services</h2>
                            <p className="text-gray-500">Everything needed to manage the academic and administrative workforce.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
                            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-primary/30 transition-all hover:shadow-lg group">
                                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                                    <Users className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Staff Digital Dossier</h3>
                                <p className="text-gray-600">Secure, centralized file management for all academic and non-academic personnel records.</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-accent/30 transition-all hover:shadow-lg group">
                                <div className="w-14 h-14 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-6 group-hover:bg-accent group-hover:text-white transition-colors">
                                    <BookOpen className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Academic Workflow</h3>
                                <p className="text-gray-600">Integrated tools for publication tracking, course allocation, and sabbatical management.</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-secondary-dark/30 transition-all hover:shadow-lg group">
                                <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center text-secondary-dark mb-6 group-hover:bg-secondary group-hover:text-slate-900 transition-colors">
                                    <Shield className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Audited & Secure</h3>
                                <p className="text-gray-600">Enterprise-grade security with role-based access control and comprehensive audit logging.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-300 py-12 border-t border-gray-800">
                <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 relative bg-white/10 rounded p-1">
                            <img src="/noun_logo.png" className="object-contain h-full w-full opacity-80" alt="NOUN" />
                        </div>
                        <div className="flex flex-col">
                            <p className="text-sm">
                                © {new Date().getFullYear()} National Open University of Nigeria.
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Powered by: <span className="font-semibold text-primary">MaSha Tech Innovations</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-8 text-sm font-medium">
                        <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
                        <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
                        <Link href="#" className="hover:text-primary transition-colors">Contact Support</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
