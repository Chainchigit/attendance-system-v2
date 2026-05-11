import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateDept } from "@/lib/i18n";
import {
  ShieldCheck, ShieldAlert, Users, Settings2, Trash2,
  LogOut, BarChart3, UserCheck, Clock, KeyRound, Shield,
  HelpCircle, BookOpen, Camera, ClipboardList, UserPlus, ChevronDown, ChevronUp, Loader2,
  Search, X,
} from "lucide-react";
import {
  useGetUsers,
  getGetUsersQueryKey,
  useDeleteUser,
  getGetUserDescriptorsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type AdminTab = "dashboard" | "employees" | "teachers" | "settings" | "help";

interface TeacherRow {
  id: number;
  username: string;
  displayName: string;
  faculty: string;
  department: string;
  subject: string;
  createdAt: string;
}

interface AdminStats {
  totalEmployees: number;
  registeredFace: number;
  todayCheckIns: number;
  todayCheckOuts: number;
  totalAttendanceRecords: number;
  last7Days: { date: string; checkIns: number; checkOuts: number }[];
}

export function Admin() {
  const { isAdmin, isLead, isOperation, adminToken, adminUsername, adminLogout, adminRole } = useAuth();
  const { t, locale } = useLanguage();
  const dateFnsLocale = locale === "th" ? th : enUS;
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  // Change my own password
  const [myCurrentPw, setMyCurrentPw]   = useState("");
  const [myNewUsername, setMyNewUsername] = useState("");
  const [myNewPw, setMyNewPw]           = useState("");
  const [myConfirmPw, setMyConfirmPw]   = useState("");
  const [isChangingMyPw, setIsChangingMyPw] = useState(false);
  // Teacher management
  const [showTeacherDialog, setShowTeacherDialog]   = useState(false);
  const [editingTeacher, setEditingTeacher]         = useState<TeacherRow | null>(null);
  const [deleteTeacherTarget, setDeleteTeacherTarget] = useState<TeacherRow | null>(null);
  const [tcName, setTcName]         = useState("");
  const [tcFaculty, setTcFaculty]   = useState("");
  const [tcDept, setTcDept]         = useState("");
  const [tcSubject, setTcSubject]   = useState("");
  const [tcUser, setTcUser]         = useState("");
  const [tcPw, setTcPw]             = useState("");
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [isDeletingTeacher, setIsDeletingTeacher] = useState(false);
  // Help FAQ accordion
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: usersData, isLoading: isLoadingUsers } = useGetUsers({
    query: { queryKey: getGetUsersQueryKey(), enabled: isAdmin },
  });

  const { data: statsData, isLoading: isLoadingStats } = useQuery<AdminStats>({
    queryKey: ["admin-stats", adminToken],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const deleteUser = useDeleteUser();

  const { data: teachersData, isLoading: isLoadingTeachers, refetch: refetchTeachers } = useQuery<{ teachers: TeacherRow[] }>({
    queryKey: ["teachers", adminToken],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/teachers`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch teachers");
      return res.json();
    },
    enabled: isAdmin,
  });

  const teachers = teachersData?.teachers || [];

  const openAddTeacher = () => {
    setEditingTeacher(null);
    setTcName(""); setTcFaculty(""); setTcDept(""); setTcSubject(""); setTcUser(""); setTcPw("");
    setShowTeacherDialog(true);
  };

  const openEditTeacher = (t: TeacherRow) => {
    setEditingTeacher(t);
    setTcName(t.displayName); setTcFaculty(t.faculty); setTcDept(t.department);
    setTcSubject(t.subject ?? ""); setTcUser(t.username); setTcPw("");
    setShowTeacherDialog(true);
  };

  const handleSaveTeacher = async () => {
    if (!tcName.trim() || !tcFaculty.trim() || !tcDept.trim() || !tcUser.trim()) {
      toast({ variant: "destructive", title: t("fillAllFields") });
      return;
    }
    if (!editingTeacher && !tcPw.trim()) {
      toast({ variant: "destructive", title: locale === "th" ? "กรุณากรอกรหัสผ่าน" : "Please enter a password" });
      return;
    }
    setIsSavingTeacher(true);
    try {
      const body: Record<string, string> = {
        displayName: tcName.trim(),
        faculty: tcFaculty.trim(),
        department: tcDept.trim(),
        subject: tcSubject.trim(),
        username: tcUser.trim(),
      };
      if (tcPw.trim()) body.password = tcPw.trim();

      const url = editingTeacher
        ? `${API_BASE}/api/teachers/${editingTeacher.id}`
        : `${API_BASE}/api/teachers`;
      const method = editingTeacher ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("genericError"));

      toast({
        title: editingTeacher ? t("teacherUpdated") : t("teacherCreated"),
        description: editingTeacher ? undefined : t("teacherCreatedDesc"),
      });
      setShowTeacherDialog(false);
      refetchTeachers();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("genericError"), description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSavingTeacher(false);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!deleteTeacherTarget) return;
    setIsDeletingTeacher(true);
    try {
      const res = await fetch(`${API_BASE}/api/teachers/${deleteTeacherTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("genericError"));
      }
      toast({ title: t("teacherDeleted") });
      setDeleteTeacherTarget(null);
      refetchTeachers();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t("genericError"), description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsDeletingTeacher(false);
    }
  };

  const users = usersData?.users || [];
  const withFace = users.filter((u) => u.hasFaceDescriptor);
  const withoutFace = users.filter((u) => !u.hasFaceDescriptor);

  const [empSearch, setEmpSearch] = useState("");
  const filteredUsers = useMemo(() => {
    if (!empSearch.trim()) return users;
    const q = empSearch.trim().toLowerCase();
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.department?.toLowerCase().includes(q) ||
      u.employeeId?.toLowerCase().includes(q)
    );
  }, [users, empSearch]);

  const statusStyle = (status: string) => {
    if (status === "good") return "bg-green-50 text-green-700 border-green-200";
    if (status === "needs_improvement") return "bg-red-50 text-red-700 border-red-200";
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  };
  const statusLabel = (status: string) => {
    if (status === "good") return t("overallStatusGood");
    if (status === "needs_improvement") return t("overallStatusNeeds");
    return t("overallStatusNormal");
  };

  const handleChangeMyPassword = async () => {
    if (!myCurrentPw || !myNewPw) {
      toast({ variant: "destructive", title: t("fillAllFields") });
      return;
    }
    if (myNewPw !== myConfirmPw) {
      toast({ variant: "destructive", title: t("passwordMismatch") });
      return;
    }
    setIsChangingMyPw(true);
    try {
      const body: Record<string, string> = {
        currentPassword: myCurrentPw,
        newPassword: myNewPw,
        confirmPassword: myConfirmPw,
      };
      if (isLead && myNewUsername.trim()) body.newUsername = myNewUsername.trim();

      const res = await fetch(`${API_BASE}/api/auth/change-my-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("genericError"));
      toast({ title: t("settingsMyPwSuccess"), description: t("settingsMyPwSuccessDesc") });
      setMyCurrentPw(""); setMyNewUsername(""); setMyNewPw(""); setMyConfirmPw("");
      setTimeout(() => adminLogout(), 1500);
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: t("passwordChangeFail"),
        description: err instanceof Error ? err.message : t("genericError"),
      });
    } finally {
      setIsChangingMyPw(false);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteUser.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: `${t("deleteStudent")} "${deleteTarget.name}"` });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetUserDescriptorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
          setDeleteTarget(null);
        },
        onError: () => {
          toast({ variant: "destructive", title: t("deleteFail"), description: t("deleteFailDesc") });
          setDeleteTarget(null);
        },
      }
    );
  };

  if (!isAdmin) return null;

  const chartData = (statsData?.last7Days || []).map((d) => ({
    date: format(new Date(d.date + "T12:00:00"), "dd MMM", { locale: dateFnsLocale }),
    [t("chartCheckIn")]:  d.checkIns,
    [t("chartCheckOut")]: d.checkOuts,
  }));

  const roleBadge = isLead ? (
    <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-0.5">
      <ShieldCheck className="h-3 w-3" /> {t("roleLead")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
      <Shield className="h-3 w-3" /> {t("roleOperation")}
    </span>
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">{t("adminTitle")}</h2>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground text-sm">
              {t("loggedInAs")} <span className="font-medium text-foreground">{adminUsername}</span>
            </p>
            {roleBadge}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={adminLogout}
          className="gap-1.5 text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </Button>
      </div>

      {/* Tab switcher — Settings only for Lead */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={activeTab === "dashboard" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("dashboard")}
          className="gap-1.5"
        >
          <BarChart3 className="h-4 w-4" />
          {t("tabDashboard")}
        </Button>
        <Button
          variant={activeTab === "employees" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("employees")}
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          {t("tabStudents")}
        </Button>
        {/* Teachers tab: all admins */}
        <Button
          variant={activeTab === "teachers" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("teachers")}
          className="gap-1.5"
        >
          <BookOpen className="h-4 w-4" />
          {t("tabTeachers")}
        </Button>
        {/* Settings tab: all admins */}
        <Button
          variant={activeTab === "settings" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("settings")}
          className="gap-1.5"
        >
          <KeyRound className="h-4 w-4" />
          {t("tabSettings")}
        </Button>
        {/* Help tab: all admins */}
        <Button
          variant={activeTab === "help" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("help")}
          className="gap-1.5"
        >
          <HelpCircle className="h-4 w-4" />
          {t("tabHelp")}
        </Button>
      </div>

      {/* ── Dashboard tab ── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("adminStatTotal")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingStats ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold">{statsData?.totalEmployees ?? 0}</div>}
                <p className="text-xs text-muted-foreground mt-1">{t("adminStatInSystem")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("adminStatFaceReg")}</CardTitle>
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingStats ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-green-600">{statsData?.registeredFace ?? 0}</div>}
                <p className="text-xs text-muted-foreground mt-1">{t("adminStatReady")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("adminStatCheckin")}</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingStats ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-blue-600">{statsData?.todayCheckIns ?? 0}</div>}
                <p className="text-xs text-muted-foreground mt-1">{t("adminStatPeople")}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("adminStatCheckout")}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoadingStats ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-orange-500">{statsData?.todayCheckOuts ?? 0}</div>}
                <p className="text-xs text-muted-foreground mt-1">{t("adminStatPeople")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("chartTitle")}</CardTitle>
              </div>
              <CardDescription>{t("chartDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingStats ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey={t("chartCheckIn")}  name={t("chartCheckIn")}  fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={t("chartCheckOut")} name={t("chartCheckOut")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("faceRegisteredBadge")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{isLoadingUsers ? "—" : withFace.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("noFaceRegistered")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{isLoadingUsers ? "—" : withoutFace.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalRecordsStat")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoadingStats ? "—" : statsData?.totalAttendanceRecords ?? 0}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Students tab ── */}
      {activeTab === "employees" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>{t("studentList")}</CardTitle>
              </div>
              {isOperation && (
                <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                  {locale === "th" ? "ดูได้อย่างเดียว" : "View only"}
                </span>
              )}
            </div>
            <CardDescription>{t("studentListDesc")}</CardDescription>
            {/* Search filter */}
            <div className="flex items-center gap-2 pt-1">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="relative flex-1 max-w-sm">
                <Input
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="pr-8 h-8 text-sm"
                />
                {empSearch && (
                  <button
                    onClick={() => setEmpSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={t("searchClear")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {empSearch && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {filteredUsers.length > 0
                    ? `${filteredUsers.length} ${t("studentsUnit")}`
                    : t("searchNoResult")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingUsers ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {empSearch ? t("searchNoResult") : t("noStudents")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[60px] text-center">{t("colNo")}</TableHead>
                      <TableHead>{t("colStudentId")}</TableHead>
                      <TableHead>{t("colName")}</TableHead>
                      <TableHead>{t("colDept")}</TableHead>
                      <TableHead className="text-center">{t("colWorkDays")}</TableHead>
                      <TableHead className="text-center">{t("colEarlyLeave")}</TableHead>
                      <TableHead className="text-center">{t("colSick")}</TableHead>
                      <TableHead className="text-center">{t("colPersonal")}</TableHead>
                      <TableHead className="text-center">{t("colAbsent")}</TableHead>
                      <TableHead className="text-center">{t("colStatus")}</TableHead>
                      <TableHead className="text-center">{t("colFace")}</TableHead>
                      {/* Delete column: Lead only */}
                      {isLead && <TableHead className="text-center w-[60px]">{t("colDelete")}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user, index) => (
                      <TableRow key={user.id} className="hover:bg-muted/30">
                        <TableCell className="text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {user.employeeId ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-sm">
                          {translateDept(user.department, locale) ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{user.workDays}</TableCell>
                        <TableCell className="text-center">
                          <span className={user.earlyLeaveCount > 0 ? "text-orange-600 font-medium" : ""}>{user.earlyLeaveCount}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={user.sickLeaveDays > 0 ? "text-blue-600 font-medium" : ""}>{user.sickLeaveDays}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={user.personalLeaveDays > 0 ? "text-purple-600 font-medium" : ""}>{user.personalLeaveDays}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={user.absentDays > 0 ? "text-red-600 font-medium" : ""}>{user.absentDays}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${statusStyle(user.overallStatus)}`}>
                            {statusLabel(user.overallStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={user.hasFaceDescriptor
                              ? "border-green-300 text-green-700 gap-1 text-xs"
                              : "border-orange-300 text-orange-600 gap-1 text-xs"}
                          >
                            {user.hasFaceDescriptor
                              ? <><ShieldCheck className="h-3 w-3" />{t("faceRegisteredBadge")}</>
                              : <><ShieldAlert className="h-3 w-3" />{t("noFaceBadge")}</>}
                          </Badge>
                        </TableCell>
                        {/* Delete button: Lead only */}
                        {isLead && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteTarget({ id: user.id, name: user.name })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Teachers tab ── */}
      {activeTab === "teachers" && isAdmin && (
        <div className="max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-50 p-3 mt-0.5">
                <BookOpen className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t("teachersMgmtTitle")}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{t("teachersMgmtDesc")}</p>
              </div>
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={openAddTeacher}>
              <UserPlus className="h-4 w-4" />
              {t("addTeacher")}
            </Button>
          </div>

          {/* Teacher list */}
          <Card>
            <CardContent className="pt-4 pb-2">
              {isLoadingTeachers ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
                </div>
              ) : teachers.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <p className="font-medium text-muted-foreground">{t("noTeachers")}</p>
                  <p className="text-sm text-muted-foreground">{t("noTeachersDesc")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("teacherDisplayName")}</TableHead>
                        <TableHead>{t("teacherFacultyLabel")}</TableHead>
                        <TableHead>{t("teacherDepartmentLabel")}</TableHead>
                        <TableHead>{t("teacherUsernameLabel")}</TableHead>
                        <TableHead className="text-center w-24">{locale === "th" ? "จัดการ" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teachers.map((teacher) => (
                        <TableRow key={teacher.id}>
                          <TableCell className="font-medium">{teacher.displayName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                              {teacher.faculty}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{teacher.department}</TableCell>
                          <TableCell className="font-mono text-sm">{teacher.username}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => openEditTeacher(teacher)}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              {isLead && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                  onClick={() => setDeleteTeacherTarget(teacher)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Settings tab: all admins ── */}
      {activeTab === "settings" && isAdmin && (
        <div className="max-w-lg space-y-6">
          {/* Current account info */}
          <Card className={isLead ? "border-purple-200 bg-purple-50/40" : "border-green-200 bg-green-50/40"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${isLead ? "bg-purple-100" : "bg-green-100"}`}>
                  {isLead
                    ? <ShieldCheck className="h-5 w-5 text-purple-600" />
                    : <Shield className="h-5 w-5 text-green-600" />
                  }
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("currentUsernameLabel")} ({isLead ? t("roleLead") : t("roleOperation")})
                  </p>
                  <p className="font-semibold text-foreground">{adminUsername}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change my own password */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t("settingsMyPwTitle")}</CardTitle>
              </div>
              <CardDescription>{t("settingsMyPwDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="myCurrentPw">{t("settingsMyPwCurrentPw")}</Label>
                <Input
                  id="myCurrentPw"
                  type="password"
                  value={myCurrentPw}
                  onChange={(e) => setMyCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              {/* Lead can also change username */}
              {isLead && (
                <div className="space-y-2">
                  <Label htmlFor="myNewUsername">{t("settingsMyPwNewUsername")}</Label>
                  <Input
                    id="myNewUsername"
                    type="text"
                    value={myNewUsername}
                    onChange={(e) => setMyNewUsername(e.target.value)}
                    placeholder={adminUsername ?? ""}
                    autoComplete="username"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="myNewPw">{t("settingsMyPwNewPw")}</Label>
                <Input
                  id="myNewPw"
                  type="password"
                  value={myNewPw}
                  onChange={(e) => setMyNewPw(e.target.value)}
                  placeholder={locale === "th" ? "อย่างน้อย 4 ตัวอักษร" : "At least 4 characters"}
                  autoComplete="new-password"
                />
              </div>
              {myNewPw && (
                <div className="space-y-2">
                  <Label htmlFor="myConfirmPw">{t("settingsMyPwConfirmPw")}</Label>
                  <Input
                    id="myConfirmPw"
                    type="password"
                    value={myConfirmPw}
                    onChange={(e) => setMyConfirmPw(e.target.value)}
                    placeholder={locale === "th" ? "ยืนยันรหัสผ่านอีกครั้ง" : "Repeat new password"}
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === "Enter" && handleChangeMyPassword()}
                  />
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={handleChangeMyPassword}
                disabled={isChangingMyPw}
              >
                <KeyRound className="h-4 w-4" />
                {isChangingMyPw ? t("settingsMyPwSaving") : t("settingsMyPwSave")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Help tab ── */}
      {activeTab === "help" && (
        <div className="max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-50 p-3 mt-0.5">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{t("helpTitle")}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{t("helpSubtitle")}</p>
            </div>
          </div>

          {/* FAQ accordion */}
          {[
            {
              icon: <UserPlus className="h-4 w-4 text-purple-600" />,
              q: locale === "th" ? "วิธีลงทะเบียนนักเรียนใหม่" : "How to register a new student",
              a: locale === "th"
                ? "ไปที่แท็บ ลงทะเบียน (ต้องล็อกอิน Admin ก่อน) → กรอกชื่อ รหัสนักศึกษา และสาขาวิชา → อัปโหลดรูปถ่ายที่มีใบหน้าชัดเจน 1 ใบหน้า → กด ลงทะเบียน ระบบจะดึงข้อมูลใบหน้าจากรูปและบันทึกไว้ในฐานข้อมูล"
                : "Go to the Register tab (Admin login required) → Enter name, student ID, and department → Upload a clear photo with exactly 1 face → Click Register. The system extracts the face descriptor and stores it.",
            },
            {
              icon: <Camera className="h-4 w-4 text-blue-600" />,
              q: locale === "th" ? "วิธีสแกนใบหน้าเพื่อเข้า-ออกห้องเรียน" : "How to check in/out with face scan",
              a: locale === "th"
                ? "ไปที่แท็บ เข้า-ออกห้องเรียน → กด เริ่มสแกน → ยืนตรงหน้ากล้องให้ใบหน้าอยู่ในกรอบ → ระบบจะจับคู่ใบหน้าอัตโนมัติและบันทึกเวลา ครั้งแรก = เข้าเรียน ครั้งที่สอง = ออกจากห้อง (สูงสุด 2 ครั้งต่อวัน)"
                : "Go to the Check In/Out tab → Click Start Scan → Stand in front of the camera with your face in the frame → The system auto-matches and records the time. First scan = Check In, second scan = Check Out (max 2 per day).",
            },
            {
              icon: <ClipboardList className="h-4 w-4 text-emerald-600" />,
              q: locale === "th" ? "วิธีดูบันทึกการเข้าเรียน" : "How to view attendance records",
              a: locale === "th"
                ? "นักเรียน: สแกนใบหน้าที่หน้า เข้า-ออกห้องเรียน ก่อน จากนั้นไปที่แท็บ บันทึกการเข้าเรียน จะเห็นข้อมูลของตนเอง\nAdmin: ล็อกอินที่แท็บ ผู้ดูแลระบบ แล้วไปที่ บันทึกการเข้าเรียน จะเห็นข้อมูลนักเรียนทั้งหมด สามารถกรองและเรียงข้อมูลได้"
                : "Students: Scan your face on the Check In/Out tab first, then go to Attendance Records to view your own data.\nAdmin: Log in at the Admin tab, then go to Attendance Records to view all students' data with filtering and sorting.",
            },
            {
              icon: <ShieldCheck className="h-4 w-4 text-purple-600" />,
              q: locale === "th" ? "ความแตกต่างระหว่าง Lead และ Operation" : "Difference between Lead and Operation roles",
              a: locale === "th"
                ? "Lead (สีม่วง): เข้าถึงทุกฟีเจอร์ — ลบนักเรียน, เปลี่ยน credentials ทั้งสองบัญชี, ดู Dashboard และนักเรียนทั้งหมด\nOperation (สีเขียว): ดู Dashboard และรายชื่อนักเรียน — ไม่สามารถลบข้อมูลหรือเปลี่ยนรหัสผ่านได้"
                : "Lead (purple): Full access — delete students, change credentials for both accounts, view Dashboard and all students.\nOperation (green): View Dashboard and student list — cannot delete data or change passwords.",
            },
            {
              icon: <KeyRound className="h-4 w-4 text-orange-500" />,
              q: locale === "th" ? "วิธีเปลี่ยนรหัสผ่านบัญชี" : "How to change account passwords",
              a: locale === "th"
                ? "ล็อกอินเป็น Lead → ไปที่แท็บ ผู้ดูแลระบบ → การตั้งค่า\n• เปลี่ยนรหัสผ่าน Lead: กรอกรหัสผ่านปัจจุบันและข้อมูลใหม่ — ระบบจะล็อกเอาต์อัตโนมัติ\n• เปลี่ยนรหัสผ่าน Operation: กรอกรหัสผ่าน Lead เพื่อยืนยันตัวตน จากนั้นกรอกรหัสผ่านใหม่ของ Operation"
                : "Log in as Lead → go to Admin tab → Settings.\n• Change Lead password: enter current password and new details — system will log you out automatically.\n• Change Operation password: enter your Lead password to confirm identity, then enter the new Operation password.",
            },
            {
              icon: <UserPlus className="h-4 w-4 text-rose-500" />,
              q: locale === "th" ? "จะอัปเดตรูปใบหน้าของนักเรียนได้อย่างไร" : "How to update a student's face photo",
              a: locale === "th"
                ? "ไปที่แท็บ ลงทะเบียน → กรอกชื่อนักเรียนคนเดิม → อัปโหลดรูปใหม่ → กด ลงทะเบียน ระบบจะอัปเดตข้อมูลใบหน้าของนักเรียนคนนั้นโดยอัตโนมัติ (ไม่สร้างรายการซ้ำ)"
                : "Go to the Register tab → enter the same student name → upload a new photo → click Register. The system will automatically update that student's face descriptor without creating a duplicate.",
            },
          ].map((item, i) => (
            <Card key={i} className="overflow-hidden">
              <button
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-muted p-1.5">{item.icon}</div>
                  <span className="font-medium text-sm">{item.q}</span>
                </div>
                {openFaq === i
                  ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground whitespace-pre-line border-t bg-muted/20 pt-3">
                  {item.a}
                </div>
              )}
            </Card>
          ))}

          {/* Contact / note */}
          <Card className="border-blue-200 bg-blue-50/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {locale === "th"
                    ? "หากพบปัญหาหรือต้องการความช่วยเหลือเพิ่มเติม กรุณาติดต่อผู้ดูแลระบบ (Lead)"
                    : "If you encounter any issues or need further assistance, please contact your Lead administrator."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Teacher Add / Edit Dialog ── */}
      <Dialog
        open={showTeacherDialog}
        onOpenChange={(open) => { if (!open) setShowTeacherDialog(false); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTeacher ? t("editTeacher") : t("addTeacher")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tc-displayName">{t("teacherDisplayName")}</Label>
              <Input
                id="tc-displayName"
                value={tcName}
                onChange={(e) => setTcName(e.target.value)}
                placeholder={locale === "th" ? "ชื่อ-นามสกุล อาจารย์" : "Full name"}
                disabled={isSavingTeacher}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-faculty">{t("teacherFacultyLabel")}</Label>
              <Input
                id="tc-faculty"
                value={tcFaculty}
                onChange={(e) => setTcFaculty(e.target.value)}
                placeholder={locale === "th" ? "เช่น วิศวกรรมศาสตร์" : "e.g. Engineering"}
                disabled={isSavingTeacher}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-dept">{t("teacherDepartmentLabel")}</Label>
              <Input
                id="tc-dept"
                value={tcDept}
                onChange={(e) => setTcDept(e.target.value)}
                placeholder={locale === "th" ? "เช่น วิศวกรรมคอมพิวเตอร์" : "e.g. Computer Engineering"}
                disabled={isSavingTeacher}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-subject">{t("teacherSubjectLabel")}</Label>
              <Input
                id="tc-subject"
                value={tcSubject}
                onChange={(e) => setTcSubject(e.target.value)}
                placeholder={locale === "th" ? "เช่น คณิตศาสตร์ประยุกต์, ฟิสิกส์" : "e.g. Applied Mathematics, Physics"}
                disabled={isSavingTeacher}
              />
            </div>
            <div className="border-t pt-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {locale === "th" ? "ข้อมูลล็อกอิน" : "Login credentials"}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="tc-username">{t("teacherUsernameLabel")}</Label>
                <Input
                  id="tc-username"
                  value={tcUser}
                  onChange={(e) => setTcUser(e.target.value)}
                  placeholder={locale === "th" ? "ชื่อผู้ใช้ (ภาษาอังกฤษ)" : "Username (English)"}
                  autoComplete="username"
                  disabled={isSavingTeacher}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tc-password">
                  {editingTeacher ? t("teacherNewPasswordLabel") : t("teacherPasswordLabel")}
                </Label>
                <Input
                  id="tc-password"
                  type="password"
                  value={tcPw}
                  onChange={(e) => setTcPw(e.target.value)}
                  placeholder={editingTeacher
                    ? (locale === "th" ? "เว้นว่างเพื่อไม่เปลี่ยน" : "Leave blank to keep")
                    : (locale === "th" ? "อย่างน้อย 4 ตัวอักษร" : "At least 4 characters")}
                  autoComplete="new-password"
                  disabled={isSavingTeacher}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTeacherDialog(false)} disabled={isSavingTeacher}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSaveTeacher} disabled={isSavingTeacher} className="gap-1.5">
              {isSavingTeacher
                ? <><Loader2 className="h-4 w-4 animate-spin" />{t("savingTeacher")}</>
                : t("saveTeacher")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Teacher Delete confirmation ── */}
      <AlertDialog
        open={!!deleteTeacherTarget}
        onOpenChange={(open) => !open && setDeleteTeacherTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("teacherDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleteTeacherTarget?.displayName}</span>
              {" — "}{deleteTeacherTarget?.faculty} / {deleteTeacherTarget?.department}
              <br />
              <span className="text-red-600">{t("teacherDeleteConfirmDesc")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeacher}
              disabled={isDeletingTeacher}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeletingTeacher ? t("deleting") : t("deleteTeacher")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmPre")}{" "}
              <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span>{" "}
              {t("deleteConfirmPost")}
              <br />
              <span className="text-red-600">{t("deleteConfirmWarn")}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteUser.isPending ? t("deleting") : t("deleteStudent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
