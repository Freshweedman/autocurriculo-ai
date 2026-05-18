"use client";

import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
      if (error) {
        setErro(error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setErro("Erro de conexao. Verifique se as variaveis de ambiente estao configuradas no Vercel.");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>
            AutoCurriculo AI
          </h1>
          <p className="text-muted" style={{ marginTop: 8 }}>
            Faca login para acessar seu painel
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin}>
            {erro && (
              <div className="badge badge-danger" style={{ marginBottom: 16, width: "100%", justifyContent: "center" }}>
                {erro}
              </div>
            )}

            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-muted)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ marginBottom: 16 }}
              placeholder="seu@email.com"
            />

            <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--text-muted)" }}>
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              style={{ marginBottom: 24 }}
              placeholder="Sua senha"
            />

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", padding: 12 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14 }} className="text-muted">
          Nao tem conta? <a href="/register">Criar conta</a>
        </p>
      </div>
    </div>
  );
}
