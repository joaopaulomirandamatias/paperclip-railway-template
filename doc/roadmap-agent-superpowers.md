# Roadmap — Superpoderes para os Agents

Catálogo de Adapters / Plugins / Skills a construir para a holding
**Mirandas Tech / Kitara** (foco principal: **Athena** + **AtendeAI**).

Objetivo de negócio: fechar **50 clientes em 90 dias** com a máquina
de prospecção/venda automatizada que os agents do Paperclip operam.

---

## Top 3 prioritários (maior ROI imediato)

### 1. Adapter `whatsapp_evolution`

Dispara mensagens via Evolution API (já é base do AtendeAI).
Agent CMO escreve copy → adapter envia em escala.

**Modes propostos**
- `send_text` — texto puro
- `send_template` — template aprovado
- `send_audio` — combina com Lemonfox TTS para áudio sintetizado
- `start_flow` — dispara fluxo do Chatwoot/AtendeAI

**Por que primeiro:** transforma o agent em SDR. 100 leads/dia com
follow-up automático via `Routines`.

### 2. Plugin `lead_sources_br`

Conjunto de tools brasileiros para o agent encontrar leads reais
(em vez de alucinar nomes).

**Tools**
- `cnpj_lookup` → BrasilAPI / ReceitaWS (porte, CNAE, sócios)
- `cfc_search` → scraper de autoescolas no DENATRAN/DETRAN por estado
  (lead-list pronta para Athena)
- `gmaps_business` → Google Places API (categoria + cidade → AtendeAI)
- `linkedin_basic` → Phantombuster / Apify para perfis de decisores

### 3. Adapter `crm_sync`

Bidirecional com o AtendeAI próprio (ou CRM externo se quiser flex).

- Agent cria lead → entra no pipeline
- Lead responde no WhatsApp → vira evento que acorda o agent
  (heartbeat por evento, não por timer)
- Status muda → agent sabe na próxima execução

Fecha o loop: prospect → conversa → pipeline → fechamento.

---

## Catálogo completo por dor

### Prospecção / Topo do funil

| Ferramenta | Tipo | Para que |
|---|---|---|
| `whatsapp_evolution` | Adapter | Outbound em massa |
| `lead_sources_br` | Plugin | Listas de CNPJs, CFCs, comércios |
| `serpapi` | Adapter | Pesquisa Google estruturada |
| `email_outbound` | Adapter | Cold email via Resend / SES |
| `apollo` | Adapter | Decisores B2B globais |
| `instagram_scraper` | Plugin | Comentários, seguidores → leads |

### Qualificação / Closing

| Ferramenta | Tipo | Para que |
|---|---|---|
| `calcom_booking` | Adapter | Marca demo automaticamente |
| `proposal_generator` | Skill | Template de proposta + variáveis |
| `clicksign` / `autentique` | Adapter | Assinatura digital |
| `mercadopago` / `asaas` | Adapter | Link de pagamento, NFe |
| `meet_recorder` | Adapter | Grava Zoom → Lemonfox STT → resumo |

### Inteligência de mercado

| Ferramenta | Tipo | Para que |
|---|---|---|
| `browser_automation` | Adapter | Aproveita o `atlas-browser` que já existe |
| `competitor_watch` | Routine | Verifica concorrentes semanalmente |
| `pricing_intel` | Skill | Compara preço com mercado |
| `news_monitor` | Adapter | Google News com filtro de palavra-chave |

### Operações / Toolkit do CTO

| Ferramenta | Tipo | Para que |
|---|---|---|
| `github_issues` | Adapter | Agent abre issue automático |
| `sentry` / `betterstack` | Adapter | Monitora produção |
| `railway_api` | Adapter | Deploy/restart pelo agent |
| `posthog` / `umami` | Adapter | Analytics → decisões |

### Conteúdo / Marketing

| Ferramenta | Tipo | Para que |
|---|---|---|
| `wp_publish` | Adapter | Publica blog post via WordPress API |
| `social_scheduler` | Adapter | Buffer / Postiz |
| `lemonfox` modo `image` | ✅ já existe | Banner/criativo automático |
| `lemonfox` modo `tts` | ✅ já existe | Áudio para WhatsApp |

---

## Sinergia com produtos próprios

Cada produto da holding pode virar um adapter Paperclip em 1–2 dias e
ser usado pelos próprios agents — vira moat (ninguém replica seu
stack porque você é dono de cada peça).

| Produto interno | Vira adapter | Para que |
|---|---|---|
| `atlas-browser` | `atlas_browser` | Automação web (alternativa grátis ao Browserless) |
| `interoperax` | `interoperax_sync` | Conectar dados entre sistemas |
| `contratos` | `contratos_sign` | Assinatura digital própria |
| `ead` / Athena | `athena_admin` | Cadastrar autoescolas prospectadas |
| `mirandas_crm` | `mirandas_crm` | CRM nativo dos agents |

---

## Plano de execução sugerido (4 semanas)

| Semana | Entrega | Resultado |
|---|---|---|
| 1 | Adapter `whatsapp_evolution` (modes chat + send) | Agent dispara WhatsApp |
| 2 | Plugin `lead_sources_br` (CNPJ + Google Places) | Agent encontra leads reais |
| 3 | Routine diária ligando os dois | Prospecção automática 200 leads/dia |
| 4 | Adapter `crm_sync` | Funil fechado: prospect → CRM → fechamento |

**Resultado esperado em 4 semanas:** máquina autônoma que lista 200
leads/dia, manda WhatsApp personalizado, registra no CRM, agenda
demos via Cal.com, gera proposta e envia link de pagamento via
Mercado Pago. Operada pelos agents CEO / CMO / CTO.

---

## Notas de arquitetura

- **Adapter vs Plugin vs Skill**
  - **Adapter** = conecta a um runtime de IA (Lemonfox, Claude, OpenAI). Um por LLM provider.
  - **Plugin** = extensão de servidor com novas tools que o agent pode chamar. Plurais e composáveis.
  - **Skill** = playbook/instruções reutilizáveis que o agent injeta no prompt.

- **Padrão de implementação:** seguir a estrutura do `adapters/lemonfox/` deste repo.
- **Builds:** cada adapter ganha um stage no `Dockerfile` + entrada no `entrypoint.sh` para `adapter-plugins.json`.
- **Secrets:** novas variáveis de ambiente no `.env.example` e no Railway Variables.

---

## Próxima decisão

Qual construir primeiro depois que o `lemonfox` estiver estável:

- [ ] `whatsapp_evolution` (recomendado — destrava vendas)
- [ ] `lead_sources_br`
- [ ] outro
