"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { login } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      router.push(nextPath)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #FFF0F3 0%, #FAFAFA 60%, #FFE4E8 100%)" }}
    >
      {/* Card */}
      <div className="w-full max-w-md mx-4 bg-white rounded-3xl shadow-xl border border-[#FECDD3] px-8 py-10">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: "#FF4D6D" }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#1A1A2E" }}>
            Test Forge AI
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "#6B7280" }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1A1A2E" }}>
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white text-sm transition focus:outline-none"
              style={{
                border: "1.5px solid #FECDD3",
                color: "#1A1A2E",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#FF4D6D")}
              onBlur={e => (e.currentTarget.style.borderColor = "#FECDD3")}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1A1A2E" }}>
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white text-sm transition focus:outline-none"
              style={{
                border: "1.5px solid #FECDD3",
                color: "#1A1A2E",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "#FF4D6D")}
              onBlur={e => (e.currentTarget.style.borderColor = "#FECDD3")}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
              style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }}>
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ background: "#FF4D6D" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in…
              </span>
            ) : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "#6B7280" }}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold hover:underline" style={{ color: "#FF4D6D" }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
