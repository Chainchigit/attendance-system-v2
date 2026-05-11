import { useState } from "react";
import { ScanFace, ShieldCheck, Shield, BookOpen, Loader2, AlertCircle, Eye, EyeOff, Fingerprint, Zap, BarChart3 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export function LoginScreen() {
  const { adminLogin } = useAuth();
  const { t, locale, setLocale } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setLoading(true);
    const result = await adminLogin(username.trim(), password);
    setLoading(false);
    if (!result.success) setError(result.error ?? t("genericError"));
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col lg:flex-row">
      {/* ── Left panel — brand / hero ── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] gradient-hero flex-col justify-between p-10 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-2xl" />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
            <ScanFace className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">{t("appTitle")}</span>
        </div>

        {/* Center hero text */}
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-white/90 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {locale === "th" ? "ระบบออนไลน์" : "System Online"}
          </div>
          <h2 className="text-4xl font-bold text-white leading-snug">
            {locale === "th"
              ? <>ระบบบันทึก<br />การเข้าเรียน<br /><span className="text-amber-300">อัจฉริยะ</span></>
              : <>Smart<br />Classroom<br /><span className="text-amber-300">Attendance</span></>
            }
          </h2>
          <p className="text-white/70 text-base leading-relaxed max-w-xs">
            {locale === "th"
              ? "จดจำใบหน้า ตรวจสอบอัตโนมัติ บริหารข้อมูลการเข้าเรียนได้ง่ายดาย"
              : "Face recognition powered attendance — fast, accurate, and effortless."
            }
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { Icon: Fingerprint, label: locale === "th" ? "จดจำใบหน้า" : "Face ID" },
              { Icon: Zap,         label: locale === "th" ? "เรียลไทม์" : "Real-time" },
              { Icon: BarChart3,   label: locale === "th" ? "รายงาน" : "Reports" },
            ].map(({ Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-white text-sm">
                <Icon className="h-3.5 w-3.5" /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <p className="relative text-white/40 text-xs">
          © {new Date().getFullYear()} Attendance System
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card lg:justify-end">
          <div className="flex items-center gap-2 text-primary lg:hidden">
            <ScanFace className="h-5 w-5" />
            <span className="font-bold text-base tracking-tight text-foreground">{t("appTitle")}</span>
          </div>
          <button
            onClick={() => setLocale(locale === "th" ? "en" : "th")}
            className="text-sm font-medium px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            {locale === "th" ? "EN" : "ไทย"}
          </button>
        </div>

        {/* Form area */}
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm space-y-8">
            {/* Heading */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{t("loginTitle")}</h1>
              <p className="text-muted-foreground text-sm">{t("loginSubtitle")}</p>
            </div>

            {/* Card */}
            <div className="rounded-2xl border bg-card shadow-lg p-6 space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div className="space-y-1.5">
                  <label htmlFor="username" className="text-sm font-medium">
                    {t("loginUsername")}
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(null); }}
                    placeholder={locale === "th" ? "กรอกชื่อผู้ใช้" : "Enter username"}
                    autoComplete="username"
                    autoFocus
                    disabled={loading}
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium">
                    {t("loginPassword")}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 pr-10 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !username.trim() || !password}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl gradient-brand text-white text-sm font-semibold shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />{t("loginLoading")}</>
                    : t("loginButton")
                  }
                </button>
              </form>

              {/* Role hints */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">
                  {t("loginRoleHint")}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold">
                      <ShieldCheck className="h-3 w-3" /> {t("roleLead")}
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-200 bg-green-50 text-green-700 text-xs font-semibold">
                      <Shield className="h-3 w-3" /> {t("roleOperation")}
                    </span>
                    <span className="text-xs text-muted-foreground">— {t("loginRoleAdmin")}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold">
                      <BookOpen className="h-3 w-3" /> {t("roleTeacher")}
                    </span>
                    <span className="text-xs text-muted-foreground">— {t("loginRoleTeacher")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
