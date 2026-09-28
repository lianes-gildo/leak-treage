import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  validarImagemSubmissao,
  verificarRateLimitContacto,
  detectarDuplicidadeMesmoContacto,
} from './validacao-submissao'
import { Ocorrencia } from '@/types/ocorrencia'

describe('Public Submission Validation Tests', () => {
  it('deve rejeitar imagens com formato inválido ou tamanho fora dos limites', () => {
    // Formato inválido
    const resMime = validarImagemSubmissao('image/bmp', 5000)
    assert.strictEqual(resMime.valido, false)
    assert.match(resMime.erro!, /Formato de imagem inválido/)

    // Tamanho demasiado pequeno (<100 bytes)
    const resPequeno = validarImagemSubmissao('image/jpeg', 50)
    assert.strictEqual(resPequeno.valido, false)
    assert.match(resPequeno.erro!, /demasiado pequena/)

    // Tamanho demasiado grande (>10MB)
    const resGrande = validarImagemSubmissao('image/png', 12 * 1024 * 1024)
    assert.strictEqual(resGrande.valido, false)
    assert.match(resGrande.erro!, /excede o limite máximo/)

    // Imagem válida
    const resValido = validarImagemSubmissao('image/webp', 500 * 1024)
    assert.strictEqual(resValido.valido, true)
  })

  it('deve bloquear o 6º envio no mesmo período de 60 minutos (rate limit)', async () => {
    const contacto = 'cliente@empresa.com'
    const agora = new Date().toISOString()

    const historico5 = [
      { contacto, criado_em: agora },
      { contacto, criado_em: agora },
      { contacto, criado_em: agora },
      { contacto, criado_em: agora },
      { contacto, criado_em: agora },
    ]

    const dentroDoLimite = await verificarRateLimitContacto(contacto, historico5.slice(0, 4))
    assert.strictEqual(dentroDoLimite, true)

    const excedeuLimite = await verificarRateLimitContacto(contacto, historico5)
    assert.strictEqual(excedeuLimite, false)
  })

  it('deve detectar duplicidade quando o mesmo contacto envia foto a <20m em menos de 10 min', async () => {
    const contacto = '+258841234567'
    const agora = new Date().toISOString()

    const ocorrenciaExistente: Partial<Ocorrencia> = {
      id: 'oc-original',
      contacto_cliente: contacto,
      latitude: -25.9692,
      longitude: 32.5732,
      criado_em: agora,
    }

    const resDuplicado = await detectarDuplicidadeMesmoContacto(
      contacto,
      -25.96925, // ~5 metros de distância
      32.5732,
      [ocorrenciaExistente as Ocorrencia]
    )

    assert.strictEqual(resDuplicado.isDuplicate, true)
    assert.strictEqual(resDuplicado.existingOccurrenceId, 'oc-original')
  })
})
