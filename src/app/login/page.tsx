"use client";

import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) { setErro(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message); setLoading(false); return; }
      router.push("/dashboard");
    } catch {
      setErro("Erro de conexão. Verifique as variáveis de ambiente.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center",
      padding: 24, background: "var(--bg)",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(10,132,255,0.08) 0%, transparent 70%)",
        }} />
      </div>

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, var(--accent), var(--purple))",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 32px rgba(10,132,255,0.3)",
          }}>
            <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
              <path d="M20 6h-2.18c.07-.44.18-.86.18-1a2 2 0 00-2-2h-2a2 2 0 00-2 2c0 .14.11.56.18 1H10c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-1h2v2h-2V5zm-3 3h8v10H10V8z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>AutoCurriculo AI</h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            Entre para acessar seu painel
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding: 28,
          boxShadow: "var(--shadow-card)",
        }}>
          <form onSubmit={handleLogin}>
            {erro && (
              <div style={{
                marginBottom: 18, padding: "10px 14px", borderRadius: "var(--radius-sm)",
                background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.2)",
                color: "var(--red)", fontSize: 13,
              }}>
                {erro}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.02em" }}>
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.02em" }}>
                SENHA
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%", padding: "12px 0", fontSize: 15, fontWeight: 600 }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span className="animate-spin" style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} />
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
          Não tem conta?{" "}
          <Link href="/register" style={{ color: "var(--accent)", fontWeight: 500 }}>
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
