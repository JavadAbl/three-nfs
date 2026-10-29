"use client";
// ─── WebGLBlockedOverlay: no 3D context → actionable dead end ────────────────
// Rendered by GameShell when the WebGL probe fails. Full-screen opaque so the
// driver never sees a broken menu/black canvas underneath — just the problem
// and its fixes. The user-facing symptoms behind this overlay used to be a
// console-only "THREE.WebGLRenderer: A WebGL context could not be created".
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WebGLBlockedOverlay({ detail }: { detail?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07070a] px-6">
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="size-7 text-red-400" />
        </div>
        <h1 className="font-mono text-2xl font-bold tracking-widest text-white">
          3D UNAVAILABLE
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Your browser could not create a WebGL context, so the game cannot
          render. This is a browser/GPU environment issue — the fixes below
          solve it in almost every case.
        </p>
        <ul className="mt-6 space-y-2 text-left text-sm text-zinc-300">
          <li>
            • Enable <span className="font-semibold text-white">hardware acceleration</span> in
            your browser settings, then fully restart the browser.
          </li>
          <li>
            • Update your GPU drivers, and check{" "}
            <span className="font-mono text-zinc-400">chrome://gpu</span> (or{" "}
            <span className="font-mono text-zinc-400">about:support</span> in
            Firefox) — WebGL must not be listed as disabled.
          </li>
          <li>• Try Chrome, Edge, or Firefox — some setups ship with 3D blocked.</li>
          <li>
            • On a VM or remote desktop, enable 3D/GPU acceleration for the
            session (VirtualBox: &quot;Enable 3D Acceleration&quot;; RDP: connect with
            GPU support).
          </li>
        </ul>
        {detail && (
          <pre className="mt-6 max-h-24 overflow-auto rounded-md border border-white/10 bg-black/50 p-3 text-left font-mono text-[11px] whitespace-pre-wrap text-zinc-500">
            {detail}
          </pre>
        )}
        <Button className="mt-6" onClick={() => location.reload()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
