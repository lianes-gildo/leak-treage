import { Equipa } from '@/types/ocorrencia'

/**
 * Sugere uma equipa técnica adequada para atender a ocorrência com base no tipo de infraestrutura.
 * 
 * Filosofia de produto: "IA recomenda, humano decide".
 * Se nenhuma equipa corresponder ao tipo de infraestrutura, devolve `null` para que a atribuição
 * seja feita manualmente pelo operador. NUNCA faz uma atribuição forçada aleatória.
 */
export function sugerirEquipa(
  infrastructureType: string | null | undefined,
  equipasDisponiveis: Equipa[]
): string | null {
  if (!infrastructureType || !equipasDisponiveis || equipasDisponiveis.length === 0) {
    return null
  }

  const infraNorm = infrastructureType.toLowerCase().trim()

  for (const equipa of equipasDisponiveis) {
    if (!equipa.ativa) continue

    const tipos = equipa.tipos_infraestrutura.map((t) => t.toLowerCase().trim())

    // Verifica se algum dos tipos de infraestrutura da equipa bate com o tipo final da ocorrência
    if (
      tipos.includes(infraNorm) ||
      (infraNorm.includes('principal') && tipos.includes('principal')) ||
      (infraNorm.includes('residencia') && tipos.includes('residencial')) ||
      (infraNorm.includes('secundaria') && tipos.includes('secundaria'))
    ) {
      return equipa.nome
    }
  }

  return null
}
