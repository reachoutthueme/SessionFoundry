"use client";

import { useEffect, useState, PropsWithChildren } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import ThemeToggle from "@/components/ui/ThemeToggle";
import {
  IconDashboard,
  IconGroup,
  IconList,
  IconSettings,
  IconHelp,
  IconShield,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/ui/Icons";
import Modal from "@/components/ui/Modal";
import ProTag from "@/components/ui/ProTag";
import Logo from "@/components/ui/Logo";
import LogoutButton from "@/components/ui/LogoutButton";

function Section({
  label,
  children,
  collapsed,
}: PropsWithChildren<{ label: string; collapsed?: boolean }>) {
  return (
    <div className="mb-4">
      <div
        className={`mb-2 px-2 text-[11px] uppercase tracking-wider text-[var(--muted)] ${
          collapsed ? "invisible" : ""
        }`}
      >
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon,
  collapsed,
}: {
  href: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={href}
      title={typeof label === "string" ? label : undefined}
      className={`flex items-center ${
        collapsed ? "justify-center" : "gap-2"
      } rounded-md border border-transparent px-3 py-2 hover:border-white/10 hover:bg-white/5`}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export default function Shell({ children }: PropsWithChildren) {
  const pathname = usePathname() || "/";
  const router = useRouter();

  // participant / public surfaces shouldn't get the full chrome
  const isParticipant =
    pathname.startsWith("/join") || pathname.startsWith("/participant");
  const isPublicHome =
    pathname === "/" ||
    pathname === "/home" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/policies");

  // auth state
  const [me, setMe] = useState<{
    id: string;
    email?: string | null;
    plan: "free" | "pro";
  } | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [authCheckedPath, setAuthCheckedPath] = useState<string | null>(null);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // sidebar collapsed state (persisted)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sf_sidebar_collapsed") === "1";
    } catch {
      return false;
    }
  });

  // fetch current user/session
  useEffect(() => {
    (async () => {
      setMeLoading(true);
      setAuthCheckedPath(null);
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setMe(j.user || null);
        } else {
          setMe(null);
        }
      } catch {
        setMe(null);
      } finally {
        setMeLoading(false);
        setAuthCheckedPath(pathname);
      }
    })();
  }, [pathname]);

  // persist collapse preference
  useEffect(() => {
    try {
      localStorage.setItem("sf_sidebar_collapsed", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // prevent logged-out users from landing on facilitator-only routes
  useEffect(() => {
    if (meLoading) return;
    if (authCheckedPath !== pathname) return;

    const restrictedPrefixes = [
      "/dashboard",
      "/sessions",
      "/templates",
      "/settings",
      "/session/",
    ];
    const isRestricted = restrictedPrefixes.some(
      (p) => pathname === p || pathname.startsWith(p)
    );

    if (!me && isRestricted) {
      router.replace("/");
    }
  }, [me, meLoading, pathname, authCheckedPath, router]);

  // Strip chrome entirely on participant/public entry pages
  if (isParticipant || isPublicHome) {
    return (
      <main className="min-h-dvh bg-[var(--bg)]">
        <div className={isPublicHome ? "" : "p-6"}>{children}</div>
      </main>
    );
  }

  // Sidebar width used in grid
  const sidebarWidth = collapsed ? "64px" : "240px";

  return (
    <div
      className="min-h-dvh grid overflow-x-hidden"
      style={{
        gridTemplateRows: "56px 1fr",
        gridTemplateColumns: `${sidebarWidth} 1fr`,
      }}
    >
      {/* HEADER */}
      <header className="col-[1_/_span_2] row-[1] border-b border-white/10 bg-[var(--panel-2)]">
        <div className="flex h-14 w-full items-center justify-between pl-3 pr-4 md:pr-6">
          {/* LEFT SIDE: logo + brand + beta */}
          <div className="flex items-center gap-3">
            <Logo size={20} className="-top-0.5" />

            <Link
              href="/"
              className="font-semibold tracking-tight flex items-baseline gap-1"
            >
              <span className="text-[var(--text)]">Session</span>
              <span className="text-[var(--brand)]">Foundry</span>
            </Link>

            <span className="text-xs text-[var(--muted)]">Beta</span>
          </div>

          {/* RIGHT SIDE: search + account/plan */}
          <div className="flex items-center justify-end gap-2">
            <input
              aria-label="Search"
              placeholder="Search"
              className="h-8 w-56 rounded-md border border-white/10 bg-[var(--panel)] px-3 text-sm outline-none focus:ring-[var(--ring)]"
            />

            {me ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">
                  {me.plan.toUpperCase()}
                </span>

                <Link
                  href="/pricing"
                  className="rounded-md border border-white/10 px-2 py-1 text-sm hover:bg-white/5"
                >
                  {me.plan === "free" ? "Become Pro" : "Manage plan"}
                </Link>

                <LogoutButton />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-md border border-white/10 px-2 py-1 text-sm hover:bg-white/5"
                >
                  Sign in
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="rounded-md border border-white/10 px-2 py-1 text-sm hover:bg-white/5"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside className="col-[1] row-[2] border-r border-white/10 bg-[var(--panel)]">
        <div className="flex h-full flex-col">
          <nav className={`p-3 text-sm ${collapsed ? "space-y-2" : ""}`}>
            {/* GENERAL */}
            <Section label="General" collapsed={collapsed}>
              <div className="relative">
                <NavLink
                  collapsed={collapsed}
                  href="/dashboard"
                  label="Dashboard"
                  icon={<IconDashboard />}
                />
                <button
                  className="absolute top-1/2 z-10 h-8 w-8 -translate-y-1/2 grid place-items-center rounded-md border border-white/10 bg-[var(--panel-2)] hover:bg-white/5"
                  style={{ right: -28 }}
                  onClick={() => setCollapsed((c) => !c)}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={collapsed ? "Expand" : "Collapse"}
                >
                  {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
                </button>
              </div>

              <NavLink
                collapsed={collapsed}
                href="/sessions"
                label="Sessions"
                icon={<IconGroup />}
              />

              <NavLink
                collapsed={collapsed}
                href="/templates"
                label={
                  <>
                    <span>Templates</span> {!collapsed && <ProTag />}
                  </>
                }
                icon={<IconList />}
              />
            </Section>

            {/* ADMIN */}
            <Section label="Admin" collapsed={collapsed}>
              <NavLink
                collapsed={collapsed}
                href="/settings"
                label="Settings"
                icon={<IconSettings />}
              />
              {/* Policies accordion */}
              <div>
                <button
                  className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-2'} rounded-md border border-transparent px-3 py-2 hover:border-white/10 hover:bg-white/5`}
                  onClick={() => setPoliciesOpen((o) => !o)}
                  aria-expanded={policiesOpen}
                >
                  <IconShield />
                  {!collapsed && <span>Policies</span>}
                </button>
                {!collapsed && policiesOpen && (
                  <div className="mt-1 ml-9 space-y-1">
                    <button
                      className="w-full text-left text-sm rounded-md border border-transparent px-3 py-2 hover:border-white/10 hover:bg-white/5"
                      onClick={() => setShowPrivacy(true)}
                    >
                      Privacy Policy
                    </button>
                    <button
                      className="w-full text-left text-sm rounded-md border border-transparent px-3 py-2 hover:border-white/10 hover:bg-white/5"
                      onClick={() => setShowTerms(true)}
                    >
                      Terms & Conditions
                    </button>
                  </div>
                )}
              </div>
            </Section>

            {/* THEME TOGGLE */}
            <div className="flex flex-col items-center pt-2">
              <div className="mb-1 text-xs text-[var(--muted)]">
                Colormode:
              </div>
              <div>
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="col-[2] row-[2] bg-[var(--bg)]">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 md:px-6">
          {children}
        </div>
      </main>

      {/* Policy modals */}
      <Modal open={showPrivacy} onClose={() => setShowPrivacy(false)} title="Privacy Policy" size="lg">
        <div className="w-full h-[70vh]">
          <iframe src="/privacy" className="w-full h-full rounded" />
        </div>
      </Modal>
      <Modal open={showTerms} onClose={() => setShowTerms(false)} title="Terms & Conditions" size="lg">
        <div className="w-full h-[70vh]">
          <iframe src="/terms" className="w-full h-full rounded" />
        </div>
      </Modal>
    </div>
  );
}
