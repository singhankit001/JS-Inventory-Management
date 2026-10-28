"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CircleCheck, Mic, Plus, RotateCcw, Square, Trash2, Upload, Wand2 } from "lucide-react";
import { uploadMedia, confirmAIDraft } from "@/app/actions/intake";
import { Button, buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PillGroup } from "@/components/ui/pill-group";
import { WorkflowStepper, type Step } from "@/components/ui/stepper";
import { Field, FileDrop, QuantityInput, Select } from "@/components/forms/fields";
import { useToast } from "@/components/feedback/toast";
import { INTAKE_STAGES, type DraftLine } from "@/features/ai/contracts";
import { DemoBanner } from "./demo-output";

const MAX_BYTES = 200 * 1024 * 1024; // same ceiling as the uploadMedia command schema
const MAX_RECORD_S = 300;

interface Media { url: string; type: string; size: number; name: string; kind: "audio_request" | "video_request" }
interface Draft { centreId: string; centreName: string; confidence: number; history: Record<string, number>; lines: DraftLine[] }
interface Line { key: string; phrase: string; productId: string; qty: number; score: number }

const fmtBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/** "audio/webm;codecs=opus" → "audio/webm": the command schema accepts bare media types only. */
const bareType = (t: string) => t.split(";")[0]!.trim();

/**
 * Record or upload → simulated pipeline → editable draft → "Create draft request".
 * The media stays in the browser (object URL); only its type and size go to uploadMedia. Processing is a client-side
 * animation over a demo transcript fixture — no transcription or AI runs.
 */
