export type Project = {
  hero?: boolean;
  setor: string;
  titulo: string;
  engajamento: string;
  categoria: string;
  problema: string;
  solucao: string;
  files: string[];
  stack: string[];
  destaques: string[];
};

export const projects: Project[] = [
  {
    setor: "Personal Training",
    titulo: "Plataforma de Treinos Personalizados",
    engajamento: "Engajamento contínuo",
    categoria: "Saúde · PWA",
    problema: "Personal trainers presos a planilhas, WhatsApp e PDFs para entregar treinos.",
    solucao: "PWA completo onde o profissional monta, executa e acompanha treinos em um só lugar — com vídeos, avaliações físicas e integração com Strava.",
    files: ["workout_builder.tsx", "execution_screen.tsx", "strava_sync.ts", "push_notif.ts", "video_storage_s3.ts", "physical_assessment.tsx"],
    stack: ["Next.js", "TypeScript", "Supabase", "AWS S3", "PWA"],
    destaques: [
      "Editor visual de treinos com drag-and-drop",
      "Tela de execução em tempo real com circuit training",
      "Notificações push sem dependência de Firebase",
      "Vídeos protegidos via signed URLs no S3"
    ],
  },
  {
    setor: "Fitness · Musculação",
    titulo: "Plataforma de Musculação Dedicada",
    engajamento: "Projeto entregue · Suporte ativo",
    categoria: "Saúde · PWA",
    problema: "Profissionais de musculação usando ferramentas genéricas que não falam a linguagem da sala de pesos.",
    solucao: "Variante adaptada da plataforma de treinos, focada exclusivamente em musculação — sem ruído de outras modalidades, com fluxo desenhado para o ciclo treino → progressão → avaliação.",
    files: ["workout_builder.tsx", "strength_progression.ts", "execution_screen.tsx", "physical_assessment.tsx", "push_notif.ts", "video_storage_s3.ts"],
    stack: ["Next.js", "TypeScript", "Supabase", "AWS S3", "PWA"],
    destaques: [
      "Editor focado em séries, repetições e cargas",
      "Acompanhamento de progressão por exercício",
      "Avaliações físicas integradas ao histórico",
      "Interface dedicada — sem distrações de outras modalidades"
    ],
  },
  {
    hero: true,
    setor: "Varejo · E-commerce",
    titulo: "E-commerce com Inteligência Financeira",
    engajamento: "Engajamento de longo prazo · Em produção",
    categoria: "E-commerce · Operação",
    problema: "Lojistas sem visibilidade do que realmente acontece com o dinheiro do negócio.",
    solucao: "E-commerce completo com painel administrativo proprietário, módulo DRE e assistente financeiro com IA que responde perguntas sobre as finanças em linguagem natural.",
    files: ["dashboard_admin.tsx", "dre_module.tsx", "ai_finance_assistant.ts", "mercado_livre_sync.ts", "mercado_pago_webhook.ts", "stock_control.tsx", "open_banking.ts"],
    stack: ["Next.js", "TypeScript", "tRPC", "Supabase", "Drizzle ORM", "AWS S3"],
    destaques: [
      "Integração nativa com Mercado Livre e Mercado Pago",
      "Módulo DRE com agentes financeiros baseados em LLM",
      "Open Banking para conciliação automática",
      "Painel administrativo proprietário, sem dependência de Shopify"
    ],
  },
  {
    setor: "Logística · E-commerce",
    titulo: "Setup Logístico para E-commerce",
    engajamento: "Implantação completa · 8 semanas",
    categoria: "Logística · E-commerce",
    problema: "Pequenos lojistas sem estrutura para escalar envios e gerenciar fretes regionais.",
    solucao: "Implementação completa de setup logístico — integração com transportadoras, cálculo dinâmico de frete, painel de pedidos e automação de etiquetas.",
    files: ["frete_calc.ts", "label_generator.ts", "orders_panel.tsx", "tracking_sync.ts"],
    stack: ["Next.js", "TypeScript", "Supabase", "Melhor Envio API"],
    destaques: [
      "Cálculo de frete em tempo real para múltiplas transportadoras",
      "Geração automática de etiquetas e códigos de rastreio",
      "Painel unificado de pedidos com status integrado",
      "Setup completo entregue em 8 semanas"
    ],
  },
  {
    setor: "Atendimento · Vendas",
    titulo: "Agente de Atendimento Comercial",
    engajamento: "Implantação · Em operação 24/7",
    categoria: "IA Agêntica · WhatsApp",
    problema: "Primeiro contato comercial perdendo tempo com perguntas básicas e leads sem qualificação adequada.",
    solucao: "Agente conversacional via WhatsApp que faz a triagem inicial, registra o contexto do projeto e entrega o lead qualificado pronto para a primeira reunião.",
    files: ["agent_orchestrator.ts", "whatsapp_webhook.ts", "lead_qualification.ts", "context_summarizer.ts", "claude_integration.ts"],
    stack: ["Node.js", "Claude API", "WhatsApp Cloud API", "Supabase"],
    destaques: [
      "Conversação natural — não parece bot mecânico",
      "Triagem com perguntas dinâmicas baseadas no contexto",
      "Resumo automático do lead para o time comercial",
      "Roda 24/7, escala sem custo adicional por atendimento"
    ],
  },
  {
    setor: "B2B · Comercial",
    titulo: "Agente de Geração de Propostas",
    engajamento: "Projeto sob demanda",
    categoria: "IA Agêntica · Documentos",
    problema: "Geração manual de propostas comerciais consumindo horas de trabalho qualificado em copy/paste de templates.",
    solucao: "Agente que analisa o briefing do cliente, monta a proposta personalizada (escopo, cronograma, investimento) e entrega em formato profissional pronto para envio.",
    files: ["proposal_agent.ts", "briefing_parser.ts", "pricing_calculator.ts", "pdf_generator.ts", "claude_orchestrator.ts"],
    stack: ["Node.js", "Claude API", "PDF generation", "Supabase"],
    destaques: [
      "Lê briefings em linguagem natural e extrai requisitos",
      "Calcula escopo, cronograma e investimento automaticamente",
      "Gera PDF profissional pronto para envio",
      "Reduz tempo de produção de propostas de horas para minutos"
    ],
  },
  {
    setor: "Financeiro · Fintech",
    titulo: "Simulador de Antecipação",
    engajamento: "Projeto entregue",
    categoria: "Financeiro · Cálculo",
    problema: "Empresários sem ferramenta para simular cenários de antecipação de recebíveis com tributação correta.",
    solucao: "Simulador completo com regras de IR brasileiras, taxas variáveis por banco e projeção de fluxo de caixa pós-antecipação.",
    files: ["simulator_engine.ts", "tax_rules_br.ts", "bank_rates_table.ts", "cash_flow_projection.ts", "report_export.tsx"],
    stack: ["Next.js", "TypeScript", "Supabase"],
    destaques: [
      "Regras de IR brasileiras aplicadas automaticamente",
      "Comparação entre múltiplas instituições financeiras",
      "Projeção de fluxo de caixa pós-antecipação",
      "Export de relatório para tomada de decisão"
    ],
  },
];
