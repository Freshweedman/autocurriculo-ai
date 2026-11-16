"use client";

import { Download, FileText, Loader2, Star, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Resume = { id: string; name: string; storage_path: string; size_bytes: number | null; is_default: boolean; created_at: string };

export default function CurriculosPage() {
  const [items, setItems] = useState<Resume[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("resumes").select("id,name,storage_path,size_bytes,is_default,created_at").order("created_at", { ascending: false });
    setItems(data || []);
    setMessage(error ? "Os currículos estarão disponíveis após a migration 007 ser aplicada." : "");
    setLoading(false);
  }

  useEffect(() => { const task = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(task); }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setMessage("Escolha um arquivo PDF."); return; }
    setUploading(true); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Sua sessão expirou."); setUploading(false); return; }
    const id = crypto.randomUUID();
    const path = `${user.id}/${id}.pdf`;
    const { error: storageError } = await supabase.storage.from("curriculos").upload(path, file, { upsert: false, contentType: file.type });
    if (storageError) { setMessage(storageError.message); setUploading(false); return; }
    const { error } = await supabase.from("resumes").insert({ id, user_id: user.id, name: file.name.replace(/\.pdf$/i, ""), storage_path: path, mime_type: file.type, size_bytes: file.size, is_default: items.length === 0 });
    if (error) { await supabase.storage.from("curriculos").remove([path]); setMessage("Arquivo enviado, mas não foi possível registrar sua versão. A migration 007 pode estar pendente."); }
    else await load();
    setUploading(false); event.target.value = "";
  }

  async function setDefault(item: Resume) {
    const { error } = await supabase.from("resumes").update({ is_default: true, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) setMessage(error.message); else await load();
  }

  async function download(item: Resume) {
    const { data, error } = await supabase.storage.from("curriculos").createSignedUrl(item.storage_path, 60);
    if (error || !data?.signedUrl) { setMessage(error?.message || "Não foi possível criar o link seguro."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function remove(item: Resume) {
    if (!window.confirm(`Excluir “${item.name}”? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("resumes").delete().eq("id", item.id);
    if (error) { setMessage(error.message); return; }
    await supabase.storage.from("curriculos").remove([item.storage_path]);
    await load();
  }

  return <div className="resource-page"><header className="page-heading"><div><p className="eyebrow">CURRÍCULOS</p><h1>Versões para cada oportunidade.</h1><p>Escolha qual currículo usar antes de iniciar uma candidatura.</p></div><label className="btn-primary upload-action"><Upload size={16} />{uploading ? "Enviando…" : "Adicionar PDF"}<input type="file" accept="application/pdf" onChange={upload} disabled={uploading} /></label></header>
    {message && <div className="notice" role="status">{message}</div>}
    {loading ? <div className="empty-panel"><Loader2 className="animate-spin" /> Carregando versões…</div> : items.length === 0 ? <div className="empty-panel"><FileText size={28} /><h2>Nenhum currículo enviado</h2><p>Adicione um PDF para usar nas candidaturas que exigirem arquivo.</p></div> : <div className="resume-list">{items.map((item) => <article className="resume-row" key={item.id}><span className="resource-icon"><FileText size={19} /></span><div><strong>{item.name}</strong><small>{item.size_bytes ? `${Math.ceil(item.size_bytes / 1024)} KB · ` : ""}{new Date(item.created_at).toLocaleDateString("pt-BR")}</small></div>{item.is_default && <span className="badge badge-green">Padrão</span>}<div className="row-actions"><button className="btn-ghost" onClick={() => setDefault(item)} disabled={item.is_default} title="Definir como padrão"><Star size={16} /></button><button className="btn-ghost" onClick={() => download(item)} title="Abrir currículo"><Download size={16} /></button><button className="btn-danger" onClick={() => remove(item)} title="Excluir currículo"><Trash2 size={16} /></button></div></article>)}</div>}
  </div>;
}
