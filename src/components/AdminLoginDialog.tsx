import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AdminLoginDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminLoginDialog({ open, onClose, onSuccess }: AdminLoginDialogProps) {
  const { adminLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await adminLogin(username.trim(), password);
    setLoading(false);
    if (result.success) {
      setUsername("");
      setPassword("");
      onClose();
      onSuccess?.();
    } else {
      setError(result.error || "เกิดข้อผิดพลาด");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>เข้าสู่ระบบผู้ดูแล</DialogTitle>
          </div>
          <DialogDescription>กรุณากรอกข้อมูลบัญชีผู้ดูแลระบบ (Admin)</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-username">ชื่อผู้ใช้</Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">รหัสผ่าน</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !username || !password}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังเข้าสู่ระบบ…
              </>
            ) : (
              "เข้าสู่ระบบ"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
