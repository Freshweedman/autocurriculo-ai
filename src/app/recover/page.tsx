"use client";

import AuthFrame from "@/components/AuthFrame";
import { supabase } from "@/lib/supabase/client";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setMessage(error ? error.message : "Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.");
    setLoading(false);
  }

  return <AuthFrame title="Recupere seu acesso." subtitle="Informe o e-mail da sua conta para receber um link seguro de redefinição." footerText="Lembrou sua senha?" footerHref="/login" footerLabel="Voltar ao login">
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      <label style={{ display: "grid", gap: 7 }}>
        <span style={{ color: "var(--text-tertiary)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>E-mail</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="seu@email.com" autoComplete="email" />
      </label>
      {message && <p className="notice" style={{ margin: 0 }}>{message}</p>}
      <button className="btn-primary" type="submit" disabled={loading} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {loading ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}
        {loading ? "Enviando…" : "Enviar link de recuperação"}
      </button>
    </form>
  </AuthFrame>;
}
