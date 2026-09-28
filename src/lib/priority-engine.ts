import { PriorityInput, PriorityOutput, Prioridade } from '@/types/ocorrencia'

/**
 * Priority Engine — Função pura e determinística para cálculo de prioridades de ocorrências.
 * 
 * Regras:
 * 1. Pesos: Risco (30%), Impacto (25%), Caudal (20%), Infraestrutura (15%), Diâmetro (10%).
 * 2. Hard Overrides:
 *    - Risco == 5 -> P1 imediato.
 *    - Infraestrutura == 5 e Caudal >= 4 -> P1 imediato.
 * 3. Mapeamento de Score (0-100):
 *    - score >= 80 -> P1
 *    - score >= 60 -> P2
 *    - score >= 40 -> P3
 *    - score >= 20 -> P4
 *    - score < 20  -> P5
 * 4. Validação humana necessária se:
 *    - confidence < 0.5
 *    - OU prioridade for P1 ou P2
 */
export function calcularPrioridade(input: PriorityInput): PriorityOutput {
  const { infraestrutura, diametro, caudal, impacto, risco, confidence } = input

  // Cálculo da média ponderada na escala 1-5
  const rawWeighted =
    risco * 0.30 +
    impacto * 0.25 +
    caudal * 0.20 +
    infraestrutura * 0.15 +
    diametro * 0.10

  // Normalização para a escala 0 - 100
  const score = Math.round(((rawWeighted - 1) / 4) * 100)

  let prioridade: Prioridade
  let overrideMotivo: string | null = null

  // 1. Verificação de Hard Rules (Overrides)
  if (risco === 5) {
    prioridade = 'P1'
    overrideMotivo =
      'Risco crítico para a integridade de pessoas detetado (nível 5) — prioridade máxima P1 forçada por regra de segurança.'
  } else if (infraestrutura === 5 && caudal >= 4) {
    prioridade = 'P1'
    overrideMotivo = `Fuga na conduta principal (nível 5) com caudal elevado (nível ${caudal}) — prioridade máxima P1 forçada por regra de infraestrutura.`
  } else {
    // 2. Mapeamento padrão do score para a prioridade
    if (score >= 80) {
      prioridade = 'P1'
    } else if (score >= 60) {
      prioridade = 'P2'
    } else if (score >= 40) {
      prioridade = 'P3'
    } else if (score >= 20) {
      prioridade = 'P4'
    } else {
      prioridade = 'P5'
    }
  }

  // 3. Determinação de necessidade de validação humana
  const necessitaValidacaoHumana =
    confidence < 0.5 || prioridade === 'P1' || prioridade === 'P2'

  // 4. Construção da justificativa / motivo legível
  let motivo = overrideMotivo
    ? overrideMotivo
    : `Prioridade ${prioridade} calculada com base no score ponderado de ${score}/100.`

  if (confidence < 0.5) {
    motivo += ` [Validação humana necessária: baixa confiança da IA (${Math.round(
      confidence * 100
    )}%)].`
  } else if (prioridade === 'P1' || prioridade === 'P2') {
    motivo += ' [Validação humana necessária: ocorrência de alta gravidade (P1/P2)].'
  }

  return {
    score,
    prioridade,
    necessita_validacao_humana: necessitaValidacaoHumana,
    motivo,
  }
}
