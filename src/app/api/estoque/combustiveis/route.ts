import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarEstoqueByGrupos } from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const empresaId = searchParams.get('empresa')

  const admin = createAdminClient()
  const { data: postos } = await admin
    .from('postos').select('id, nome, codigo_empresa_externo')
    .not('codigo_empresa_externo', 'is', null)

  const postoMap: Record<string, string> = {}
  for (const p of postos ?? []) {
    if (p.codigo_empresa_externo) postoMap[p.codigo_empresa_externo] = p.nome
  }

  const empresaIds = (empresaId ? [empresaId] : Object.keys(postoMap)).map(Number)
  if (!empresaIds.length) return NextResponse.json({ dados: [] })

  const estoque = await buscarEstoqueByGrupos(empresaIds, [45481])

  const agg: Record<string, { produto: number; estoque_total: number; custo_sum: number; count: number; data_ref: string | null; nome: string; unid_med: string; tipo_combustivel: number | null }> = {}
  for (const e of estoque as any[]) {
    if ((e.estoque ?? 0) <= 0) continue
    const key = `${e.empresa}|${e.produto}`
    if (!agg[key]) agg[key] = { produto: e.produto, estoque_total: 0, custo_sum: 0, count: 0, data_ref: null, nome: e.produto_nome, unid_med: e.unid_med ?? 'L', tipo_combustivel: e.tipo_combustivel }
    agg[key].estoque_total += e.estoque ?? 0
    agg[key].custo_sum     += e.custo_medio ?? 0
    agg[key].count         += 1
    if (!agg[key].data_ref || (e.data && e.data > agg[key].data_ref!)) agg[key].data_ref = e.data
  }

  const postoDataMap: Record<string, any[]> = {}
  for (const [key, row] of Object.entries(agg)) {
    const empresa_str = key.split('|')[0]
    if (!postoDataMap[empresa_str]) postoDataMap[empresa_str] = []
    const custo_medio = row.count > 0 ? row.custo_sum / row.count : 0
    postoDataMap[empresa_str].push({
      produto: String(row.produto), produto_nome: row.nome, unid_med: row.unid_med,
      tipo_combustivel: row.tipo_combustivel, estoque_total: row.estoque_total,
      custo_medio, data_referencia: row.data_ref, valor_total: row.estoque_total * custo_medio,
    })
  }

  const dados = Object.entries(postoDataMap).map(([empresa, produtos_posto]) => ({
    empresa, posto_nome: postoMap[empresa] ?? empresa,
    produtos:    produtos_posto.sort((a, b) => a.produto_nome.localeCompare(b.produto_nome)),
    total_valor: produtos_posto.reduce((s, p) => s + p.valor_total, 0),
    total_itens: produtos_posto.length,
  })).sort((a, b) => a.posto_nome.localeCompare(b.posto_nome))

  return NextResponse.json({ dados })
}
