type ServiceCopy = Record<string, unknown>;

function textValue(service: ServiceCopy, key: string, fallback = "") {
  const value = service[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function priceText(service: ServiceCopy) {
  const value = service.price_min;
  return value ? `a partir de R$ ${value}` : "orçamento sob consulta";
}

function includeText(service: ServiceCopy) {
  const includes = service.includes;
  return Array.isArray(includes) && includes.length ? includes.join(", ") : "escopo combinado, revisão e suporte inicial";
}

export function buildMarketplaceCopy(platform: string, service: ServiceCopy, tone = "profissional") {
  const name = textValue(service, "name", "serviço profissional");
  const description = textValue(service, "base_description", `${name} sob medida para o seu negócio.`);
  const audience = textValue(service, "target_audience", "negócios que querem vender mais");
  const delivery = textValue(service, "delivery_time", "prazo combinado");
  const price = priceText(service);
  const includes = includeText(service);
  const portfolio = textValue(service, "portfolio_url");
  const whatsapp = textValue(service, "whatsapp_url");
  const toneLine = tone === "urgente"
    ? "Tenho agenda para começar rápido."
    : tone === "premium"
      ? "Entrega cuidada, com acabamento profissional e foco em conversão."
      : "Atendimento claro, prazo combinado e revisão antes da entrega.";

  const common = [
    description,
    "",
    `Ideal para: ${audience}.`,
    `Inclui: ${includes}.`,
    `Prazo: ${delivery}.`,
    `Valor: ${price}.`,
    toneLine,
    portfolio ? `Portfolio: ${portfolio}` : "",
    whatsapp ? `WhatsApp: ${whatsapp}` : "",
    "Chame para alinhar o projeto e receber um orçamento.",
  ].filter(Boolean).join("\n");

  const byPlatform: Record<string, { title: string; long_description: string; tags: string[] }> = {
    mercado_livre: {
      title: `${name} profissional para empresas`,
      long_description: [
        `${name} sob medida`,
        "",
        common,
        "",
        "Antes de comprar/contratar, envie uma mensagem com o que você precisa para eu confirmar escopo, prazo e disponibilidade.",
      ].join("\n"),
      tags: ["servico", "profissional", "mercado livre", name],
    },
    ggmax: {
      title: `${name} com entrega segura`,
      long_description: [
        `${name} para quem precisa de uma entrega confiável.`,
        "",
        common,
        "",
        "A entrega é feita depois do alinhamento do pedido. Se tiver dúvidas, mande mensagem antes de fechar.",
      ].join("\n"),
      tags: ["ggmax", "servico digital", "entrega segura", name],
    },
    olx: {
      title: `${name} profissional - ${price}`,
      long_description: common,
      tags: ["olx", "servicos", name],
    },
    facebook_marketplace: {
      title: `${name} para seu negócio`,
      long_description: `${common}\n\nMe mande uma mensagem e eu respondo com próximos passos.`,
      tags: ["facebook", "marketplace", name],
    },
    facebook_page: {
      title: `${name}: agenda aberta`,
      long_description: `${description}\n\n${toneLine}\n\n${price}. Me chame para alinhar escopo, prazo e próximos passos.`,
      tags: ["facebook", "pagina", "servicos", name],
    },
    facebook_group: {
      title: `${name} profissional`,
      long_description: `Pessoal, estou com agenda para ${name.toLowerCase()}.\n\n${common}\n\nSe o grupo permitir indicação/divulgação, posso mandar exemplos por mensagem.`,
      tags: ["facebook", "grupo", "organico", name],
    },
    workana: {
      title: `Proposta: ${name}`,
      long_description: `Olá! Posso ajudar com ${name.toLowerCase()}.\n\n${common}\n\nPosso começar assim que alinharmos escopo e prioridade.`,
      tags: ["freelancer", "workana", name],
    },
    "99freelas": {
      title: `Proposta profissional para ${name}`,
      long_description: `Tenho experiência com ${name.toLowerCase()} e posso entregar com processo claro.\n\n${common}\n\nFico à disposição para conversar sobre o projeto.`,
      tags: ["freelancer", "99freelas", name],
    },
    getninjas: {
      title: `${name} com atendimento profissional`,
      long_description: `${common}\n\nRespondo rápido e alinho o serviço antes de começar para evitar retrabalho.`,
      tags: ["getninjas", "servicos", name],
    },
    fiverr: {
      title: `I will create a professional ${name} for your business`,
      long_description: `I will deliver a professional ${name} tailored to your business.\n\nBest for: ${audience}.\nIncludes: ${includes}.\nDelivery: ${delivery}.\nPrice: ${price}.\n\nMessage me before ordering so we can confirm scope and availability.`,
      tags: ["fiverr", "service", "business", name],
    },
    upwork: {
      title: `Proposal for ${name}`,
      long_description: `Hi! I can help with ${name}.\n\nI deliver a clear process, aligned scope, and professional execution. The service includes ${includes}. Delivery: ${delivery}. Budget: ${price}.\n\nI can share examples and start after we confirm the scope.`,
      tags: ["upwork", "proposal", "service", name],
    },
    freelancer: {
      title: `Professional ${name} proposal`,
      long_description: `I can help you with ${name} using a clear delivery process.\n\n${description}\n\nIncludes: ${includes}.\nDelivery: ${delivery}.\nBudget: ${price}.\n\nMessage me so we can define the scope and timeline.`,
      tags: ["freelancer", "proposal", name],
    },
    behance: {
      title: `${name} - projeto profissional`,
      long_description: `${description}\n\nProcesso: alinhamento, produção, revisão e entrega final. ${portfolio ? `Portfolio: ${portfolio}` : "Portfolio disponível por mensagem."}`,
      tags: ["behance", "portfolio", "criativo", name],
    },
    google_business: {
      title: `${name} profissional`,
      long_description: `${name} para empresas que querem uma presença mais forte.\n\n${description}\n\nAtendimento por orçamento. ${whatsapp ? `Contato: ${whatsapp}` : "Chame para consultar disponibilidade."}`,
      tags: ["google business", "post", name],
    },
    pinterest: {
      title: `${name} para vender melhor`,
      long_description: `${description}\n\nSalve esta ideia e fale comigo para transformar em um projeto profissional. ${portfolio ? `Veja exemplos: ${portfolio}` : ""}`,
      tags: ["pinterest", "ideia", "servico", name],
    },
    instagram: {
      title: `${name} profissional`,
      long_description: `${name} profissional para quem quer vender com mais confiança.\n\n${description}\n\nPortfolio e orçamento por mensagem.`,
      tags: ["instagram", "post", name],
    },
    tiktok: {
      title: `${name} em poucos dias`,
      long_description: `Roteiro curto: Você precisa de ${name.toLowerCase()} com aparência profissional? Eu faço o processo do alinhamento até a entrega, com revisão e prazo combinado. Chame para ver exemplos.`,
      tags: ["tiktok", "roteiro", "video curto", name],
    },
    youtube_shorts: {
      title: `${name}: como vender com mais confiança`,
      long_description: `Descrição para Shorts:\n${description}\n\nQuer algo assim para seu negócio? Chame para orçamento e exemplos.`,
      tags: ["youtube shorts", "video", name],
    },
    whatsapp: {
      title: `${name} - mensagem direta`,
      long_description: `Oi! Trabalho com ${name.toLowerCase()} profissional. ${description} Atendo com ${price} e prazo ${delivery}. Posso te mandar alguns exemplos?`,
      tags: ["whatsapp", "mensagem", name],
    },
    telegram: {
      title: `${name} profissional`,
      long_description: `${name} para negócios que precisam vender melhor.\n\n${common}\n\nMe chame para orçamento.`,
      tags: ["telegram", "canal", name],
    },
    reddit: {
      title: `Serviço: ${name}`,
      long_description: `Estou oferecendo ${name.toLowerCase()} para ${audience.toLowerCase()}.\n\n${description}\n\nInclui ${includes}. Prazo: ${delivery}. Valor: ${price}.\n\nAberto a dúvidas e feedback da comunidade, seguindo as regras do subreddit.`,
      tags: ["reddit", "community", name],
    },
    classificados_locais: {
      title: `${name} profissional - atendimento online`,
      long_description: `${common}\n\nAtendo online e posso adaptar para sua cidade/região.`,
      tags: ["classificados", "local", "servicos", name],
    },
  };

  const selected = byPlatform[platform] || {
    title: `${name} profissional`,
    long_description: common,
    tags: ["servico", name],
  };

  return {
    ...selected,
    price_text: price,
  };
}
