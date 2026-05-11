import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const { adminToken, adminLogout } = useAuth();
  const { t, locale } = useLanguage();
  const { toast } = useToast();

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [showCon,    setShowCon]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [done,       setDone]       = useState(false);

  const reset = () => {
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setShowCur(false); setShowNew(false); setShowCon(false);
    setLoading(false); setDone(false);
  };

  const handleClose = (v: boolean) => {
    if (!loading) { reset(); onOpenChange(v); }
  };

  const mismatch = newPw.length > 0 && confirmPw.length > 0 && newPw !== confirmPw;
  const tooShort = newPw.length > 0 && newPw.length < 4;
  const canSubmit = currentPw.length > 0 && newPw.length >= 4 && newPw === confirmPw && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-my-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
          confirmPassword: confirmPw,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("genericError"));

      setDone(true);
      toast({ title: t("settingsMyPwSuccess"), description: t("settingsMyPwSuccessDesc") });
      setTimeout(() => { handleClose(false); adminLogout(); }, 1800);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("passwordChangeFail"),
        description: err instanceof Error ? err.message : t("genericError"),
      });
    } finally {
      setLoading(false);
    }
  };

  const PwInput = ({
    id, value, onChange, show, onToggle, placeholder, autoComplete, label,
  }: {
    id: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; placeholder: string;
    autoComplete: string; label: string;
  }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={loading || done}
          className="flex h-10 w-full rounded-xl border border-input bg-background px-3.5 py-2 pr-10 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
              <KeyRound className="h-4 w-4 text-white" />
            </div>
            {t("settingsMyPwTitle")}
          </DialogTitle>
          <DialogDescription>{t("settingsMyPwDesc")}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-50 border border-green-200">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="font-semibold text-center">{t("settingsMyPwSuccess")}</p>
            <p className="text-sm text-muted-foreground text-center">{t("settingsMyPwSuccessDesc")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <PwInput
              id="cpd-cur"
              label={t("settingsMyPwCurrentPw")}
              value={currentPw}
              onChange={setCurrentPw}
              show={showCur}
              onToggle={() => setShowCur((p) => !p)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <PwInput
              id="cpd-new"
              label={t("settingsMyPwNewPw")}
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              onToggle={() => setShowNew((p) => !p)}
              placeholder={locale === "th" ? "อย่างน้อย 4 ตัวอักษร" : "At least 4 characters"}
              autoComplete="new-password"
            />
            {tooShort && (
              <p className="text-xs text-destructive -mt-2">
                {locale === "th" ? "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" : "Password must be at least 4 characters"}
              </p>
            )}
            {newPw.length >= 4 && (
              <PwInput
                id="cpd-con"
                label={t("settingsMyPwConfirmPw")}
                value={confirmPw}
                onChange={setConfirmPw}
                show={showCon}
                onToggle={() => setShowCon((p) => !p)}
                placeholder={locale === "th" ? "ยืนยันรหัสผ่านอีกครั้ง" : "Repeat new password"}
                autoComplete="new-password"
              />
            )}
            {mismatch && (
              <p className="text-xs text-destructive">
                {t("passwordMismatch")}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="flex-1 gradient-brand text-white hover:opacity-90 gap-2 rounded-xl"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{t("settingsMyPwSaving")}</>
                  : <><KeyRound className="h-4 w-4" />{t("settingsMyPwSave")}</>
                }
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={loading}
                className="rounded-xl"
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
