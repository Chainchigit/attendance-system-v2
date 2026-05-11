import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList, ScanFace, Download, Calendar, Clock,
  TrendingUp, TrendingDown, Users, ArrowUpDown, ArrowUp, ArrowDown,
  Search, X,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { translateDept } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface AttendanceRecord {
  id: number;
  userId: number;
  userName: string;
  date: string;
  type: string;
  timestamp: string;
}

interface AttendanceResponse {
  records: AttendanceRecord[];
}

interface UserMeta {
  id: number;
  employeeId: string | null;
  name: string;
  department: string | null;
}

interface UsersResponse {
  users: UserMeta[];
}

type Period = "day" | "week" | "month" | "custom";
type SortField = "date" | "name" | "time";
type SortDir   = "asc" | "desc";

function toLocalDateString(date: Date): string {
  return date.toLocaleDateString("sv-SE");
}

function getDateRange(period: Period, customStart: string, customEnd: string) {
  const today = toLocalDateString(new Date());
  if (period === "day")   return { start: today, end: today };
  if (period === "week") {
    const now = new Date();
    return {
      start: toLocalDateString(startOfWeek(now, { weekStartsOn: 1 })),
      end:   toLocalDateString(endOfWeek(now,   { weekStartsOn: 1 })),
    };
  }
  if (period === "month") {
    const now = new Date();
    return {
      start: toLocalDateString(startOfMonth(now)),
      end:   toLocalDateString(endOfMonth(now)),
    };
  }
  return { start: customStart, end: customEnd };
}

function filterByTime(records: AttendanceRecord[], timeFrom: string, timeTo: string) {
  if (!timeFrom && !timeTo) return records;
  return records.filter((r) => {
    const time = format(new Date(r.timestamp), "HH:mm");
    if (timeFrom && time < timeFrom) return false;
    if (timeTo   && time > timeTo)   return false;
    return true;
  });
}

