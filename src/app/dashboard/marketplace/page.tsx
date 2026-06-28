"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  tipo: string;
  preco_min: number | null;
  preco_max: number | null;
  modalidade: string;
  cidade: string | null;
  tags: string[];
  contato_email: string | null;
  contato_whatsapp: string | null;
  contato_site: string | null;
  ativo: boolean;
  destaque: boolean;
  visualizacoes: number;
  created_at: string;
}

const CATEGORIAS = [
  { value: "todas", label: "Todas" },
  { value: "marketing", label: "Marketing" },
  { value: "design", label: "Design" },
  { value: "dev", label: "Desenvolvimento" },
  { value: "redacao", label: "Redação" },
  { value: "social_media", label: "Social Media" },
  { value: "seo", label: "SEO / Tráfego" },
  { value: "outros", label: "Outros" },
];

const CAT_COLOR: Record<string, string> = {
  marketing: "#0A84FF", design: "#BF5AF2", dev: "#30D158",
  redacao: "#FF9F0A", social_media: "#FF453A", seo: "#00C7BE", outros: "#636366",
};

const CAT_ICON: Record<string, string> = {
  marketing: "📊", design: "🎨", dev: "💻",
  redacao: "✍️", social_media: "📱", seo: "🎯", outros: "⚡",
};

const emptyForm = () => ({
  titulo: "", descricao: "", categoria: "marketing", tipo: "servico",
  preco_min: "", preco_max: "", modalidade: "remoto", cidade: "",
  tags: "", contato_email: "", contato_whatsapp: "", contato_site: "", ativo: true,
});

