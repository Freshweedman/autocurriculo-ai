import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Gerador de panfletos digitais com IA (sem dependência de OpenAI — usa template engine inteligente)
// Para integrar OpenAI/Groq no futuro, substituir as funções generate* abaixo

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function generateTitles(service: Record<string, string>): string[] {
  const name = service.name || "serviço";
  const audience = service.target_audience || "negócios";
  const price = service.price_min ? `a partir de R$ ${service.price_min}` : "";
  return shuffle([
    `${name} profissional para ${audience}`,
    `Precisa de ${name.toLowerCase()}? Eu faço ${price}`,
    `${name} — entrega rápida e resultado garantido`,
    `Transforme seu negócio com ${name.toLowerCase()} de qualidade`,
    `${name} completo para ${audience} — sem complicação`,
    `Eu crio ${name.toLowerCase()} para ${audience} que vendem`,
    `${name} com resultado: conheça meu trabalho`,
    `Quer ${name.toLowerCase()}? Orçamento grátis agora`,
    `${name} moderno e profissional ${price ? "— " + price : ""}`,
    `${name} para ${audience} — peça seu orçamento`,
  ]);
}

function generateShortDescs(service: Record<string, string>): string[] {
  const name = service.name || "serviço";
  const desc = service.base_description || "";
  const delivery = service.delivery_time || "prazo combinado";
  return shuffle([
    `${desc.slice(0, 100) || name} — entrega em ${delivery}.`,
    `Qualidade, prazo e resultado. Solicite orçamento agora.`,
    `${name} feito para o seu negócio crescer. Fale comigo.`,
    `Experiência comprovada. Portfolio disponível. Orçamento grátis.`,
    `Solução completa de ${name.toLowerCase()}. Resultado garantido.`,
    `Profissional disponível. Entrego em ${delivery}.`,
    `Deixe de perder clientes. Tenha um ${name.toLowerCase()} profissional.`,
    `${name} sob medida para o seu negócio. Atendo agora.`,
    `Preço justo, qualidade real. Me chama para conversar.`,
    `Seu negócio merece ${name.toLowerCase()} de qualidade.`,
  ]);
}

function generateCTAs(): string[] {
  return shuffle([
    "Me chama no WhatsApp e te mostro modelos prontos.",
    "Clica aqui para ver meu portfolio completo.",
    "Fale comigo agora e receba um orçamento em minutos.",
    "Envie mensagem e te respondo hoje mesmo.",
    "Acesse o link e veja exemplos de trabalhos entregues.",
    "Solicite seu orçamento grátis — sem compromisso.",
    "Manda um oi e a gente conversa sobre seu projeto.",
    "Clique no perfil e veja o que já entregamos.",
    "Orçamento grátis em menos de 1 hora. Me chama!",
    "Tô disponível agora. Bora conversar sobre seu projeto?",
  ]);
}

function generateOLX(service: Record<string, string>): string[] {
  const name = service.name || "serviço";
  const price = service.price_min ? `R$ ${service.price_min}` : "a combinar";
  const delivery = service.delivery_time || "prazo combinado";
  const includes = (service.includes as unknown as string[])?.join(", ") || "";
  return [
    `Título: ${name} profissional — entrega rápida\nPreço: ${price}\n${includes ? "Inclui: " + includes + "\n" : ""}Prazo: ${delivery}\nEntre em contato para ver portfolio e solicitar orçamento.`,
    `Título: ${name} para sua empresa — qualidade garantida\nPreço: ${price}\nAtendo pequenos e médios negócios. Portfolio disponível. Respondo rápido.`,
    `Título: Criação de ${name.toLowerCase()} — profissional\nDescrição: Você precisa de ${name.toLowerCase()} e eu faço do jeito certo. Preço: ${price}. Me chama no WhatsApp.`,
    `Título: ${name} — resultados reais, preço justo\nDescrição: Entrego ${name.toLowerCase()} com qualidade e no prazo. Orçamento grátis. Fale comigo agora.`,
    `Título: ${name} completo por ${price}\nDescrição: Inclui ${includes || "tudo necessário para seu negócio"}. Prazo: ${delivery}. Portfolio no perfil.`,
  ];
}

function generateFacebook(service: Record<string, string>): string[] {
  const name = service.name || "serviço";
  const audience = service.target_audience || "negócios locais";
  return shuffle([
    `Você tem um negócio em ${audience} e ainda não tem ${name.toLowerCase()}?\n\nEu crio ${name.toLowerCase()} profissional com resultado de verdade.\n\nMe manda mensagem e te mostro modelos prontos! 👇`,
    `${name} profissional para ${audience}.\n\nSe você quer mais clientes, mais credibilidade e mais vendas — isso começa com um ${name.toLowerCase()} de qualidade.\n\nOrçamento grátis no direct ou WhatsApp! 🚀`,
    `Conheço muitas empresas que investem em tráfego mas não têm ${name.toLowerCase()} profissional.\n\nIsso mata a conversão.\n\nEu resolvo isso. Me chama. ✅`,
    `Lançamento: ${name} completo com preço especial este mês.\n\nPortfolio disponível. Prazo garantido. Fale comigo agora!`,
    `Se você ainda depende só do Instagram e WhatsApp para vender, tá na hora de dar o próximo passo.\n\n${name} profissional muda tudo. Me conta sobre seu negócio! 💬`,
  ]);
}

