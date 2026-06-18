"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import {
  listWorkspaces,
  createWorkspace,
  switchWorkspace,
  type Workspace,
} from "@/lib/workspaces";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, AuthField, AuthInput, AuthButton, AuthError } from "@/components/auth/AuthShell";

/**
 * Onboarding step 1 — Create / confirm workspace.
 *
 * Registration auto-provisions a personal workspace, so this step lets the user
 * name their workspace (creating a new one) or keep the default, then continues
 * to the onboarding intro and finally the dashboard.
 */
export default function OnboardingWorkspacePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [defaultWs, setDefaultWs] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

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
        await switchWorkspace(ws.id);
      } else if (defaultWs) {
        await switchWorkspace(defaultWs.id);
      }
      router.push("/onboarding");
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Could not set up your workspace");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
        <Loader2 size={32} className="animate-spin text-white/70" />
      </div>
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
