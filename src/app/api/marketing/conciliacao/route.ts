import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarTodosMotivos, buscarMovtosPorMotivo } from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dataIni = searchParams.get('data_ini') ?? `${new Date().getFullYear()}-01-01`
  const dataFim = searchParams.get('data_fim') ?? new Date().toISOString().slice(0, 10)

  const admin = createAdminClient()

  const { data: postos } = await admin
    .from('postos')
    .select('id, nome, codigo_empresa_externo')
    .not('codigo_empresa_externo', 'is', null)

  const postoMap: Record<string, { id: string; nome: string }> = {}
  for (const p of postos ?? []) {
    if (p.codigo_empresa_externo) postoMap[p.codigo_empresa_externo] = { id: p.id, nome: p.nome }
  }

  const empresaIds = Object.keys(postoMap).map(Number)
  if (!empresaIds.length) return NextResponse.json({ resultado: [] })

  const todosMotivos = await buscarTodosMotivos()
  const motivosFiltrados = todosMotivos.filter(m =>
    m.nome?.toLowerCase().includes('marketing') || m.nome?.toLowerCase().includes('patroc')
  )
  const motivoLookup: Record<number, string> = {}
  for (const m of todosMotivos) motivoLookup[m.grid] = m.nome ?? ''
  const motivoGrids = motivosFiltrados.map(m => m.grid)

  if (!motivoGrids.length) {
    const { data: patrocinios } = await admin
      .from('marketing_patrocinios')
      .select('id, posto_id, valor, data_evento, status, movto_mlid_externo, valor_externo, divergencia, conciliado, postos(nome)')
      .in('status', ['pendente','aprovado'])
      .gte('data_evento', dataIni)
      .lte('data_evento', dataFim)

    const soSistema = (patrocinios ?? []).map((p: any) => ({
      tipo: 'patrocinio',
      posto_id: p.posto_id,
      posto_nome: (p.postos as any)?.nome ?? p.posto_id,
      valor: p.valor,
      data: p.data_evento,
      status_conciliacao: 'so_sistema',
      interno: p,
      movimento_externo: null,
    }))
    return NextResponse.json({ movimentos_externo: 0, resultado: soSistema })
  }

  const movtosRaw = await buscarMovtosPorMotivo(empresaIds, motivoGrids, dataIni, dataFim)

  const movimentos = (movtosRaw as any[]).map(m => ({
    mlid:        m.mlid,
    empresa_cod: String(m.empresa),
    valor:       m.valor,
    motivo:      motivoLookup[m.motivo ?? 0] ?? String(m.motivo),
    data:        m.data,
    vencto:      m.vencto,
    documento:   m.documento,
    child:       m.child,
    baixado:     m.child !== null && m.child !== 0,
    posto_id:    postoMap[String(m.empresa)]?.id   ?? null,
    posto_nome:  postoMap[String(m.empresa)]?.nome ?? String(m.empresa),
    tipo:        (motivoLookup[m.motivo ?? 0] ?? '').toLowerCase().includes('patroc') ? 'patrocinio' : 'acao',
  }))

  const [patrociniosRes, acaoPostosRes] = await Promise.all([
    admin
      .from('marketing_patrocinios')
      .select('id, posto_id, valor, data_evento, status, movto_mlid_externo, valor_externo, divergencia, conciliado, postos(nome)')
      .in('status', ['pendente','aprovado'])
      .gte('data_evento', dataIni)
      .lte('data_evento', dataFim),
    admin
      .from('marketing_acao_postos')
      .select(`id, posto_id, valor, status, movto_mlid_externo, valor_externo, divergencia, conciliado, postos(nome), marketing_acoes(titulo, data_acao, valor_padrao)`)
      .in('status', ['enviado','aprovado'])
      .not('marketing_acoes', 'is', null),
  ])

  const patrocinios = patrociniosRes.data
  const acaoPostos  = acaoPostosRes.data

  const resultadoConciliacao = movimentos.map(mov => {
    const candidatos = [
      ...(patrocinios ?? []).filter((p: any) =>
        p.posto_id === mov.posto_id &&
        Math.abs(p.valor - mov.valor) / mov.valor <= 0.05 &&
        Math.abs(new Date(p.data_evento).getTime() - new Date(mov.data).getTime()) <= 3 * 86400000
      ).map((p: any) => ({ ...p, _origem: 'patrocinio' })),
      ...(acaoPostos ?? []).filter((ap: any) => {
        const valorAp = ap.valor ?? ap.marketing_acoes?.valor_padrao ?? 0
        const dataAp  = ap.marketing_acoes?.data_acao ?? ''
        return ap.posto_id === mov.posto_id &&
          Math.abs(valorAp - mov.valor) / mov.valor <= 0.05 &&
          Math.abs(new Date(dataAp).getTime() - new Date(mov.data).getTime()) <= 3 * 86400000
      }).map((ap: any) => ({ ...ap, _origem: 'acao' })),
    ]

    if (!candidatos.length) return { ...mov, status_conciliacao: 'so_caixa', interno: null }

    const interno = candidatos[0]
    const valorInterno = interno._origem === 'acao'
      ? (interno.valor ?? interno.marketing_acoes?.valor_padrao ?? 0)
      : interno.valor
    const diverge = Math.abs(valorInterno - mov.valor) > 0.01
    return {
      ...mov,
      status_conciliacao: diverge ? 'divergencia' : 'conciliado',
      interno,
      divergencia_valor: diverge ? (valorInterno - mov.valor) : 0,
    }
  })

  const mlidsEncontrados = new Set(resultadoConciliacao.filter(r => r.interno).map(r => (r as any).interno?.id))
  const soSistema = (patrocinios ?? [])
    .filter((p: any) => !mlidsEncontrados.has(p.id))
    .map((p: any) => ({
      tipo: 'patrocinio',
      posto_id: p.posto_id,
      posto_nome: (p.postos as any)?.nome ?? p.posto_id,
      valor: p.valor,
      data: p.data_evento,
      status_conciliacao: 'so_sistema',
      interno: p,
      movimento_externo: null,
    }))

  return NextResponse.json({
    movimentos_externo: movimentos.length,
    resultado: [...resultadoConciliacao, ...soSistema],
  })
}
