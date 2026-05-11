import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, ClipboardCheck, Activity, ScanFace, UserCheck, UserX,
  Clock, CalendarDays, TrendingUp, LogIn, LogOut, ShieldCheck, BookOpen,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { translateDept } from "@/lib/i18n";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface PublicStats {
  totalEmployees: number;
  todayCheckIns: number;
}

interface UserDashboard {
  userId: number;
  userName: string;
  department: string | null;
  workDays: number;
  totalCheckIns: number;
  totalCheckOuts: number;
  lastCheckIn: string | null;
  todayRecords: { id: number; type: string; timestamp: string }[];
  last7Days: { date: string; checkIns: number; checkOuts: number }[];
}

interface EmployeeSummaryItem {
  id: number;
  name: string;
  department: string | null;
  workDays: number;
  todayStatus: "present" | "checked_out" | "absent";
  lastActivity: string | null;
}

interface AdminDashboard {
  totalEmployees: number;
  todayPresent: number;
  todayCheckedOut: number;
  todayAbsent: number;
  employeeSummary: EmployeeSummaryItem[];
  last7Days: { date: string; checkIns: number; checkOuts: number }[];
}

const iconGradients: Record<string, string> = {
  blue:   "from-blue-500 to-indigo-600",
  green:  "from-emerald-500 to-green-600",
  orange: "from-orange-400 to-amber-500",
  purple: "from-purple-500 to-violet-600",
  red:    "from-red-500 to-rose-600",
  amber:  "from-amber-400 to-orange-500",
  teal:   "from-teal-500 to-cyan-600",
};

