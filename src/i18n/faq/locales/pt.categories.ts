import type { FaqCategory } from '../types'

/** FAQ em português brasileiro */
export const ptCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Primeiros passos e navegação',
    items: [
      {
        q: 'O que é o Peptid Tracker?',
        a: 'O Peptid Tracker é um aplicativo pessoal para uso em pesquisa. Você pode gerenciar seus peptídeos, planejar ciclos de ingestão, registrar doses, calcular dosagem, anotar efeitos no diário e escrever avaliações — tudo em um só lugar.',
      },
      {
        q: 'Como navego entre as seções?',
        a: 'Na parte inferior da tela há uma navegação com 5 ícones: Estoque, Peptídeos, Início (centro), Calendário e Perfil. Todas as outras áreas são acessadas pela tela Início no meio.',
      },
      {
        q: 'O que é a tela Início?',
        a: [
          'A tela Início (botão central na navegação) é o seu hub:',
          '• No topo você vê 3 estatísticas rápidas: Ciclos ativos, Frascos em estoque, Meus peptídeos',
          '• Abaixo há blocos para as 8 áreas do aplicativo',
          '• Toque em um bloco para ir direto até lá',
        ],
      },
      {
        q: 'Quais são todas as áreas do aplicativo?',
        a: [
          '📅 Calendário – registro diário, confirmar doses e visão geral dos ciclos',
          '📦 Estoque – inventário de matéria-prima, armazenar e gerenciar frascos',
          '🧪 Peptídeos – peptídeos reconstituídos e criar ciclos',
          '🧮 Calculadora – calculadora de dose com escala da seringa',
          '📓 Diário – registrar efeitos e efeitos colaterais',
          '⭐ Avaliações – relatos de experiência com peptídeos individuais',
          '👤 Perfil – dados da conta, perfil público e link para compartilhar',
          '❓ FAQ – esta página de ajuda',
        ],
      },
      {
        q: 'Como faço logout?',
        a: 'Vá em “Perfil” e toque no botão vermelho “Sair” no canto superior direito.',
      },
      {
        q: 'Meus dados ficam armazenados com segurança?',
        a: 'Sim. Todos os dados ficam em um banco Supabase. Cada usuário vê apenas os próprios dados — isso é garantido com Row Level Security (RLS). Arquivos de lote (PDFs/imagens) ficam em um bucket de armazenamento separado e só você tem acesso.',
      },
      {
        q: 'Posso instalar o app no celular?',
        a: [
          'Sim! O Peptid Tracker é um PWA (Progressive Web App):',
          'iPhone/Safari: ícone Compartilhar → “Adicionar à Tela de Início” → “Adicionar”',
          'Android/Chrome: três pontos → “Instalar app” ou “Adicionar à tela inicial”',
          'O app passa a rodar sem a barra do navegador e parece um app nativo.',
        ],
      },
      {
        q: 'Por onde devo começar?',
        a: [
          'Ordem sugerida:',
          '1. “Peptídeos” → “+ Novo” → criar um peptídeo (nome, princípio ativo, reconstituição, estoque)',
          '2. “Adicionar ciclo” direto no card do peptídeo',
          '3. Use a “Calculadora” para calcular unidades e concentração',
          '4. Abra o “Calendário” – o ciclo aparece com fundo roxo',
          '5. Toque em um dia do ciclo → registrar dose e confirmar',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Calendário e registro',
    items: [
      {
        q: 'O que o calendário mostra?',
        a: [
          'O calendário dá uma visão geral rápida:',
          '🟣 Fundo roxo = ciclo ativo planejado para aquele dia',
          '🔵 Ponto azul = uma dose foi registrada naquele dia',
          '🔵 Anel celeste = hoje',
          '🟠 Ícone de seta laranja = aumento de dose ativo naquele dia',
        ],
      },
      {
        q: 'Como registro uma dose?',
        a: [
          '1. Toque em um dia no calendário',
          '2. Ciclos ativos aparecem como cards no painel do dia abaixo',
          '3. Toque em um ciclo → o formulário de registro abre pré-preenchido',
          '4. Ajuste dose, método ou horário se precisar',
          '5. Toque em “Salvar”',
        ],
      },
      {
        q: 'O que é a confirmação de dose?',
        a: [
          'Depois de registrar você pode confirmar cada dose:',
          '✅ “Tomada” – o registro fica marcado em verde',
          '❌ “Não tomada” – o registro fica marcado em vermelho e aparecem opções de adiar',
          'Até confirmar, os dois botões aparecem no card do registro.',
        ],
      },
      {
        q: 'O que é adiar (snooze)?',
        a: [
          'Ao tocar em “Não tomada”, aparecem botões de adiar:',
          '⏰ 15 min – lembrete em 15 minutos',
          '⏰ 30 min – lembrete em 30 minutos',
          '⏰ 1 h – lembrete em 1 hora',
          '⏰ 2 h – lembrete em 2 horas',
          'Quando dispara, um toast mostra o peptídeo e a dose.',
        ],
      },
      {
        q: 'O que significa a seta laranja no calendário?',
        a: 'A seta laranja (📈 aumento ativo) indica que um aumento de dose do seu ciclo vale naquele dia. A dose exibida no painel do dia já é a dose total aumentada.',
      },
      {
        q: 'Como mudo de mês?',
        a: 'Toque nas setas à esquerda/direita do nome do mês.',
      },
      {
        q: 'Posso excluir uma dose registrada?',
        a: 'Sim. No painel do dia há um botão ✕ à direita de cada registro → toque e confirme.',
      },
      {
        q: 'Por que não há fundo roxo mesmo tendo um ciclo?',
        a: [
          'Possíveis motivos:',
          '• Ciclo está “Inativo” → em Peptídeos → ciclo → ative o interruptor',
          '• Mês errado exibido → navegue até o mês de início do ciclo',
          '• Datas de início/fim excluem este mês',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    title: 'Peptídeos e estoque',
    items: [
      {
        q: 'Como crio um peptídeo novo?',
        a: [
          '1. Toque em “+ Novo” no canto superior direito',
          '2. Digite um nome ou escolha em “Conhecidos”',
          '3. Preencha princípio ativo e reconstituição (mg/frasco, líquido, seringa)',
          '4. Informe estoque, dados do lote e dosagem',
          '5. Opcionalmente envie PDF ou imagem do documento de análise',
          '6. Toque em “Salvar”',
        ],
      },
      {
        q: 'O que o frasco animado no card do peptídeo mostra?',
        a: [
          'Se você informou estoque, um frasco animado aparece à esquerda do card:',
          '🟢 Verde = mais de 50% de estoque restante',
          '🟡 Amarelo = 25–50% de estoque',
          '🔴 Vermelho = menos de 25% – acabando em breve',
          'O líquido anima. No celular o frasco inclina com a orientação do aparelho.',
        ],
      },
      {
        q: 'O que é o botão de informações (ícone de nota) no card do peptídeo?',
        a: [
          'O ícone de nota (📄) abre uma ficha com todos os dados salvos:',
          '• Dose e via de administração',
          '• Princípio ativo, volume de líquido, seringa',
          '• Data de reconstituição e validade com contagem regressiva',
          '• Estoque e barra de progresso',
          '• Número do lote e origem',
          '• Documento de análise: imagens inline, PDFs como link',
          '• Observações',
        ],
      },
      {
        q: 'O que é o gerenciamento de estoque?',
        a: [
          'Você pode informar quantos frascos tem:',
          '• “Frascos em mãos” = estoque atual',
          '• No primeiro salvamento esse valor vira a linha de base de 100%',
          '• A barra de progresso no card mostra o consumo em cores',
          '• A validade é calculada a partir da data de reconstituição + prazo de conservação',
        ],
      },
      {
        q: 'O que são informações de lote?',
        a: [
          'Informações de lote documentam a origem do seu peptídeo:',
          '• Número do lote = ID do lote do fabricante',
          '• Origem = fabricante ou fornecedor (ex.: “Peptide Sciences”)',
          '• Documento de análise = envio de PDF ou imagem (COA, laudo, nota fiscal)',
          'Isso também aparece na ficha de informações do peptídeo.',
        ],
      },
      {
        q: 'O que significa “Líquido adicionado (mL)”?',
        a: 'É quanta água (ex.: água bacteriostática, NaCl ou água estéril para injeção) você adiciona ao frasco. Mais líquido significa menor concentração. Valores típicos: 1–2 mL.',
      },
      {
        q: 'O que significam os campos da seringa “mL” e “unidades”?',
        a: [
          'Esses dois campos descrevem sua seringa:',
          '• mL = volume total da seringa (ex.: 1 mL)',
          '• Unidades = marcas máximas na escala (ex.: 100 em seringa U-100)',
          '→ Com isso: unidades/mL = marcas por mililitro',
          'Seringa de insulina U-100 padrão: 1 mL / 100 unidades = 100 unidades/mL',
        ],
      },
      {
        q: 'O que é o prazo de validade após a reconstituição?',
        a: [
          'Depois de dissolver o peptídeo ele só fica estável por um tempo limitado (na geladeira):',
          '10–14 dias = peptídeos de vida curta',
          '21–28 dias = típico para peptídeos reconstituídos',
          '42–90 dias = peptídeos especialmente estáveis',
          'A validade é calculada a partir da data de reconstituição + dias escolhidos e exibida em cores.',
        ],
      },
      {
        q: 'Como adiciono um ciclo pelo card do peptídeo?',
        a: 'Cada card de peptídeo tem um botão roxo “Adicionar ciclo” no canto inferior direito. Toque nele — não precisa expandir o peptídeo antes.',
      },
      {
        q: 'O que a seta com contagem de ciclos na parte inferior mostra?',
        a: 'A setinha na parte inferior esquerda (ex.: “▼ 2 ciclos”) expande ou recolhe a visão de ciclos. Você vê de relance quantos ciclos existem para aquele peptídeo.',
      },
      {
        q: 'Como pesquiso um peptídeo?',
        a: 'Quando existem peptídeos, um campo de busca aparece no topo. Digite um nome — a lista filtra automaticamente. Use o menu ao lado para ordenar A→Z ou Z→A.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Calculadora',
    items: [
      {
        q: 'O que a calculadora faz?',
        a: [
          'Com suas entradas a calculadora determina:',
          '• Unidades a puxar – quantas marcas na seringa',
          '• Concentração – mg/mL da solução pronta',
          '• Preenchimento da seringa – qual percentual da seringa você puxa',
          '• Doses por frasco – quantas injeções saem de um frasco',
        ],
      },
      {
        q: 'O que é a escala da seringa?',
        a: [
          'A escala colorida no topo mostra visualmente quantas unidades puxar:',
          '• A barra preenche da esquerda (azul) para a direita (roxo → rosa)',
          '• A linha branca marca o ponto exato',
          '• O número grande acima mostra as unidades',
          'Você vê na hora se a dose cabe na seringa.',
        ],
      },
      {
        q: 'Quais entradas a calculadora precisa?',
        a: [
          '• Tamanho da seringa – escolha um preset (ex.: 1 mL / 100 unidades) ou valores personalizados',
          '• Ativo por frasco – mg no frasco (ex.: 10 mg)',
          '• Líquido adicionado – quantos mL você adicionou (ex.: 2 mL)',
          '• Dose – sua dose alvo com unidade (mcg, mg, UI)',
        ],
      },
      {
        q: 'Quais presets de seringa existem?',
        a: [
          '• 1 mL · 100 unidades (U-100) – seringa de insulina padrão',
          '• 0,5 mL · 50 unidades (U-100) – seringa de insulina pequena',
          '• 0,3 mL · 30 unidades (U-100) – seringa bem pequena',
          '• 2 mL · 200 unidades (U-100) – seringa maior',
          '• 1 mL · 40 unidades (U-40) – seringa U-40 antiga',
          'Ou: informe mL e unidades personalizados.',
        ],
      },
      {
        q: 'Exemplo – como funciona o cálculo?',
        a: [
          'Exemplo: BPC-157, frasco 5 mg, 2 mL de água, dose 500 mcg, seringa U-100',
          '→ Concentração: 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Volume: 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Unidades: 0,200 mL × 100 unidades/mL = 20 unidades',
          '→ Doses/frasco: 5000 mcg ÷ 500 mcg = 10 doses',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Ciclos',
    items: [
      {
        q: 'O que é um ciclo?',
        a: 'Um ciclo é um plano estruturado de ingestão de um peptídeo. Define dose, método, frequência, período, horário de ingestão opcional e lembretes.',
      },
      {
        q: 'Como crio um ciclo?',
        a: [
          '1. No card do peptídeo toque em “+ Adicionar ciclo” (botão roxo)',
          '2. Preencha nome, dose, frequência e datas',
          '3. Opcionalmente defina horário de ingestão e lembretes',
          '4. Toque em “Salvar”',
          'O ciclo aparece no calendário automaticamente!',
        ],
      },
      {
        q: 'Quais opções de frequência existem?',
        a: [
          '• Diário · Duas vezes ao dia · Dia sim, dia não',
          '• 5 dias ligado / 2 desligado (5on/2off)',
          '• Seg–Sex · Semanal',
          '• A cada X dias – intervalo personalizado',
          '• Escolher dias da semana – ex.: só seg, qua, sex',
        ],
      },
      {
        q: 'O que significa o interruptor Ativo/Inativo?',
        a: 'Ativo = o ciclo aparece no calendário (dias roxos). Inativo = ciclo pausado, não visível no calendário. Alterne tocando no interruptor à direita do ciclo.',
      },
      {
        q: 'O que é horário de ingestão?',
        a: [
          'Opcional – define o horário do dia:',
          '🌅 Manhã = 08:00 · ☀️ Meio-dia = 12:00 · 🌙 Noite = 20:00 · 🕐 Horário personalizado',
          'Usado para lembretes. É opcional — pode deixar em branco.',
        ],
      },
      {
        q: 'Como funcionam os lembretes?',
        a: [
          'Lembretes são de seleção múltipla — você pode escolher vários:',
          '• 1 dia antes – lembrete 24 horas antes da ingestão',
          '• 2 h antes – antecedência de 2 horas',
          '• Na ingestão – exatamente no horário definido',
          'O app pede permissão de notificação ao salvar.',
          'Importante: só funciona com o app aberto.',
        ],
      },
      {
        q: 'Posso ter vários ciclos para um peptídeo?',
        a: 'Sim, quantos quiser. Todos os ciclos ativos aparecem no calendário. Útil, por exemplo, para manhã + noite ou fases de dosagem diferentes.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Aumentos de dose',
    items: [
      {
        q: 'O que é um aumento de dose?',
        a: 'Uma subida planejada de dose dentro de um ciclo. Exemplo: começar com 200 mcg, após 2 semanas +100 mcg, após 4 semanas mais +100 mcg. Vários degraus são possíveis.',
      },
      {
        q: 'Como adiciono um aumento de dose?',
        a: [
          '1. Expanda o peptídeo → encontre o ciclo → seção “Aumentos de dose”',
          '2. Toque em “+ Adicionar”',
          '3. Informe valor do aumento e unidade',
          '4. Escolha início: data fixa / após X dias / após X semanas',
          '5. Opcionalmente adicione uma nota → Salvar',
        ],
      },
      {
        q: 'O aumento de dose aparece no calendário?',
        a: [
          'Sim! A partir de quando um aumento vale:',
          '• 📈 laranja no painel do dia mostra “Estágio X ativo”',
          '• A dose exibida já é o total aumentado (base + aumento)',
          '• O ícone de aumento aparece na legenda do calendário',
        ],
      },
      {
        q: 'O que significam as opções de início?',
        a: [
          '• Data fixa – a partir de qual dia o aumento vale',
          '• Após X dias – X dias após o início do ciclo',
          '• Após X semanas – dias equivalentes após o início do ciclo',
        ],
      },
      {
        q: 'Posso ter vários degraus?',
        a: 'Sim, quantos quiser. São numerados #1, #2, #3. Todos os degraus ativos somam.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Diário',
    items: [
      {
        q: 'O que é o diário?',
        a: 'Aqui você documenta efeitos e efeitos colaterais dos seus peptídeos. Ajuda a identificar padrões — quais efeitos ocorrem quando, com que intensidade e por quanto tempo.',
      },
      {
        q: 'Qual a diferença entre efeito e efeito colateral?',
        a: [
          '✅ Efeito (verde) = resultado desejado (sono, cicatrização, energia...)',
          '⚠️ Efeito colateral (laranja) = resultado indesejado (dor, fadiga...)',
        ],
      },
      {
        q: 'O que significam as opções de status?',
        a: [
          '🔘 Pendente – ainda não ocorreu',
          '✅ Ocorreu – presente ativamente',
          '⏳ Ainda em curso – continua',
          '✅ Passou – terminou',
          'Altere o status direto no card sem abrir o formulário.',
        ],
      },
      {
        q: 'O que é a escala de intensidade (1–5)?',
        a: [
          '1 = Quase imperceptível · 2 = Leve · 3 = Moderado · 4 = Forte · 5 = Muito forte',
        ],
      },
      {
        q: 'Como filtro e pesquiso no diário?',
        a: [
          '• Abas: Todos / Efeitos / Efeitos colaterais',
          '• Busca: filtra por descrição e nome do peptídeo',
          '• Ordenação: data (nova/antiga), intensidade (alta/baixa)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Avaliações',
    items: [
      {
        q: 'O que são avaliações?',
        a: 'Relatos pessoais de experiência com peptídeos individuais. Com estrelas (1–5), experiência geral (boa/média/ruim), prós e contras e texto detalhado.',
      },
      {
        q: 'Como crio uma avaliação?',
        a: [
          '1. Em “Avaliações” toque em “+ Novo”',
          '2. Escolha o peptídeo → atribua estrelas → escolha a experiência',
          '3. Digite o título (obrigatório) → opcionalmente relatório, prós, contras',
          '4. Salvar',
        ],
      },
      {
        q: 'Como pesquiso e ordeno avaliações?',
        a: [
          '• Busca: título e nome do peptídeo',
          '• Ordenação: mais recentes / mais antigas / nota alta / nota baixa',
        ],
      },
      {
        q: 'Posso compartilhar avaliações no meu perfil?',
        a: 'Sim. Em “Perfil” ative o interruptor “Avaliações” — elas passam a aparecer no seu link de perfil público.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Perfil e compartilhamento',
    items: [
      {
        q: 'O que posso informar no meu perfil?',
        a: [
          '• Nome de usuário (para o link de compartilhamento) – obrigatório',
          '• Nome de exibição, idade, sexo, peso, altura',
          '• Notas pessoais (só para você)',
          '• Bio pública (exibida no perfil compartilhado)',
        ],
      },
      {
        q: 'Como ativo o perfil público?',
        a: [
          '1. Informe o nome de usuário e salve o perfil',
          '2. Ative o interruptor principal “Compartilhar perfil”',
          '3. Ative áreas individuais (Peptídeos / Calendário / Diário / Avaliações)',
          '4. Salve → o link aparece e pode ser copiado',
        ],
      },
      {
        q: 'Qual conteúdo posso compartilhar?',
        a: [
          'Cada área tem seu próprio interruptor:',
          '🧪 Peptídeos · 📅 Calendário e ciclos · 📖 Diário · ⭐ Avaliações',
          'Você pode, por exemplo, compartilhar só avaliações e manter o resto privado.',
        ],
      },
      {
        q: 'Posso desativar o compartilhamento a qualquer momento?',
        a: 'Sim. Desative o interruptor principal “Compartilhar perfil” → salve. O link passa a mostrar imediatamente “Este perfil é privado”.',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Lembretes e adiar',
    items: [
      {
        q: 'Como configuro lembretes?',
        a: [
          '1. Crie ou edite um ciclo',
          '2. Defina o horário de ingestão (manhã/meio-dia/noite/personalizado)',
          '3. Em “Lembrete” escolha uma ou mais opções (seleção múltipla)',
          '4. Salve → o app pede permissão de notificação',
        ],
      },
      {
        q: 'Posso escolher vários horários de lembrete?',
        a: 'Sim. Você pode, por exemplo, ativar “1 dia antes” e “Na ingestão” ao mesmo tempo. Marcas de seleção mostram quais estão ativos.',
      },
      {
        q: 'Qual a diferença entre lembrete e adiar?',
        a: [
          'Lembrete (no ciclo) = notificação planejada antes da ingestão',
          'Adiar (no calendário) = lembrete de acompanhamento depois de marcar uma dose como “Não tomada” (15 min / 30 min / 1 h / 2 h)',
        ],
      },
      {
        q: 'Por que não recebo lembretes?',
        a: [
          '• Permissão de notificação negada → ative nas configurações do celular',
          '• O app não estava aberto no horário do lembrete',
          '• O horário do lembrete de hoje já passou',
          '• O ciclo está “Inativo”',
        ],
      },
      {
        q: 'Lembretes funcionam com o app fechado?',
        a: 'Ainda não. As notificações são do navegador e exigem o app aberto (aba ou PWA). Entrega em segundo plano precisaria de um serviço push.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Técnico e privacidade',
    items: [
      {
        q: 'Por que vejo “Erro ao salvar”?',
        a: [
          '• Sem conexão com a internet',
          '• Campos obrigatórios faltando',
          '• Sessão expirada → saia e entre de novo',
          '• Envio de PDF: bucket de armazenamento ainda não configurado → execute o SQL no Supabase',
        ],
      },
      {
        q: 'Por que não consigo enviar um PDF?',
        a: [
          'O bucket de armazenamento “batch-files” precisa ser configurado uma vez no Supabase:',
          '1. supabase.com → seu projeto → SQL Editor → nova aba',
          '2. Cole e execute o SQL de “supabase-inventory.sql”',
          'Os envios funcionam imediatamente depois.',
        ],
      },
      {
        q: 'O que acontece com meus dados quando saio?',
        a: 'Seus dados permanecem no servidor. No próximo login todos os registros continuam lá.',
      },
      {
        q: 'Os dados são apagados se desinstalar o app?',
        a: 'Não. Os dados ficam no servidor (Supabase) — independente do aparelho. Basta entrar de novo em qualquer dispositivo.',
      },
      {
        q: 'O app serve para uso médico?',
        a: 'Não. Apenas para pesquisa e documentação. Não substitui orientação médica. Consulte sempre um médico.',
      },
      {
        q: 'Posso usar o app em tablet ou outro dispositivo?',
        a: [
          'Sim. Como tudo fica na nuvem, o app funciona em quantos dispositivos quiser:',
          '1. Abra a mesma URL no navegador',
          '2. Entre com a mesma conta',
          '3. Todos os dados ficam disponíveis na hora',
          'Para acesso ao código (desenvolvimento): clone o repositório no GitHub.',
        ],
      },
    ],
  },
]
