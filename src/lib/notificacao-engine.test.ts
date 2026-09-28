import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  decidirNotificacoes,
  verificarThrottlingNotificacao,
  processarERegistarNotificacoes,
} from './notificacao-engine'
import { EventoAuditoria } from './auditoria'
import { Notificacao } from '@/types/ocorrencia'

describe('Notification Decision Engine Tests', () => {
  it('Regra 1: Nova ocorrência urgente (fila_urgente_humana / P1) notifica operador e supervisor', () => {
    const evento: EventoAuditoria = {
      ocorrencia_id: 'oc-urgente-1',
      tipo_evento: 'classificacao_inicial',
      valor_novo: {
        prioridade: 'P1',
        decisao_despacho: { acao: 'fila_urgente_humana' },
      },
      motivo: 'Conduta principal com inundação',
    }

    const notifs = decidirNotificacoes(evento)
    assert.strictEqual(notifs.length, 2)
    assert.strictEqual(notifs[0].papel_alvo, 'operador')
    assert.strictEqual(notifs[1].papel_alvo, 'supervisor')
    assert.strictEqual(notifs[0].tipo, 'nova_urgente')
  })

  it('Regra 2: Escalonamento por SLA para P1/P2 notifica supervisor', () => {
    const evento: EventoAuditoria = {
      ocorrencia_id: 'oc-sla-1',
      tipo_evento: 'escalonamento_sla',
      valor_anterior: { prioridade: 'P3' },
      valor_novo: { prioridade: 'P2' },
      motivo: 'SLA de 8 horas vencido',
    }

    const notifs = decidirNotificacoes(evento)
    assert.strictEqual(notifs.length, 1)
    assert.strictEqual(notifs[0].papel_alvo, 'supervisor')
    assert.strictEqual(notifs[0].tipo, 'escalonada')
  })

  it('Regra 3: Grupo amplificado cruzando piso de P1 (>=10 reportes) notifica supervisor', () => {
    const evento: EventoAuditoria = {
      ocorrencia_id: 'oc-grupo-10',
      tipo_evento: 'amplificacao_grupo',
      valor_novo: { grupo_id: 'grp-99', quantidade_reportes: 10, prioridade: 'P1' },
      motivo: 'Amplificação por volume de 10 reportes',
    }

    const notifs = decidirNotificacoes(evento)
    assert.strictEqual(notifs.length, 1)
    assert.strictEqual(notifs[0].papel_alvo, 'supervisor')
    assert.strictEqual(notifs[0].tipo, 'grupo_amplificado')
  })

  it('Regra 4: Atribuição de equipa notifica operador', () => {
    const evento: EventoAuditoria = {
      ocorrencia_id: 'oc-atrib-1',
      tipo_evento: 'atribuicao_equipa',
      valor_novo: { equipa_atribuida: 'Equipa Alpha' },
      motivo: 'Atribuição pelo operador',
    }

    const notifs = decidirNotificacoes(evento)
    assert.strictEqual(notifs.length, 1)
    assert.strictEqual(notifs[0].papel_alvo, 'operador')
    assert.strictEqual(notifs[0].tipo, 'atribuicao_pendente')
  })

  it('Regra de supressão (throttling): suprime se não lida nos últimos 15m; permite se lida ou >15m', () => {
    const agora = new Date()
    const ha10Min = new Date(agora.getTime() - 10 * 60 * 1000).toISOString()
    const ha20Min = new Date(agora.getTime() - 20 * 60 * 1000).toISOString()

    const notifNaoLidaRecente: Notificacao = {
      id: 'n-1',
      destinatario_id: null,
      papel_alvo: 'supervisor',
      ocorrencia_id: 'oc-dup',
      grupo_id: 'grp-1',
      tipo: 'grupo_amplificado',
      titulo: 'Teste',
      mensagem: 'Teste',
      lida: false,
      criado_em: ha10Min,
    }

    // 1. Deve suprimir se houver notificação não lida recente (<15m)
    const suprimir = verificarThrottlingNotificacao('grupo_amplificado', 'grp-1', [notifNaoLidaRecente])
    assert.strictEqual(suprimir, true)

    // 2. Deve PERMITIR se a notificação foi criada há mais de 15 min (>15m)
    const notifAntiga = { ...notifNaoLidaRecente, criado_em: ha20Min }
    const suprimirAntiga = verificarThrottlingNotificacao('grupo_amplificado', 'grp-1', [notifAntiga])
    assert.strictEqual(suprimirAntiga, false)

    // 3. Deve PERMITIR se a notificação recente já foi LIDA (lida === true)
    const notifLidaRecente = { ...notifNaoLidaRecente, lida: true }
    const suprimirLida = verificarThrottlingNotificacao('grupo_amplificado', 'grp-1', [notifLidaRecente])
    assert.strictEqual(suprimirLida, false)
  })

  it('Isolamento de falhas: erro ao gravar notificação não derruba o fluxo', async () => {
    const evento: EventoAuditoria = {
      ocorrencia_id: 'oc-iso-1',
      tipo_evento: 'escalonamento_sla',
      valor_novo: { prioridade: 'P1' },
      motivo: 'Teste de isolamento',
    }

    const mockNotifStore: Notificacao[] = []
    const ok = await processarERegistarNotificacoes(evento, mockNotifStore)
    assert.strictEqual(ok, true)
    assert.strictEqual(mockNotifStore.length, 1)
  })
})
