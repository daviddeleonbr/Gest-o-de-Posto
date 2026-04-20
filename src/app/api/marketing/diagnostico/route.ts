import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buscarTodosMotivos, buscarMovtosPorMotivo } from '@/lib/autosystem'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: postos } = await admin
    .from('postos')
    .select('codigo_empresa_externo')
    .not('codigo_empresa_externo', 'is', null)

  const empresaIds = (postos ?? []).map(p => parseInt(p.codigo_empresa_externo!)).filter(n => !isNaN(n))

  const todosMotivos = await buscarTodosMotivos()
  const motivosFiltrados = todosMotivos.filter(m =>
    m.nome?.toLowerCase().includes('marketing') || m.nome?.toLowerCase().includes('patroc')
  )

  if (!motivosFiltrados.length) return NextResponse.json({ motivos: [] })

  const motivoGrids = motivosFiltrados.map(m => m.grid)
  const dataIni = '2020-01-01'
  const dataFim = new Date().toISOString().slice(0, 10)

  const movtos = empresaIds.length
    ? await buscarMovtosPorMotivo(empresaIds, motivoGrids, dataIni, dataFim)
    : []

  const agg: Record<number, { qtd: number; valor: number }> = {}
  for (const m of movtos as any[]) {
    if (!m.motivo) continue
    if (!agg[m.motivo]) agg[m.motivo] = { qtd: 0, valor: 0 }
    agg[m.motivo].qtd   += 1
    agg[m.motivo].valor += m.valor ?? 0
  }

  const motivos = motivosFiltrados.map(m => ({
    grid:        m.grid,
    nome:        m.nome,
    qtd_movtos:  agg[m.grid]?.qtd   ?? 0,
    valor_total: parseFloat((agg[m.grid]?.valor ?? 0).toFixed(2)),
  })).sort((a, b) => b.qtd_movtos - a.qtd_movtos)

  return NextResponse.json({ motivos })
}
