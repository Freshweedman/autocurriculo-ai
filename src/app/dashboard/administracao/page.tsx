import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, ShieldCheck } from "lucide-react";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { AdminIngestionPanel } from "@/components/AdminIngestionPanel";

const integrations = [
  ["OLX", "Preenchimento assistido", "O runner pode preencher campos visíveis; a publicação final é manual."],
  ["Mercado Livre", "Preenchimento assistido", "O runner abre o fluxo e preenche campos disponíveis; não confirma anúncio."],
  ["GGMAX", "Preenchimento assistido", "Fluxo assistido sujeito às mudanças da plataforma."],
  ["Facebook Marketplace", "Manual", "Exige sessão e confirmação diretamente no Facebook."],
  ["Workana · 99Freelas · GetNinjas", "Manual", "Sem API de publicação integrada neste projeto."],
  ["Facebook Pages · Google Business · Pinterest", "Pendente", "Requer OAuth e escopos oficiais antes de qualquer publicação."],
] as const;

export default async function AdministracaoPage() {
  const supabase = await createClient();
  const { user } = await getAuthenticatedAdmin(supabase);
  if (!user) redirect("/dashboard");
  return <div className="resource-page"><header className="page-heading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Operação e integrações.</h1><p>Esta área é protegida por papel administrativo persistente.</p></div><ShieldCheck color="var(--accent)" size={30} /></header><section className="admin-grid"><article className="admin-card"><BarChart3 size={19} /><h2>Publicações</h2><p>As filas e tarefas existentes permanecem administrativas. Não há publicação automática confirmada nesta versão.</p></article><article className="admin-card"><ClipboardList size={19} /><h2>Integrações</h2><p>Veja o método efetivamente implementado em cada canal antes de usá-lo.</p></article></section><AdminIngestionPanel /><section className="integration-table"><div className="integration-head"><span>Canal</span><span>Método</span><span>Estado real</span></div>{integrations.map(([name, method, detail]) => <div className="integration-row" key={name}><strong>{name}</strong><span className="badge badge-blue">{method}</span><p>{detail}</p></div>)}</section></div>;
}
