"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const navItems = [
  {
    href: "/dashboard",
    label: "Visão Geral",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    section: "SERVIÇOS",
  },
  {
    href: "/dashboard/servicos",
    label: "Meus Serviços",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  },
  {
    href: "/dashboard/campanhas",
    label: "Campanhas",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  },
  {
    href: "/dashboard/criativos",
    label: "Criativos",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/><path d="M3 15l4-4 4 4 4-4 4 4"/></svg>,
  },
  {
    section: "PANFLETAGEM",
  },
  {
    href: "/dashboard/panfletagem",
    label: "Gerar Panfletos",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    badge: "IA",
  },
  {
    href: "/dashboard/canais",
    label: "Canais",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
  },
  {
    href: "/dashboard/fila",
    label: "Fila de Publicação",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  },
  {
    href: "/dashboard/autopilot",
    label: "Autopilot",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
    badge: "Runner",
  },
  {
    section: "RESULTADOS",
  },
  {
    href: "/dashboard/leads",
    label: "Leads",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  },
  {
    href: "/dashboard/historico",
    label: "Histórico",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>,
  },
  {
    section: "BOT CLT",
  },
  {
    href: "/dashboard/candidaturas",
    label: "Candidaturas",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  },
  {
    href: "/dashboard/configuracoes",
    label: "Configurações",
    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ""));
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside style={{
      width: 224, minHeight: "100vh", background: "var(--bg-elevated)",
      borderRight: "1px solid var(--border)", display: "flex",
      flexDirection: "column", padding: "16px 8px", flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "4px 8px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), var(--purple))",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" fill="white" viewBox="0 0 24 24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>Panfletagem</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>Digital AI · v4</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
        {navItems.map((item, idx) => {
          if ("section" in item) {
            return (
              <div key={idx} style={{
                fontSize: 9, fontWeight: 700, color: "var(--text-tertiary)",
                letterSpacing: "0.1em", padding: "12px 8px 4px",
              }}>
                {item.section}
              </div>
            );
          }
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 8px",
              borderRadius: 7, fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--text)" : "var(--text-secondary)",
              background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
              textDecoration: "none", transition: "all 0.1s", position: "relative",
            }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              {isActive && <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 2, height: 14, borderRadius: 1, background: "var(--accent)" }} />}
              <span style={{ opacity: isActive ? 1 : 0.55, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {"badge" in item && item.badge && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 100, background: "rgba(10,132,255,0.18)", color: "var(--accent)", letterSpacing: "0.02em" }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        {userEmail && (
          <div style={{ padding: "6px 8px", marginBottom: 4, borderRadius: 6, background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 2 }}>Conta</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</div>
          </div>
        )}
        <button onClick={handleLogout} disabled={loggingOut} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 8px",
          borderRadius: 7, background: "transparent", border: "none", color: "var(--text-tertiary)",
          fontSize: 13, cursor: "pointer", transition: "all 0.1s",
        }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.background = "rgba(255,69,58,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          {loggingOut ? "Saindo..." : "Sair"}
        </button>
      </div>
    </aside>
  );
}