function StatCard({
  title, value, sub, icon: Icon, loading, gradient = "blue",
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  loading?: boolean;
  gradient?: keyof typeof iconGradients;
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
            {loading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <p className="text-3xl font-bold tracking-tight">{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br ${iconGradients[gradient]} shadow-sm shrink-0`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Last7DaysBar({ data, legendIn, legendOut }: {
  data: { date: string; checkIns: number; checkOuts: number }[];
  legendIn: string;
  legendOut: string;
}) {
  const max = Math.max(...data.map((d) => Math.max(d.checkIns, d.checkOuts)), 1);
  const { locale } = useLanguage();
  const dateFnsLocale = locale === "th" ? th : enUS;
  return (
    <div className="flex items-end gap-1.5 h-28 w-full">
      {data.map((d) => {
        const inH  = (d.checkIns / max) * 100;
        const outH = (d.checkOuts / max) * 100;
        const label = format(new Date(d.date + "T12:00:00"), "EEE", { locale: dateFnsLocale });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-end gap-0.5 w-full h-20">
              <div
                className="flex-1 rounded-md bg-gradient-to-t from-indigo-500 to-blue-400 transition-all"
                style={{ height: `${inH}%`, minHeight: d.checkIns > 0 ? "6px" : "0" }}
                title={`${legendIn}: ${d.checkIns}`}
              />
              <div
                className="flex-1 rounded-md bg-gradient-to-t from-emerald-500 to-green-400 transition-all"
                style={{ height: `${outH}%`, minHeight: d.checkOuts > 0 ? "6px" : "0" }}
                title={`${legendOut}: ${d.checkOuts}`}
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function UserDashboardView({ userId, userName }: { userId: number; userName: string }) {
  const { t, locale } = useLanguage();
  const dateFnsLocale = locale === "th" ? th : enUS;
  const { data, isLoading } = useQuery<UserDashboard>({
    queryKey: ["dashboard-user", userId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/dashboard/user?userId=${userId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const todayLabel = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* User banner */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 to-primary/4 px-5 py-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-brand shadow-sm shrink-0">
          <ScanFace className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{userName}</p>
          {data?.department
            ? <p className="text-xs text-muted-foreground mt-0.5">{translateDept(data.department, locale)}</p>
            : <p className="text-xs text-muted-foreground mt-0.5">{todayLabel}</p>
          }
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard title={t("totalClassDays")} value={data?.workDays ?? 0} sub={t("daysUnit")} icon={CalendarDays} loading={isLoading} gradient="blue" />
        <StatCard title={t("checkInCount")} value={data?.totalCheckIns ?? 0} sub={t("allTime")} icon={LogIn} loading={isLoading} gradient="green" />
        <StatCard title={t("checkOutCount")} value={data?.totalCheckOuts ?? 0} sub={t("allTime")} icon={LogOut} loading={isLoading} gradient="orange" />
        <StatCard
          title={t("lastCheckIn")}
          value={data?.lastCheckIn ? format(new Date(data.lastCheckIn), "HH:mm") : "—"}
          sub={data?.lastCheckIn ? format(new Date(data.lastCheckIn), "dd MMM", { locale: dateFnsLocale }) : t("noRecord")}
          icon={Clock}
          loading={isLoading}
          gradient="purple"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("todaySection")} — {todayLabel}</CardTitle>
            <CardDescription className="text-xs">{t("todayAttendance")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ) : data?.todayRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <ClipboardCheck className="h-8 w-8 opacity-30" />
                <p className="text-sm">{t("noRecordsToday")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data?.todayRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <Badge variant="outline" className={
                      r.type === "check_in"
                        ? "border-indigo-200 text-indigo-700 bg-indigo-50 gap-1"
                        : "border-emerald-200 text-emerald-700 bg-emerald-50 gap-1"
                    }>
                      {r.type === "check_in" ? <LogIn className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
                      {r.type === "check_in" ? t("checkIn") : t("checkOut")}
                    </Badge>
                    <span className="text-sm font-mono text-muted-foreground">
                      {format(new Date(r.timestamp), "HH:mm น.")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("last7Days")}</CardTitle>
            <CardDescription className="text-xs inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-gradient-to-br from-indigo-500 to-blue-400 inline-block" /> {t("chartLegendIn")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-gradient-to-br from-emerald-500 to-green-400 inline-block" /> {t("chartLegendOut")}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading
              ? <Skeleton className="h-28 w-full" />
              : <Last7DaysBar data={data?.last7Days ?? []} legendIn={t("chartLegendIn")} legendOut={t("chartLegendOut")} />
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminDashboardView({ adminToken }: { adminToken: string }) {
  const { t, locale } = useLanguage();
  const dateFnsLocale = locale === "th" ? th : enUS;
  const { data, isLoading } = useQuery<AdminDashboard>({
    queryKey: ["dashboard-admin"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/dashboard/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: healthData } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/healthz`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const todayLabel = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const statusStyle: Record<string, string> = {
    present:     "border-indigo-200 text-indigo-700 bg-indigo-50",
    checked_out: "border-emerald-200 text-emerald-700 bg-emerald-50",
    absent:      "border-red-200 text-red-600 bg-red-50",
  };
  const statusLabel: Record<string, string> = {
    present:     t("statusInClass"),
    checked_out: t("statusLeftClass"),
    absent:      t("statusAbsent"),
  };

  const isOnline = healthData?.status === "ok";

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/8 to-primary/4 px-5 py-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-brand shadow-sm shrink-0">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{t("classroomOverview")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{todayLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
          <span className="text-xs font-medium text-muted-foreground hidden sm:block">
            {isOnline ? t("online") : t("checking")}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard title={t("totalStudents")} value={data?.totalEmployees ?? 0} sub={t("registeredInSys")} icon={Users} loading={isLoading} gradient="blue" />
        <StatCard title={t("attendingToday")} value={data?.todayPresent ?? 0} sub={t("inClassroomSub")} icon={UserCheck} loading={isLoading} gradient="green" />
        <StatCard title={t("notYetAttended")} value={data?.todayAbsent ?? 0} sub={t("rightNow")} icon={UserX} loading={isLoading} gradient="red" />
        <StatCard
          title={t("systemStatus")}
          value={isOnline ? t("online") : t("checking")}
          sub={t("apiConnected")}
          icon={Activity}
          loading={isLoading}
          gradient={isOnline ? "teal" : "amber"}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("last7DaysChart")}</CardTitle>
            <CardDescription className="text-xs inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-gradient-to-br from-indigo-500 to-blue-400 inline-block" /> {t("chartLegendIn")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-gradient-to-br from-emerald-500 to-green-400 inline-block" /> {t("chartLegendOut")}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading
              ? <Skeleton className="h-28 w-full" />
              : <Last7DaysBar data={data?.last7Days ?? []} legendIn={t("chartLegendIn")} legendOut={t("chartLegendOut")} />
            }
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("todayByDept")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-full" />)}
              </div>
            ) : (
              <div className="space-y-1">
                {(() => {
                  const deptMap: Record<string, { present: number; total: number }> = {};
                  for (const emp of data?.employeeSummary ?? []) {
                    const dept = translateDept(emp.department, locale) ?? t("noDept");
                    if (!deptMap[dept]) deptMap[dept] = { present: 0, total: 0 };
                    deptMap[dept].total++;
                    if (emp.todayStatus !== "absent") deptMap[dept].present++;
                  }
                  return Object.entries(deptMap).map(([dept, s]) => {
                    const pct = s.total > 0 ? Math.round((s.present / s.total) * 100) : 0;
                    return (
                      <div key={dept} className="py-2 border-b last:border-0">
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-muted-foreground truncate max-w-[55%] text-xs">{dept}</span>
                          <span className="font-semibold text-xs">{s.present}/{s.total} {t("peopleUnit")}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
                {(data?.employeeSummary ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("noData")}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Student list */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">{t("allStudentsStatus")}</CardTitle>
          <CardDescription className="text-xs">{t("allStudentsToday")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (data?.employeeSummary ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("noStudentsInSys")}</p>
          ) : (
            <div className="divide-y">
              {data?.employeeSummary.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-3 gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{emp.name}</p>
                    {emp.department && (
                      <p className="text-xs text-muted-foreground">{translateDept(emp.department, locale)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {emp.workDays} {t("daysUnit")}
                    </span>
                    <Badge variant="outline" className={`text-xs ${statusStyle[emp.todayStatus]}`}>
                      {statusLabel[emp.todayStatus]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PublicView() {
  const { t, locale } = useLanguage();
  const { data: statsData, isLoading } = useQuery<PublicStats>({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: healthData } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/healthz`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const todayLabel = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Prompt card */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 px-6 py-8 text-center space-y-3">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand mx-auto shadow-lg">
          <ScanFace className="h-8 w-8 text-white" />
        </div>
        <p className="font-semibold text-foreground">{t("homeScanPrompt")}</p>
        <p className="text-xs text-muted-foreground">{todayLabel}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title={t("totalStudents")} value={statsData?.totalEmployees ?? 0} sub={t("registeredInSys")} icon={Users} loading={isLoading} gradient="blue" />
        <StatCard title={t("presentToday")} value={statsData?.todayCheckIns ?? 0} sub={todayLabel} icon={ClipboardCheck} loading={isLoading} gradient="green" />
        <StatCard
          title={t("systemStatus")}
          value={healthData?.status === "ok" ? t("online") : t("checking")}
          sub={t("apiConnected")}
          icon={Activity}
          gradient={healthData?.status === "ok" ? "teal" : "amber"}
        />
      </div>
    </div>
  );
}

function TeacherDashboardView({
  adminToken, teacherDisplayName, teacherFaculty, teacherDepartment, teacherSubject,
}: {
  adminToken: string;
  teacherDisplayName: string | null;
  teacherFaculty: string | null;
  teacherDepartment: string | null;
  teacherSubject: string | null;
}) {
  const { t, locale } = useLanguage();
  const dateFnsLocale = locale === "th" ? th : enUS;
  const { data, isLoading } = useQuery<AdminDashboard>({
    queryKey: ["dashboard-teacher"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/dashboard/admin`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const todayLabel = new Date().toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const statusStyle: Record<string, string> = {
    present:     "border-indigo-200 text-indigo-700 bg-indigo-50",
    checked_out: "border-emerald-200 text-emerald-700 bg-emerald-50",
    absent:      "border-red-200 text-red-600 bg-red-50",
  };
  const statusLabel: Record<string, string> = {
    present:     t("statusInClass"),
    checked_out: t("statusLeftClass"),
    absent:      t("statusAbsent"),
  };

  return (
    <div className="space-y-6">
      {/* Teacher classroom banner */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
        <div className="flex items-start gap-3.5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm shrink-0 mt-0.5">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900">{teacherDisplayName ?? t("teacherModeActive")}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
              {teacherSubject && (
                <p className="text-xs text-amber-700 font-medium">
                  {t("teacherSubjectInfo")}: <span className="font-semibold">{teacherSubject}</span>
                </p>
              )}
              {teacherFaculty && (
                <p className="text-xs text-amber-600">{t("teacherFacultyLabel")}: {teacherFaculty}</p>
              )}
              {teacherDepartment && (
                <p className="text-xs text-amber-600">{t("teacherDepartmentLabel")}: {teacherDepartment}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-amber-600 shrink-0 hidden sm:block">{todayLabel}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard title={t("totalStudents")}   value={data?.totalEmployees ?? 0} sub={t("registeredInSys")}  icon={Users}     loading={isLoading} gradient="blue" />
        <StatCard title={t("attendingToday")}  value={data?.todayPresent   ?? 0} sub={t("inClassroomSub")}  icon={UserCheck}  loading={isLoading} gradient="green" />
        <StatCard title={t("notYetAttended")}  value={data?.todayAbsent    ?? 0} sub={t("rightNow")}        icon={UserX}      loading={isLoading} gradient="red" />
        <StatCard title={t("checkOutCount")}   value={data?.todayCheckedOut ?? 0} sub={todayLabel}           icon={LogOut}     loading={isLoading} gradient="orange" />
      </div>

      {/* Chart + student list */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("last7DaysChart")}</CardTitle>
            <CardDescription className="text-xs inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-gradient-to-br from-indigo-500 to-blue-400 inline-block" /> {t("chartLegendIn")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-gradient-to-br from-emerald-500 to-green-400 inline-block" /> {t("chartLegendOut")}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading
              ? <Skeleton className="h-28 w-full" />
              : <Last7DaysBar data={data?.last7Days ?? []} legendIn={t("chartLegendIn")} legendOut={t("chartLegendOut")} />
            }
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t("allStudentsStatus")}</CardTitle>
            <CardDescription className="text-xs">{t("allStudentsToday")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (data?.employeeSummary ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("noStudentsInSys")}</p>
            ) : (
              <div className="divide-y max-h-64 overflow-y-auto">
                {data?.employeeSummary.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between py-2.5 gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{emp.name}</p>
                      {emp.department && (
                        <p className="text-xs text-muted-foreground">{translateDept(emp.department, locale)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {emp.workDays} {t("daysUnit")}
                      </span>
                      <Badge variant="outline" className={`text-xs ${statusStyle[emp.todayStatus]}`}>
                        {statusLabel[emp.todayStatus]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function Home() {
  const { isAdmin, isTeacher, adminToken, faceVerifiedUser, teacherDisplayName, teacherFaculty, teacherDepartment, teacherSubject } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {isTeacher ? t("teacherHomeTitle") : t("homeTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isTeacher
            ? t("teacherHomeDesc")
            : isAdmin
            ? t("homeSubAdmin")
            : faceVerifiedUser
            ? faceVerifiedUser.name
            : t("homeSubPublic")}
        </p>
      </div>

      {isTeacher && adminToken ? (
        <TeacherDashboardView
          adminToken={adminToken}
          teacherDisplayName={teacherDisplayName}
          teacherFaculty={teacherFaculty}
          teacherDepartment={teacherDepartment}
          teacherSubject={teacherSubject}
        />
      ) : isAdmin && adminToken ? (
        <AdminDashboardView adminToken={adminToken} />
      ) : faceVerifiedUser ? (
        <UserDashboardView userId={faceVerifiedUser.id} userName={faceVerifiedUser.name} />
      ) : (
        <PublicView />
      )}
    </div>
  );
}