// ─── Main component ────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [tab, setTab] = useState<"explorar" | "meus">("explorar");
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoria, setCategoria] = useState("todas");
  const [busca, setBusca] = useState("");
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || ""));
    loadMyListings();
  }, []);

  const loadListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoria !== "todas") params.set("categoria", categoria);
    if (busca) params.set("busca", busca);
    const res = await fetch(`/api/marketplace?${params}`);
    if (res.ok) {
      const data = await res.json();
      setListings(data.listings || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [categoria, busca]);

  useEffect(() => { loadListings(); }, [loadListings]);

  const loadMyListings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyListings(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      id: editingId || undefined,
      ...form,
      preco_min: form.preco_min ? Number(form.preco_min) : null,
      preco_max: form.preco_max ? Number(form.preco_max) : null,
      tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean),
    };
    const res = await fetch("/api/marketplace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSavedMsg(editingId ? "Anúncio atualizado!" : "Anúncio publicado!");
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      loadListings();
      loadMyListings();
      setTimeout(() => setSavedMsg(""), 4000);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este anúncio?")) return;
    await fetch(`/api/marketplace?id=${id}`, { method: "DELETE" });
    loadMyListings();
    loadListings();
  };

  const startEdit = (l: Listing) => {
    setForm({
      titulo: l.titulo, descricao: l.descricao, categoria: l.categoria,
      tipo: l.tipo, preco_min: l.preco_min?.toString() || "",
      preco_max: l.preco_max?.toString() || "", modalidade: l.modalidade,
      cidade: l.cidade || "", tags: (l.tags || []).join(", "),
      contato_email: l.contato_email || "", contato_whatsapp: l.contato_whatsapp || "",
      contato_site: l.contato_site || "", ativo: l.ativo,
    });
    setEditingId(l.id);
    setShowForm(true);
    setTab("meus");
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em" }}>Marketplace</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
            Ofereça seus serviços e encontre oportunidades — {total} anúncios ativos
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setForm(emptyForm()); setEditingId(null); setShowForm(true); setTab("meus"); }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", fontWeight: 600 }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Publicar Anúncio
        </button>
      </div>

      {savedMsg && (
        <div className="toast toast-success" style={{ position: "relative", marginBottom: 16, bottom: "auto", right: "auto" }}>
          ✓ {savedMsg}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {(["explorar", "meus"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "10px 20px", background: "transparent", border: "none",
            borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            color: tab === t ? "var(--text)" : "var(--text-secondary)",
            fontWeight: tab === t ? 600 : 400, fontSize: 14, cursor: "pointer",
            marginBottom: -1, transition: "all 0.15s",
          }}>
            {t === "explorar" ? "🛒 Explorar" : `📌 Meus Anúncios (${myListings.length})`}
          </button>
        ))}
      </div>

      {/* ── EXPLORAR TAB ── */}
      {tab === "explorar" && (
        <>
          {/* Categoria pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {CATEGORIAS.map((c) => (
              <button key={c.value} onClick={() => setCategoria(c.value)} style={{
                padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: categoria === c.value ? `${CAT_COLOR[c.value] || "var(--accent)"}25` : "var(--bg-card)",
                border: `1px solid ${categoria === c.value ? (CAT_COLOR[c.value] || "var(--accent)") + "60" : "var(--border)"}`,
                color: categoria === c.value ? (CAT_COLOR[c.value] || "var(--accent)") : "var(--text-secondary)",
                transition: "all 0.15s",
              }}>
                {c.value !== "todas" && CAT_ICON[c.value]} {c.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text" placeholder="Buscar por título, habilidade..."
              value={busca} onChange={e => setBusca(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <div className="animate-spin" style={{ width: 24, height: 24, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%" }} />
            </div>
          ) : listings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Nenhum anúncio encontrado.</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 4 }}>Seja o primeiro a publicar nesta categoria!</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} onSelect={() => setSelected(l)} isOwner={l.user_id === userId} onEdit={() => startEdit(l)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MEUS ANÚNCIOS TAB ── */}
      {tab === "meus" && (
        <>
          {/* Form */}
          {showForm && (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>
                {editingId ? "Editar anúncio" : "Novo anúncio"}
              </h3>
              <form onSubmit={handleSubmit}>
                <FormRow label="Título *">
                  <input value={form.titulo} onChange={e => setForm(p => ({...p, titulo: e.target.value}))} placeholder="Ex: Gestor de Tráfego Pago disponível para projetos" required />
                </FormRow>
                <FormRow label="Descrição *">
                  <textarea value={form.descricao} onChange={e => setForm(p => ({...p, descricao: e.target.value}))} placeholder="Descreva sua experiência, resultados e o que oferece..." required style={{ minHeight: 100, resize: "vertical" }} />
                </FormRow>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <FormRow label="Categoria *">
                    <select value={form.categoria} onChange={e => setForm(p => ({...p, categoria: e.target.value}))}>
                      {CATEGORIAS.filter(c => c.value !== "todas").map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Tipo">
                    <select value={form.tipo} onChange={e => setForm(p => ({...p, tipo: e.target.value}))}>
                      <option value="servico">Serviço freelancer</option>
                      <option value="curriculo">Currículo / CLT</option>
                    </select>
                  </FormRow>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <FormRow label="Preço mínimo (R$)">
                    <input type="number" value={form.preco_min} onChange={e => setForm(p => ({...p, preco_min: e.target.value}))} placeholder="500" />
                  </FormRow>
                  <FormRow label="Preço máximo (R$)">
                    <input type="number" value={form.preco_max} onChange={e => setForm(p => ({...p, preco_max: e.target.value}))} placeholder="2000" />
                  </FormRow>
                  <FormRow label="Modalidade">
                    <select value={form.modalidade} onChange={e => setForm(p => ({...p, modalidade: e.target.value}))}>
                      <option value="remoto">Remoto</option>
                      <option value="presencial">Presencial</option>
                      <option value="hibrido">Híbrido</option>
                    </select>
                  </FormRow>
                </div>
                <FormRow label="Tags (separadas por vírgula)">
                  <input value={form.tags} onChange={e => setForm(p => ({...p, tags: e.target.value}))} placeholder="facebook ads, google ads, tráfego pago" />
                </FormRow>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <FormRow label="Email de contato">
                    <input type="email" value={form.contato_email} onChange={e => setForm(p => ({...p, contato_email: e.target.value}))} placeholder="seu@email.com" />
                  </FormRow>
                  <FormRow label="WhatsApp">
                    <input value={form.contato_whatsapp} onChange={e => setForm(p => ({...p, contato_whatsapp: e.target.value}))} placeholder="(51) 99999-9999" />
                  </FormRow>
                  <FormRow label="Site / Portfolio">
                    <input value={form.contato_site} onChange={e => setForm(p => ({...p, contato_site: e.target.value}))} placeholder="https://..." />
                  </FormRow>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1, padding: "11px 0" }}>
                    {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Publicar anúncio"}
                  </button>
                  <button type="button" className="btn-outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()); }} style={{ padding: "11px 20px" }}>
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {myListings.length === 0 && !showForm ? (
            <div style={{ textAlign: "center", padding: 60, borderRadius: "var(--radius-lg)", border: "1px dashed var(--border)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📌</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 16 }}>Você ainda não tem anúncios.</p>
              <button className="btn-primary" onClick={() => { setForm(emptyForm()); setEditingId(null); setShowForm(true); }}>
                Criar primeiro anúncio
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myListings.map((l) => (
                <div key={l.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${CAT_COLOR[l.categoria] || "var(--accent)"}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {CAT_ICON[l.categoria] || "⚡"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      {l.titulo}
                      {!l.ativo && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(99,99,102,0.2)", color: "var(--text-tertiary)" }}>Pausado</span>}
                      {l.destaque && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(255,159,10,0.15)", color: "var(--orange)" }}>⭐ Destaque</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {CATEGORIAS.find(c => c.value === l.categoria)?.label} · {l.modalidade} · {l.visualizacoes} visualizações
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button className="btn-outline" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => startEdit(l)}>Editar</button>
                    <button className="btn-danger" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => handleDelete(l.id)}>Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <ListingModal listing={selected} onClose={() => setSelected(null)} isOwner={selected.user_id === userId} onEdit={() => { startEdit(selected); setSelected(null); }} />
      )}
    </div>
  );
}

// ─── Sub components ───────────────────────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6, letterSpacing: "0.02em" }}>
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}

function ListingCard({ listing: l, onSelect, isOwner, onEdit }: {
  listing: Listing;
  onSelect: () => void;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const color = CAT_COLOR[l.categoria] || "var(--accent)";
  const preco = l.preco_min && l.preco_max
    ? `R$ ${l.preco_min.toLocaleString("pt-BR")} – ${l.preco_max.toLocaleString("pt-BR")}`
    : l.preco_min ? `A partir de R$ ${l.preco_min.toLocaleString("pt-BR")}`
    : l.preco_max ? `Até R$ ${l.preco_max.toLocaleString("pt-BR")}` : null;

  return (
    <div
      onClick={onSelect}
      style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: 20, cursor: "pointer",
        transition: "all 0.15s", position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3)`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {l.destaque && (
        <div style={{ position: "absolute", top: 0, right: 0, background: "var(--orange)", color: "#000", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderBottomLeftRadius: 8 }}>
          DESTAQUE
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {CAT_ICON[l.categoria] || "⚡"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {CATEGORIAS.find(c => c.value === l.categoria)?.label}
          </span>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>
            {l.tipo === "curriculo" ? "Currículo / CLT" : "Serviço freelancer"} · {l.modalidade}
          </div>
        </div>
        {isOwner && (
          <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>
            Editar
          </button>
        )}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>
        {l.titulo.slice(0, 60)}{l.titulo.length > 60 ? "..." : ""}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
        {l.descricao.slice(0, 110)}{l.descricao.length > 110 ? "..." : ""}
      </p>
      {(l.tags || []).length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {l.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: `${color}15`, color, fontWeight: 500 }}>
              {tag}
            </span>
          ))}
          {l.tags.length > 3 && <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>+{l.tags.length - 3}</span>}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {preco ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{preco}</span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Sob consulta</span>
        )}
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-tertiary)" }}>
          {l.contato_email && <span>✉️</span>}
          {l.contato_whatsapp && <span>💬</span>}
          {l.contato_site && <span>🌐</span>}
        </div>
      </div>
    </div>
  );
}

function ListingModal({ listing: l, onClose, isOwner, onEdit }: {
  listing: Listing;
  onClose: () => void;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const color = CAT_COLOR[l.categoria] || "var(--accent)";
  const preco = l.preco_min && l.preco_max
    ? `R$ ${l.preco_min.toLocaleString("pt-BR")} – ${l.preco_max.toLocaleString("pt-BR")}`
    : l.preco_min ? `A partir de R$ ${l.preco_min.toLocaleString("pt-BR")}`
    : l.preco_max ? `Até R$ ${l.preco_max.toLocaleString("pt-BR")}` : "Sob consulta";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={onClose}>
      <div style={{ maxWidth: 540, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: 28, position: "relative", boxShadow: "var(--shadow-elevated)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
            {CAT_ICON[l.categoria] || "⚡"}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {CATEGORIAS.find(c => c.value === l.categoria)?.label}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {l.tipo === "curriculo" ? "Currículo / CLT" : "Serviço freelancer"} · {l.modalidade}
              {l.cidade ? ` · ${l.cidade}` : ""}
            </div>
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, paddingRight: 32 }}>{l.titulo}</h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 16 }}>{l.descricao}</p>

        {(l.tags || []).length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {l.tags.map((tag: string) => (
              <span key={tag} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: `${color}15`, color, fontWeight: 500 }}>{tag}</span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--bg)", marginBottom: 20 }}>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Investimento</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--green)" }}>{preco}</span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {l.contato_email && (
            <a href={`mailto:${l.contato_email}`} className="btn-primary" style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
              ✉️ Enviar email
            </a>
          )}
          {l.contato_whatsapp && (
            <a href={`https://wa.me/55${l.contato_whatsapp.replace(/\D/g, "")}?text=Olá! Vi seu anúncio no AutoCurriculo AI e gostaria de conversar.`}
              target="_blank" rel="noreferrer" className="btn-outline"
              style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13, background: "rgba(37,211,102,0.08)", borderColor: "#25d36640", color: "#25d366" }}>
              💬 WhatsApp
            </a>
          )}
          {l.contato_site && (
            <a href={l.contato_site} target="_blank" rel="noreferrer" className="btn-outline"
              style={{ textDecoration: "none", flex: 1, textAlign: "center", padding: "10px 0", fontSize: 13 }}>
              🌐 Portfolio
            </a>
          )}
          {isOwner && (
            <button className="btn-ghost" onClick={onEdit} style={{ flex: 1, padding: "10px 0", fontSize: 13 }}>
              ✏️ Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
