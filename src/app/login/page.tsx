"use client";

import AuthFrame from "@/components/AuthFrame";
import { supabase } from "@/lib/supabase/client";
import { Loader2, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setErro(error.message === "Invalid login credentials" ? "Email ou senha incorretos." : error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      setErro("Erro de conexão. Verifique as variáveis de ambiente.");
      setLoading(false);
    }
  };

  return (
    <AuthFrame
      title="Entre no seu espaço profissional."
      subtitle="Entre para organizar seu currículo, encontrar oportunidades e acompanhar suas candidaturas."
      footerText="Ainda não tem conta?"
      footerHref="/register"
      footerLabel="Criar conta"
    >
      <form onSubmit={handleLogin} style={{ display: "grid", gap: 16 }}>
        {erro && (
          <div style={{
            padding: "11px 13px",
            borderRadius: 8,
            background: "rgba(255,69,58,0.10)",
            border: "1px solid rgba(255,69,58,0.24)",
            color: "#FF7A72",
            fontSize: 13,
            lineHeight: 1.45,
          }}>
            {erro}
          </div>
        )}

        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="seu@email.com"
            autoComplete="email"
            style={inputStyle}
          />
        </AuthField>

        <AuthField label="Senha">
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            placeholder="Sua senha"
            autoComplete="current-password"
            style={inputStyle}
          />
        </AuthField>
        <Link href="/recover" style={{ color: "var(--accent)", fontSize: 13, justifySelf: "end" }}>Esqueci minha senha</Link>

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthFrame>
  );
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ color: "var(--text-tertiary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-input)",
  color: "var(--text)",
  padding: "0 14px",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 50,
  borderRadius: 8,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "#07121c",
  fontSize: 15,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  marginTop: 6,
  cursor: "pointer",
  fontFamily: "inherit",
};
