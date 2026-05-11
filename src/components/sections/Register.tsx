import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, CameraOff, UserPlus, UserRoundPlus, AlertCircle,
  CheckCircle2, Loader2, Lock, RefreshCw,
} from "lucide-react";
import { useRegisterUser, getGetUsersQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadFaceApiModels,
  detectAllFacesWithDescriptors,
} from "@/lib/faceApi";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { getDepartments } from "@/lib/i18n";

type FaceStatus = "idle" | "no_face" | "multi_face" | "ok";
type LiveCount  = "none" | "one" | "many";

function drawRegisterOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Awaited<ReturnType<typeof detectAllFacesWithDescriptors>>
) {
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const count = detections.length;
  const color = count === 1 ? "#22c55e" : "#f97316";

  for (const det of detections) {
    const { x: rawX, y, width, height } = det.detection.box;
    const x = canvas.width - rawX - width;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.strokeRect(x, y, width, height);
  }
}

export function Register() {
  const { t, locale } = useLanguage();
  const { isAdmin } = useAuth();

  const [employeeId, setEmployeeId]               = useState("");
  const [name, setName]                           = useState("");
  const [department, setDepartment]               = useState("");
  const [modelsReady, setModelsReady]             = useState(false);
  const [modelsLoading, setModelsLoading]         = useState(false);

  const [stream, setStream]                       = useState<MediaStream | null>(null);
  const [cameraErr, setCameraErr]                 = useState(false);
  const [liveCount, setLiveCount]                 = useState<LiveCount>("none");

  const [captured, setCaptured]                   = useState(false);
  const [imagePreview, setImagePreview]           = useState<string | null>(null);
  const [faceStatus, setFaceStatus]               = useState<FaceStatus>("idle");
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [analyzing, setAnalyzing]                 = useState(false);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const overlayRef    = useRef<HTMLCanvasElement>(null);
  const hiddenCanvas  = useRef<HTMLCanvasElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const loopRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  const registerUser   = useRegisterUser();
  const departments    = getDepartments(locale);

  useEffect(() => {
    setModelsLoading(true);
    loadFaceApiModels()
      .then(() => setModelsReady(true))
      .catch(() =>
        toast({ variant: "destructive", title: t("modelLoadFail"), description: t("modelLoadFailDesc") })
      )
      .finally(() => setModelsLoading(false));
  }, []);

  const stopCamera = useCallback(() => {
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setLiveCount("none");
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext("2d");
      ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraErr(false);
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = ms;
      setStream(ms);
      if (videoRef.current) videoRef.current.srcObject = ms;
    } catch {
      setCameraErr(true);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    startCamera();
    return () => stopCamera();
  }, [isAdmin]);

  useEffect(() => {
    if (!stream || !modelsReady || captured) {
      if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
      return;
    }
    loopRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const dets = await detectAllFacesWithDescriptors(videoRef.current);
        if (overlayRef.current && videoRef.current) drawRegisterOverlay(overlayRef.current, videoRef.current, dets);
        const n = dets.length;
        setLiveCount(n === 0 ? "none" : n === 1 ? "one" : "many");
      } catch { /* ignore */ }
    }, 300);
    return () => { if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; } };
  }, [stream, modelsReady, captured]);

  const analyzeCapture = useCallback(async (dataUrl: string) => {
    if (!hiddenCanvas.current || !modelsReady) return;
    setAnalyzing(true);
    setFaceStatus("idle");
    setCapturedDescriptor(null);
    try {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      const c = hiddenCanvas.current;
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      const dets = await detectAllFacesWithDescriptors(c);
      if (dets.length === 0)      { setFaceStatus("no_face"); }
      else if (dets.length > 1)   { setFaceStatus("multi_face"); }
      else { setFaceStatus("ok"); setCapturedDescriptor(Array.from(dets[0].descriptor)); }
    } catch { setFaceStatus("no_face"); }
    finally  { setAnalyzing(false); }
  }, [modelsReady]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !hiddenCanvas.current) return;
    const video = videoRef.current;
    const c = hiddenCanvas.current;
    c.width = video.videoWidth; c.height = video.videoHeight;
    const ctx = c.getContext("2d")!;
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.92);
    setImagePreview(dataUrl);
    setCaptured(true);
    if (loopRef.current) { clearInterval(loopRef.current); loopRef.current = null; }
    await analyzeCapture(dataUrl);
  }, [analyzeCapture]);

  const retake = useCallback(() => {
    setImagePreview(null);
    setCaptured(false);
    setCapturedDescriptor(null);
    setFaceStatus("idle");
    setLiveCount("none");
  }, []);

  const handleRegister = () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: t("needNameFirst"), description: t("needNameFirstDesc") });
      return;
    }
    if (!imagePreview || !capturedDescriptor) {
      toast({ variant: "destructive", title: t("needPhoto"), description: t("needPhotoDesc") });
      return;
    }
    registerUser.mutate(
      { data: { employeeId: employeeId.trim() || undefined, name, department: department || undefined, image: imagePreview, faceDescriptor: capturedDescriptor } },
      {
        onSuccess: (data) => {
          toast({ title: t("registerSuccess"), description: data.message || name, action: <CheckCircle2 className="h-5 w-5 text-green-500" /> });
          setEmployeeId(""); setName(""); setDepartment("");
          setImagePreview(null); setCapturedDescriptor(null);
          setFaceStatus("idle"); setCaptured(false); setLiveCount("none");
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        },
        onError: (error) => {
          toast({ variant: "destructive", title: t("registerFail"), description: ((error as unknown) as Record<string, unknown>)?.["error"] as string || t("genericError") });
        },
      }
    );
  };

  const liveStatusInfo: Record<LiveCount, { text: string; color: string; border: string }> = {
    none: { text: t("faceLiveNone"), color: "text-orange-500", border: "border-orange-400/50" },
    one:  { text: t("faceLiveOk"),   color: "text-green-600",  border: "border-green-400/80" },
    many: { text: t("faceLiveMulti"), color: "text-orange-500", border: "border-orange-400/50" },
  };

  const captureStatusInfo = {
    idle:       null,
    no_face:    { text: t("faceStatusNoFace"), color: "text-orange-500", icon: AlertCircle },
    multi_face: { text: t("faceStatusMulti"),  color: "text-orange-500", icon: AlertCircle },
    ok:         { text: t("faceStatusOk"),     color: "text-green-600",  icon: CheckCircle2 },
  }[faceStatus];

  if (!isAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2">
          <UserRoundPlus className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">{t("registerTitle")}</h2>
        </div>
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-lg">{t("registerLoginRequired")}</p>
              <p className="text-sm text-muted-foreground max-w-sm">{t("registerLoginRequiredDesc")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ls = liveStatusInfo[liveCount];

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shrink-0">
          <UserRoundPlus className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("registerTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("registerDesc")}</p>
        </div>
      </div>

      {modelsLoading && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          {t("loadingFaceRec")}
        </div>
      )}

      {/* Student info */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>{t("studentInfo")}</CardTitle>
          <CardDescription>{t("studentInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">{t("studentId")}</Label>
              <Input id="employeeId" placeholder={t("studentIdPlaceholder")} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={registerUser.isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">{t("dept")}</Label>
              <Select value={department} onValueChange={setDepartment} disabled={registerUser.isPending}>
                <SelectTrigger id="department"><SelectValue placeholder={t("deptPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">{t("fullName")} <span className="text-destructive">*</span></Label>
            <Input id="name" placeholder={t("fullNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} disabled={registerUser.isPending} />
          </div>
        </CardContent>
      </Card>

      {/* Camera / Capture section */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-violet-500" />
            {t("scanPhotoLabel")}
          </CardTitle>
          <CardDescription>
            {captured ? t("faceStatusOk") : t("faceLiveNone")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Camera view (live) */}
          {!captured && (
            <div className={`relative rounded-xl overflow-hidden aspect-video bg-black border-2 transition-colors ${stream ? ls.border : "border-border/40"}`}>
              <video
                ref={videoRef}
                autoPlay playsInline muted
                className="w-full h-full object-cover"
                style={{ display: stream ? "block" : "none", transform: "scaleX(-1)" }}
              />
              <canvas
                ref={overlayRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ display: stream ? "block" : "none" }}
              />
              {!stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Camera className="h-12 w-12 opacity-25" />
                  <p className="text-xs">{cameraErr ? t("cameraError") : t("cameraStarting")}</p>
                </div>
              )}
            </div>
          )}

          {/* Live status badge */}
          {!captured && stream && (
            <div className={`flex items-center gap-2 text-sm ${ls.color}`}>
              {liveCount === "one"
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
              {ls.text}
            </div>
          )}

          {/* Captured preview */}
          {captured && imagePreview && (
            <div className="relative rounded-xl overflow-hidden aspect-video bg-muted/50 flex items-center justify-center border">
              <img src={imagePreview} alt="Captured face" className="w-full h-full object-contain" />
              {analyzing && (
                <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm font-medium">{t("analyzingFace")}</span>
                </div>
              )}
            </div>
          )}

          {/* Captured face status */}
          {captured && !analyzing && captureStatusInfo && (
            <div className={`flex items-center gap-2 text-sm ${captureStatusInfo.color}`}>
              <captureStatusInfo.icon className="h-4 w-4 shrink-0" />
              {captureStatusInfo.text}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2 flex-wrap">
            {!captured ? (
              <>
                <Button
                  onClick={capturePhoto}
                  disabled={!modelsReady || !stream || liveCount !== "one" || registerUser.isPending}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                  size="sm"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {t("captureBtn")}
                </Button>
                {stream ? (
                  <Button onClick={stopCamera} variant="outline" size="sm">
                    <CameraOff className="h-4 w-4 mr-2" />
                    {t("stopCamera")}
                  </Button>
                ) : (
                  cameraErr && (
                    <Button onClick={startCamera} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t("restartCamera")}
                    </Button>
                  )
                )}
              </>
            ) : (
              <Button onClick={retake} variant="outline" size="sm" disabled={registerUser.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("retakeBtn")}
              </Button>
            )}
          </div>

          <canvas ref={hiddenCanvas} className="hidden" />
        </CardContent>
      </Card>

      {/* Register button */}
      <Button
        className="w-full"
        onClick={handleRegister}
        disabled={!name.trim() || !capturedDescriptor || faceStatus !== "ok" || registerUser.isPending || analyzing}
      >
        {registerUser.isPending
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("registering")}</>
          : <><UserPlus className="w-4 h-4 mr-2" />{t("registerAndSave")}</>}
      </Button>
    </div>
  );
}
