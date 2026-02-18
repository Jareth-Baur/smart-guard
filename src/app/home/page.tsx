"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";

export default function SmartGuard() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [objectCount, setObjectCount] = useState(0);
  const [status, setStatus] = useState("Initializing");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [name, setName] = useState("");

  /* ---------------- LOAD CAMERAS ---------------- */
  useEffect(() => {
    async function loadCameras() {
      await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices[0]) setSelectedCamera(videoDevices[0].deviceId);
    }
    loadCameras();
  }, []);

  /* ---------------- START CAMERA ---------------- */
  useEffect(() => {
    if (!selectedCamera) return;

    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedCamera }, width: 1280, height: 720 },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }

    startCamera();
  }, [selectedCamera]);

  /* ---------------- LOAD MODELS ---------------- */
  useEffect(() => {
    async function loadModels() {
      setStatus("Loading Models...");
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri("/models/ssd_mobilenetv1");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
        await loadRegisteredFaces();
      } catch (err) {
        console.error(err);
        setStatus("Model Loading Failed");
      }
    }

    loadModels();
  }, []);

  /* ---------------- LOAD REGISTERED FACES ---------------- */
  async function loadRegisteredFaces() {
    setStatus("Loading Registered Faces...");

    try {
      const res = await fetch("/api/registered");
      const files: string[] = await res.json();

      if (!files.length) {
        setStatus("No Registered Faces");
        return;
      }

      const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];

      for (const file of files) {
        const label = file.split("_")[0];
        const img = await faceapi.fetchImage(`/registered/${file}`);

        const detection = await faceapi
          .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) continue;

        const existing = labeledDescriptors.find((ld) => ld.label === label);

        if (existing) {
          existing.descriptors.push(detection.descriptor);
        } else {
          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(label, [detection.descriptor])
          );
        }
      }

      if (!labeledDescriptors.length) {
        setStatus("No Valid Face Data");
        return;
      }

      const matcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
      setFaceMatcher(matcher);
      setStatus("System Ready");
    } catch (err) {
      console.error(err);
      setStatus("Face Loading Failed");
    }
  }

  /* ---------------- SMART REGISTRATION (CROPPED FACE) ---------------- */
  async function captureFaceImages(label: string) {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const angles = ["front", "left", "right"];

    for (let i = 0; i < angles.length; i++) {
      alert(`Turn head: ${angles[i]}`);
      await new Promise((res) => setTimeout(res, 2000));

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const detection = await faceapi
        .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        alert("Face not detected. Try again.");
        i--;
        continue;
      }

      const box = detection.detection.box;

      const faceCanvas = document.createElement("canvas");
      faceCanvas.width = box.width;
      faceCanvas.height = box.height;
      const faceCtx = faceCanvas.getContext("2d");
      if (!faceCtx) return;

      faceCtx.drawImage(
        canvas,
        box.x,
        box.y,
        box.width,
        box.height,
        0,
        0,
        box.width,
        box.height
      );

      const dataUrl = faceCanvas.toDataURL("image/jpeg");

      await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, image: dataUrl, index: i + 1 }),
      });
    }

    alert("Registration Complete");
    await loadRegisteredFaces();
  }

  /* ---------------- RECOGNITION LOOP ---------------- */
  useEffect(() => {
    if (!faceMatcher) return;

    let animationId: number;
    let authorizedFrames = 0;
    const REQUIRED_FRAMES = 3;

    const detect = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.readyState !== 4) {
        animationId = requestAnimationFrame(detect);
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      let unknownFound = false;

      detections.forEach((det) => {
        const match = faceMatcher.findBestMatch(det.descriptor);
        const isUnknown = match.label === "unknown";
        if (isUnknown) unknownFound = true;

        const { x, y, width: w, height: h } = det.detection.box;

        ctx.strokeStyle = isUnknown ? "#ff0000" : "#00ff00";
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "14px monospace";
        ctx.fillText(match.toString(), x, y - 6);
      });

      setObjectCount(detections.length);

      if (detections.length > 0 && !unknownFound) {
        authorizedFrames++;
        if (authorizedFrames >= REQUIRED_FRAMES) {
          setStatus("Authorized");
        }
      } else if (unknownFound) {
        authorizedFrames = 0;
        setStatus("Unknown Person Detected");
      } else {
        authorizedFrames = 0;
        setStatus("No Face Detected");
      }

      animationId = requestAnimationFrame(detect);
    };

    detect();

    return () => cancelAnimationFrame(animationId);
  }, [faceMatcher]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-200 font-mono">
      <header className="flex justify-between items-center px-8 py-4 bg-[#0f172a] border-b border-cyan-900">
        <h1 className="text-cyan-400 font-bold tracking-widest">
          SMART GUARD FACE RECOGNITION
        </h1>

        <select
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
          className="bg-[#111827] border border-cyan-900 px-3 py-1 rounded text-xs"
        >
          {cameras.map((cam) => (
            <option key={cam.deviceId} value={cam.deviceId}>
              {cam.label || "Camera"}
            </option>
          ))}
        </select>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8">
        <section className="col-span-3 bg-[#111827] p-6 rounded-xl border border-cyan-900 shadow-lg">
          <h2 className="text-cyan-400 mb-4">LIVE CAMERA</h2>

          <div className="flex gap-2 mb-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Name"
              className="px-2 py-1 rounded text-black"
            />
            <button
              onClick={() => name && captureFaceImages(name)}
              className="bg-cyan-600 px-3 py-1 rounded text-white"
            >
              Register
            </button>
          </div>

          <div className="relative">
            <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-lg" />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
          </div>
        </section>

        <section className="bg-[#111827] p-6 rounded-xl border border-cyan-900 shadow-lg">
          <h2 className="text-cyan-400 mb-4">AI STATUS</h2>
          <Status label="Faces Detected" value={objectCount.toString()} />
          <Status label="System Status" value={status} />
        </section>
      </main>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border border-cyan-900 px-3 py-2 rounded text-xs mb-2">
      <span className="text-gray-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
