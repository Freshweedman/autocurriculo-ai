"use client";

import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, CircleHelp, FileText, LayoutDashboard, LogOut, Menu, Search, Settings2, ShieldCheck, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const groups = [
  { label: "Principal", items: [{ href: "/dashboard", label: "Visão geral", icon: LayoutDashboard }] },
  { label: "Minha busca", items: [{ href: "/dashboard/oportunidades", label: "Oportunidades", icon: Search }, { href: "/dashboard/candidaturas", label: "Candidaturas", icon: BriefcaseBusiness }] },
  { label: "Conta", items: [{ href: "/dashboard/curriculos", label: "Currículos", icon: FileText }, { href: "/dashboard/configuracoes", label: "Configurações", icon: Settings2 }, { href: "/dashboard/guia", label: "Como usar", icon: CircleHelp }] },
];

function initialClosedGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("ac-nav-groups") || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [closed, setClosed] = useState<Record<string, boolean>>(initialClosedGroups);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setEmail(user?.email || "");
      if (!user) return;
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      setIsAdmin(role?.role === "admin");
    });
  }, []);

  function toggle(label: string) {
    setClosed((current) => {
      const next = { ...current, [label]: !current[label] };
      localStorage.setItem("ac-nav-groups", JSON.stringify(next));
      return next;
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return <>
    <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
    {open && <button className="nav-backdrop" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
    <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
      <div className="sidebar-top">
        <Link href="/dashboard" className="sidebar-brand" onClick={() => setOpen(false)}><span><FileText size={18} /></span>AutoCurrículo <b>AI</b></Link>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
      </div>
      <nav className="app-nav" aria-label="Navegação principal">
        {groups.map((group) => <section className="nav-group" key={group.label}>
          <button className="nav-group-label" onClick={() => toggle(group.label)} aria-expanded={!closed[group.label]}>{group.label}<ChevronDown size={14} className={closed[group.label] ? "is-closed" : ""} /></button>
          {!closed[group.label] && group.items.map((item) => {
            const Icon = item.icon;
            return <Link className={`nav-link ${pathname === item.href ? "is-active" : ""}`} href={item.href} key={`${group.label}-${item.label}`} onClick={() => setOpen(false)}><Icon size={17} /><span>{item.label}</span></Link>;
          })}
        </section>)}
        {isAdmin && <section className="nav-group"><p className="nav-group-label">Administração</p><Link className={`nav-link ${pathname === "/dashboard/administracao" ? "is-active" : ""}`} href="/dashboard/administracao" onClick={() => setOpen(false)}><ShieldCheck size={17} /><span>Marketplace</span></Link></section>}
      </nav>
      <div className="sidebar-account"><div><small>CONTA</small><span title={email}>{email || "Carregando…"}</span></div><button onClick={logout} aria-label="Sair"><LogOut size={17} /></button></div>
    </aside>
  </>;
}
