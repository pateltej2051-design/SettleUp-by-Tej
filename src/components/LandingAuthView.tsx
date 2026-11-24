import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Sun, Moon, ShieldCheck, Split, Sparkles } from 'lucide-react';

interface LandingAuthViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onEmailSignUp: (displayName: string, email: string, password: string) => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onEnterDemo: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

export const LandingAuthView: React.FC<LandingAuthViewProps> = ({
  isDark,
  onToggleTheme,
  onEmailSignUp,
  onEmailSignIn,
  onGoogleSignIn,
  onEnterDemo,
  authError,
  clearAuthError,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setLocalError(null);
    clearAuthError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    if (mode === 'signup' && trimmedName.length < 2) {
      setLocalError('Please enter your display name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await onEmailSignUp(trimmedName, trimmedEmail, password);
      } else {
        await onEmailSignIn(trimmedEmail, password);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setLocalError(null);
    clearAuthError();
    setGoogleLoading(true);
    try {
      await onGoogleSignIn();
    } finally {
      setGoogleLoading(false);
    }
  };

  const activeError = localError || authError;

  const scrollToAuth = (targetMode: 'login' | 'signup') => {
    switchMode(targetMode);
    const el = document.getElementById('auth-panel');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Strict 3-zone Top Bar Contract */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            SettleUp
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#overview" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Overview
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
              Privacy
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => scrollToAuth(mode === 'login' ? 'signup' : 'login')}
              className="py-2 px-4 text-sm font-medium rounded-lg bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0"
            >
              {mode === 'login' ? 'Create Account' : 'Log In'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero + Auth Split */}
        <section id="overview" className="max-w-6xl mx-auto px-4 sm:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            {/* Left: Editorial Value Proposition */}
            <div className="lg:col-span-7 space-y-6 pt-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>Shared Expenses in INR</span>
                <span aria-hidden="true">·</span>
                <span>Friends, Flatmates & College Groups</span>
              </div>

              <h1
                className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12]"
                style={{ textWrap: 'balance' }}
              >
                Split shared bills without the awkward math.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Track Goa trips, Flat 402 rent, and daily canteen lunches in one shared ledger.
                SettleUp automatically simplifies who owes whom so your group settles in fewer transfers.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onEnterDemo}
                  className="inline-flex items-center gap-2 py-2.5 px-5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Try Demo Preview (Local Only)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="inline-flex items-center gap-2 py-2.5 px-4 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
              </div>

              {/* Clean Ledger Preview Strip */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 max-w-lg">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Currency</div>
                  <div className="mt-1 font-mono-nums text-base font-semibold text-slate-900 dark:text-white">
                    INR (₹)
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Split Modes</div>
                  <div className="mt-1 text-base font-semibold text-slate-900 dark:text-white">
                    Equal & Exact
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Sensitive Info</div>
                  <div className="mt-1 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                    None Needed
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Toggleable Sign Up / Log In Card */}
            <div id="auth-panel" className="lg:col-span-5">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      mode === 'signup'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Sign Up
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Log In
                  </button>
                </div>

                <div className="mb-5">
                  <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                    {mode === 'signup' ? 'Create your SettleUp account' : 'Welcome back'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {mode === 'signup'
                      ? 'Register with just your name, email, and a password.'
                      : 'Sign in to view your groups and live balances.'}
                  </p>
                </div>

                {activeError && (
                  <div
                    role="alert"
                    className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300"
                  >
                    {activeError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {mode === 'signup' && (
                    <div>
                      <label
                        htmlFor="auth-display-name"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                      >
                        Display Name
                      </label>
                      <input
                        id="auth-display-name"
                        type="text"
                        required
                        maxLength={80}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., Aarav Mehta"
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="auth-email"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      maxLength={160}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || googleLoading}
                    className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 transition-colors"
                  >
                    {submitting
                      ? mode === 'signup'
                        ? 'Creating Account...'
                        : 'Signing In...'
                      : mode === 'signup'
                        ? 'Create Account'
                        : 'Log In'}
                  </button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">or</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleClick}
                  disabled={submitting || googleLoading}
                  className="w-full py-2.5 px-4 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-60 transition-colors flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  <span>{googleLoading ? 'Connecting Google...' : 'Continue with Google'}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Mechanism-to-Outcome & Editorial Visual Split */}
        <section
          id="how-it-works"
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6">
              {!heroImageError ? (
                <div className="h-full min-h-[260px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                  <img
                    src="/src/assets/images/settleup_hero_editorial_1795540338219.jpg"
                    alt="Minimalist wooden table with coffee cups, smartphone, and shared cafe receipt"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImageError(true)}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-full min-h-[260px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center p-8 text-center">
                  <Split className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mb-3" />
                  <p className="font-display font-semibold text-slate-900 dark:text-white">
                    Shared Group Ledger
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Clean bill splitting for every trip and flat
                  </p>
                </div>
              )}
            </div>

            <div id="privacy" className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Built for clarity, speed, and privacy.
                </h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  Designed specifically for college groups, roommates, and weekend trips without collecting sensitive banking or phone data.
                </p>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                <div className="py-4 flex items-start gap-3.5">
                  <Split className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Equal or Custom Exact Splits
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      Split dinner equally across selected friends or allocate exact rupee shares per item.
                    </p>
                  </div>
                </div>

                <div className="py-4 flex items-start gap-3.5">
                  <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Automatic Debt Simplification
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      Eliminate circular IOUs inside each group and record one-click non-cash settlements.
                    </p>
                  </div>
                </div>

                <div className="py-4 flex items-start gap-3.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Zero Sensitive Financial Collection
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      Profiles store only your display name and email. No phone numbers, UPI IDs, or bank credentials.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>SettleUp · Shared Expense & Bill-Splitting Platform</span>
          <span>Privacy-first expense ledger in INR (₹)</span>
        </div>
      </footer>
    </div>
  );
};
