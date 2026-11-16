"use client";

import AuthFrame from "@/components/AuthFrame";
import { supabase } from "@/lib/supabase/client";
import { Loader2, MailCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
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

    if (data.session) {
      router.push("/dashboard");
      return;
    }

    if (data.user?.email_confirmed_at) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (!loginError) {
        router.push("/dashboard");
        return;
      }
    }

    setSucesso(true);
    setLoading(false);
  };

  if (sucesso) {
    return (
      <AuthFrame
        title="Confirme seu acesso."
        subtitle="Enviamos um link para ativar sua conta. Depois disso, você poderá acessar seu espaço profissional."
        footerText="Já confirmou?"
        footerHref="/login"
        footerLabel="Ir para login"
      >
        <div style={{ display: "grid", gap: 16, textAlign: "center" }}>
          <div style={{ width: 54, height: 54, border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card-hover)", color: "var(--accent)", display: "grid", placeItems: "center", margin: "0 auto" }}>
            <MailCheck size={26} />
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
            Link enviado para <strong style={{ color: "var(--text)" }}>{email}</strong>.
          </p>
          <Link href="/login" style={linkButtonStyle}>Ir para o login</Link>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Organize sua próxima oportunidade."
      subtitle="Crie sua conta para reunir currículo, preferências de busca e candidaturas em um só lugar."
      footerText="Já tem conta?"
      footerHref="/login"
      footerLabel="Fazer login"
    >
      <form onSubmit={handleRegister} style={{ display: "grid", gap: 16 }}>
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
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="seu@email.com" autoComplete="email" style={inputStyle} />
        </AuthField>

        <AuthField label="Senha">
          <input type="password" value={senha} onChange={(event) => setSenha(event.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" autoComplete="new-password" style={inputStyle} />
        </AuthField>

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>
    </AuthFrame>
  );
}

function AuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ color: "var(--text-tertiary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
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

const linkButtonStyle: React.CSSProperties = {
  height: 46,
  borderRadius: 8,
  background: "var(--accent)",
  color: "#07121c",
  fontSize: 14,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};
