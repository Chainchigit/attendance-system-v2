import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera, CameraOff, Loader2, AlertCircle, LogOut, LogIn,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  useGetUserDescriptors,
  getGetUserDescriptorsQueryKey,
  useMarkAttendance,
  getGetAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadFaceApiModels,
  detectAllFacesWithDescriptors,
  drawDetectionOverlay,
  COOLDOWN_MS,
  type UserForMatching,
} from "@/lib/faceApi";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

type AttendanceMode = "check_in" | "check_out";

interface ScanResult {
  userName: string;
  type: AttendanceMode;
  time: string;
  timestamp: number;
}

// ─── CameraStation ───────────────────────────────────────────────────────────

interface CameraStationProps {
  mode: AttendanceMode;
  modelsReady: boolean;
  userDescriptorsRef: React.RefObject<UserForMatching[]>;
  registeredCount: number;
}

function CameraStation({ mode, modelsReady, userDescriptorsRef, registeredCount }: CameraStationProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setFaceVerifiedUser } = useAuth();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<ScanResult[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isRunningRef = useRef(false);
  const cooldownMapRef = useRef<Record<number, number>>({});
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmBufferRef = useRef<Record<number, number>>({});

  const markAttendance = useMarkAttendance();

  const isCheckIn = mode === "check_in";

  const handleMarkAttendance = useCallback(
    (userId: number, userName: string) => {
      markAttendance.mutate(
        { data: { name: userName, type: mode } },
        {
          onSuccess: (record) => {
            const recType = (record.type === "check_out" ? "check_out" : "check_in") as AttendanceMode;
            const timeStr = new Date(record.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            const message =
              recType === "check_in"
                ? `${t("checkinSuccess")} ${userName}! ${t("checkinTime")} ${timeStr}`
                : `${t("checkoutSuccess")} ${userName}! ${t("checkoutTime")} ${timeStr}`;

            toast({ title: message });

            setRecentResults((prev) =>
              [{ userName, type: recType, time: timeStr, timestamp: Date.now() }, ...prev].slice(0, 4)
            );

            setFaceVerifiedUser({ id: userId, name: userName });

            queryClient.invalidateQueries({ queryKey: getGetAttendanceQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["attendance"] });
            queryClient.invalidateQueries({ queryKey: ["public-stats"] });
          },
          onError: (err) => {
            toast({
              variant: "destructive",
              title: t("attendanceError"),
              description: err.data?.error ?? err.message ?? t("attendanceErrorDesc"),
            });
          },
        }
      );
    },
    [markAttendance, queryClient, toast, setFaceVerifiedUser, t, mode]
  );

  const CONFIRM_FRAMES = 3;

  const runDetectionLoop = useCallback(async () => {
    if (!isRunningRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;

    if (video.readyState === 4 && video.videoWidth > 0 && modelsReady) {
      try {
        const detections = await detectAllFacesWithDescriptors(video);
        const matches = drawDetectionOverlay(
          canvasRef.current,
          video,
          detections,
          userDescriptorsRef.current
        );

        const matchedIds = new Set(matches.map((m) => m.user.id));

        for (const id of Object.keys(confirmBufferRef.current)) {
          if (!matchedIds.has(Number(id))) {
            confirmBufferRef.current[Number(id)] = 0;
          }
        }

        const now = Date.now();
        for (const match of matches) {
          const userId = match.user.id;
          const lastScan = cooldownMapRef.current[userId] || 0;
          if (now - lastScan <= COOLDOWN_MS) continue;

          confirmBufferRef.current[userId] = (confirmBufferRef.current[userId] || 0) + 1;

          if (confirmBufferRef.current[userId] >= CONFIRM_FRAMES) {
            confirmBufferRef.current[userId] = 0;
            cooldownMapRef.current[userId] = now;
            handleMarkAttendance(userId, match.user.name);
          }
        }
      } catch {
        // silent detection errors
      }
    }

    if (isRunningRef.current) {
      loopTimerRef.current = setTimeout(runDetectionLoop, 300);
    }
  }, [modelsReady, handleMarkAttendance, userDescriptorsRef]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? t("camPermissionDenied")
          : t("camError");
      setCameraError(msg);
    }
  }, [t]);

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stream && modelsReady) {
      isRunningRef.current = true;
      setIsScanning(true);
      loopTimerRef.current = setTimeout(runDetectionLoop, 800);
    }
    return () => {
      isRunningRef.current = false;
      setIsScanning(false);
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    };
  }, [stream, modelsReady, runDetectionLoop]);

  const stopCamera = useCallback(() => {
    isRunningRef.current = false;
    setIsScanning(false);
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [stream]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Colour tokens per mode ────────────────────────────────────────────────
  const accent = isCheckIn
    ? { border: "border-green-200", bg: "bg-green-50", text: "text-green-700", badge: "border-green-300 text-green-700", dot: "bg-green-500", btn: "bg-green-600 hover:bg-green-700 text-white", header: "from-green-500 to-emerald-600" }
    : { border: "border-blue-200",  bg: "bg-blue-50",  text: "text-blue-700",  badge: "border-blue-300 text-blue-700",  dot: "bg-blue-500",  btn: "bg-blue-600 hover:bg-blue-700 text-white",   header: "from-blue-500 to-indigo-600" };

  const stationLabel = isCheckIn ? t("stationCheckIn") : t("stationCheckOut");
  const stationDesc  = isCheckIn ? t("stationCheckInDesc") : t("stationCheckOutDesc");
  const startLabel   = isCheckIn ? t("startCheckIn") : t("startCheckOut");

  return (
    <Card className={`flex flex-col overflow-hidden border-2 ${accent.border}`}>
      {/* Station header */}
      <div className={`bg-gradient-to-r ${accent.header} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2 text-white">
          {isCheckIn
            ? <LogIn className="h-5 w-5" />
            : <LogOut className="h-5 w-5" />}
          <span className="font-semibold text-base">{stationLabel}</span>
        </div>
        {isScanning && (
          <Badge variant="outline" className="gap-1.5 bg-white/20 border-white/40 text-white text-xs">
            <span className={`h-2 w-2 rounded-full ${accent.dot} animate-pulse`} />
            {t("scanningBadge")}
          </Badge>
        )}
      </div>

      <CardContent className="flex-1 flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">{stationDesc}</p>

        {/* Error */}
        {cameraError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">{cameraError}</p>
          </div>
        )}

        {/* Camera feed */}
        <div className="relative rounded-lg border bg-muted/50 overflow-hidden aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ display: stream ? "block" : "none", transform: "scaleX(-1)" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none", display: stream ? "block" : "none" }}
          />
          {!stream && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="h-12 w-12 opacity-25" />
              <p className="text-xs">{cameraError ? t("cameraOff") : t("cameraStarting")}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {stream ? (
            <Button onClick={stopCamera} variant="outline" className="w-full" size="sm">
              <CameraOff className="h-4 w-4 mr-2" />
              {t("stopCamera")}
            </Button>
          ) : cameraError ? (
            <Button
              onClick={startCamera}
              disabled={!modelsReady}
              className={`w-full ${accent.btn}`}
              size="sm"
            >
              <Camera className="h-4 w-4 mr-2" />
              {t("restartCamera")}
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {t("faceRegisteredCount")} {registeredCount}
        </p>

        {/* Recent results for this station */}
        {recentResults.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">{t("recentActivity")}</p>
            {recentResults.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              >
                <span className="font-medium truncate max-w-[65%]">{r.userName}</span>
                <span className="text-muted-foreground shrink-0">{r.time}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── CheckIn (parent) ─────────────────────────────────────────────────────────

interface CheckInProps {
  mode: AttendanceMode;
}

export function CheckIn({ mode }: CheckInProps) {
  const {
    setFaceVerifiedUser: _setFV,
    isTeacher, isAdmin: _isAdmin, adminUsername, adminLogout,
    teacherDisplayName, teacherFaculty, teacherDepartment, teacherSubject,
  } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const teacherToastShownRef = useRef(false);
  const noFaceToastShownRef = useRef(false);
  const userDescriptorsRef = useRef<UserForMatching[]>([]);

  const { data: descriptorsData } = useGetUserDescriptors({
    query: { queryKey: getGetUserDescriptorsQueryKey() },
  });

  useEffect(() => {
    if (descriptorsData?.users) {
      userDescriptorsRef.current = descriptorsData.users.map((u) => ({
        id: u.id,
        name: u.name,
        faceDescriptor: u.faceDescriptor ?? null,
      }));
    }
  }, [descriptorsData]);

  // Teacher mode toast — once on mount
  useEffect(() => {
    if (!isTeacher || teacherToastShownRef.current) return;
    teacherToastShownRef.current = true;
    const name = teacherDisplayName ?? adminUsername ?? t("teacherModeActive");
    const parts = [
      teacherSubject    ? `${t("teacherSubjectInfo")}: ${teacherSubject}`     : "",
      teacherFaculty    ? `${t("teacherBannerFaculty")}: ${teacherFaculty}`   : "",
      teacherDepartment ? `${t("teacherBannerDept")}: ${teacherDepartment}`   : "",
    ].filter(Boolean).join("  ·  ");
    toast({ title: name, description: parts || t("teacherModeActiveDesc"), duration: 6000 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  // No face data toast — once when models finish and no descriptors found
  useEffect(() => {
    if (modelsLoading || noFaceToastShownRef.current) return;
    const count = (descriptorsData?.users || []).filter((u) => u.faceDescriptor).length;
    if (count === 0) {
      noFaceToastShownRef.current = true;
      toast({ variant: "destructive", title: t("noFaceData"), description: t("pleaseRegisterFirst"), duration: 8000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsLoading, descriptorsData]);

  // Load face-api models once
  useEffect(() => {
    setModelsLoading(true);
    loadFaceApiModels()
      .then(() => setModelsReady(true))
      .catch(() => {
        toast({ variant: "destructive", title: t("modelLoadFail"), description: t("modelLoadFailDesc") });
      })
      .finally(() => setModelsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registeredCount = (descriptorsData?.users || []).filter((u) => u.faceDescriptor).length;

  return (
    <>
      <div className="w-full max-w-5xl mx-auto p-4 space-y-5">
        {/* Page header */}
        <div>
          <div className="flex items-center gap-2">
            {mode === "check_in"
              ? <LogIn className="h-6 w-6 text-green-600" />
              : <LogOut className="h-6 w-6 text-blue-600" />}
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "check_in" ? t("stationCheckIn") : t("stationCheckOut")}
            </h2>
          </div>
          <p className="text-muted-foreground">
            {mode === "check_in" ? t("stationCheckInDesc") : t("stationCheckOutDesc")}
          </p>
        </div>

        {/* Model loading indicator */}
        {modelsLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loadingModels")}
          </div>
        )}

        {/* Single camera station */}
        <CameraStation
          mode={mode}
          modelsReady={modelsReady}
          userDescriptorsRef={userDescriptorsRef}
          registeredCount={registeredCount}
        />
      </div>

      {/* Logout confirmation dialog (teacher) */}
      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                <LogOut className="h-4 w-4 text-white" />
              </div>
              {t("teacherLogoutConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("teacherLogoutConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={adminLogout}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
            >
              <LogOut className="h-4 w-4" />
              {t("teacherLogoutConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
