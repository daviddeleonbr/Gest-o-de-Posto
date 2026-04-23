import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarMovtosAutosystem, calcularMovimento } from '@/lib/autosystem'

const CRON_SECRET = process.env.CRON_SECRET ?? 'cron-interno-gestao'

function gerarDatas(ini: string, fim: string): string[] {
  const datas: string[] = []
  const cur = new Date(ini + 'T12:00:00')
  const end = new Date(fim + 'T12:00:00')
  while (cur <= end && datas.length < 60) {
    datas.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return datas
}

async function criarNotificacoes(
  admin: ReturnType<typeof createAdminClient>,
  usuarioIds: string[],
  titulo: string,
  mensagem: string,
  tarefaId: string,
  postoNome: string,
) {
  if (!usuarioIds.length) return
  const registros = usuarioIds.map(uid => ({
    usuario_id: uid,
    tipo:       'divergencia_extrato',
    titulo,
    mensagem,
    tarefa_id:  tarefaId,
    posto_nome: postoNome,
  }))
  await admin.from('notificacoes').insert(registros)
}

// POST /api/cron/verificar-extratos
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== CRON_SECRET)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()

  // 1. Todos os extratos validados (ok ou divergente)
  const { data: tarefas } = await admin
    .from('tarefas')
    .select(`
      id, titulo, extrato_data, extrato_periodo_ini,
      extrato_movimento, extrato_saldo_externo, extrato_status,
      posto_id,
      posto:postos(id, nome, codigo_empresa_externo),
      recorrente:tarefas_recorrentes(posto_id, usuario_id,
        posto:postos(id, nome, codigo_empresa_externo))
    `)
    .eq('categoria', 'conciliacao_bancaria')
    .in('extrato_status', ['ok', 'divergente'])
    .not('extrato_arquivo_path', 'is', null)
    .not('extrato_data', 'is', null)

  if (!tarefas?.length) return NextResponse.json({ verificadas: 0, divergentes: 0, notificados: 0 })

  // 2. Notificações não lidas já existentes para evitar duplicatas
  const tarefaIds = tarefas.map(t => t.id)
  const { data: notifExistentes } = await admin
    .from('notificacoes')
    .select('tarefa_id')
    .in('tarefa_id', tarefaIds)
    .eq('lida', false)
    .eq('tipo', 'divergencia_extrato')

  const tarefasJaNotificadas = new Set((notifExistentes ?? []).map(n => n.tarefa_id as string))

  // 3. Contas bancárias mapeadas
  const { data: contasBancarias } = await admin
    .from('contas_bancarias')
    .select('posto_id, codigo_conta_externo')
    .not('codigo_conta_externo', 'is', null)

  const contaMap: Record<string, string> = {}
  for (const c of contasBancarias ?? []) {
    if (c.posto_id && !contaMap[c.posto_id]) contaMap[c.posto_id] = c.codigo_conta_externo!
  }

  // 4. Usuários master e admin para notificação global
  const { data: masterAdmins } = await admin
    .from('usuarios')
    .select('id')
    .in('role', ['master', 'admin'])

  const masterAdminIds = (masterAdmins ?? []).map(u => u.id as string)

  let verificadas = 0
  let divergentes = 0
  let notificados = 0

  for (const t of tarefas) {
    const posto = (t.posto as any) ?? (t.recorrente as any)?.posto ?? null
    if (!posto?.codigo_empresa_externo) continue

    const empresaId = parseInt(posto.codigo_empresa_externo)
    if (isNaN(empresaId)) continue

    const postoId = t.posto_id ?? (t.recorrente as any)?.posto_id ?? posto?.id ?? null
    const contaCodigo: string | null = postoId ? (contaMap[postoId] ?? null) : null
    // Sempre verifica só o dia específico da tarefa — extrato_periodo_ini é apenas
    // metadado do arquivo que foi usado (multi-dias), não o range a re-verificar.
    const dataFim = t.extrato_data as string
    const datas   = [dataFim]

    let movAtual: number
    try {
      const movtos = await buscarMovtosAutosystem(empresaId, datas)
      if (contaCodigo) {
        const entradas = movtos.filter(m => m.conta_debitar  === contaCodigo).reduce((s, m) => s + m.valor, 0)
        const saidas   = movtos.filter(m => m.conta_creditar === contaCodigo).reduce((s, m) => s + m.valor, 0)
        movAtual = parseFloat((entradas - saidas).toFixed(2))
      } else {
        movAtual = calcularMovimento(movtos, null)
      }
    } catch {
      continue
    }

    verificadas++
    const movExtrato   = t.extrato_movimento as number
    const diferenca    = parseFloat((movExtrato - movAtual).toFixed(2))
    const isDivergente = Math.abs(diferenca) > 0.02

    if (isDivergente) {
      divergentes++

      // Atualiza banco
      await admin.from('tarefas').update({
        extrato_saldo_externo: movAtual,
        extrato_diferenca:     diferenca,
        extrato_status:        'divergente',
      }).eq('id', t.id)

      // Notifica apenas se ainda não há notificação não lida para esta tarefa
      if (!tarefasJaNotificadas.has(t.id)) {
        const postoNome = posto.nome ?? 'Posto'
        const dataFmt   = new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')
        const difFmt    = Math.abs(diferenca).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        const titulo    = `Divergência detectada — ${postoNome}`
        const mensagem  = `O extrato de ${dataFmt} está divergente. Diferença: ${diferenca > 0 ? '+' : ''}${difFmt}. A conciliação precisa ser refeita.`

        const responsavelId: string | null = (t.recorrente as any)?.usuario_id ?? null
        const destinos = [...new Set([...masterAdminIds, ...(responsavelId ? [responsavelId] : [])])]

        await criarNotificacoes(admin, destinos, titulo, mensagem, t.id, postoNome)
        notificados++
      }
    } else {
      // Estava divergente e voltou a bater — limpa o status e notifica resolução
      if ((t.extrato_status as string) === 'divergente') {
        await admin.from('tarefas').update({
          extrato_saldo_externo: movAtual,
          extrato_diferenca:     0,
          extrato_status:        'ok',
        }).eq('id', t.id)

        const postoNome = posto.nome ?? 'Posto'
        const dataFmt   = new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')
        const titulo    = `Divergência resolvida — ${postoNome}`
        const mensagem  = `O extrato de ${dataFmt} voltou a bater com o AUTOSYSTEM. Conciliação OK.`

        const responsavelId: string | null = (t.recorrente as any)?.usuario_id ?? null
        const destinos = [...new Set([...masterAdminIds, ...(responsavelId ? [responsavelId] : [])])]

        const registros = destinos.map(uid => ({
          usuario_id: uid,
          tipo:       'divergencia_resolvida',
          titulo,
          mensagem,
          tarefa_id:  t.id,
          posto_nome: postoNome,
        }))
        await admin.from('notificacoes').insert(registros)
      }
    }
  }

  console.log(`[cron-extratos] ${new Date().toISOString()} — verificadas: ${verificadas}, divergentes: ${divergentes}, notificados: ${notificados}`)
  return NextResponse.json({ verificadas, divergentes, notificados })
}