function generateWorkana(service: Record<string, string>): string[] {
  const name = service.name || "serviço";
  const desc = service.base_description || `Desenvolvimento de ${name} com qualidade`;
  const delivery = service.delivery_time || "prazo a combinar";
  return [
    `Olá! Sou especialista em ${name.toLowerCase()} com portfólio comprovado. Entrego ${desc.slice(0, 80)}. Prazo: ${delivery}. Posso começar imediatamente. Vamos conversar?`,
    `Tenho experiência em ${name.toLowerCase()} para pequenos e médios negócios. Trabalho com metodologia clara, entregas no prazo e revisões incluídas. Qual é o seu projeto?`,
    `Proposta: ${desc.slice(0, 100)}. Minha abordagem garante resultado dentro do prazo e orçamento. Portfolio disponível para análise. Aguardo contato!`,
    `Especialista em ${name.toLowerCase()}. Já entregamos projetos similares com sucesso comprovado. Prazo de entrega: ${delivery}. Solicite nossa proposta detalhada.`,
    `${name} profissional com foco em resultado. ${desc.slice(0, 100)}. Disponível para iniciar imediatamente. Veja nosso portfolio antes de decidir.`,
  ];
}

function generateWhatsApp(service: Record<string, string>): string[] {
  const name = service.name || "serviço";
  const price = service.price_min ? `a partir de R$ ${service.price_min}` : "orçamento grátis";
  return shuffle([
    `Oi! Sou profissional em ${name.toLowerCase()}. ${price}. Posso te mandar exemplos? 😊`,
    `Olá! Vi que você pode precisar de ${name.toLowerCase()}. Tenho portfolio pra mostrar — posso enviar?`,
    `Ei! Trabalho com ${name.toLowerCase()} profissional. ${price}. Me conta mais sobre o seu negócio?`,
    `Oi! Tenho ${name.toLowerCase()} com resultado garantido. ${price}. Bora conversar?`,
    `Olá! Especialista em ${name.toLowerCase()}. Posso te mostrar modelos prontos? Orçamento grátis!`,
  ]);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { service_id, campaign_id, tone: _tone = "profissional" } = await req.json();
  const tone = _tone as string;

  // Load service
  const { data: service } = await supabase.from("services").select("*").eq("id", service_id).eq("user_id", user.id).single();
  if (!service) return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });

  const svc = service as Record<string, string>;

  const pamphlets = {
    titulos: generateTitles(svc),
    descricoes_curtas: generateShortDescs(svc),
    ctas: generateCTAs(),
    olx: generateOLX(svc),
    facebook: generateFacebook(svc),
    workana: generateWorkana(svc),
    whatsapp: generateWhatsApp(svc),
    fiverr: [
      `I will create a professional ${svc.name} for your business`,
      `Professional ${svc.name} for small businesses — fast delivery`,
      `I will design and develop a complete ${svc.name} with guaranteed results`,
      `Custom ${svc.name} — high quality, fast turnaround`,
      `${svc.name} specialist — portfolio available, start today`,
    ],
    instagram: [
      `✨ ${svc.name} profissional\n\nAjudo negócios a crescerem com ${(svc.name || "").toLowerCase()} de qualidade.\n\nLink na bio para ver portfolio! 🔗`,
      `🚀 Você sabia que seu negócio pode vender muito mais com ${(svc.name || "").toLowerCase()} profissional?\n\nMe manda DM e a gente conversa! 📩`,
      `💼 ${svc.name} feito para converter.\n\n📌 Portfolio: link na bio\n📲 Orçamento: manda DM`,
      `Cada cliente merece um ${(svc.name || "").toLowerCase()} que representa bem o seu negócio.\n\nEu faço isso acontecer. Me chama! 👋`,
      `Novo projeto entregue! 🎉\nSe você quer resultado igual, fala comigo.\n💬 DM aberto`,
    ],
    follow_up: [
      `Oi! Vi que você se interessou em ${(svc.name || "").toLowerCase()}. Ainda posso te ajudar com isso?`,
      `Olá! Só passando para saber se ficou alguma dúvida sobre o projeto. Estou à disposição!`,
      `Ei! Fiz um orçamento especial para você essa semana. Posso te enviar?`,
      `Oi! Acabei de terminar um projeto parecido com o que você precisa. Quer ver?`,
      `Olá! Minha agenda está com horário disponível esta semana. Podemos dar início ao seu projeto?`,
    ],
    objecao_preco: [
      `Entendo sua preocupação com o valor. Mas considere: um ${(svc.name || "").toLowerCase()} ruim custa mais caro no longo prazo. O meu trabalho se paga.`,
      `Posso te mostrar o que está incluso no valor. Quando você vê a entrega completa, o preço faz sentido.`,
      `Consigo dividir o pagamento ou ajustar o escopo para caber no seu orçamento. Me conta o que você precisa.`,
      `Meu preço reflete qualidade e prazo garantido. Me diz quanto você tem disponível e vejo o que posso fazer.`,
      `Tenho clientes que tentaram mais barato e vieram me contratar depois. Posso mostrar os casos se quiser.`,
    ],
  };

  // Save to DB
  const inserts = [];
  for (const [platform, items] of Object.entries(pamphlets)) {
    for (const text of items as string[]) {
      inserts.push({
        user_id: user.id,
        service_id,
        campaign_id: campaign_id || null,
        platform,
        title: text.split("\n")[0].replace("Título: ", "").slice(0, 120),
        long_description: text,
        tone,
        status: "gerado",
      });
    }
  }

  await supabase.from("generated_pamphlets").insert(inserts);

  return NextResponse.json({ ok: true, pamphlets, total: inserts.length });
}
