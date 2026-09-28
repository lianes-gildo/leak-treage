import { GoogleGenAI, Type } from '@google/genai'
import {
  ClassificacaoGemini,
  PriorityInput,
  LocalFuga,
  IntensidadeReportada,
  AfetaOutros,
} from '@/types/ocorrencia'

interface ContextoFormulario {
  local_fuga?: LocalFuga | string | null
  intensidade_reportada?: IntensidadeReportada | string | null
  afeta_outros?: AfetaOutros | string | null
}

/**
 * Converte uma URL de imagem (ou data URI) num buffer base64 e mimeType para enviar à API do Gemini.
 */
async function obterImagemPart(fotoUrl: string): Promise<{ mimeType: string; data: string }> {
  if (fotoUrl.startsWith('data:')) {
    const commaIndex = fotoUrl.indexOf(',')
    if (commaIndex !== -1) {
      const header = fotoUrl.substring(0, commaIndex)
      const data = fotoUrl.substring(commaIndex + 1)
      const mimeMatch = header.match(/data:([^;]+)/)
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg'
      return { mimeType, data }
    }
  }

  // Tenta realizar fetch da imagem com timeout de 6 segundos
  const response = await fetch(fotoUrl, {
    signal: AbortSignal.timeout(6000),
  })
  if (!response.ok) {
    throw new Error(`Não foi possível descarregar a imagem para classificação: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = response.headers.get('content-type') || 'image/jpeg'

  return {
    mimeType,
    data: buffer.toString('base64'),
  }
}

/**
 * Classifica a imagem enviada usando a API do Gemini 2.5 Flash com Structured Output (JSON Schema).
 * IMPORTANTE: O prompt solicita APENAS observações visuais objetivas. Não pede à IA para calcular prioridade.
 */
export async function classificarOcorrencia(
  fotoUrl: string,
  contextoFormulario?: ContextoFormulario
): Promise<ClassificacaoGemini> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.error('GEMINI_API_KEY não configurada em .env.local')
    return fallbackClassificacao('Chave API do Gemini (GEMINI_API_KEY) não encontrada.')
  }

  try {
    const imagePart = await obterImagemPart(fotoUrl)
    const ai = new GoogleGenAI({ apiKey })

    const promptText = `
Você é um sistema especializado e rigoroso de visão computacional para triagem de ocorrências de água e saneamento.
Analise a imagem da ocorrência fornecida e os dados reportados pelo utilizador.

DADOS REPORTADOS PELO UTILIZADOR (Formulário):
- Local de fuga reportado: ${contextoFormulario?.local_fuga || 'Não informado'}
- Intensidade reportada: ${contextoFormulario?.intensidade_reportada || 'Não informada'}
- Afeta outros: ${contextoFormulario?.afeta_outros || 'Não informado'}

INSTRUÇÕES E REGRAS RÍGIDAS DE VERIFICAÇÃO:
1. INSPEÇÃO CRÍTICA DE VERACIDADE DA FUGA:
   - A sua primeira obrigação é verificar se a imagem contém evidências REAIS de água, fuga, cano rebentado, infiltração visível, humidade anormal, poça na via pública ou infraestrutura hidráulica com anomalia.
   - ATENÇÃO: Podem ser enviadas fotografias pessoais, selfies, fotos de rostos, animais, carros secos, documentos, capturas de tela, salas secas, pratos de comida, mobília ou objetos aleatórios sem qualquer ligação a água ou saneamento.
   - SE A IMAGEM NÃO MOSTRAR FUGA DE ÁGUA NEM SINAIS DE ÁGUA/SANEAMENTO:
     * is_leak: false
     * confidence: 0.95
     * leak_type: "sem_fuga"
     * water_flow: "nenhum"
     * affected_area: "nenhuma"
     * infrastructure_type: "nenhuma"
     * visible_damage: false
     * risk_to_people: "nenhum"
     * risk_to_property: "nenhum"
     * reason: "A imagem não apresenta sinais visíveis de água, humidade ou infraestrutura hidráulica com anomalia (imagem pessoal ou alheia a saneamento)."
2. SE A IMAGEM CONTIVER UMA FUGA REAL:
   * is_leak: true
   * Avalie objetivamente o tipo de fuga, o diâmetro estimado da tubagem em mm (se visível/estimável), o fluxo de água ('gotas', 'pequeno_fluxo', 'fluxo_continuo', 'grande_fluxo', 'jacto'), os danos visíveis, a infraestrutura e os riscos.
3. Responda APENAS com observações visuais e físicas objetivas sobre a imagem.
4. NUNCA tente calcular prioridade (P1-P5) ou tomar decisões de despacho operacional.
`

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: imagePart.mimeType,
                data: imagePart.data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
        temperature: 0.1,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            is_leak: { type: Type.BOOLEAN },
            confidence: { type: Type.NUMBER },
            leak_type: { type: Type.STRING },
            estimated_pipe_diameter_mm: { type: Type.NUMBER, nullable: true },
            water_flow: {
              type: Type.STRING,
              enum: ['nenhum', 'gotas', 'pequeno_fluxo', 'fluxo_continuo', 'grande_fluxo', 'jacto'],
            },
            affected_area: { type: Type.STRING },
            infrastructure_type: { type: Type.STRING },
            visible_damage: { type: Type.BOOLEAN },
            risk_to_people: {
              type: Type.STRING,
              enum: ['nenhum', 'baixo', 'medio', 'alto', 'critico'],
            },
            risk_to_property: {
              type: Type.STRING,
              enum: ['nenhum', 'baixo', 'medio', 'alto', 'critico'],
            },
            reason: { type: Type.STRING },
          },
          required: [
            'is_leak',
            'confidence',
            'leak_type',
            'water_flow',
            'affected_area',
            'infrastructure_type',
            'visible_damage',
            'risk_to_people',
            'risk_to_property',
            'reason',
          ],
        },
      },
    })

    const responseText = response.text
    if (!responseText) {
      throw new Error('Resposta vazia da API Gemini')
    }

    const classificacao: ClassificacaoGemini = JSON.parse(responseText)
    return classificacao
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erro na chamada da API Gemini:', msg)
    return fallbackClassificacao(`Falha no processamento pelo modelo Gemini: ${msg}`)
  }
}

/**
 * Resposta de fallback graciosa quando a API do Gemini falha.
 * Mantém confidence: 0 para que caia obrigatoriamente na fila de validação humana.
 */
function fallbackClassificacao(motivoErro: string): ClassificacaoGemini {
  return {
    is_leak: false,
    confidence: 0,
    leak_type: 'desconhecido',
    estimated_pipe_diameter_mm: null,
    water_flow: 'nenhum',
    affected_area: 'nao_identificada',
    infrastructure_type: 'desconhecida',
    visible_damage: false,
    risk_to_people: 'nenhum',
    risk_to_property: 'nenhum',
    reason: motivoErro,
  }
}

/**
 * TABELA DE MAPEAMENTO: Gemini / Form -> PriorityInput (Escala 1-5)
 * ------------------------------------------------------------------
 * 1. RISCO PARA PESSOAS (risco: 1-5)
 *    'nenhum' -> 1 | 'baixo' -> 2 | 'medio' -> 3 | 'alto' -> 4 | 'critico' -> 5
 *
 * 2. IMPACTO / DANOS E ÁREA AFETADA (impacto: 1-5)
 *    - 'critico' ou 'rua_zona' -> 5
 *    - 'alto' ou 'varias_residencias' -> 4
 *    - 'medio' ou 'uma_residencia' -> 3
 *    - 'baixo' -> 2
 *    - 'nenhum' ou 'nao' -> 1
 *
 * 3. CAUDAL / FLUXO DE ÁGUA (caudal: 1-5)
 *    - 'jacto' -> 5
 *    - 'grande_fluxo' / 'fluxo_forte' -> 4
 *    - 'fluxo_continuo' -> 3
 *    - 'pequeno_fluxo' -> 2
 *    - 'gotas' -> 1
 *
 * 4. INFRAESTRUTURA (infraestrutura: 1-5)
 *    - 'conduta_principal' / 'conduta' -> 5
 *    - 'edificio_publico' / 'zona_comercial' -> 4
 *    - 'estrada' / 'via_publica' -> 3
 *    - 'passeio' -> 2
 *    - 'residencia' / 'dentro_residencia' / 'caixa_agua' / 'terreno' / outros -> 1
 *
 * 5. DIÂMETRO ESTIMADO (diametro: 1-5)
 *    - > 200mm -> 5
 *    - 101 a 200mm -> 4
 *    - 51 a 100mm -> 3
 *    - 25 a 50mm -> 2
 *    - < 25mm ou null -> 1
 */
export function mapearParaPriorityInput(
  classificacao: ClassificacaoGemini,
  contextoFormulario?: ContextoFormulario
): PriorityInput {
  // 1. Mapeamento de Risco (1-5)
  const riscoMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
    nenhum: 1,
    baixo: 2,
    medio: 3,
    alto: 4,
    critico: 5,
  }
  const risco = riscoMap[classificacao.risk_to_people] || 1

  // 2. Mapeamento de Impacto (1-5)
  let impacto: 1 | 2 | 3 | 4 | 5 = 1
  const afetaForm = contextoFormulario?.afeta_outros
  const riskPropGemini = classificacao.risk_to_property

  if (riskPropGemini === 'critico' || afetaForm === 'rua_zona') {
    impacto = 5
  } else if (riskPropGemini === 'alto' || afetaForm === 'varias_residencias') {
    impacto = 4
  } else if (riskPropGemini === 'medio' || afetaForm === 'uma_residencia') {
    impacto = 3
  } else if (riskPropGemini === 'baixo') {
    impacto = 2
  } else {
    impacto = 1
  }

  // 3. Mapeamento de Caudal (1-5)
  let caudal: 1 | 2 | 3 | 4 | 5 = 1
  const flowGemini = classificacao.water_flow
  const intForm = contextoFormulario?.intensidade_reportada

  if ((!classificacao.is_leak && classificacao.confidence >= 0.5) || (flowGemini === 'nenhum' && !intForm)) {
    caudal = 1
  } else if (flowGemini === 'jacto' || intForm === 'jacto') {
    caudal = 5
  } else if (flowGemini === 'grande_fluxo' || intForm === 'fluxo_forte') {
    caudal = 4
  } else if (flowGemini === 'fluxo_continuo') {
    caudal = 3
  } else if (flowGemini === 'pequeno_fluxo' || intForm === 'pequeno_fluxo') {
    caudal = 2
  } else {
    caudal = 1
  }

  // 4. Mapeamento de Infraestrutura (1-5)
  let infraestrutura: 1 | 2 | 3 | 4 | 5 = 1
  const infraGemini = (classificacao.infrastructure_type || '').toLowerCase()
  const localForm = (contextoFormulario?.local_fuga || '').toLowerCase()

  if (infraGemini.includes('conduta') || localForm === 'conduta') {
    infraestrutura = 5
  } else if (infraGemini.includes('public') || infraGemini.includes('comerc') || localForm === 'edificio_publico') {
    infraestrutura = 4
  } else if (infraGemini.includes('estrada') || infraGemini.includes('via') || localForm === 'estrada') {
    infraestrutura = 3
  } else if (infraGemini.includes('passeio') || localForm === 'passeio') {
    infraestrutura = 2
  } else {
    infraestrutura = 1
  }

  // 5. Mapeamento de Diâmetro (1-5)
  let diametro: 1 | 2 | 3 | 4 | 5 = 1
  const diam = classificacao.estimated_pipe_diameter_mm

  if (diam !== null && diam !== undefined) {
    if (diam > 200) diametro = 5
    else if (diam > 100) diametro = 4
    else if (diam > 50) diametro = 3
    else if (diam >= 25) diametro = 2
    else diametro = 1
  }

  return {
    infraestrutura,
    diametro,
    caudal,
    impacto,
    risco,
    confidence: classificacao.confidence,
  }
}
