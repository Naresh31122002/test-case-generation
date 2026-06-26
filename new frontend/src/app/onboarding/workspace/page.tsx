"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, FolderOpen } from "lucide-react";
import {
  listWorkspaces,
  createWorkspace,
  switchWorkspace,
  type Workspace,
} from "@/lib/workspaces";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, AuthField, AuthInput, AuthButton, AuthError } from "@/components/auth/AuthShell";

/**
 * Onboarding — Step 1: Name your workspace, Step 2: Name your first project.
 *
 * Registration auto-provisions a personal workspace, so step 1 lets the user
 * rename it (or keep the default). Step 2 stores the project name in
 * localStorage as `pendingProject` — it is picked up and pre-filled when the
 * user creates their first story (projects are created implicitly on first
 * story upload).
 */
export default function OnboardingWorkspacePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [defaultWs, setDefaultWs] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Step 1 = workspace name, Step 2 = first project name
  const [step, setStep] = useState<1 | 2>(1);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    let cancelled = false;
    listWorkspaces()
      .then((ws) => {
        if (cancelled) return;
        const personal = ws[0] ?? null;
        setDefaultWs(personal);
        // Seed the input from the user's email handle for a friendlier default.
        setName(personal?.name ?? (user?.email ? `${user.email.split("@")[0]}'s workspace` : ""));
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const trimmed = name.trim();
      // If the name differs from the auto-created workspace, create a fresh one
      // and switch into it; otherwise just proceed with the default.
      if (trimmed && (!defaultWs || trimmed !== defaultWs.name)) {
        const ws = await createWorkspace(trimmed);
        await switchWorkspace(ws.id, ws.name);
      } else if (defaultWs) {
        await switchWorkspace(defaultWs.id, defaultWs.name);
      }
      // Trigger a soft route refresh so that WorkspaceSwitcher and other layout
      // components pick up the updated workspace name without a full page reload.
      router.refresh();
      // Move to step 2 instead of pushing to /onboarding
      setStep(2);
    } catch (err: any) {
      setError(err?.message ?? "Could not set up your workspace");
    } finally {
      setLoading(false);
    }
  }

  async function handleProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (trimmed) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("pendingProject", trimmed);
        }
      } catch {}
    }
    // Mark onboarding as complete on the backend
    try {
      const { patch } = await import("@/lib/apiClient");
      await patch("/api/auth/me", { onboarding_completed: true });
    } catch {}
    router.push("/stories");
    router.refresh();
  }

  if (authLoading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
        <Loader2 size={32} className="animate-spin text-white/70" />
      </div>
    );
  }

  if (step === 2) {
    return (
      <AuthShell title="Create your first project" subtitle="Projects help you organise stories. You can always add more later.">
        <form onSubmit={handleProjectSubmit} className="space-y-4">
          <div className="flex items-center justify-center mb-2">
            <span className="w-12 h-12 rounded-xl bg-surface-pink text-pink flex items-center justify-center">
              <FolderOpen size={22} />
            </span>
          </div>
          <AuthField label="Project name">
            <AuthInput
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
              required
              placeholder="e.g. Mobile App, Backend API, Payment Flow"
              maxLength={80}
            />
          </AuthField>

          <AuthButton type="submit" loading={loading} disabled={!projectName.trim()}>
            Start building →
          </AuthButton>

          <button
            type="button"
            onClick={async () => {
              try { const { patch } = await import("@/lib/apiClient"); await patch("/api/auth/me", { onboarding_completed: true }); } catch {}
              router.push("/stories"); router.refresh();
            }}
            className="w-full text-center text-sm text-muted hover:text-navy transition-colors py-1"
          >
            Skip for now
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Name your workspace" subtitle="This is where your stories, tests, and team live.">
      <form onSubmit={handleContinue} className="space-y-4">
        <div className="flex items-center justify-center mb-2">
          <span className="w-12 h-12 rounded-xl bg-surface-pink text-pink flex items-center justify-center">
            <Building2 size={22} />
          </span>
        </div>
        <AuthField label="Workspace name">
          <AuthInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Acme QA"
            maxLength={60}
          />
        </AuthField>

        <AuthError message={error} />

        <AuthButton type="submit" loading={loading}>
          Continue
        </AuthButton>
      </form>
    </AuthShell>
  );
}
