"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";

function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invitation link — no token provided.");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/workspaces/invites/accept", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        // Not authenticated — redirect to login, preserving the invite token so
        // the user is sent back here after signing in.
        if (res.status === 401) {
          const next = encodeURIComponent(`/invite/accept?token=${token}`);
          router.replace(`/login?next=${next}`);
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Failed to accept invitation. It may have expired.");
          return;
        }
        setWorkspaceName(data.workspace?.name || "the workspace");
        setStatus("success");
        // Redirect to stories after short delay
        setTimeout(() => router.push("/stories"), 2500);
      } catch {
        setStatus("error");
        setMessage("Network error. Please try again.");
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-8 text-center">
        <div className="mb-4">
          <span className="text-2xl font-black text-[#0F172A]">Test<span className="text-[#FF0A78]">Surge</span></span>
        </div>
        {status === "loading" && (
          <>
            <Loader2 size={40} className="animate-spin text-[#FF0A78] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#0F172A] mb-2">Accepting invitation…</h2>
            <p className="text-sm text-[#64748B]">Please wait while we add you to the workspace.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 size={40} className="text-[#10B981] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#0F172A] mb-2">You're in!</h2>
            <p className="text-sm text-[#64748B]">You've joined <strong>{workspaceName}</strong>. Redirecting you now…</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertTriangle size={40} className="text-[#F59E0B] mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#0F172A] mb-2">Invitation problem</h2>
            <p className="text-sm text-[#64748B] mb-6">{message}</p>
            <Link href="/login" className="inline-block bg-[#FF0A78] text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-[#e0006a] transition-colors">
              Sign in to try again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-8 text-center">
          <Loader2 size={40} className="animate-spin text-[#FF0A78] mx-auto mb-4" />
          <p className="text-sm text-[#64748B]">Loading…</p>
        </div>
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  );
}
