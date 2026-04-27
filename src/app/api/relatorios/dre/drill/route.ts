import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buscarContasPorGrid,
  buscarGruposProduto,
  aggregarMovtoPorContaPorMes,
  aggregarVendasCustosPorGrupoPorMes,
  listarMovtoConta,
  listarLanctoGrupo,
} from '@/lib/autosystem'

// ─── Tipos ────────────────────────────────────────────────────

export interface DrillContaItem {
  tipo:           'conta'
  conta_grid:     string
  codigo:         string
  nome:           string
  natureza:       'Débito' | 'Crédito'
  valoresPorMes:  number[]
  total:          number
}

export interface DrillGrupoItem {
  tipo:           'grupo'
  grupo_grid:     string
  codigo:         number
  nome:           string
  tipo_valor:     'venda' | 'custo'
  valoresPorMes:  number[]
  total:          number
}

export type DrillItem = DrillContaItem | DrillGrupoItem

export interface DrillLinhaResponse {
  modo:    'linha'
  meses:   string[]
  itens:   DrillItem[]
}

export interface DrillLancamento {
  data:       string  // mantido apenas para colocar o valor na coluna do mês correto
  observacao: string | null
  valor:      number
}

export interface DrillLancamentosResponse {
  modo:        'lancamentos'
  lancamentos: DrillLancamento[]
  truncado:    boolean
}

// ─── Helpers ──────────────────────────────────────────────────

