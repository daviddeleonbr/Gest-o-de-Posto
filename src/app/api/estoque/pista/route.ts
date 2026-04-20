import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarEstoqueByGrupos, buscarGrupos } from '@/lib/autosystem'

const GRUPOS_PISTA = [45482, 45483, 45486, 45487, 45492, 16574993]

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

  const [estoque, grupos] = await Promise.all([
    buscarEstoqueByGrupos(empresaIds, GRUPOS_PISTA),
    buscarGrupos(),
  ])

  const grupoLookup: Record<number, string> = {}
  for (const g of grupos) grupoLookup[g.grid] = g.nome

  const agg: Record<string, { produto: number; grupo: number | null; estoque_total: number; custo_sum: number; count: number; data_ref: string | null; nome: string; unid_med: string }> = {}
  for (const e of estoque as any[]) {
    if ((e.estoque ?? 0) <= 0) continue
    const key = `${e.empresa}|${e.produto}`
    if (!agg[key]) agg[key] = { produto: e.produto, grupo: e.grupo, estoque_total: 0, custo_sum: 0, count: 0, data_ref: null, nome: e.produto_nome, unid_med: e.unid_med ?? 'UN' }
    agg[key].estoque_total += e.estoque ?? 0
    agg[key].custo_sum     += e.custo_medio ?? 0
    agg[key].count         += 1
    if (!agg[key].data_ref || (e.data && e.data > agg[key].data_ref!)) agg[key].data_ref = e.data
  }

  const postoDataMap: Record<string, Record<string, any[]>> = {}
  for (const [key, row] of Object.entries(agg)) {
    const empresa_str = key.split('|')[0]
    const grupo_nome = row.grupo ? (grupoLookup[row.grupo] ?? 'Outros') : 'Outros'
    if (!postoDataMap[empresa_str]) postoDataMap[empresa_str] = {}
    if (!postoDataMap[empresa_str][grupo_nome]) postoDataMap[empresa_str][grupo_nome] = []
    const custo_medio = row.count > 0 ? row.custo_sum / row.count : 0
    postoDataMap[empresa_str][grupo_nome].push({
      produto: String(row.produto), produto_nome: row.nome, unid_med: row.unid_med,
      estoque_total: row.estoque_total, custo_medio, data_referencia: row.data_ref,
      valor_total: row.estoque_total * custo_medio,
    })
  }

  const dados = Object.entries(postoDataMap).map(([empresa, gruposMap]) => {
    const grupos_posto = Object.entries(gruposMap).map(([grupo_nome, prods]) => ({
      grupo_nome, produtos: prods.sort((a, b) => a.produto_nome.localeCompare(b.produto_nome)),
      total_valor: prods.reduce((s, p) => s + p.valor_total, 0), total_itens: prods.length,
    })).sort((a, b) => a.grupo_nome.localeCompare(b.grupo_nome))
    return { empresa, posto_nome: postoMap[empresa] ?? empresa, grupos: grupos_posto,
      total_valor: grupos_posto.reduce((s, g) => s + g.total_valor, 0),
      total_itens: grupos_posto.reduce((s, g) => s + g.total_itens, 0) }
  }).sort((a, b) => a.posto_nome.localeCompare(b.posto_nome))

  return NextResponse.json({ dados })
}
