import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, ApiRequestError } from '../../contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  // Honor the path the user tried to reach before being redirected to /login
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/search';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const status = err.error.httpStatus;
        if (status === 401) {
          setError('כתובת דוא״ל או סיסמה שגויים');
        } else if (status === 429) {
          setError('החשבון נעול זמנית עקב ניסיונות כניסה מרובים. נסה שוב מאוחר יותר');
        } else if (status === 0) {
          setError('שגיאת רשת — בדוק את החיבור');
        } else {
          setError('שגיאת שרת. פנה לתמיכה');
        }
      } else {
        setError('שגיאה לא צפויה');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-clinic-bg flex items-center justify-center px-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo / Clinic Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full bg-clinic-pink flex items-center justify-center mb-3 shadow-sm">
            <span className="text-clinic-gold font-bold text-2xl">מ</span>
          </div>
          <h1 className="text-2xl font-bold text-clinic-gold">מרפאת יופי</h1>
          <p className="text-sm text-clinic-muted mt-1">ניהול מרפאה</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-clinic-border p-8">
          <h2 className="text-lg font-semibold text-clinic-text mb-6 text-center">כניסה למערכת</h2>

          {error && (
            <div className="mb-4 text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1.5">
                דוא״ל
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={isLoading}
                className="w-full border border-clinic-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold/40 focus:border-clinic-gold disabled:opacity-50 disabled:cursor-not-allowed"
                dir="ltr"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-clinic-text mb-1.5">
                סיסמה
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full border border-clinic-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-gold/40 focus:border-clinic-gold disabled:opacity-50 disabled:cursor-not-allowed"
                dir="ltr"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password}
              className="w-full bg-clinic-gold text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span>מתחבר...</span>
                </>
              ) : (
                <span>כניסה</span>
              )}
            </button>
          </form>

          {/* Forgot password — placeholder for Phase 9+ */}
          <div className="mt-4 text-center">
            <button
              type="button"
              disabled
              className="text-xs text-clinic-muted opacity-50 cursor-not-allowed"
              title="זמין בקרוב"
            >
              שכחת סיסמה?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
