import { Prioridade, DispatchDecision } from '@/types/ocorrencia'

export interface InputClassificadoDespacho {
  prioridade: Prioridade
  necessita_validacao_humana: boolean
  confidence: number
  quantidade_reportes?: number
}

/**
 * Motor de Decisão de Despacho Operacional.
 * 
 * NOTA IMPORTANTE DE PRODUTO:
 * Esta função NUNCA despacha uma equipa técnica para o terreno de forma totalmente autónoma nesta fase.
 * A ação "fila_automatica" significa apenas que a ocorrência entra na fila de trabalho sem exigir
 * validação manual bloqueante prévia para acompanhamento operacional.
 * 
 * As regras são avaliadas em ordem estrita. A primeira regra que corresponder decide o destino.
 */
export function decidirDespacho(input: InputClassificadoDespacho): DispatchDecision {
  const { prioridade, necessita_validacao_humana, confidence, quantidade_reportes = 1 } = input

  // Regra 1: Validação humana necessária E alta gravidade (P1 ou P2) -> Fila Urgente Humana
  if (necessita_validacao_humana && (prioridade === 'P1' || prioridade === 'P2')) {
    return {
      acao: 'fila_urgente_humana',
      motivo:
        'Ocorrência de alta gravidade (P1/P2) que exige validação humana prioritária antes de qualquer encaminhamento.',
    }
  }

  // Regra 2: Validação humana necessária (qualquer outra prioridade P3-P5) -> Fila Validação Humana
  if (necessita_validacao_humana) {
    return {
      acao: 'fila_validacao_humana',
      motivo:
        'Validação humana requerida devido a parâmetros do Priority Engine ou confiança reduzida da IA.',
    }
  }

  // Regra 3: Baixa gravidade (P4/P5) + Alta Confiança (>= 85%) + Sem surto massivo de reportes (< 5) -> Fila Automática
  if ((prioridade === 'P4' || prioridade === 'P5') && confidence >= 0.85 && quantidade_reportes < 5) {
    return {
      acao: 'fila_automatica',
      motivo:
        'Ocorrência de baixo risco (P4/P5) com alta confiança visual da IA (>= 85%). Encaminhada para a fila automática sem bloqueio prévio.',
    }
  }

  // Regra 4: Fallback padrão seguro -> Fila Validação Humana
  return {
    acao: 'fila_validacao_humana',
    motivo: 'Encaminhada para a fila de validação humana padrão (fluxo regulamentar).',
  }
}
