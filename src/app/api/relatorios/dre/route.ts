import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buscarContasPorGrid,
  aggregarMovtoPorContaPorMes,
  aggregarVendasCustosPorGrupoPorMes,
} from '@/lib/autosystem'

// ─── Tipos da resposta ────────────────────────────────────────

export interface DreLinhaResultado {
  id:             string
  parent_id:      string | null
  ordem:          number
  nome:           string
  tipo_linha:     'grupo' | 'subtotal'
  depth:          number
  valoresPorMes:  number[]   // alinhado com `meses`
  total:          number
  // Indica se a linha tem mapeamentos (para mostrar chevron de drill-down)
  tem_mapeamento: boolean
}

export interface DreResponse {
  meses:    string[]      // 'YYYY-MM'
  linhas:   DreLinhaResultado[]
  periodo:  { dataIni: string; dataFim: string }
  empresas: number
}

interface MascaraLinhaRow {
  id:         string
  parent_id:  string | null
  ordem:      number
  nome:       string
  tipo_linha: 'grupo' | 'subtotal'
}

// ─── Helpers ──────────────────────────────────────────────────

// Calcula janela (dataIni, dataFim) e a lista de meses 'YYYY-MM' incluídos,
// retroagindo a partir do mês de referência.
//
// Exemplo: ref=2026-03, meses=3 → janeiro, fevereiro e março de 2026.
//          dataIni=2026-01-01, dataFim=2026-03-31, mesesISO=['2026-01','2026-02','2026-03']
function calcularJanela(meses: number, refAno: number, refMes: number): {
  dataIni:  string
  dataFim:  string
  mesesISO: string[]
} {
  // refMes: 1-12. Construímos primeiro do mês ref e último dia (= dia 0 do mês seguinte).
  const dataFim = new Date(refAno, refMes, 0)         // último dia de refMes
  const dataIni = new Date(refAno, refMes - meses, 1) // 1º dia de (refMes - meses + 1)

  const mesesISO: string[] = []
  for (let i = 0; i < meses; i++) {
    const d = new Date(refAno, refMes - meses + i, 1)
    mesesISO.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { dataIni: fmt(dataIni), dataFim: fmt(dataFim), mesesISO }
}

// Lê ?ref=YYYY-MM (default: mês atual)
function lerRef(sp: URLSearchParams): { refAno: number; refMes: number } {
  const ref = sp.get('ref')
  if (ref && /^\d{4}-\d{2}$/.test(ref)) {
    const [a, m] = ref.split('-').map(Number)
    if (m >= 1 && m <= 12) return { refAno: a, refMes: m }
  }
  const hoje = new Date()
  return { refAno: hoje.getFullYear(), refMes: hoje.getMonth() + 1 }
}

// ─── GET ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mascaraId  = searchParams.get('mascara_id')
  const periodoStr = searchParams.get('periodo')  // '1' | '3' | '6'
  const periodoMeses = Number(periodoStr) || 3
  if (![1, 3, 6].includes(periodoMeses)) {
    return NextResponse.json({ error: 'periodo deve ser 1, 3 ou 6' }, { status: 400 })
  }
  if (!mascaraId) {
    return NextResponse.json({ error: 'mascara_id é obrigatório' }, { status: 400 })
  }

  const { refAno, refMes } = lerRef(searchParams)
  const { dataIni, dataFim, mesesISO } = calcularJanela(periodoMeses, refAno, refMes)
  const admin = createAdminClient()

  // 1. Linhas + mapeamentos da máscara
  const [linhasResp, mapContasResp, mapGruposResp] = await Promise.all([
    admin.from('mascaras_linhas').select('id, parent_id, ordem, nome, tipo_linha').eq('mascara_id', mascaraId),
    admin.from('mascaras_mapeamentos').select('linha_id, conta_grid').eq('mascara_id', mascaraId),
    admin.from('mascaras_mapeamentos_grupos').select('linha_id, grupo_grid, tipo_valor').eq('mascara_id', mascaraId),
  ])

  if (linhasResp.error || mapContasResp.error || mapGruposResp.error) {
    return NextResponse.json({
      error: linhasResp.error?.message ?? mapContasResp.error?.message ?? mapGruposResp.error?.message,
    }, { status: 500 })
  }

  const linhas = (linhasResp.data ?? []) as MascaraLinhaRow[]
  const mapContas = (mapContasResp.data ?? []).map(r => ({
    linha_id: r.linha_id, conta_grid: String(r.conta_grid),
  }))
  const mapGrupos = (mapGruposResp.data ?? []).map(r => ({
    linha_id: r.linha_id, grupo_grid: String(r.grupo_grid),
    tipo_valor: r.tipo_valor as 'venda' | 'custo',
  }))

  // Set de linhas com mapeamentos (para mostrar chevron de drill-down)
  const linhasComMapeamento = new Set<string>([
    ...mapContas.map(m => m.linha_id),
    ...mapGrupos.map(m => m.linha_id),
  ])

  if (!linhas.length) {
    return NextResponse.json({
      meses: mesesISO,
      linhas: [],
      periodo: { dataIni, dataFim },
      empresas: 0,
    } as DreResponse)
  }

  // 2. Empresas do tenant
  const { data: postos } = await admin
    .from('postos')
    .select('codigo_empresa_externo')
    .not('codigo_empresa_externo', 'is', null)
    .eq('ativo', true)
  const empresaIds = Array.from(new Set(
    (postos ?? []).map(p => Number(p.codigo_empresa_externo)).filter(n => !Number.isNaN(n))
  ))

  // 3. Detalhes das contas mapeadas + agregações no AUTOSYSTEM
  const contaGrids = Array.from(new Set(mapContas.map(m => m.conta_grid)))
  const grupoGrids = Array.from(new Set(mapGrupos.map(m => m.grupo_grid)))

  let contasDetalhes: { grid: string; codigo: string; natureza: 'Débito' | 'Crédito' }[] = []
  let movtosAgregados:  { codigo: string; mes: string; total_debitar: number; total_creditar: number }[] = []
  let vendasCustos:     { grupo_grid: string; mes: string; total_venda: number; total_custo: number }[] = []

  try {
    if (contaGrids.length > 0) {
      const detalhes = await buscarContasPorGrid(contaGrids)
      contasDetalhes = detalhes.map(d => ({ grid: String(d.grid), codigo: d.codigo, natureza: d.natureza }))
      const codigos = contasDetalhes.map(c => c.codigo)
      if (codigos.length > 0 && empresaIds.length > 0) {
        const movtos = await aggregarMovtoPorContaPorMes(empresaIds, dataIni, dataFim, codigos)
        movtosAgregados = movtos.map(m => ({
          codigo: m.codigo,
          mes: m.mes,
          total_debitar:  Number(m.total_debitar) || 0,
          total_creditar: Number(m.total_creditar) || 0,
        }))
      }
    }
    if (grupoGrids.length > 0 && empresaIds.length > 0) {
      const vc = await aggregarVendasCustosPorGrupoPorMes(empresaIds, dataIni, dataFim, grupoGrids)
      vendasCustos = vc.map(v => ({
        grupo_grid:  String(v.grupo_grid),
        mes: v.mes,
        total_venda: Number(v.total_venda) || 0,
        total_custo: Number(v.total_custo) || 0,
      }))
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar AUTOSYSTEM'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 4. Calcula valor por linha por mês
  const codigoByGrid = new Map(contasDetalhes.map(c => [c.grid, c.codigo]))

  // valoresPorLinha[linhaId] = { mesISO: valor }
  const valoresPorLinha = new Map<string, Map<string, number>>()
  linhas.forEach(l => {
    const m = new Map<string, number>()
    mesesISO.forEach(mes => m.set(mes, 0))
    valoresPorLinha.set(l.id, m)
  })

  // Contas
  for (const m of mapContas) {
    const codigo = codigoByGrid.get(m.conta_grid)
    if (!codigo) continue
    for (const reg of movtosAgregados) {
      if (reg.codigo !== codigo) continue
      const linhaMap = valoresPorLinha.get(m.linha_id)
      if (!linhaMap) continue
      const balance = reg.total_creditar - reg.total_debitar
      linhaMap.set(reg.mes, (linhaMap.get(reg.mes) ?? 0) + balance)
    }
  }

  // Grupos
  for (const m of mapGrupos) {
    for (const reg of vendasCustos) {
      if (reg.grupo_grid !== m.grupo_grid) continue
      const linhaMap = valoresPorLinha.get(m.linha_id)
      if (!linhaMap) continue
      const v = m.tipo_valor === 'venda' ? reg.total_venda : reg.total_custo
      linhaMap.set(reg.mes, (linhaMap.get(reg.mes) ?? 0) + v)
    }
  }

  // 5. Árvore + roll-up
  type Node = { linha: MascaraLinhaRow; children: Node[] }
  const byId = new Map<string, Node>()
  linhas.forEach(l => byId.set(l.id, { linha: l, children: [] }))
  const roots: Node[] = []
  linhas.forEach(l => {
    const n = byId.get(l.id)!
    if (l.parent_id && byId.has(l.parent_id)) byId.get(l.parent_id)!.children.push(n)
    else roots.push(n)
  })
  const sortChildren = (nodes: Node[]) => {
    nodes.sort((a, b) => a.linha.ordem - b.linha.ordem)
    nodes.forEach(n => sortChildren(n.children))
  }
  sortChildren(roots)

  // Roll-up de grupos: pai com filhos soma os filhos (post-order, por mês)
  function rollUpGrupos(node: Node) {
    for (const c of node.children) rollUpGrupos(c)
    if (node.linha.tipo_linha === 'grupo' && node.children.length > 0) {
      const myMap = valoresPorLinha.get(node.linha.id)!
      for (const mes of mesesISO) {
        let sum = 0
        for (const c of node.children) {
          sum += valoresPorLinha.get(c.linha.id)?.get(mes) ?? 0
        }
        myMap.set(mes, (myMap.get(mes) ?? 0) + sum)
      }
    }
  }
  for (const r of roots) rollUpGrupos(r)

  // Subtotais: soma dos irmãos não-subtotal anteriores no mesmo nível, por mês
  function computeSubtotals(siblings: Node[]) {
    for (let i = 0; i < siblings.length; i++) {
      const node = siblings[i]
      computeSubtotals(node.children)
      if (node.linha.tipo_linha === 'subtotal') {
        const myMap = valoresPorLinha.get(node.linha.id)!
        for (const mes of mesesISO) {
          let sum = 0
          for (let j = 0; j < i; j++) {
            if (siblings[j].linha.tipo_linha !== 'subtotal') {
              sum += valoresPorLinha.get(siblings[j].linha.id)?.get(mes) ?? 0
            }
          }
          myMap.set(mes, sum)
        }
      }
    }
  }
  computeSubtotals(roots)

  // 6. Achata
  const out: DreLinhaResultado[] = []
  function flatten(nodes: Node[], depth: number) {
    for (const n of nodes) {
      const m = valoresPorLinha.get(n.linha.id)!
      const valoresPorMes = mesesISO.map(mes => m.get(mes) ?? 0)
      const total = valoresPorMes.reduce((s, v) => s + v, 0)
      out.push({
        id:             n.linha.id,
        parent_id:      n.linha.parent_id,
        ordem:          n.linha.ordem,
        nome:           n.linha.nome,
        tipo_linha:     n.linha.tipo_linha,
        depth,
        valoresPorMes,
        total,
        tem_mapeamento: linhasComMapeamento.has(n.linha.id),
      })
      flatten(n.children, depth + 1)
    }
  }
  flatten(roots, 0)

  const resp: DreResponse = {
    meses: mesesISO,
    linhas: out,
    periodo: { dataIni, dataFim },
    empresas: empresaIds.length,
  }
  return NextResponse.json(resp)
}
