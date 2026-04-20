import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarEstoqueByGrupos, buscarSubgrupos } from '@/lib/autosystem'

const GRUPO_CONVENIENCIA = 9896787

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

  const [estoque, subgrupos] = await Promise.all([
    buscarEstoqueByGrupos(empresaIds, [GRUPO_CONVENIENCIA]),
    buscarSubgrupos(),
  ])

  const subgrupoLookup: Record<number, string> = {}
  for (const s of subgrupos) subgrupoLookup[s.grid] = s.nome

  const agg: Record<string, { produto: number; subgrupo: number | null; estoque_total: number; custo_sum: number; count: number; data_ref: string | null; nome: string; unid_med: string }> = {}
  for (const e of estoque as any[]) {
    if ((e.estoque ?? 0) <= 0) continue
    const key = `${e.empresa}|${e.produto}`
    if (!agg[key]) agg[key] = { produto: e.produto, subgrupo: e.subgrupo, estoque_total: 0, custo_sum: 0, count: 0, data_ref: null, nome: e.produto_nome, unid_med: e.unid_med ?? 'UN' }
    agg[key].estoque_total += e.estoque ?? 0
    agg[key].custo_sum     += e.custo_medio ?? 0
    agg[key].count         += 1
    if (!agg[key].data_ref || (e.data && e.data > agg[key].data_ref!)) agg[key].data_ref = e.data
  }

  const postoDataMap: Record<string, Record<string, any[]>> = {}
  for (const [key, row] of Object.entries(agg)) {
    const empresa_str = key.split('|')[0]
    const sub_nome = row.subgrupo ? (subgrupoLookup[row.subgrupo] ?? 'Sem subgrupo') : 'Sem subgrupo'
    if (!postoDataMap[empresa_str]) postoDataMap[empresa_str] = {}
    if (!postoDataMap[empresa_str][sub_nome]) postoDataMap[empresa_str][sub_nome] = []
    const custo_medio = row.count > 0 ? row.custo_sum / row.count : 0
    postoDataMap[empresa_str][sub_nome].push({
      produto: String(row.produto), produto_nome: row.nome, unid_med: row.unid_med,
      estoque_total: row.estoque_total, custo_medio, data_referencia: row.data_ref,
      valor_total: row.estoque_total * custo_medio,
    })
  }

  const dados = Object.entries(postoDataMap).map(([empresa, subgruposMap]) => {
    const subgrupos_posto = Object.entries(subgruposMap).map(([subgrupo_nome, prods]) => ({
      subgrupo_nome, produtos: prods.sort((a, b) => a.produto_nome.localeCompare(b.produto_nome)),
      total_valor: prods.reduce((s, p) => s + p.valor_total, 0), total_itens: prods.length,
    })).sort((a, b) => a.subgrupo_nome.localeCompare(b.subgrupo_nome))
    return { empresa, posto_nome: postoMap[empresa] ?? empresa, subgrupos: subgrupos_posto,
      total_valor: subgrupos_posto.reduce((s, g) => s + g.total_valor, 0),
      total_itens: subgrupos_posto.reduce((s, g) => s + g.total_itens, 0) }
  }).sort((a, b) => a.posto_nome.localeCompare(b.posto_nome))

  return NextResponse.json({ dados })
}