export function IntakeFlow({ drafts, products, transcript, targetPeriod }: { drafts: Draft[]; products: { id: string; label: string; sku: string }[]; transcript: string; targetPeriod: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [source, setSource] = useState<"record" | "upload">("record");
  const [centreId, setCentreId] = useState(drafts[0]?.centreId ?? "");
  const [media, setMedia] = useState<Media>();
  const [fileError, setFileError] = useState<string>();
  const [phase, setPhase] = useState<"source" | "processing" | "review" | "done">("source");
  const [stage, setStage] = useState(0);
  const [jobId, setJobId] = useState<string>();
  const [lines, setLines] = useState<Line[]>([]);
  const [requestId, setRequestId] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const draft = drafts.find((d) => d.centreId === centreId);

  // Recording
  const recorder = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string>();
  const [canRecord, setCanRecord] = useState<boolean>();
  useEffect(() => setCanRecord(typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia), []);
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => { if (recording && seconds >= MAX_RECORD_S) recorder.current?.stop(); }, [recording, seconds]);
  // Free the object URL when it is replaced or the page closes.
  useEffect(() => () => { if (media) URL.revokeObjectURL(media.url); }, [media]);
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const startRecording = async () => {
    setMicError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return setMicError("Nothing was recorded. Try again, or upload a file.");
        setMedia({ url: URL.createObjectURL(blob), type: bareType(blob.type), size: blob.size, name: "Recording", kind: "audio_request" });
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setMicError(name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser's site settings, or upload a file instead."
        : name === "NotFoundError" ? "No microphone was found on this device. Upload a recording instead."
        : "The microphone could not be started. Upload a recording instead.");
    }
  };

  const takeFile = (files: File[]) => {
    setFileError(undefined);
    const f = files[0];
    if (!f) return;
    const type = bareType(f.type);
    if (!/^(audio|video)\//.test(type)) return setFileError("Choose an audio or video file (for example .m4a, .mp3, .webm or .mp4).");
    if (f.size === 0) return setFileError("That file is empty.");
    if (f.size > MAX_BYTES) return setFileError(`That file is ${fmtBytes(f.size)}; the limit is 200 MB. Trim it or record a shorter note.`);
    setMedia({ url: URL.createObjectURL(f), type, size: f.size, name: f.name, kind: type.startsWith("video/") ? "video_request" : "audio_request" });
  };

  const process = () => {
    if (!media || !draft) return;
    start(async () => {
      const res = await uploadMedia({ centreId, kind: media.kind, contentType: media.type, sizeBytes: media.size });
      if (!res.ok) return toast({ tone: "error", title: "Could not start drafting", body: res.error });
      setJobId(res.data!.jobId);
      setLines(draft.lines.map((l, i) => ({ key: `${i}`, phrase: l.phrase, productId: l.productId ?? "", qty: l.qty, score: l.score })));
      setStage(0);
      setPhase("processing");
    });
  };

  // Simulated pipeline: advance one stage at a time, faster under reduced motion.
  useEffect(() => {
    if (phase !== "processing") return;
    if (stage >= INTAKE_STAGES.length - 1) { setPhase("review"); return; }
    const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setStage((s) => s + 1), fast ? 200 : 1100);
    return () => clearTimeout(t);
  }, [phase, stage]);

  const steps: Step[] = INTAKE_STAGES.map((s, i) => ({
    label: s.label,
    state: phase === "review" || phase === "done" || i < stage ? "done" : i === stage && phase === "processing" ? "current" : "upcoming",
    detail: s.key === "draft" && (phase === "review" || phase === "done") ? "Waiting for you" : `Job: ${s.status.replace("_", " ")}`,
  }));

  const update = (key: string, patch: Partial<Line>) => { setFormError(undefined); setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l))); };
  const create = () => {
    if (!jobId) return;
    const kept = lines.filter((l) => l.qty > 0);
    if (!kept.length) return setFormError("Keep at least one line with a quantity.");
    if (kept.some((l) => !l.productId)) return setFormError("Pick a product for every line, or remove the lines that did not match.");
    if (new Set(kept.map((l) => l.productId)).size !== kept.length) return setFormError("Each product may appear once — merge the duplicate lines.");
    start(async () => {
      const res = await confirmAIDraft({ jobId, items: kept.map((l) => ({ productId: l.productId, proposedQty: l.qty })) });
      if (!res.ok) { setFormError(res.error); return toast({ tone: "error", title: "Draft not created", body: res.error }); }
      toast({ tone: "success", title: res.message });
      setRequestId(res.data!.requestId);
      setPhase("done");
    });
  };
  const reset = () => { setMedia(undefined); setJobId(undefined); setLines([]); setRequestId(undefined); setFormError(undefined); setPhase("source"); setStage(0); };

  return (
    <div className="grid gap-5">
      <DemoBanner>Your recording stays in this browser — only its type and size are sent, to open an AI job. Transcription and matching are simulated with a demo transcript.</DemoBanner>
      <WorkflowStepper steps={steps} label="Intake progress" />

      {phase === "source" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            {drafts.length > 1 && (
              <Field label="Centre">{(a) => <Select {...a} value={centreId} onChange={(e) => setCentreId(e.target.value)}>{drafts.map((d) => <option key={d.centreId} value={d.centreId}>{d.centreName}</option>)}</Select>}</Field>
            )}
            <PillGroup ariaLabel="Source" activeKey={source} onSelect={(k) => setSource(k as typeof source)} items={[{ key: "record", label: "Record audio", icon: <Mic className="size-4" /> }, { key: "upload", label: "Upload file", icon: <Upload className="size-4" /> }]} />
            {source === "record" ? (
              <div className="grid gap-3 rounded-tile bg-surface-2 p-4" role="group" aria-label="Record audio">
                {canRecord === false ? (
                  <p className="text-label text-ink-2">This browser cannot record audio. Upload a recording from your phone instead.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      {recording
                        ? <Button variant="danger" onClick={() => recorder.current?.stop()}><Square />Stop</Button>
                        : <Button variant="primary" onClick={startRecording} disabled={canRecord === undefined}><Mic />{media ? "Record again" : "Start recording"}</Button>}
                      <span className="text-body tabular" aria-live="polite">{recording ? <><span className="pulse-dot mr-2 inline-block size-2 rounded-full bg-red" aria-hidden />Recording {mmss(seconds)}</> : media ? `${media.name} · ${fmtBytes(media.size)}` : "Up to 5 minutes"}</span>
                    </div>
                    <p className="text-[12px] text-ink-3">Your browser will ask for microphone access. Speak item, quantity and unit — &ldquo;12 boxes of jumbo crayons&rdquo;.</p>
                  </>
                )}
                {micError && <p role="alert" className="text-label text-red">{micError}</p>}
              </div>
            ) : (
              <Field label="Audio or video file" error={fileError} hint="Audio or video, up to 200 MB. Stays on this device.">
                {(a) => <FileDrop {...a} accept="audio/*,video/*" onFiles={takeFile} label="Drop a recording or browse" />}
              </Field>
            )}
          </div>
          <div className="grid content-start gap-3 rounded-tile border border-line p-4">
            <p className="text-label font-medium">Ready to draft</p>
            {media ? (
              <>
                {media.kind === "video_request"
                  ? <video src={media.url} controls className="max-h-56 w-full rounded-tile bg-surface-3" aria-label="Preview of your video" />
                  : <audio src={media.url} controls className="w-full" aria-label="Preview of your recording" />}
                <p className="text-[12px] text-ink-3">{media.name} · {media.type} · {fmtBytes(media.size)}</p>
                <Button variant="primary" onClick={process} disabled={pending || recording}><Wand2 />{pending ? "Starting…" : "Draft line items"}</Button>
              </>
            ) : <p className="text-label text-ink-3">Record or upload a request first. It drafts next month&apos;s ({targetPeriod}) request for {draft?.centreName ?? "your centre"}.</p>}
          </div>
        </div>
      )}

      {phase !== "source" && stage >= 1 && (
        <figure className="animate-enter rounded-tile bg-surface-2 p-4">
          <figcaption className="mb-1.5 flex flex-wrap items-center gap-2 text-label font-medium">Transcript <StatusBadge tone="amber">Demo fixture — your recording was not transcribed</StatusBadge></figcaption>
          <blockquote className="text-body text-ink-2">&ldquo;{transcript}&rdquo;</blockquote>
        </figure>
      )}

      {(phase === "review" || phase === "done") && (
        <section aria-labelledby="draft-h" className="animate-enter grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="draft-h" className="text-title font-normal tracking-[-0.01em]">Draft lines · {draft?.centreName} · {targetPeriod}</h3>
            <StatusBadge tone="blue">Match confidence {Math.round((draft?.confidence ?? 0) * 100)}%</StatusBadge>
          </div>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-left text-body">
              <caption className="sr-only">Draft request lines</caption>
              <thead><tr className="text-[11.5px] text-ink-3">
                <th className="border-b border-line px-2 py-2 font-medium">Heard</th><th className="border-b border-line px-2 py-2 font-medium">Catalogue product</th>
                <th className="border-b border-line px-2 py-2 font-medium">Quantity</th><th className="border-b border-line px-2 py-2 text-right font-medium">Avg / month</th><th className="border-b border-line px-2 py-2"><span className="sr-only">Remove</span></th>
              </tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key}>
                    <td className="border-b border-line/60 px-2 py-2">{l.phrase || <span className="text-ink-3">Added by you</span>}{l.phrase && <span className="block"><StatusBadge tone={l.score >= 0.5 ? "green" : "amber"}>{l.score >= 0.5 ? `${Math.round(l.score * 100)}% match` : "No match"}</StatusBadge></span>}</td>
                    <td className="border-b border-line/60 px-2 py-2">
                      <Select aria-label={`Product for ${l.phrase || "new line"}`} aria-invalid={!l.productId || undefined} value={l.productId} disabled={phase === "done"} onChange={(e) => update(l.key, { productId: e.target.value })}>
                        <option value="">Choose a product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </Select>
                    </td>
                    <td className="border-b border-line/60 px-2 py-2"><label htmlFor={`qty-${l.key}`} className="sr-only">Quantity for {l.phrase || "new line"}</label><QuantityInput id={`qty-${l.key}`} value={l.qty} min={0} onChange={(n) => update(l.key, { qty: n })} /></td>
                    <td className="border-b border-line/60 px-2 py-2 text-right tabular text-ink-2">{l.productId ? draft?.history[l.productId] ?? 0 : "—"}</td>
                    <td className="border-b border-line/60 px-2 py-2 text-right">
                      <Button variant="ghost" size="sm" disabled={phase === "done"} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.phrase || "line"}`}><Trash2 /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {formError && <p role="alert" className="text-label text-red">{formError}</p>}
          {phase === "review" ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setLines((ls) => [...ls, { key: `n${Date.now()}`, phrase: "", productId: "", qty: 1, score: 1 }])}><Plus />Add line</Button>
              <Button variant="primary" onClick={create} disabled={pending}><CircleCheck />{pending ? "Creating…" : "Create draft request"}</Button>
              <Button variant="ghost" onClick={reset}><RotateCcw />Start over</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-tile bg-green-soft px-4 py-3">
              <CircleCheck className="size-4 text-green" aria-hidden />
              <span className="text-body">Draft request created. Review it, then submit it to Head Office from the request page.</span>
              <Link href={`/requests/${requestId}`} className={buttonClass("primary", "sm", "ml-auto")}>Open request</Link>
              <Button size="sm" variant="ghost" onClick={reset}>New intake</Button>
            </div>
          )}
          <p className="text-[12px] text-ink-3">Prices and history are taken from the catalogue and stock ledger when the draft is saved, not from this screen.</p>
        </section>
      )}
    </div>
  );
}
