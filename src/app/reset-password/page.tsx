"use client";

import AuthFrame from "@/components/AuthFrame";
import { supabase } from "@/lib/supabase/client";
import { KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPage() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); if (password.length < 8) { setMessage("Use pelo menos 8 caracteres."); return; } if (password !== confirm) { setMessage("As senhas não coincidem."); return; } setLoading(true); const { error } = await supabase.auth.updateUser({ password }); if (error) { setMessage(error.message); setLoading(false); return; } router.push("/dashboard"); }
  return <AuthFrame title="Defina uma nova senha." subtitle="Escolha uma senha exclusiva para sua conta." footerText="Não recebeu o link?" footerHref="/recover" footerLabel="Solicitar novamente"><form onSubmit={submit} style={{ display: "grid", gap: 16 }}><label style={{ display: "grid", gap: 7 }}><span>Nova senha</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" /></label><label style={{ display: "grid", gap: 7 }}><span>Confirme a senha</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required autoComplete="new-password" /></label>{message && <p className="notice" style={{ margin: 0 }}>{message}</p>}<button className="btn-primary" type="submit" disabled={loading} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{loading ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}{loading ? "Atualizando…" : "Salvar nova senha"}</button></form></AuthFrame>;
}
