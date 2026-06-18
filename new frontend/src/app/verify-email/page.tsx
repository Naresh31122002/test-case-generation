"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { verifyEmail } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";

type Status = "verifying" | "success" | "error";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh, user } = useAuth();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        await verifyEmail(token);
        await refresh(); // pick up email_verified=true in the session
        setStatus("success");
        // If logged in, head to the app; otherwise to login.
        setTimeout(() => router.push(user ? "/stories" : "/login"), 1500);
      } catch {
        setStatus("error");
      }
    })();
  }, [token, refresh, router, user]);

  return (
    <AuthShell
      title={
        status === "success"
          ? "Email verified"
          : status === "error"
          ? "Verification failed"
          : "Verifying your email…"
      }
      footer={
        status !== "verifying" ? (
          <Link href={user ? "/stories" : "/login"} className="font-semibold hover:underline" style={{ color: "#FF0A78" }}>
            {user ? "Go to dashboard" : "Back to sign in"}
          </Link>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center text-center gap-3 py-2">
        {status === "verifying" && <Loader2 size={40} className="text-cyan-500 animate-spin" />}
        {status === "success" && <CheckCircle2 size={40} className="text-green-500" />}
        {status === "error" && <XCircle size={40} className="text-red-500" />}
        <p className="text-sm text-gray-500">
          {status === "verifying" && "Hang tight while we confirm your email."}
          {status === "success" && "Your email is confirmed. Redirecting…"}
          {status === "error" && "This link is invalid or has expired. You can request a new one from the app."}
        </p>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A]" />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
