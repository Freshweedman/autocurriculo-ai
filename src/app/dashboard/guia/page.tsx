import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Search, Send, ShieldCheck } from "lucide-react";

const steps = [
  { icon: FileText, title: "Escolha seu currículo", text: "Envie versões em PDF e marque uma como padrão. Você pode trocar a versão antes de cada candidatura.", href: "/dashboard/curriculos", action: "Gerenciar currículos" },
  { icon: Search, title: "Defina o que procura", text: "Adicione cargos, localidade e preferências. A busca assistida usa esses dados para pesquisar oportunidades.", href: "/dashboard/configuracoes", action: "Configurar busca" },
  { icon: ShieldCheck, title: "Revise oportunidades", text: "A descoberta registra vagas encontradas. Abra a página original e confirme os requisitos antes de se candidatar.", href: "/dashboard/oportunidades", action: "Ver oportunidades" },
  { icon: Send, title: "Registre o próximo passo", text: "Depois de enviar no site de origem, marque a candidatura como enviada e acompanhe entrevista, notas e contatos.", href: "/dashboard/candidaturas", action: "Abrir candidaturas" },
];

export default function GuiaPage() {
  return <div className="guide-page"><header className="guide-hero"><p className="eyebrow">GUIA RÁPIDO</p><h1>Você decide cada envio.</h1><p>O AutoCurrículo organiza a pesquisa e o acompanhamento. A candidatura só é considerada enviada depois da confirmação no site da empresa ou plataforma.</p></header><section className="guide-steps">{steps.map((step, index) => { const Icon = step.icon; return <article key={step.title}><span className="guide-index">0{index + 1}</span><span className="guide-icon"><Icon size={19} /></span><div><h2>{step.title}</h2><p>{step.text}</p><Link href={step.href}>{step.action}<ArrowRight size={14} /></Link></div></article>; })}</section><aside className="guide-note"><CheckCircle2 size={18} /><p><strong>Como saber se foi enviado?</strong> Só use o status “Candidatado” quando o site de origem exibir confirmação, e-mail de recebimento ou protocolo. Vagas encontradas não são candidaturas enviadas.</p></aside></div>;
}
