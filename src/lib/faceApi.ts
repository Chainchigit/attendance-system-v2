import * as faceapi from "face-api.js";

const MODEL_URL = "/models";

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then(() => {
    modelsLoaded = true;
  });

  return loadingPromise;
}

export function areFaceModelsLoaded(): boolean {
  return modelsLoaded;
}

export const FACE_MATCH_THRESHOLD = 0.45;
export const COOLDOWN_MS = 10_000;
export const SECOND_BEST_MARGIN = 0.08;

export const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.55,
});

export async function detectAllFacesWithDescriptors(
  el: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
) {
  return faceapi
    .detectAllFaces(el, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptors();
}

export interface UserForMatching {
  id: number;
  name: string;
  faceDescriptor?: number[] | null;
}

export interface MatchResult {
  user: UserForMatching;
  distance: number;
}

export function matchDescriptor(
  descriptor: Float32Array,
  users: UserForMatching[]
): MatchResult | null {
  let bestUser: UserForMatching | null = null;
  let bestDistance = Infinity;
  let secondBestDistance = Infinity;

  for (const user of users) {
    if (!user.faceDescriptor || user.faceDescriptor.length !== 128) continue;
    const dist = faceapi.euclideanDistance(
      descriptor,
      user.faceDescriptor as unknown as Float32Array
    );
    if (dist < bestDistance) {
      secondBestDistance = bestDistance;
      bestDistance = dist;
      bestUser = user;
    } else if (dist < secondBestDistance) {
      secondBestDistance = dist;
    }
  }

  if (
    bestUser &&
    bestDistance < FACE_MATCH_THRESHOLD &&
    secondBestDistance - bestDistance >= SECOND_BEST_MARGIN
  ) {
    return { user: bestUser, distance: bestDistance };
  }
  return null;
}

export function drawDetectionOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: Awaited<ReturnType<typeof detectAllFacesWithDescriptors>>,
  users: UserForMatching[],
  mirror = true
): MatchResult[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const matches: MatchResult[] = [];

  for (const det of detections) {
    const { x: rawX, y, width, height } = det.detection.box;

    const x = mirror ? canvas.width - rawX - width : rawX;

    const match = matchDescriptor(det.descriptor, users);
    const isKnown = !!match;

    const color = isKnown ? "#22c55e" : "#ef4444";

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    const confidence = isKnown
      ? `${Math.round((1 - match!.distance) * 100)}%`
      : "";
    const label = isKnown ? `${match!.user.name} ${confidence}` : "Unknown";

    ctx.font = "bold 14px Inter, sans-serif";
    const textWidth = ctx.measureText(label).width;
    const padX = 8;
    const padY = 4;
    const labelHeight = 22;
    const labelY = y > labelHeight + 4 ? y - labelHeight - 4 : y + height + 4;

    ctx.fillStyle = color;
    ctx.fillRect(x, labelY, textWidth + padX * 2, labelHeight + padY * 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, x + padX, labelY + labelHeight);

    if (isKnown) matches.push(match!);
  }

  return matches;
}

export { faceapi };
