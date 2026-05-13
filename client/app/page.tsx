'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle, Users, BookOpen, Shield } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';

export default function Home() {
    const { user } = useAuth();

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <header className="border-b border-gray-100 bg-white/95 backdrop-blur-md sticky top-0 z-50">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Logo Placeholder - expecting /noun_logo.png */}
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
                            <div className="h-full w-full bg-nounGreen rounded-full hidden items-center justify-center text-white font-bold text-xl">N</div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-extrabold text-nounGreen leading-tight tracking-tight">NATIONAL OPEN UNIVERSITY</span>
                            <span className="text-xs font-bold text-nounRed tracking-widest">OF NIGERIA</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <Link
                                href="/dashboard"
                                className="px-5 py-2.5 bg-nounGreen text-white text-sm font-bold rounded-full hover:bg-green-800 transition-all shadow-md hover:shadow-lg"
                            >
                                Go to Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="text-sm font-semibold text-gray-600 hover:text-nounGreen transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/register"
                                    className="px-5 py-2.5 bg-nounGreen text-white text-sm font-bold rounded-full hover:bg-green-800 transition-all shadow-md hover:shadow-lg"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1">
                <section className="relative py-24 lg:py-36 overflow-hidden bg-gradient-to-br from-green-50 to-white">
                    <div className="absolute top-0 right-0 w-1/3 h-full bg-nounGreen/5 skew-x-12 transform origin-top-right"></div>

                    <div className="container mx-auto px-6 relative z-10 flex flex-col items-center text-center">
                        <div className="max-w-4xl">
                            <h1 className="text-4xl lg:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
                                <span className="block text-nounGreen mb-2">Human Resource</span>
                                <span className="block text-nounRed">Management System</span>
                            </h1>
                            <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
                                The centralized platform for managing staff workflows, academic administration, and payroll services for the <span className="font-semibold text-nounGreen">National Open University of Nigeria</span>.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-nounGreen text-white font-bold rounded-full hover:bg-green-800 transition-all shadow-xl shadow-green-900/10 hover:-translate-y-1"
                                >
                                    Log In to Portal <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                                <Link
                                    href="/register"
                                    className="inline-flex items-center justify-center px-8 py-4 bg-white text-gray-800 border-2 border-gray-100 font-bold rounded-full hover:border-nounGreen hover:text-nounGreen transition-all hover:-translate-y-1"
                                >
                                    New Staff Registration
                                </Link>
                            </div>
                        </div>
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
                            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-nounGreen/30 transition-all hover:shadow-lg group">
                                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-nounGreen mb-6 group-hover:bg-nounGreen group-hover:text-white transition-colors">
                                    <Users className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Staff Digital Dossier</h3>
                                <p className="text-gray-600">Secure, centralized file management for all academic and non-academic personnel records.</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-red-200 transition-all hover:shadow-lg group">
                                <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center text-nounRed mb-6 group-hover:bg-nounRed group-hover:text-white transition-colors">
                                    <BookOpen className="h-7 w-7" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">Academic Workflow</h3>
                                <p className="text-gray-600">Integrated tools for publication tracking, course allocation, and sabbatical management.</p>
                            </div>
                            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-yellow-200 transition-all hover:shadow-lg group">
                                <div className="w-14 h-14 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600 mb-6 group-hover:bg-nounGold group-hover:text-black transition-colors">
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
                        <p className="text-sm">
                            © {new Date().getFullYear()} National Open University of Nigeria.
                        </p>
                    </div>

                    <div className="flex gap-8 text-sm font-medium">
                        <Link href="#" className="hover:text-nounGreen transition-colors">Privacy Policy</Link>
                        <Link href="#" className="hover:text-nounGreen transition-colors">Terms of Service</Link>
                        <Link href="#" className="hover:text-nounGreen transition-colors">Contact Support</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
