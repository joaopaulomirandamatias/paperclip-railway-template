# Roadmap — Superpoderes para os Agents

Catálogo de Adapters / Plugins / Skills / Capacidades a construir para a
holding **Mirandas Tech / Kitara**.

Foco principal de negócio: **Athena** + **AtendeAI**, meta de **50
clientes em 90 dias** com a máquina de prospecção/venda autônoma
operada pelos agents do Paperclip.

---

## Estado atual (o que já está pronto)

| Camada | Tecnologia | Como é usado |
|---|---|---|
| Orquestrador | **Paperclip** (Railway, este repo) | CEO / CMO / CTO agents com heartbeats |
| LLM runtime | **Lemonfox** adapter (este repo) | chat / tts / stt / sdxl em modos |
| CRM omnichannel | **AtendeAI** (`atendeai.kitara.com.br/integrations/v1`) | Pipeline, tickets, kanban, mensagens |
| WhatsApp | **Evolution API** (via AtendeAI) | Envio/recebimento outbound + inbound |
| Automação | **n8n** com webhooks prontos | Camada de ação dos agents |
| Skills | `paperclip`, `paperclip-create-agent`, `paperclip-create-plugin`, `para-memory-files` | Já configuradas no CTO |

### Webhooks n8n já operacionais

| Webhook | Uso |
|---|---|
| `agente-crm-acoes` | Roteador completo do AtendeAI: ping, list/get/list_messages tickets, contatos, send_message, add_note, add_tag, move_kanban, transfer, close, reopen, schedule_followup |
| `agente-vendas-conversar-lead` | Busca histórico do ticket + envia mensagem com contexto |
| `agente-buscar-leads-web` | SerpAPI + scraper + extração email/telefone + validação + dispatch para CRM |
| `crm-criar-ticket-kanban-mensagem` | Composto: cria ticket → move no Kanban → manda primeira mensagem |
| `crm-receber-lead-validado` | Endpoint para aceitar leads validados (vindos do fluxo de busca) |
| `create-lead` (openclaw) | Webhook genérico para ingestão de lead |

> **Conclusão:** prospecção web, criação/movimentação no CRM e envio
> de WhatsApp **já estão cobertos**. Não precisamos construir adapters
> dedicados para essas três coisas — basta o LLM saber chamar esses
> webhooks.

---

## ❌ Ideias do roadmap antigo que ficam descartadas

| Plano original | Por que não precisa | Substituto |
|---|---|---|
| Adapter `whatsapp_evolution` | n8n `agente-vendas-conversar-lead` já manda WhatsApp via AtendeAI | Usar webhook existente |
| Plugin `lead_sources_br` | n8n `agente-buscar-leads-web` já faz SerpAPI + scrape + valida | Usar webhook existente |
| Adapter `crm_sync` | n8n `agente-crm-acoes` é roteador completo do AtendeAI | Usar webhook existente |

---

## 🚀 As 10 ideias novas (ordem de impacto)

### A. Memória de longo prazo (RAG)

**Problema:** agents são amnésicos entre heartbeats. Cada run começa
do zero exceto pelo histórico da conversa atual em `sessionParams`.

**Solução:** vector store (Qdrant ou Weaviate em Docker no Railway,
~$5/mês) + adapter `vector_memory` com modes:
- `recall(query)` → busca contexto relevante antes do agent responder
- `remember(text, tags)` → armazena resumo após cada run
- `forget(filter)` → LGPD compliance

**Ganho:** SDR vê automaticamente "lead X já pediu desconto em
outubro" sem você programar nada. Aprendizado acumula sozinho.

**Esforço:** 1 semana. **ROI:** alto, compõe ao longo do tempo.

---

### B. Multi-agent em paralelo (worker pool)

**Problema:** heartbeat de 300s × 1 agent = no máximo 12 ações/hora
por papel. Não escala para 500 leads/dia.

**Solução:** o CMO **contrata** 10 SDRs especializados (1 por
cidade/segmento). Paperclip já suporta hierarquia (`Reports to`).

**Como:** skill `hire_specialized_agent(role, focus)` que o CMO
chama. Templates de "SDR-Recife", "SDR-SP-medico", etc., todos
usando lemonfox + os webhooks n8n.

**Ganho:** 500 leads/dia totais, divididos por especialização.

**Esforço:** 3-4 dias. **ROI:** linear no número de agents.

---

### C. WhatsApp em áudio (sleeping giant)

