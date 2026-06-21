"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Building2, CreditCard,
  Zap, Activity, AlertTriangle, LogOut, Shield, Cpu,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/credits", label: "Credits", icon: Zap },
  { href: "/admin/tokens", label: "Token Usage", icon: Cpu },
  { href: "/admin/usage", label: "Generation Activity", icon: Activity },
  { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") { setAuthed(true); return; }
    const token = localStorage.getItem("admin_token");
    if (!token) router.replace("/admin/login");
    else setAuthed(true);
  }, [pathname, router]);

  if (!authed) return null;
  if (pathname === "/admin/login") return <>{children}</>;

  function logout() {
    localStorage.removeItem("admin_token");
    router.push("/admin/login");
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
          <Shield size={20} className="text-pink-500" />
          <span className="font-bold text-sm tracking-wide text-white">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "bg-pink-600/20 text-pink-400 font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800">
          <button onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 w-full transition-colors">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-950">
        {children}
      </main>
    </div>
  );
}
