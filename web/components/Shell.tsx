"use client";

import { Suspense, useEffect, useState, useCallback, type PropsWithChildren, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import ThemeToggle from "@/components/ui/ThemeToggle";
import {
  IconDashboard,
  IconPresentation,
  IconList,
  IconSettings,
  IconShield,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/ui/Icons";
import Modal from "@/components/ui/Modal";
import ProTag from "@/components/ui/ProTag";
import Logo from "@/components/ui/Logo";
import LogoutButton from "@/components/ui/LogoutButton";
import { apiFetch } from "@/app/lib/apiFetch";
import { isPublicRoute, isParticipantRoute, isRestrictedRoute } from "@/app/lib/routeRules";

// Types
interface User {
  id: string;
  email?: string | null;
  plan: "free" | "pro";
}

interface SectionProps {
  label: string;
  collapsed?: boolean;
  children: ReactNode;
}

interface NavLinkProps {
  href: string;
  label: ReactNode;
  icon?: ReactNode;
  collapsed?: boolean;
}

// Constants
const STORAGE_KEY = "sf_sidebar_collapsed";

// Helper functions are centralized in @/app/lib/routeRules

const getSidebarCollapsedState = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const setSidebarCollapsedState = (collapsed: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Silently fail if localStorage is unavailable
  }
};

// Sub-components
function Section({ label, children, collapsed }: SectionProps) {
  return (
    <div className="mb-4">
      <div
        className={`mb-2 px-2 text-[11px] uppercase tracking-wider text-[var(--muted)] transition-opacity ${
          collapsed ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={collapsed}
      >
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavLink({ href, label, icon, collapsed }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : (pathname === href || pathname?.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      title={typeof label === "string" ? label : undefined}
      className={`flex items-center ${
        collapsed ? "justify-center" : "gap-2"
      } rounded-md border px-3 py-2 transition-colors ${
        isActive
          ? "border-white/20 bg-white/10"
          : "border-transparent hover:border-white/10 hover:bg-white/5"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

// Main component
function ShellBody({ children }: PropsWithChildren) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();

  // State
  const [me, setMe] = useState<User | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [collapsed, setCollapsed] = useState(getSidebarCollapsedState);

  // Route checks
  const isParticipant = isParticipantRoute(pathname);
  const isPublicHome = isPublicRoute(pathname);
  const showFullChrome = !isParticipant && !isPublicHome;

  // Fetch user session once on mount and on visibility/focus changes (avoid per-route fetches)
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setMeLoading(true);
      try {
        const response = await apiFetch("/api/auth/session", { cache: "no-store" });
        if (!isMounted) return;
        if (response.ok) {
          const data = await response.json();
          setMe(data.user || null);
        } else {
          setMe(null);
        }
      } catch (e) {
        if (isMounted) setMe(null);
      } finally {
        if (isMounted) setMeLoading(false);
      }
    };
    load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("visibilitychange", onVis);
    return () => {
      isMounted = false;
      window.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Auth protection
  useEffect(() => {
    if (meLoading) return;
    if (!me && isRestrictedRoute(pathname)) {
      const full = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      router.replace("/login?redirect=" + encodeURIComponent(full));
    }
  }, [me, meLoading, pathname, searchParams, router]);

  // Persist sidebar state
  useEffect(() => {
    setSidebarCollapsedState(collapsed);
  }, [collapsed]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // Strip chrome entirely on participant/public entry pages
  if (!showFullChrome) {
    return (
      <main className="min-h-dvh bg-[var(--bg)]">
        <div className={isPublicHome ? "" : "p-6"}>{children}</div>
      </main>
    );
  }

  // Sidebar width
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
          {/* LEFT SIDE */}
          <div className="flex items-center gap-3">
            <Logo size={20} className="-top-0.5" />

            <Link
              href={me ? "/dashboard" : "/"}
              className="font-semibold tracking-tight flex items-baseline gap-1 hover:opacity-80 transition-opacity"
            >
              <span className="text-[var(--text)]">Session</span>
              <span className="text-[var(--brand)]">Foundry</span>
            </Link>

            <span aria-hidden className="text-xs text-[var(--muted)] select-none">Beta</span>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex items-center justify-end gap-2">
            {/* Theme toggle in header for quick access */}
            <ThemeToggle />

            {meLoading ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-white/5" />
            ) : me ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--muted)] select-none">
                  {me.plan.toUpperCase()}
                </span>

                <Link
                  href="/pricing"
                  className="rounded-md border border-white/10 px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
                >
                  {me.plan === "free" ? "Upgrade to Pro" : "Manage Plan"}
                </Link>

                <LogoutButton />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-md border border-white/10 px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm transition-colors hover:bg-white/10"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside className="col-[1] row-[2] border-r border-white/10 bg-[var(--panel)]">
        <div className="flex h-full flex-col">
          <nav id="sidebar-nav" className={`p-3 text-sm ${collapsed ? "space-y-2" : ""}`}>
            {/* GENERAL */}
            <Section label="General" collapsed={collapsed}>
              <NavLink
                collapsed={collapsed}
                href="/dashboard"
                label="Dashboard"
                icon={<IconDashboard />}
              />
              <button
                className="mt-2 h-8 w-8 grid place-items-center rounded-md border border-white/10 bg-[var(--panel-2)] transition-colors hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                onClick={toggleSidebar}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-pressed={collapsed}
                aria-controls="sidebar-nav"
                title={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
              </button>

              <NavLink
                collapsed={collapsed}
                href="/sessions"
                label="Sessions"
                icon={<IconPresentation />}
              />

              <NavLink
                collapsed={collapsed}
                href="/templates"
                label={
                  <span className="flex items-center gap-2 w-full">
                    <span>Templates</span>
                    {!collapsed && <ProTag />}
                  </span>
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
                  id="policies-button"
                  className={`w-full flex items-center ${
                    collapsed ? "justify-center" : "gap-2"
                  } rounded-md border border-transparent px-3 py-2 transition-colors hover:border-white/10 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]`}
                  onClick={() => setPoliciesOpen((prev) => !prev)}
                  aria-expanded={policiesOpen}
                  aria-controls="policies-panel"
                  aria-label="Policies menu"
                >
                  {!collapsed && (
                    <span
                      className={`inline-block transition-transform duration-200 ${
                        policiesOpen ? "rotate-90" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <IconChevronRight />
                    </span>
                  )}
                  <IconShield />
                  {!collapsed && <span>Policies</span>}
                </button>
                
                {!collapsed && policiesOpen && (
                  <div
                    id="policies-panel"
                    role="region"
                    aria-labelledby="policies-button"
                    className="mt-1 ml-6 pl-3 space-y-1 border-l border-white/10"
                  >
                    <button
                      className="w-full flex items-center gap-2 text-left text-sm rounded-md border border-transparent px-3 py-2 transition-colors hover:border-white/10 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      onClick={() => setShowPrivacy(true)}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-white/40 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span>Privacy Policy</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-2 text-left text-sm rounded-md border border-transparent px-3 py-2 transition-colors hover:border-white/10 hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                      onClick={() => setShowTerms(true)}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-white/40 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span>Terms & Conditions</span>
                    </button>
                  </div>
                )}
              </div>
            </Section>

            {/* THEME TOGGLE */}
            <div className={`pt-4 ${collapsed ? 'flex flex-col items-center' : 'px-3 flex flex-col items-center'}`}>
              {!collapsed && (
                <div className="mb-2 text-xs text-[var(--muted)] self-start">Color Mode</div>
              )}
              <ThemeToggle />
            </div>
          </nav>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="col-[2] row-[2] bg-[var(--bg)] overflow-y-auto">
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 md:px-6">
          {children}
        </div>
      </main>

      {/* Policy modals */}
      <Modal
        open={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacy Policy"
        size="lg"
        footer={
          <button
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm transition-colors hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            onClick={() => setShowPrivacy(false)}
          >
            Close
          </button>
        }
      >
        <div className="w-full h-[70vh]">
          <iframe
            src="/privacy"
            className="w-full h-full rounded border-0"
            title="Privacy Policy"
          />
        </div>
      </Modal>

      <Modal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        title="Terms & Conditions"
        size="lg"
        footer={
          <button
            className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm transition-colors hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            onClick={() => setShowTerms(false)}
          >
            Close
          </button>
        }
      >
        <div className="w-full h-[70vh]">
          <iframe
            src="/terms"
            className="w-full h-full rounded border-0"
            title="Terms & Conditions"
          />
        </div>
      </Modal>
    </div>
  );
}

export default function Shell(props: PropsWithChildren) {
  return (
    <Suspense fallback={<div />}> 
      <ShellBody {...props} />
    </Suspense>
  );
}