function exportCSV(
  records: AttendanceRecord[],
  userMetaMap: Record<number, UserMeta>,
  filename: string,
  colLabels: { no: string; name: string; studentId: string; dept: string; status: string; time: string; date: string },
  checkInLabel: string,
  checkOutLabel: string,
) {
  const BOM = "\uFEFF";
  const header = `${colLabels.no},${colLabels.name},${colLabels.studentId},${colLabels.dept},${colLabels.status},${colLabels.time},${colLabels.date}\n`;
  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const rows = sorted
    .map((r, idx) => {
      const meta = userMetaMap[r.userId];
      const time = format(new Date(r.timestamp), "HH:mm");
      const status = r.type === "check_in" ? checkInLabel : checkOutLabel;
      return `${idx + 1},"${r.userName}","${meta?.employeeId ?? ""}","${meta?.department ?? ""}","${status}","${time}","${r.date}"`;
    })
    .join("\n");

  const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AttendanceList() {
  const { isAdmin, isLead, isOperation, isTeacher, adminToken, faceVerifiedUser } = useAuth();
  const { t, locale } = useLanguage();
  const dateFnsLocale = locale === "th" ? th : enUS;

  // Operation admin can view all records just like Lead
  const canViewAll = isAdmin || isTeacher;
  const userId     = faceVerifiedUser?.id;
  const canView    = canViewAll || !!faceVerifiedUser;

  const [period, setPeriod]           = useState<Period>("day");
  const today = toLocalDateString(new Date());
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd]     = useState(today);
  const [timeFrom, setTimeFrom]       = useState("");
  const [timeTo, setTimeTo]           = useState("");
  const [sortField, setSortField]     = useState<SortField>("date");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [searchTerm, setSearchTerm]   = useState("");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const { data: attendanceData, isLoading } = useQuery<AttendanceResponse>({
    queryKey: ["attendance", canViewAll ? "admin" : userId],
    queryFn: async () => {
      const url = canViewAll
        ? `${API_BASE}/api/attendance`
        : `${API_BASE}/api/attendance?userId=${userId}`;
      const headers: Record<string, string> = {};
      if (canViewAll && adminToken) headers["Authorization"] = `Bearer ${adminToken}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return res.json();
    },
    enabled: canView,
    refetchInterval: canView ? 30000 : false,
  });

  const { data: usersData } = useQuery<UsersResponse>({
    queryKey: ["users-meta"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: canViewAll && !!adminToken,
    staleTime: 60000,
  });

  const userMetaMap = useMemo<Record<number, UserMeta>>(() => {
    if (!usersData?.users) return {};
    return Object.fromEntries(usersData.users.map((u) => [u.id, u]));
  }, [usersData]);

  const { start, end } = getDateRange(period, customStart, customEnd);

  const filteredRecords = useMemo(() => {
    const all = attendanceData?.records ?? [];
    const byDate = all.filter((r) => r.date >= start && r.date <= end);
    const byTime = filterByTime(byDate, timeFrom, timeTo);
    if (!searchTerm.trim() || !canViewAll) return byTime;
    const q = searchTerm.trim().toLowerCase();
    return byTime.filter((r) => {
      if (r.userName.toLowerCase().includes(q)) return true;
      const meta = userMetaMap[r.userId];
      if (!meta) return false;
      if (meta.employeeId?.toLowerCase().includes(q)) return true;
      if (meta.department?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [attendanceData, start, end, timeFrom, timeTo, searchTerm, canViewAll, userMetaMap]);

  const earliestArrivals = useMemo(() => {
    if (!canViewAll) return [];
    const firstCheckInByUser: Record<number, AttendanceRecord> = {};
    for (const r of filteredRecords) {
      if (r.type === "check_in") {
        if (!firstCheckInByUser[r.userId] || new Date(r.timestamp) < new Date(firstCheckInByUser[r.userId].timestamp))
          firstCheckInByUser[r.userId] = r;
      }
    }
    return Object.values(firstCheckInByUser).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [filteredRecords, canViewAll]);

  const latestArrivals = useMemo(() => {
    if (!canViewAll) return [];
    const firstCheckInByUser: Record<number, AttendanceRecord> = {};
    for (const r of filteredRecords) {
      if (r.type === "check_in" && !firstCheckInByUser[r.userId])
        firstCheckInByUser[r.userId] = r;
    }
    return Object.values(firstCheckInByUser).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [filteredRecords, canViewAll]);

  const groupedByDate = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    for (const r of filteredRecords) {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    }
    return map;
  }, [filteredRecords]);

  const sortedDates = useMemo(() => {
    const dates = Object.keys(groupedByDate);
    return dates.sort((a, b) => {
      if (sortField === "date") {
        return sortDir === "desc" ? (b > a ? 1 : -1) : (a > b ? 1 : -1);
      }
      return b > a ? 1 : -1;
    });
  }, [groupedByDate, sortField, sortDir]);

  const totalCheckIns  = filteredRecords.filter((r) => r.type === "check_in").length;
  const totalCheckOuts = filteredRecords.filter((r) => r.type === "check_out").length;
  const uniqueStudents = new Set(filteredRecords.map((r) => r.userId)).size;

  if (!canView) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
        <div className="rounded-full bg-muted p-6">
          <ScanFace className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{t("needFaceScan")}</h2>
          <p className="text-muted-foreground">
            {t("needFaceScanDesc")}{" "}
            <span className="font-medium text-foreground">{t("checkinTabName")}</span>{" "}
            {t("needFaceScanDesc2")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("needFaceScanAdmin")}{" "}
            <span className="font-medium">{t("adminTabRef")}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-sm shrink-0">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{t("attendanceTitle")}</h2>
            <p className="text-muted-foreground text-sm">
              {canViewAll
                ? t("attendanceSubAdmin")
                : `${t("attendanceSubUser")} ${faceVerifiedUser?.name}`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(
            filteredRecords,
            userMetaMap,
            `attendance_${start}_${end}.csv`,
            { no: t("colNo"), name: t("colName"), studentId: t("colStudentId"), dept: t("colDept"), status: t("colStatus"), time: t("colTime"), date: t("sortDate") },
            t("checkIn"),
            t("checkOut"),
          )}
          className="gap-2 self-start sm:self-auto border-border/60"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Period filter */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="day">{t("filterToday")}</TabsTrigger>
              <TabsTrigger value="week">{t("filterWeek")}</TabsTrigger>
              <TabsTrigger value="month">{t("filterMonth")}</TabsTrigger>
              <TabsTrigger value="custom">{t("filterCustom")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36" />
              <span className="text-muted-foreground">{t("filterTo")}</span>
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <Label className="text-sm text-muted-foreground">{t("timeRange")}</Label>
            <Input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="w-28" placeholder="00:00" />
            <span className="text-muted-foreground">—</span>
            <Input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="w-28" placeholder="23:59" />
            {(timeFrom || timeTo) && (
              <Button variant="ghost" size="sm" onClick={() => { setTimeFrom(""); setTimeTo(""); }} className="text-xs h-7">
                {t("clearFilter")}
              </Button>
            )}
          </div>

          {canViewAll && (
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Label className="text-sm text-muted-foreground shrink-0">{t("searchLabel")}</Label>
              <div className="relative flex-1 max-w-sm">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="pr-8 h-8 text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={t("searchClear")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {searchTerm && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {filteredRecords.length > 0
                    ? `${new Set(filteredRecords.map((r) => r.userId)).size} ${t("studentsUnit")}`
                    : t("searchNoResult")}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground shrink-0">{t("sortBy")}:</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSort("date")}
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              sortField === "date"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-muted-foreground/30 hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {t("sortDate")}
            <SortIcon field="date" />
          </button>

          {canViewAll && (
            <button
              onClick={() => handleSort("name")}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                sortField === "name"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-muted-foreground/30 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              {t("sortName")}
              <SortIcon field="name" />
            </button>
          )}

          {canViewAll && (
            <button
              onClick={() => handleSort("time")}
              className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
                sortField === "time"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-muted-foreground/30 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              {t("sortCheckIn")}
              <SortIcon field="time" />
            </button>
          )}
        </div>
        {sortField !== "date" || sortDir !== "desc" ? (
          <button
            onClick={() => { setSortField("date"); setSortDir("desc"); }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("clearFilter")}
          </button>
        ) : null}
      </div>

      {/* Summary stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Users,
              gradient: "from-blue-500 to-indigo-600",
              label: canViewAll ? t("summaryStudents") : t("summaryRecords"),
              value: canViewAll ? uniqueStudents : filteredRecords.length,
              sub: canViewAll ? t("studentsUnit") : t("itemsUnit"),
            },
            {
              icon: TrendingUp,
              gradient: "from-emerald-500 to-green-600",
              label: t("checkIn"),
              value: totalCheckIns,
              sub: t("timesUnit"),
            },
            {
              icon: TrendingDown,
              gradient: "from-orange-400 to-amber-500",
              label: t("checkOut"),
              value: totalCheckOuts,
              sub: t("timesUnit"),
            },
          ].map(({ icon: Icon, gradient, label, value, sub }) => (
            <Card key={label} className="border-border/60 shadow-sm overflow-hidden">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                    <p className="text-3xl font-bold tracking-tight">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                  <div className={`flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br ${gradient} shadow-sm shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Earliest / latest (admin-level only) */}
      {canViewAll && !isLoading && earliestArrivals.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {t("earliestArrivals")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {earliestArrivals.slice(0, 5).map((r, i) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-medium">{r.userName}</span>
                  </div>
                  <Badge variant="outline" className="border-green-300 text-green-700 font-mono text-xs">
                    {format(new Date(r.timestamp), "HH:mm")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                {t("latestArrivals")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {latestArrivals.slice(0, 5).map((r, i) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-medium">{r.userName}</span>
                  </div>
                  <Badge variant="outline" className="border-red-300 text-red-600 font-mono text-xs">
                    {format(new Date(r.timestamp), "HH:mm")}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main records */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </CardContent>
        </Card>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {t("noRecordsInPeriod")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dayRecords = groupedByDate[date];
            const dateLabel  = format(new Date(date + "T12:00:00"), "EEEE dd MMMM yyyy", { locale: dateFnsLocale });

            const sortedRecords = [...dayRecords].sort((a, b) => {
              if (sortField === "name") {
                const cmp = a.userName.localeCompare(b.userName, locale === "th" ? "th" : "en");
                return sortDir === "asc" ? cmp : -cmp;
              }
              const ta = new Date(a.timestamp).getTime();
              const tb = new Date(b.timestamp).getTime();
              if (sortField === "time") return sortDir === "asc" ? ta - tb : tb - ta;
              return ta - tb;
            });

            return (
              <Card key={date}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{dateLabel}</CardTitle>
                  <CardDescription>
                    {canViewAll
                      ? `${new Set(dayRecords.map((r) => r.userId)).size} ${t("dayCardStudents")} — ${dayRecords.filter((r) => r.type === "check_in").length} ${t("dayCardCheckIns")}`
                      : `${dayRecords.length} ${t("itemsUnit")} — ${t("checkIn")} ${dayRecords.filter((r) => r.type === "check_in").length} ${t("timesUnit")}`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center pl-4">{t("colNo")}</TableHead>
                        <TableHead>{t("colName")}</TableHead>
                        <TableHead>{t("colStudentId")}</TableHead>
                        <TableHead>{t("colDept")}</TableHead>
                        <TableHead className="text-center">{t("colStatus")}</TableHead>
                        <TableHead className="text-right pr-4">{t("colTime")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRecords.map((r, idx) => {
                        const meta = userMetaMap[r.userId];
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-center text-muted-foreground text-sm pl-4">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{r.userName}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {meta?.employeeId ?? <span className="opacity-40">—</span>}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {translateDept(meta?.department, locale) ?? <span className="opacity-40">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant="outline"
                                className={r.type === "check_in"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"}
                              >
                                {r.type === "check_in" ? t("checkIn") : t("checkOut")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm pr-4">
                              {format(new Date(r.timestamp), "HH:mm")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