function calcularJanela(meses: number, refAno: number, refMes: number) {
  const dataFim = new Date(refAno, refMes, 0)
  const dataIni = new Date(refAno, refMes - meses, 1)
  const mesesISO: string[] = []
  for (let i = 0; i < meses; i++) {
    const d = new Date(refAno, refMes - meses + i, 1)
    mesesISO.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { dataIni: fmt(dataIni), dataFim: fmt(dataFim), mesesISO }
}

function lerRef(sp: URLSearchParams): { refAno: number; refMes: number } {
  const ref = sp.get('ref')
  if (ref && /^\d{4}-\d{2}$/.test(ref)) {
    const [a, m] = ref.split('-').map(Number)
    if (m >= 1 && m <= 12) return { refAno: a, refMes: m }
  }
  const hoje = new Date()
  return { refAno: hoje.getFullYear(), refMes: hoje.getMonth() + 1 }
}

async function getEmpresaIds(admin: ReturnType<typeof createAdminClient>) {
  const { data: postos } = await admin
    .from('postos')
    .select('codigo_empresa_externo')
    .not('codigo_empresa_externo', 'is', null)
    .eq('ativo', true)
  return Array.from(new Set(
    (postos ?? []).map(p => Number(p.codigo_empresa_externo)).filter(n => !Number.isNaN(n))
  ))
}

// ─── GET ──────────────────────────────────────────────────────
//
// Modos:
//  - mode=linha      → Lista contas/grupos mapeados a uma linha, com valores por mês.
//                      Params: linha_id, mascara_id, periodo
//  - mode=lancamentos→ Lista lançamentos individuais de uma conta OU grupo.
//                      Params: target='conta'|'grupo', codigo (conta) ou grupo_grid+tipo_valor, periodo

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const sp = new URL(req.url).searchParams
  const mode = sp.get('mode')
  const periodoMeses = Number(sp.get('periodo')) || 3
  if (![1, 3, 6].includes(periodoMeses)) {
    return NextResponse.json({ error: 'periodo deve ser 1, 3 ou 6' }, { status: 400 })
  }

  const { refAno, refMes } = lerRef(sp)
  const { dataIni, dataFim, mesesISO } = calcularJanela(periodoMeses, refAno, refMes)
  const admin = createAdminClient()
  const empresaIds = await getEmpresaIds(admin)

  // ── MODE: LINHA ───────────────────────────────────────────
  if (mode === 'linha') {
    const linhaId   = sp.get('linha_id')
    const mascaraId = sp.get('mascara_id')
    if (!linhaId || !mascaraId) {
      return NextResponse.json({ error: 'linha_id e mascara_id são obrigatórios' }, { status: 400 })
    }

    const [mc, mg] = await Promise.all([
      admin.from('mascaras_mapeamentos').select('conta_grid').eq('mascara_id', mascaraId).eq('linha_id', linhaId),
      admin.from('mascaras_mapeamentos_grupos').select('grupo_grid, tipo_valor').eq('mascara_id', mascaraId).eq('linha_id', linhaId),
    ])

    if (mc.error || mg.error) {
      return NextResponse.json({ error: mc.error?.message ?? mg.error?.message }, { status: 500 })
    }

    const contaGrids = (mc.data ?? []).map(r => String(r.conta_grid))
    const grupoMaps  = (mg.data ?? []).map(r => ({
      grupo_grid: String(r.grupo_grid),
      tipo_valor: r.tipo_valor as 'venda' | 'custo',
    }))

    const itens: DrillItem[] = []
    try {
      // Contas
      if (contaGrids.length > 0) {
        const detalhes = await buscarContasPorGrid(contaGrids)
        const codigos = detalhes.map(d => d.codigo)
        const movtos = empresaIds.length && codigos.length
          ? await aggregarMovtoPorContaPorMes(empresaIds, dataIni, dataFim, codigos)
          : []
        const balPorCodMes = new Map<string, Map<string, number>>()  // codigo → mes → balance
        for (const m of movtos) {
          if (!balPorCodMes.has(m.codigo)) balPorCodMes.set(m.codigo, new Map())
          const bal = Number(m.total_creditar) - Number(m.total_debitar)
          balPorCodMes.get(m.codigo)!.set(m.mes, bal)
        }
        for (const d of detalhes) {
          const valoresPorMes = mesesISO.map(mes => balPorCodMes.get(d.codigo)?.get(mes) ?? 0)
          itens.push({
            tipo: 'conta',
            conta_grid: String(d.grid),
            codigo:   d.codigo,
            nome:     d.nome,
            natureza: d.natureza,
            valoresPorMes,
            total:    valoresPorMes.reduce((s, v) => s + v, 0),
          })
        }
      }

      // Grupos
      if (grupoMaps.length > 0) {
        const grupoGrids = Array.from(new Set(grupoMaps.map(g => g.grupo_grid)))
        const todosGrupos = await buscarGruposProduto()
        const grupoInfoById = new Map(todosGrupos.map(g => [String(g.id), g]))
        const vc = empresaIds.length
          ? await aggregarVendasCustosPorGrupoPorMes(empresaIds, dataIni, dataFim, grupoGrids)
          : []
        const vcByGrid = new Map<string, Map<string, { total_venda: number; total_custo: number }>>()
        for (const v of vc) {
          if (!vcByGrid.has(String(v.grupo_grid))) vcByGrid.set(String(v.grupo_grid), new Map())
          vcByGrid.get(String(v.grupo_grid))!.set(v.mes, {
            total_venda: Number(v.total_venda),
            total_custo: Number(v.total_custo),
          })
        }
        for (const m of grupoMaps) {
          const info = grupoInfoById.get(m.grupo_grid)
          const valoresPorMes = mesesISO.map(mes => {
            const data = vcByGrid.get(m.grupo_grid)?.get(mes)
            if (!data) return 0
            return m.tipo_valor === 'venda' ? data.total_venda : data.total_custo
          })
          itens.push({
            tipo: 'grupo',
            grupo_grid: m.grupo_grid,
            codigo: info?.codigo ?? 0,
            nome:   info?.nome ?? m.grupo_grid,
            tipo_valor: m.tipo_valor,
            valoresPorMes,
            total: valoresPorMes.reduce((s, v) => s + v, 0),
          })
        }
      }

      const resp: DrillLinhaResponse = { modo: 'linha', meses: mesesISO, itens }
      return NextResponse.json(resp)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao consultar AUTOSYSTEM'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // ── MODE: LANCAMENTOS ─────────────────────────────────────
  if (mode === 'lancamentos') {
    const target = sp.get('target')  // 'conta' | 'grupo'
    if (target === 'conta') {
      const codigo = sp.get('codigo')
      if (!codigo) return NextResponse.json({ error: 'codigo é obrigatório' }, { status: 400 })
      try {
        const limit = 500
        const rows = await listarMovtoConta(empresaIds, dataIni, dataFim, codigo, limit)
        const lancamentos: DrillLancamento[] = rows.map(r => ({
          data:       r.data,
          observacao: r.observacao,
          valor:      Number(r.valor),
        }))
        const resp: DrillLancamentosResponse = {
          modo: 'lancamentos',
          lancamentos,
          truncado: lancamentos.length === limit,
        }
        return NextResponse.json(resp)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao consultar AUTOSYSTEM'
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }

    if (target === 'grupo') {
      const grupoGrid = sp.get('grupo_grid')
      const tipoValor = sp.get('tipo_valor') as 'venda' | 'custo' | null
      if (!grupoGrid || !tipoValor) {
        return NextResponse.json({ error: 'grupo_grid e tipo_valor são obrigatórios' }, { status: 400 })
      }
      try {
        const limit = 500
        const rows = await listarLanctoGrupo(empresaIds, dataIni, dataFim, grupoGrid, tipoValor, limit)
        const lancamentos: DrillLancamento[] = rows.map(r => ({
          data:       r.data,
          observacao: r.observacao,
          valor:      Number(r.valor),
        }))
        const resp: DrillLancamentosResponse = {
          modo: 'lancamentos',
          lancamentos,
          truncado: lancamentos.length === limit,
        }
        return NextResponse.json(resp)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao consultar AUTOSYSTEM'
        return NextResponse.json({ error: msg }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'target inválido — use conta ou grupo' }, { status: 400 })
  }

  return NextResponse.json({ error: 'mode inválido — use linha ou lancamentos' }, { status: 400 })
}
