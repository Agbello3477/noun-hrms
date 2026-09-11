'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, Users, BookOpen, Shield, ShieldAlert, PhoneCall, 
  Activity, CheckCircle2, Wallet, Stethoscope, GraduationCap, 
  Building2, Lock, Server, Clock, Sparkles, ChevronRight, Menu, 
  X, Radio, FileText, AlertCircle, ExternalLink, UserCheck, HeartPulse
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserLocation } from '../hooks/useUserLocation';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';

export default function Home() {
  const { user } = useAuth();
  const userLocation = useUserLocation();
  const [activeView, setActiveView] = useState<'hero' | 'login' | 'register'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hash = window.location.hash;
      if (searchParams.get('login') === 'true' || hash === '#login') return 'login';
      if (searchParams.get('register') === 'true' || hash === '#register') return 'register';
    }
    return 'hero';
  });
  const [selectedRoleHint, setSelectedRoleHint] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Synchronize URL parameters if changed dynamically
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


  const handleRoleGatewayClick = (roleTitle: string) => {
    setSelectedRoleHint(roleTitle);
    setActiveView('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (activeView !== 'hero') {
      setActiveView('hero');
      setTimeout(() => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-[#006533] selection:text-white antialiased">
      
      {/* 1. Fixed Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 h-16 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          
          {/* Brand Logo & Title */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => {
              setActiveView('hero');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <div className="h-10 w-10 relative flex-shrink-0 rounded-xl bg-slate-50 p-1 border border-slate-200/80 shadow-xs flex items-center justify-center group-hover:border-[#006533]/40 transition-colors">
              <img
                src="/noun_logo.png"
                alt="NOUN Emblem"
                className="object-contain h-full w-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="h-full w-full bg-[#006533] rounded-lg hidden items-center justify-center text-white font-black text-sm">
                N
              </div>
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight leading-none group-hover:text-[#006533] transition-colors">
                  NATIONAL OPEN UNIVERSITY OF NIGERIA
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#006533]/10 text-[#006533] border border-[#006533]/20">
                  Enterprise HRMS
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 tracking-wide">
                Unified Workforce &amp; Academic Operations
              </span>
            </div>
          </div>

          {/* Desktop Center Anchor Navigation */}
          {activeView === 'hero' && (
            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600">
              <button 
                onClick={() => scrollToSection('payroll')} 
                className="px-3 py-1.5 rounded-lg hover:text-[#006533] hover:bg-slate-100 transition-colors"
              >
                Payroll &amp; CONUASS
              </button>
              <button 
                onClick={() => scrollToSection('telehealth')} 
                className="px-3 py-1.5 rounded-lg hover:text-[#006533] hover:bg-slate-100 transition-colors"
              >
                Clinical Services
              </button>
              <button 
                onClick={() => scrollToSection('safety')} 
                className="px-3 py-1.5 rounded-lg hover:text-[#006533] hover:bg-slate-100 transition-colors"
              >
                Campus Safety
              </button>
              <button 
                onClick={() => scrollToSection('research')} 
                className="px-3 py-1.5 rounded-lg hover:text-[#006533] hover:bg-slate-100 transition-colors"
              >
                Academic &amp; Research
              </button>
              <button 
                onClick={() => scrollToSection('gateways')} 
                className="px-3 py-1.5 rounded-lg hover:text-[#006533] hover:bg-slate-100 transition-colors"
              >
                Role Gateways
              </button>
            </nav>
          )}

          {/* Right Controls: Location Status Pill & Auth Action */}
          <div className="flex items-center gap-3">
            {/* Real-time Dynamic Network Location Status Indicator Pill */}
            <button
              type="button"
              onClick={() => userLocation.requestPreciseLocation()}
              title="Click to refine location via device GPS"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 border border-slate-200/80 text-xs font-medium text-slate-600 transition-all cursor-pointer select-none"
            >
              <span className={`inline-block w-2 h-2 rounded-full ${userLocation.isLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="font-semibold text-slate-800">{userLocation.statusText}</span>
            </button>

            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all"
              >
                Go to Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {activeView === 'hero' ? (
                  <button
                    onClick={() => setActiveView('login')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#006533] hover:bg-[#004d26] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Sign In to Portal
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveView('hero')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Back to Homepage
                  </button>
                )}
              </div>
            )}

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle Navigation Drawer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-200 bg-white/98 backdrop-blur-xl px-4 pt-3 pb-5 space-y-2 shadow-xl animate-fadeIn">
            {/* Mobile Dynamic Network Location Status Indicator Pill */}
            <button
              type="button"
              onClick={() => userLocation.requestPreciseLocation()}
              title="Click to refine location via device GPS"
              className="flex items-center gap-1.5 px-3 py-1.5 mb-2 rounded-full bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 border border-slate-200/80 text-xs font-medium text-slate-600 w-max cursor-pointer select-none"
            >
              <span className={`inline-block w-2 h-2 rounded-full ${userLocation.isLoading ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="font-semibold text-slate-800">{userLocation.statusText}</span>
            </button>
            <button 
              onClick={() => scrollToSection('payroll')} 
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Payroll &amp; CONUASS
            </button>
            <button 
              onClick={() => scrollToSection('telehealth')} 
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clinical Services
            </button>
            <button 
              onClick={() => scrollToSection('safety')} 
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Campus Safety &amp; 24/7 Security
            </button>
            <button 
              onClick={() => scrollToSection('research')} 
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Academic &amp; Research Grants
            </button>
            <button 
              onClick={() => scrollToSection('gateways')} 
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Role Gateways
            </button>
          </div>
        )}
      </header>

      {/* Main Content View Container */}
      <main className="flex-1 flex flex-col">
        {activeView === 'login' ? (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center animate-fadeIn">
            {selectedRoleHint && (
              <div className="mb-4 p-3 rounded-xl bg-[#006533]/10 border border-[#006533]/20 flex items-center justify-between text-xs text-[#006533]">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#006533]" />
                  <span>Role Gateway: <strong>{selectedRoleHint}</strong></span>
                </div>
                <button 
                  onClick={() => setSelectedRoleHint(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              </div>
            )}
            <LoginForm onSwitchView={setActiveView} />
          </div>
        ) : activeView === 'register' ? (
          <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center animate-fadeIn">
            <RegisterForm onSwitchView={setActiveView} />
          </div>
        ) : (
          <>
            {/* 2. Asymmetric Modern Hero Section */}
            <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 border-b border-slate-200/80 bg-gradient-to-b from-white via-slate-50/50 to-[#F8FAFC]">
              
              {/* Subtle ambient decorative gradient blooms */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#006533]/5 blur-[120px] rounded-full pointer-events-none -z-10" />
              <div className="absolute top-1/3 right-10 w-[400px] h-[250px] bg-amber-400/5 blur-[100px] rounded-full pointer-events-none -z-10" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                  
                  {/* Left Hero Column */}
                  <div className="lg:col-span-7 flex flex-col items-start text-left">
                    
                    {/* Status Chip */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#006533]/10 border border-[#006533]/20 text-[#006533] text-xs font-bold mb-6">
                      <Sparkles className="w-3.5 h-3.5 text-[#006533]" />
                      <span>National Open University of Nigeria · Enterprise Workforce Platform</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-6">
                      Unified Workforce, Clinical &amp; Academic Management.
                    </h1>

                    {/* Description */}
                    <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8 max-w-2xl">
                      Centralized personnel governance, automated CONUASS/CONTISS payroll computation, electronic medical triage, and real-time security intercom across all <strong className="text-slate-900 font-semibold">114 nationwide study centers</strong>.
                    </p>

                    {/* Action Group */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setActiveView('login')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#006533] hover:bg-[#004d26] text-white text-sm font-extrabold shadow-lg shadow-[#006533]/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <Lock className="w-4 h-4" />
                        Log In to Portal
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => scrollToSection('safety')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 text-sm font-bold shadow-xs hover:border-slate-400 transition-all duration-200"
                      >
                        <PhoneCall className="w-4 h-4 text-rose-600" />
                        Campus Emergency / Security Desk
                      </button>
                    </div>

                    {/* Institutional Trust Badges */}
                    <div className="mt-10 pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-6 w-full max-w-xl text-left">
                      <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight">114+</div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Study Centers</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-[#006533] tracking-tight">10,000+</div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Personnel</div>
                      </div>
                      <div>
                        <div className="text-2xl font-black text-slate-900 tracking-tight">99.98%</div>
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">System Uptime</div>
                      </div>
                    </div>
                  </div>

                  {/* Right Hero Column: Interactive Glassmorphic Dashboard Mockup */}
                  <div className="lg:col-span-5 w-full">
                    <div className="relative rounded-3xl bg-white/95 border border-slate-200/90 p-6 sm:p-7 shadow-2xl shadow-slate-200/70 backdrop-blur-xl hover:border-slate-300 transition-all duration-300">
                      
                      {/* Card Header */}
                      <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live System Operations</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">HQ · Abuja Campus</span>
                      </div>

                      {/* Mockup Counters Grid */}
                      <div className="space-y-4">
                        
                        {/* Metric 1: Staff Clocked In */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#006533]/10 text-[#006533] flex items-center justify-center font-bold">
                              <Users className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Staff Clocked-In Today</div>
                              <div className="text-xl font-extrabold text-slate-900 tracking-tight">3,842 Personnel</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                            +4.2% on-shift
                          </span>
                        </div>

                        {/* Metric 2: Telehealth Consultations */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                              <HeartPulse className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Active Telehealth Consultations</div>
                              <div className="text-xl font-extrabold text-slate-900 tracking-tight">18 Live Clinical Sessions</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                            Encrypted
                          </span>
                        </div>

                        {/* Metric 3: Next CONUASS/CONTISS Payroll */}
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                              <Wallet className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-500">Next Automated Payroll Run</div>
                              <div className="text-xl font-extrabold text-slate-900 tracking-tight">25th Sep 2026</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                            CONTISS Ready
                          </span>
                        </div>

                        {/* Metric 4: Security Extension Status */}
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-emerald-950 font-bold">
                            <Radio className="w-4 h-4 text-[#006533]" />
                            <span>VoIP Intercom Network: 114 Centers Connected</span>
                          </div>
                          <span className="text-[11px] font-mono text-[#006533] font-extrabold">ONLINE</span>
                        </div>

                      </div>

                      {/* Mockup Card Bottom Action */}
                      <button
                        onClick={() => setActiveView('login')}
                        className="mt-5 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        Authenticate to View Real-Time Dossiers
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* 3. Bento-Grid Module Showcase */}
            <section className="py-20 bg-[#F8FAFC] border-b border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                {/* Section Title */}
                <div className="text-center max-w-3xl mx-auto mb-16">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#006533] mb-2 block">
                    Core Platform Modules
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                    Engineered for National University Scale
                  </h2>
                  <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                    Built to support decentralized academic centers with unified regulatory compliance, verified audit trails, and instant communications.
                  </p>
                </div>

                {/* 4-Card Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
                  
                  {/* Block A: Automated Payroll (7 cols on LG) */}
                  <div id="payroll" className="lg:col-span-7 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-[#006533]/10 text-[#006533] flex items-center justify-center font-bold">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200/80">
                          CONUASS / CONTISS Matched
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2 group-hover:text-[#006533] transition-colors">
                        Automated Academic &amp; Non-Academic Payroll
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Configurable multi-grade salary step matrices, automated statutory tax deductions, pension computations, and instant electronic payslip distribution.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#006533]" />
                        <span>One-Click Batch Runs</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#006533]" />
                        <span>Audit Verification</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#006533]" />
                        <span>Tax &amp; Pension Slips</span>
                      </div>
                    </div>
                  </div>

                  {/* Block B: Integrated Telehealth & Clinic Records (5 cols on LG) */}
                  <div id="telehealth" className="lg:col-span-5 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                          <Stethoscope className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          WebRTC Telehealth
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2 group-hover:text-indigo-600 transition-colors">
                        Integrated Telehealth &amp; Medical Triage
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Encrypted video consultations for remote faculty, digital medical dossiers, electronic drug prescriptions, and health clearance tracking.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-100 text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>Secure Peer-to-Peer Video Consultations</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>Electronic Prescription &amp; Lab Requests</span>
                      </div>
                    </div>
                  </div>

                  {/* Block C: 24/7 Security Intercom & Incident Dispatch (5 cols on LG) */}
                  <div id="safety" className="lg:col-span-5 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100">
                          24/7 Intercom Desk
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2 group-hover:text-rose-600 transition-colors">
                        Security Intercom &amp; Incident Dispatch
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Internal 4-digit VoIP intercom dialer, instant panic SOS broadcasting, shift roster logs, and direct dispatch to campus safety officers.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-100 text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-rose-600" />
                        <span>Direct 4-Digit WebRTC Extension Dialing</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-rose-600" />
                        <span>Push-to-Talk Emergency Broadcasting</span>
                      </div>
                    </div>
                  </div>

                  {/* Block D: Collaborative Research & Grants (7 cols on LG) */}
                  <div id="research" className="lg:col-span-7 p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/60">
                          Academic Directorate
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-2 group-hover:text-amber-800 transition-colors">
                        Collaborative Research &amp; Grant Management
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed mb-6">
                        Real-time collaborative workspaces, journal publication indexing, sabbatical tracking, and grant disbursement milestones across faculties.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs font-medium text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                        <span>Grant Milestones</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                        <span>Peer Review Logs</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                        <span>APER Synchronization</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* 4. Quick Portal Role Gateways */}
            <section id="gateways" className="py-20 bg-white border-b border-slate-200/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <div className="text-center max-w-3xl mx-auto mb-14">
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#006533] mb-2 block">
                    Institutional Access
                  </span>
                  <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">
                    Select Your Role Gateway
                  </h2>
                  <p className="text-sm text-slate-600">
                    Direct authenticated access to role-tailored dashboards and permissions.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* Gateway 1: Academic Staff */}
                  <div 
                    onClick={() => handleRoleGatewayClick('Academic Staff & Faculty')}
                    className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-[#006533] hover:bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#006533]/10 text-[#006533] flex items-center justify-center font-bold mb-5 group-hover:bg-[#006533] group-hover:text-white transition-colors">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mb-1.5 group-hover:text-[#006533] transition-colors">
                      Academic Staff
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      Professors, Lecturers, Researchers, and Study Center Deans.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#006533]">
                      <span>Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Gateway 2: Registry & HR */}
                  <div 
                    onClick={() => handleRoleGatewayClick('Registry & Administration')}
                    className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-[#006533] hover:bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center font-bold mb-5 group-hover:bg-[#006533] group-hover:text-white transition-colors">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mb-1.5 group-hover:text-[#006533] transition-colors">
                      Registry &amp; Admin
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      HR Officers, Registrars, Desk Officers, and Bursary Auditors.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#006533]">
                      <span>Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Gateway 3: Health Center */}
                  <div 
                    onClick={() => handleRoleGatewayClick('Health Center & Clinical Staff')}
                    className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-indigo-600 hover:bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors">
                      Clinic &amp; Health Center
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      Medical Officers, Triage Nurses, Pharmacists, and Lab Personnel.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                      <span>Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* Gateway 4: Security Directorate */}
                  <div 
                    onClick={() => handleRoleGatewayClick('Security Directorate')}
                    className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-rose-600 hover:bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-5 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900 mb-1.5 group-hover:text-rose-600 transition-colors">
                      Campus Security
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      Security Officers, Surveillance Desks, and Emergency Responders.
                    </p>
                    <div className="flex items-center gap-1 text-xs font-bold text-rose-600">
                      <span>Sign In</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                </div>
              </div>
            </section>

            {/* 5. Enterprise CTA Banner */}
            <section className="py-16 bg-[#006533] text-white relative overflow-hidden">
              <div className="absolute right-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 pointer-events-none" />
              
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
                    Centralized Governance for All 114 Study Centers.
                  </h3>
                  <p className="text-sm text-emerald-100/80 max-w-2xl leading-relaxed">
                    Access your staff dossier, review monthly CONUASS payslips, initiate sabbatical leaves, or launch peer research consultations securely.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveView('login')}
                    className="px-6 py-3 bg-white hover:bg-slate-100 text-[#006533] font-black text-xs rounded-xl shadow-lg hover:shadow-xl transition-all"
                  >
                    Access Staff Portal
                  </button>
                  <button
                    onClick={() => alert("Registration is managed centrally by the NOUN Registry Department. Please contact your Study Center Desk Officer to initialize your staff account.")}
                    className="px-5 py-3 bg-[#004d26] hover:bg-[#003d1e] text-white border border-emerald-400/30 font-bold text-xs rounded-xl transition-all"
                  >
                    Registry Support
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* 6. Institutional Enterprise Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 text-xs py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            
            {/* Col 1: Institutional Identity */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 relative bg-white/10 rounded-lg p-1">
                  <img src="/noun_logo.png" className="object-contain h-full w-full opacity-90" alt="NOUN" />
                </div>
                <span className="font-extrabold text-white text-sm tracking-tight">
                  National Open University of Nigeria
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                Official Unified Human Resource Management System (HRMS) coordinating workforce, academic dossiers, clinical triage, and 24/7 security intercom across all study centers nationwide.
              </p>
              <div className="text-[11px] text-slate-500">
                Headquarters: Plot 91, Cadastral Zone, Nnamdi Azikiwe Expressway, Jabi, Abuja, Nigeria.
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div>
              <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Platform Navigation</h5>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('payroll')} className="hover:text-white transition-colors">CONUASS / CONTISS Payroll</button></li>
                <li><button onClick={() => scrollToSection('telehealth')} className="hover:text-white transition-colors">Telehealth &amp; Clinic Records</button></li>
                <li><button onClick={() => scrollToSection('safety')} className="hover:text-white transition-colors">Campus Safety Intercom</button></li>
                <li><button onClick={() => scrollToSection('research')} className="hover:text-white transition-colors">Academic Research &amp; Grants</button></li>
                <li><button onClick={() => scrollToSection('gateways')} className="hover:text-white transition-colors">Role Gateways</button></li>
              </ul>
            </div>

            {/* Col 3: Security & Governance */}
            <div>
              <h5 className="text-white font-bold text-xs uppercase tracking-wider mb-3">Security &amp; Compliance</h5>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-400" /> <span>Row-Level Security (RLS)</span></li>
                <li className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" /> <span>End-to-End Encrypted VoIP</span></li>
                <li className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-emerald-400" /> <span>Automated Daily Backups</span></li>
                <li className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-emerald-400" /> <span>Zero-Downtime High Availability</span></li>
              </ul>
            </div>

          </div>

          {/* Footer Bottom Bar */}
          <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              © {new Date().getFullYear()} National Open University of Nigeria (NOUN). All rights reserved.
            </div>
            <div>
              Powered by <strong className="text-emerald-400 font-semibold">MaSha Tech Innovations</strong>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
