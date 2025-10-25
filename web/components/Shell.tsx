"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { IconDashboard, IconSessions, IconTemplates, IconSettings, IconHelp, IconChevronLeft, IconChevronRight } from "@/components/ui/Icons";
import ProTag from "@/components/ui/ProTag";
import Logo from "@/components/ui/Logo";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/ui/LogoutButton"; 

function Section({ label, children, collapsed }: PropsWithChildren<{ label: string; collapsed?: boolean }>) {
  return (
    <div className="mb-4">
      <div className={`px-2 mb-2 text-[11px] uppercase tracking-wider text-[var(--muted)] ${collapsed ? 'invisible' : ''}`}>{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavLink({ href, label, icon, collapsed }: { href: string; label: React.ReactNode; icon?: React.ReactNode; collapsed?: boolean }) {
  return (
    <Link href={href} title={typeof label === 'string' ? label : undefined} className={`flex items-center ${collapsed? 'justify-center':'gap-2'} px-3 py-2 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10`}>
      {icon}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export default function Shell({ children }: PropsWithChildren) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const isParticipant = pathname.startsWith("/join") || pathname.startsWith("/participant");
  const isPublicHome = pathname === "/" || pathname === "/home" || pathname.startsWith("/login");
  const [me, setMe] = useState<{ id: string; email?: string|null; plan: "free"|"pro" }|null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    (async () => {
      try{
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        const j = await r.json();
        setMe(j.user || null);
      }catch{
        setMe(null);
      } finally {
        setMeLoading(false);
      }
    })();
    // load sidebar state
    try { const c = localStorage.getItem('sf_sidebar_collapsed'); setCollapsed(c === '1'); } catch {}
  }, [pathname]);

  useEffect(() => {
    // Redirect unauthenticated users from restricted routes to home
    const restricted = ["/dashboard", "/sessions", "/templates", "/settings", "/session/"];
    if (meLoading) return;
    if (!me && restricted.some(p => pathname === p || pathname.startsWith(p))) {
      router.replace("/");
    }
  }, [me, meLoading, pathname, router]);

  useEffect(() => {
    try { localStorage.setItem('sf_sidebar_collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  if (isParticipant || isPublicHome) {
    return (
      <main className="min-h-dvh bg-[var(--bg)]">
        <div className={isPublicHome ? "" : "p-6"}>{children}</div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh grid grid-rows-[56px_1fr] overflow-x-hidden" style={{ gridTemplateColumns: collapsed ? '64px 1fr' : '240px 1fr' }}>
      <header className="col-span-2 row-[1] border-b border-white/10 bg-[var(--panel-2)]">
        <div className="h-14">
          <div className="mx-auto max-w-screen-2xl w-full h-full px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={20} className="-top-0.5" />
              <Link href="/" className="font-semibold tracking-tight">SessionFoundry</Link>
              <span className="text-xs text-[var(--muted)] ml-3">Beta</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                placeholder="Search"
                className="h-8 w-56 rounded-md bg-[var(--panel)] border border-white/10 px-3 text-sm outline-none focus:ring-[var(--ring)]"
              />
{me ? (
  <div className="flex items-center gap-2">
    <span className="text-xs text-[var(--muted)]">{me.plan.toUpperCase()}</span>
    <Link
      href="/pricing"
      className="text-sm px-2 py-1 rounded-md border border-white/10 hover:bg-white/5"
    >
      {me.plan === "free" ? "Become Pro" : "Manage plan"}
    </Link>
    {/* NEW COMPONENT */}
    <LogoutButton />
  </div>
) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="text-sm px-2 py-1 rounded-md border border-white/10 hover:bg-white/5">Sign in</Link>
                  <Link href="/login?mode=signup" className="text-sm px-2 py-1 rounded-md border border-white/10 hover:bg-white/5">Create account</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <aside className="row-[2] bg-[var(--panel)] border-r border-white/10">
        <div className="h-full flex flex-col">
          <nav className={`p-3 text-sm ${collapsed ? 'space-y-2' : ''}`}>
            <Section label="General" collapsed={collapsed}>
              <div className="relative">
                <NavLink collapsed={collapsed} href="/dashboard" label="Dashboard" icon={<IconDashboard />} />
                <button
                  className="absolute top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center rounded-md border border-white/10 bg-[var(--panel-2)] hover:bg-white/5 z-10"
                  style={{ right: -28 }}
                  onClick={() => setCollapsed(c => !c)}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  title={collapsed ? 'Expand' : 'Collapse'}
                >
                  {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
                </button>
              </div>
              <NavLink collapsed={collapsed} href="/sessions" label="Sessions" icon={<IconSessions />} />
              <NavLink collapsed={collapsed} href="/templates" label={<><span>Templates</span> {!collapsed && <ProTag />}</>} icon={<IconTemplates />} />
            </Section>
            <Section label="Admin" collapsed={collapsed}>
              <NavLink collapsed={collapsed} href="/settings" label="Settings" icon={<IconSettings />} />
              <NavLink collapsed={collapsed} href="/help" label="Help" icon={<IconHelp />} />
            </Section>
            <div className={`pt-2 flex flex-col items-center`}>
              <div className="text-xs text-[var(--muted)] mb-1">Colormode:</div>
              <div>
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      </aside>

      <main className="row-[2] bg-[var(--bg)]">
        <div className="mx-auto max-w-screen-2xl w-full px-4 md:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
