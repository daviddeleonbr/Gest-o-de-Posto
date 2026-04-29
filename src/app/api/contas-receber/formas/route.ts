import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buscarMovtosCRPorMotivos,
  buscarMotivosUsadosEmContas,
  buscarPessoas,
  buscarMotivos,
} from '@/lib/autosystem'

interface GrupoInfo { grupo: string; nome: string }
// Cada motivo aponta de volta para a chave original em cr_contas_grupo
// (uma 'motivo:NNN' ou uma conta '1.3.X'), preservando o agrupamento configurado.
interface MotivoOrigin extends GrupoInfo { originKey: string }

export async function GET(req: NextRequest) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const empresaId  = searchParams.get('empresa')
  const dataIniRaw = searchParams.get('data_ini') ?? searchParams.get('vencto_ini')
  const dataFimRaw = searchParams.get('data_fim') ?? searchParams.get('vencto_fim')

  const admin = createAdminClient()

  const { data: postos } = await admin
    .from('postos')
    .select('id, nome, codigo_empresa_externo')
    .not('codigo_empresa_externo', 'is', null)

  const postoMap: Record<string, string> = {}
  for (const p of postos ?? []) {
    if (p.codigo_empresa_externo) postoMap[p.codigo_empresa_externo] = p.nome
  }

  const empresaIds = (empresaId ? [empresaId] : Object.keys(postoMap)).map(Number)
  if (!empresaIds.length) return NextResponse.json({ resumo: [] })

  // ── 1. Lê configuração: motivos diretos + contas → grupo ─────────────────
  const { data: gruposData } = await admin
    .from('cr_contas_grupo')
    .select('conta_debitar, grupo, conta_nome')

  const motivoGrupoDireto: Record<number, GrupoInfo> = {}
  const contaGrupo:        Record<string, GrupoInfo> = {}

  for (const g of gruposData ?? []) {
    if (!g.grupo) continue
    if (g.conta_debitar.startsWith('motivo:')) {
      const grid = parseInt(g.conta_debitar.replace('motivo:', ''))
      if (!isNaN(grid)) motivoGrupoDireto[grid] = { grupo: g.grupo, nome: g.conta_nome ?? g.conta_debitar }
    } else {
      contaGrupo[g.conta_debitar] = { grupo: g.grupo, nome: g.conta_nome ?? g.conta_debitar }
    }
  }

  // ── 2. Descobre motivos das contas configuradas via DISTINCT ─────────────
  const contasArr = Object.keys(contaGrupo)
  const motivosViaConta = contasArr.length
    ? await buscarMotivosUsadosEmContas(empresaIds, contasArr)
    : []

  // motivo → origem (motivo direto tem prioridade sobre lookup via conta).
  // O originKey é o que vai virar `conta_debitar` na resposta — múltiplos motivos
  // que resolvem para a mesma conta colapsam em uma única linha no painel.
  const motivoToOrigin: Record<number, MotivoOrigin> = {}
  for (const [grid, info] of Object.entries(motivoGrupoDireto)) {
    motivoToOrigin[Number(grid)] = { originKey: `motivo:${grid}`, ...info }
  }
  for (const mv of motivosViaConta) {
    if (!motivoToOrigin[mv.motivo]) {
      const info = contaGrupo[mv.conta_debitar]
      if (info) motivoToOrigin[mv.motivo] = { originKey: mv.conta_debitar, ...info }
    }
  }

  const motivoGrids = Object.keys(motivoToOrigin).map(Number)
  if (!motivoGrids.length) return NextResponse.json({ resumo: [] })

  // ── 3. Query principal: todos os lançamentos do período (child=0 indica aberto) ──
  const dataIni = dataIniRaw || '1900-01-01'

  const movtosRaw = await buscarMovtosCRPorMotivos(empresaIds, motivoGrids, {
    dataIni,
    dataFim: dataFimRaw,
  })

  // ── 4. Lookups complementares ────────────────────────────────────────────
  const pessoaIds = [...new Set((movtosRaw as any[]).map(m => m.pessoa).filter(Boolean))] as number[]
  const pessoaLookup: Record<number, string> = {}
  if (pessoaIds.length) {
    const pessoas = await buscarPessoas(pessoaIds)
    for (const p of pessoas) pessoaLookup[p.grid] = p.nome ?? '(sem cliente)'
  }

  const motivoNomes = await buscarMotivos(motivoGrids)
  const motivoNomeLookup: Record<number, string> = {}
  for (const mn of motivoNomes) motivoNomeLookup[mn.grid] = mn.nome ?? ''

  // ── 5. Agrega por origem|empresa|pessoa|mes_emissão|pago ────────────────
  // A chave usa `originKey` (a entrada de cr_contas_grupo) — assim várias
  // motivos que apontam pra mesma conta colapsam em uma linha só.
  const agg: Record<string, {
    conta_debitar: string; conta_nome: string; empresa: string
    pessoa_nome: string; mes: string; pago: boolean; qtd: number; valor_total: number
    grupo: string | null
  }> = {}

  for (const m of movtosRaw as any[]) {
    const motivoGrid  = Number(m.motivo)
    const origin      = motivoToOrigin[motivoGrid]
    if (!origin) continue
    const pessoa_nome = m.pessoa ? (pessoaLookup[m.pessoa] ?? '(sem cliente)') : '(sem cliente)'
    const mes         = ((m.data as string | null) ?? '').slice(0, 7)
    // child = 0 → título em aberto; qualquer outro valor → já recebido
    const childVal    = m.child as number | null
    const pago        = childVal !== null && childVal !== 0
    const key         = `${origin.originKey}|${m.empresa}|${pessoa_nome}|${mes}|${pago}`
    if (!agg[key]) agg[key] = {
      conta_debitar: origin.originKey,
      conta_nome:    origin.nome ?? motivoNomeLookup[motivoGrid] ?? origin.originKey,
      empresa:       String(m.empresa),
      pessoa_nome,
      mes,
      pago,
      qtd:           0,
      valor_total:   0,
      grupo:         origin.grupo,
    }
    agg[key].qtd         += 1
    agg[key].valor_total += m.valor ?? 0
  }

  const rows = Object.values(agg).map(r => ({
    ...r,
    posto_nome: postoMap[r.empresa] ?? r.empresa,
  }))

  return NextResponse.json({ resumo: rows })
  } catch (err: any) {
    console.error('[contas-receber/formas]', err)
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 })
  }
}