**Problema:** cold message em texto no Brasil tem ~5% de reply rate.
**Áudio** tem 25-35%.

**Solução:** Lemonfox TTS já está no adapter. Pipeline:

```
LLM gera roteiro → Lemonfox modo=tts (voz pt-br) →
upload temporário → AtendeAI envia áudio via Evolution
```

Pode ser um novo webhook n8n `agente-enviar-audio` que combina
geração + envio, ou skill que orquestra os dois passos.

**Ganho:** dobrar/quintuplicar taxa de resposta sem mudar nada na
lista de leads.

**Esforço:** 1 semana. **ROI:** o mais alto da lista.

---

### D. Speed-to-lead (<30 segundos)

**Problema:** conversão cai 80% se a primeira resposta demora >5min.
Hoje o heartbeat de 300s já garante latência de até 5min mesmo no
melhor caso.

**Solução:** **event-driven heartbeat**. Quando AtendeAI/Evolution
recebe nova mensagem, n8n chama API do Paperclip e **força wake** do
agent SDR específico.

**Como:**
1. Routine n8n nova: `crm-message-inbound` → POST no Paperclip
   `/api/agents/<id>/wake?reason=inbound_message`
2. Agent acorda em <1s
3. Lemonfox 70B responde em ~3s
4. Mensagem entregue em **<5s do recebimento**

**Esforço:** 2 dias. **ROI:** maior taxa de conversão dos leads que
chegam.

---

### E. Self-improvement loop

**Problema:** o copy do CMO não evolui. Cada erro de prompt fica
fixo até você descobrir.

**Solução:** agent novo **`Optimizer`** que roda 1× por semana:
1. Pega histórico dos últimos 100 disparos do CMO
2. Calcula reply rate por variante de copy
3. Propõe ajuste no `instructionsBundle` do CMO
4. Espera aprovação humana (approval gate)
5. Aplica e mede de novo

**Ganho:** copy 2-3x melhor em 1 mês sem você editar prompt.

**Esforço:** 1 semana. **ROI:** crescente com o tempo (efeito
composto).

---

### F. Approval gates para ações de alto risco

**Problema:** autonomia é boa até o agent mandar uma proposta de
R$50k para o lead errado.

**Solução:** regras declarativas no skill:
- Mensagem contendo `R$` > limite → exige aprovação humana
- Email para domínios sensíveis (`gov.br`, escritórios de advocacia)
  → revisão humana
- Mover ticket para `Fechado-Ganho` → confirmação humana
- `close_ticket` com perda > X → revisão

**Como:** Paperclip já tem fluxo de approval embutido. Criar skill
`risk_check` que o agent invoca antes de ações sensíveis.

**Esforço:** 3-4 dias. **ROI:** evita 1 desastre = paga o ano todo.

---

### G. Dashboard de operação

**Problema:** não tem visão centralizada do que os agents estão
fazendo nem do funil.

**Solução:** routine diária que cada agent reporta métricas para
Notion DB ou Grafana:

| Métrica | Fonte | Quem reporta |
|---|---|---|
| Leads gerados/dia | n8n busca-leads-web | CMO |
| Reply rate | AtendeAI list_messages + filtro | CMO |
| Demos agendadas | Cal.com / agenda | CMO |
| Propostas enviadas | CRM stage | SDR |
| MRR atual | Stripe / MercadoPago / Asaas | CEO |
| Custo Lemonfox/lead fechado (CAC AI) | Lemonfox usage / fechados | CEO |
| Top 5 objeções da semana | Análise de transcripts | CMO |

**Esforço:** 1 semana. **ROI:** decisão informada > intuição.

---

### H. Inteligência de mercado para Athena

**Insight:** CFCs (autoescolas) = mercado fragmentado e
**totalmente mapeável**.

**Solução:**
- Scraper DETRAN/DENATRAN estado-a-estado → lista de TODAS
  autoescolas do Brasil com CNPJ
- Cruzar com Receita Federal (BrasilAPI): faturamento estimado,
  sócios, tempo de mercado
- Score por probabilidade de comprar Athena (porte + idade +
  digitalização aparente)
- Agent prospecta os top 200 primeiro

**Análogo para AtendeAI:** Google Places por categoria
(odontologia, advocacia, imobiliária) × cidades top → CNPJ →
score → prospect.

**Esforço:** 2 semanas (scrapers + enrichment). **ROI:** vira moat
— ninguém mais tem essa lista cruzada.

