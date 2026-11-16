"use client";

import Link from "next/link";
import { BriefcaseBusiness, FileSearch, ShieldCheck } from "lucide-react";

interface AuthFrameProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerHref: string;
  footerLabel: string;
}

export default function AuthFrame({ title, subtitle, children, footerText, footerHref, footerLabel }: AuthFrameProps) {
  return <main className="auth-layout">
    <section className="auth-panel">
      <Link href="/" className="brand-lockup"><span className="brand-symbol"><BriefcaseBusiness size={19}/></span><span>AutoCurrículo <b>AI</b></span></Link>
      <p className="eyebrow">SUA BUSCA PROFISSIONAL, EM UM SÓ LUGAR</p>
      <h1>{title}</h1><p className="auth-intro">{subtitle}</p>
      <div className="auth-form">{children}</div>
      <p className="auth-switch">{footerText} <Link href={footerHref}>{footerLabel}</Link></p>
      <p className="auth-privacy"><ShieldCheck size={15}/> Seus dados ficam associados à sua conta.</p>
    </section>
    <aside className="auth-aside"><div className="auth-aside-icon"><FileSearch size={24}/></div><p className="eyebrow">BUSCA ORGANIZADA</p><h2>Mais clareza em cada etapa da procura.</h2><p>Guarde seu currículo, acompanhe candidaturas e mantenha suas oportunidades organizadas em um só espaço.</p><div className="auth-aside-rule"/><span>AutoCurrículo AI <span>·</span> carreira com mais organização</span></aside>
    <style jsx>{`
      .auth-layout{min-height:100dvh;display:grid;grid-template-columns:minmax(420px,1fr) minmax(360px,.8fr);background:#09111a;color:#eaf4fa;font-family:Inter,"Segoe UI",sans-serif}
      .auth-panel{width:min(100%,560px);padding:clamp(28px,6vw,76px);margin:auto}
      .brand-lockup{display:inline-flex;gap:11px;align-items:center;color:#eaf4fa;font-size:17px;font-weight:700;text-decoration:none;margin-bottom:64px;letter-spacing:-.03em}
      .brand-lockup b{color:#7dd3fc}.brand-symbol{width:38px;height:38px;border:1px solid #2a506b;border-radius:9px;background:#123047;color:#7dd3fc;display:grid;place-items:center}
      .eyebrow{font-size:11px;letter-spacing:.12em;font-weight:700;color:#7dd3fc;margin-bottom:14px}
      h1{font-size:clamp(30px,4vw,42px);letter-spacing:-.045em;line-height:1.08;margin:0 0 12px;font-weight:650}
      .auth-intro{color:#a8bacb;line-height:1.6;font-size:15px;margin:0 0 28px}
      .auth-form{background:linear-gradient(145deg,#122130,#0f1a27);border:1px solid #2a4055;border-radius:14px;padding:24px;box-shadow:0 20px 50px #0004}
      .auth-switch{text-align:center;color:#a8bacb;font-size:14px;margin:22px 0}.auth-switch :global(a){color:#7dd3fc;font-weight:650}
      .auth-privacy{display:flex;justify-content:center;align-items:center;gap:7px;color:#8298a9;font-size:12px}.auth-privacy :global(svg){color:#5eead4}
      .auth-aside{margin:20px;background:radial-gradient(circle at 70% 20%,#1a4560 0,transparent 45%),#0e1d2b;border:1px solid #234258;border-radius:18px;padding:clamp(32px,5vw,72px);display:flex;flex-direction:column;justify-content:center;min-height:calc(100dvh - 40px)}
      .auth-aside-icon{width:50px;height:50px;border:1px solid #31566d;border-radius:12px;background:#112d42;color:#7dd3fc;display:grid;place-items:center;margin-bottom:48px}
      .auth-aside h2{font-size:clamp(28px,3.5vw,42px);letter-spacing:-.04em;line-height:1.1;max-width:440px;margin:0 0 16px}.auth-aside>p:not(.eyebrow){color:#b1c4d3;line-height:1.7;max-width:420px}
      .auth-aside-rule{height:1px;background:#29465c;margin:48px 0 16px}.auth-aside>span{font-size:12px;color:#91a8ba}
      @media(max-width:850px){.auth-layout{grid-template-columns:1fr}.auth-panel{padding:30px 22px}.brand-lockup{margin-bottom:40px}.auth-aside{min-height:0;margin:0;border-radius:0;padding:38px 24px}.auth-aside-icon{margin-bottom:28px}.auth-aside-rule{margin:28px 0 14px}}
      @media(max-width:380px){.auth-panel{padding:24px 16px}.auth-form{padding:18px}}
    `}</style>
  </main>;
}
