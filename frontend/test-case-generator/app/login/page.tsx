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
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E]">
      <div className="w-full max-w-md px-8 py-10 bg-[#1A1A2E] rounded-2xl shadow-xl border border-[#FF4D6D]/20">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">Test Forge AI</h1>
          <p className="mt-2 text-sm text-[#FBCFE8]">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#FBCFE8] mb-1.5">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#1A1A2E] border border-[#FF4D6D]/30 text-white placeholder-[#4a7a8a] focus:outline-none focus:ring-2 focus:ring-[#FF4D6D] focus:border-transparent transition"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#FBCFE8] mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#1A1A2E] border border-[#FF4D6D]/30 text-white placeholder-[#4a7a8a] focus:outline-none focus:ring-2 focus:ring-[#FF4D6D] focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#FF4D6D] hover:bg-[#E11D48] disabled:opacity-60 text-white font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#FF4D6D] focus:ring-offset-2 focus:ring-offset-[#1A1A2E]"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#FBCFE8]">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#FF4D6D] hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
