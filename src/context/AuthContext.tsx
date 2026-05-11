import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export type AdminRole = "lead" | "operation" | "teacher";

export interface FaceVerifiedUser {
  id: number;
  name: string;
}

interface AuthContextType {
  adminToken: string | null;
  isAdmin: boolean;
  isLead: boolean;
  isOperation: boolean;
  isTeacher: boolean;
  adminRole: AdminRole | null;
  adminUsername: string | null;
  teacherDisplayName: string | null;
  teacherFaculty: string | null;
  teacherDepartment: string | null;
  teacherSubject: string | null;
  adminLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  adminLogout: () => void;

  faceVerifiedUser: FaceVerifiedUser | null;
  setFaceVerifiedUser: (user: FaceVerifiedUser | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    sessionStorage.getItem("adminToken")
  );
  const [adminUsername, setAdminUsername] = useState<string | null>(() =>
    sessionStorage.getItem("adminUsername")
  );
  const [adminRole, setAdminRole] = useState<AdminRole | null>(() => {
    const saved = sessionStorage.getItem("adminRole");
    if (saved === "lead" || saved === "operation" || saved === "teacher") return saved;
    return null;
  });
  const [teacherDisplayName, setTeacherDisplayName] = useState<string | null>(() =>
    sessionStorage.getItem("teacherDisplayName")
  );
  const [teacherFaculty, setTeacherFaculty] = useState<string | null>(() =>
    sessionStorage.getItem("teacherFaculty")
  );
  const [teacherDepartment, setTeacherDepartment] = useState<string | null>(() =>
    sessionStorage.getItem("teacherDepartment")
  );
  const [teacherSubject, setTeacherSubject] = useState<string | null>(() =>
    sessionStorage.getItem("teacherSubject")
  );
  const [faceVerifiedUser, setFaceVerifiedUser] = useState<FaceVerifiedUser | null>(null);

  if (adminToken) {
    setAuthTokenGetter(() => adminToken);
  }

  const adminLogin = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "เกิดข้อผิดพลาด" };
      }
      const role: AdminRole = data.role === "lead" ? "lead" : data.role === "teacher" ? "teacher" : "operation";
      setAdminToken(data.token);
      setAdminUsername(data.username);
      setAdminRole(role);
      sessionStorage.setItem("adminToken", data.token);
      sessionStorage.setItem("adminUsername", data.username);
      sessionStorage.setItem("adminRole", role);

      // Teacher profile info (from DB teacher login)
      const dn   = data.displayName  ?? null;
      const fac  = data.faculty      ?? null;
      const dept = data.department   ?? null;
      const subj = data.subject      ?? null;
      setTeacherDisplayName(dn);
      setTeacherFaculty(fac);
      setTeacherDepartment(dept);
      setTeacherSubject(subj);
      if (dn)   sessionStorage.setItem("teacherDisplayName", dn);
      else      sessionStorage.removeItem("teacherDisplayName");
      if (fac)  sessionStorage.setItem("teacherFaculty", fac);
      else      sessionStorage.removeItem("teacherFaculty");
      if (dept) sessionStorage.setItem("teacherDepartment", dept);
      else      sessionStorage.removeItem("teacherDepartment");
      if (subj) sessionStorage.setItem("teacherSubject", subj);
      else      sessionStorage.removeItem("teacherSubject");

      setAuthTokenGetter(() => data.token);
      return { success: true };
    } catch {
      return { success: false, error: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้" };
    }
  }, []);

  const adminLogout = useCallback(() => {
    setAdminToken(null);
    setAdminUsername(null);
    setAdminRole(null);
    setTeacherDisplayName(null);
    setTeacherFaculty(null);
    setTeacherDepartment(null);
    setTeacherSubject(null);
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminUsername");
    sessionStorage.removeItem("adminRole");
    sessionStorage.removeItem("teacherDisplayName");
    sessionStorage.removeItem("teacherFaculty");
    sessionStorage.removeItem("teacherDepartment");
    sessionStorage.removeItem("teacherSubject");
    setAuthTokenGetter(null);
  }, []);

  const isAdmin     = adminRole === "lead" || adminRole === "operation";
  const isLead      = adminRole === "lead";
  const isOperation = adminRole === "operation";
  const isTeacher   = adminRole === "teacher";

  return (
    <AuthContext.Provider
      value={{
        adminToken,
        isAdmin,
        isLead,
        isOperation,
        isTeacher,
        adminRole,
        adminUsername,
        teacherDisplayName,
        teacherFaculty,
        teacherDepartment,
        teacherSubject,
        adminLogin,
        adminLogout,
        faceVerifiedUser,
        setFaceVerifiedUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