---

### I. Inbound funnel + landing pages

**Problema:** prospecção ativa é cara. Inbound qualificado escala
melhor.

**Solução:** landing por produto:
- `athena.kitara.com.br/grow` (formulário CFC)
- `atendeai.kitara.com.br/teste` (formulário SaaS)
- Form → n8n `create-lead` (já existe) → CRM → **agent responde
  em <30s com áudio personalizado** (combina C + D)

**Componente novo:** páginas conversoras (você já tem domínios e
produtos). Investimento: copy + design + tráfego pago direcionado.

**Esforço:** 2 semanas para landings + integração. **ROI:** CAC
escala melhor que outbound puro.

---

### J. Produto novo — "CEO Autônomo as a Service"

**Insight:** o stack que você está montando **é um produto
vendável** para outros pequenos negócios.

**Modelo:**
- Mirandas Tech vira reseller de "CEO Autônomo" para PMEs
- R$2.000/mês por cliente
- Cada cliente ganha CEO/CMO/CTO autônomo + AtendeAI integrado
- White-label do Paperclip + adapters customizados

**Vantagem:** R&D já está pago. Custo marginal = Lemonfox tokens +
Railway resources do cliente.

**Esforço:** 4-6 semanas para empacotar. **ROI:** 4ª linha de
receita da holding com margem >70%.

---

## 📅 Plano de execução sugerido (8 semanas)

| Semana | Entrega | Por quê |
|---|---|---|
| 1 | **C** WhatsApp áudio + **D** speed-to-lead | Maior salto de conversão imediato |
| 2 | **A** Memória vetorial (Qdrant) | Destrava aprendizado acumulado |
| 3 | **F** Approval gates + **G** dashboard básico | Reduz risco e dá visibilidade |
| 4 | **B** Multi-agent paralelo (10 SDRs) | Escala throughput |
| 5-6 | **H** Inteligência de mercado (scrapers Athena/AtendeAI) | Lista pronta de 10k+ leads qualificados |
| 7 | **E** Self-improvement Optimizer | Copy melhora sozinho daqui em diante |
| 8 | **I** Landings + integração inbound | Funil dual outbound+inbound |
| (depois) | **J** Empacotar como produto vendável | Nova linha de receita |

---

## 🎯 Decisões pendentes (você bate o martelo)

1. **Vector store**: Qdrant (mais simples) ou Weaviate (mais features)?
2. **Voz pt-br do TTS**: testar `sarah` ou `bella`? — agendar teste A/B
3. **Approval gates**: limite em R$ para exigir aprovação? (sugestão: R$5k)
4. **Multi-agent**: começar com 3 SDRs (Recife, SP, RJ) ou 10 cidades?
5. **Lançar como produto (J)**: depois das 8 semanas ou começar a empacotar em paralelo?

---

## 🏗️ Notas de arquitetura

- **Adapter vs Plugin vs Skill vs Webhook n8n**
  - **Adapter** = LLM runtime (lemonfox = o cérebro)
  - **Skill** = playbook reutilizável injetado no prompt
  - **Webhook n8n** = ferramenta que o agent chama via HTTP (mãos)
  - **Plugin Paperclip** = extensão de servidor (raramente necessário)

- **Padrão atual:** agent (lemonfox) decide o quê → invoca webhook n8n → recebe resultado → continua decidindo

- **Estendendo lemonfox para function calling**: a API da Lemonfox é
  OpenAI-compatible e suporta `tools`/`tool_calls`. Podemos
  estender o adapter para detectar `tool_calls` no response e
  executar webhooks n8n automaticamente. Isso transforma o ciclo em:

  ```
  Heartbeat
    → LLM com lista de tools (= n8n webhooks)
    → LLM responde com tool_call(prospect_web, {query: "..."})
    → Adapter chama webhook → recebe resultado
    → Manda resultado de volta para LLM
    → LLM continua/conclui
  ```

  Tudo numa só sessão de heartbeat. Esta é a evolução natural do
  adapter atual e habilita as ideias **A**, **B**, **D**, **E**.

---

## 🔗 Referências

- [Paperclip docs](https://docs.paperclip.ing)
- [Lemonfox API](https://www.lemonfox.ai/apis)
- [AtendeAI integrations](https://atendeai.kitara.com.br/integrations/v1)
- Workflows n8n já criados em `mirandas_crm/docs/n8n_*.json` e
  `openclaw/criar-lead.json`
