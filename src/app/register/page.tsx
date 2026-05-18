"use client";

import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    // Auto-login if email confirmation is disabled
    if (data.user?.email_confirmed_at) {
      await supabase.auth.signInWithPassword({ email, password: senha });
      router.push("/dashboard");
      return;
    }

    setSucesso(true);
    setLoading(false);
  };

  if (sucesso) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div className="card">
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Conta criada!</h2>
            <p className="text-muted" style={{ marginBottom: 20 }}>
              Verifique seu email para confirmar o cadastro.
            </p>
            <a href="/login" className="btn-primary" style={{ display: "inline-block" }}>
              Ir para o login
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>
            AutoCurriculo AI
          </h1>
          <p className="text-muted" style={{ marginTop: 8 }}>
            Crie sua conta gratuita
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleRegister}>
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
              minLength={6}
              style={{ marginBottom: 24 }}
              placeholder="Minimo 6 caracteres"
            />

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", padding: 12 }}>
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14 }} className="text-muted">
          Ja tem conta? <a href="/login">Fazer login</a>
        </p>
      </div>
    </div>
  );
}
