"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/dashboard/prospeccao", label: "Prospecção", icon: "🎯" },
  { href: "/dashboard/candidaturas", label: "Candidaturas", icon: "□" },
  { href: "/dashboard/leads", label: "Leads", icon: "○" },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: "⚙" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside style={{
      width: 240,
      minHeight: "100vh",
      background: "var(--bg-card)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "20px 12px",
    }}>
      <div style={{ padding: "0 12px", marginBottom: 32 }}>
        <Link href="/dashboard" style={{ fontSize: 18, fontWeight: 700, color: "var(--primary)" }}>
          AutoCurriculo
        </Link>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>AI</p>
      </div>

      <nav style={{ flex: 1 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 4,
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--text)" : "var(--text-muted)",
                background: isActive ? "var(--bg)" : "transparent",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = "var(--bg)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="btn-outline"
        style={{ width: "100%", marginTop: "auto" }}
      >
        Sair
      </button>
    </aside>
  );
}
