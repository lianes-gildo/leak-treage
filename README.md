# SAAS — Gateway Operacional de Triagem de Fugas de Água

Gateway corporativo de triagem, priorização determinística e integração externa para empresas de distribuição de água e saneamento (Maputo).

O sistema atua como ponto de entrada e motor de decisão: recebe reportes de cidadãos com geolocalização e fotografia, analisa os atributos físicos via IA (Gemini 2.5 Flash) e cadastro de rede (GIS), calcula a prioridade operacional (P1 a P5) e permite ao operador **aprovar e transmitir os dados para um sistema externo de Mapa de Distribuição** ou **descartar ocorrências fora de âmbito**.

---

## Pilares do Sistema

O sistema foi arquitetado de forma focada e modular em 4 componentes centrais:

1. **Canal Público de Reportes (`/reportar`)**:
   - Ponto de entrada otimizado para dispositivos móveis com captura direta por câmara.
   - Georreferenciação por coordenadas GPS.
   - Proteção anti-spam: *Rate limit* rigoroso (máximo 5 submissões/hora por contacto) e deteção de duplicidade por proximidade (<20 metros em <10 minutos).
   - Geração de código de protocolo institucional (`PROT-XXXXXXXX`).

2. **Fila de Triagem Operacional (`/dashboard`)**:
   - Painel de trabalho com consolidação em tempo real ordenado por criticidade (P1 a P5) e antiguidade.
   - Inspeção de evidências fotográficas, parâmetros visuais da IA e cadastro GIS.
   - **Modelo de Dupla Decisão do Operador**:
     - **Aprovar & Enviar ao Mapa**: Valida a prioridade, marca como `validado` e despacha imediatamente os dados criptografados para o Mapa de Distribuição externo.
     - **Descartar Ocorrência (Fora de Âmbito)**: Se a fuga estiver fora da rede sob gestão, em rede predial privada ou for falso positivo, o operador descarta com justificativa. **Ocorrências descartadas são estritamente isoladas e nunca enviadas ao mapa externo.**

3. **Alertas & Notificações (`/dashboard/notificacoes`)**:
   - Centro de eventos críticos em tempo real (Supabase Realtime via `postgres_changes`).
   - Notificações automáticas para ocorrências P1/P2 imediatas e quebras de limite de SLA.
   - Mecanismo anti-fadiga com *throttling* de 15 minutos para alertas repetitivos do mesmo grupo.

4. **Matriz de Prioridades & SLAs (`/dashboard/prioridades`)**:
   - Definição determinística das 5 categorias (P1 Emergência a P5 Monitorização).
   - Prazos limite de atendimento (SLA) com motor de auto-escalonamento para ocorrências vencidas.

---

## Integração Segura com o Sistema Externo (Mapa de Distribuição)

A comunicação de dados validados para o sistema externo de cartografia/mapa de distribuição é efetuada segundo as melhores práticas de engenharia de software e segurança:

### 1. API Segura de Consumo (Pull Model / GeoJSON)
- **Endpoint**: `GET /api/v1/integracao/mapa`
- **Formatos suportados**:
  - `?formato=geojson` (Padrão RFC 7946 `FeatureCollection`, ideal para Leaflet, Mapbox, OpenLayers, ArcGIS e QGIS).
  - `?formato=json` (Array estruturado de DTOs para sistemas de despacho).
- **Autenticação Segura**:
  - Cabeçalho `X-API-Key: <CHAVE>` ou `Authorization: Bearer <TOKEN>`.
  - Verificação de chave em **tempo constante (`crypto.timingSafeEqual`)** para imunidade contra ataques de canal lateral (*timing attacks*).
- **Garantia de Isolamento de Descarte**:
  - O endpoint aplica filtro estrito `status = 'validado'`.
  - Ocorrências descartadas (`status = 'rejeitado'`) ou sem coordenadas válidas **nunca** são expostas.

### 2. Despacho por Webhook em Tempo Real (Push Model / Event-Driven)
- Quando o operador aprova a ocorrência, é disparado um evento `ocorrencia.validada` para `MAPA_WEBHOOK_URL` (se configurado).
- **Garantias Criptográficas**:
  - **Assinatura HMAC-SHA256**: Cabeçalho `X-Signature-SHA256: sha256=<hex>` gerado a partir do payload com segredo partilhado (`MAPA_WEBHOOK_SECRET`).
  - **Proteção Anti-Replay**: Cabeçalho `X-Timestamp` com carimbo ISO 8601.
  - **Idempotência**: Cabeçalho `X-Idempotency-Key` único por ocorrência/versão, evitando pins duplicados no mapa.
  - **Tolerância a Falhas**: Falhas temporárias de rede no sistema externo nunca bloqueiam a interface do operador.

---

## Variáveis de Ambiente de Integração

Configuráveis no ficheiro `.env.local`:

```bash
# Autenticação da API Segura de Integração com o Mapa (Pull)
MAPA_INTEGRACAO_API_KEY=saas_sec_mapa_dev_key_2026

# Webhook em Tempo Real para o Mapa Externo (Push Opcional)
MAPA_WEBHOOK_URL=https://mapa-distribuicao.exemplo.com/api/webhooks/fugas
MAPA_WEBHOOK_SECRET=saas_webhook_hmac_secret_2026_prod

# Provedores de Dados e IA
NEXT_PUBLIC_SUPABASE_URL=https://exemplo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

---

## Execução e Testes Automatizados

O projeto conta com **42 testes unitários** organizados em 12 suítes, cobrindo segurança criptográfica, integridade GeoJSON, deduplicação, precedência GIS > IA e regras de override:

```bash
# Executar todos os testes
npm test

# Verificar integridade e formatação de código
npm run lint

# Compilar para produção (Turbopack)
npm run build
```
