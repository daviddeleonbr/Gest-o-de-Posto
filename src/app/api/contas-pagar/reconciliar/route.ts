import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarMovtosEmpresaDia, buscarMotivos } from '@/lib/autosystem'

const TOLERANCIA = 0.05
const IGUALDADE  = 0.01

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { posto_id, data } = await req.json()
  if (!posto_id || !data)
    return NextResponse.json({ error: 'posto_id e data são obrigatórios' }, { status: 400 })

  const admin = createAdminClient()

  const { data: posto } = await admin
    .from('postos')
    .select('codigo_empresa_externo, nome')
    .eq('id', posto_id)
    .single()

  if (!posto?.codigo_empresa_externo)
    return NextResponse.json({ error: 'Posto sem código externo configurado' }, { status: 400 })

  const { data: lancamentos } = await admin
    .from('cp_lancamentos')
    .select('*')
    .eq('posto_id', posto_id)
    .eq('data_lancamento', data)

  if (!lancamentos?.length)
    return NextResponse.json({ reconciliados: 0, mensagem: 'Nenhum lançamento interno para reconciliar' })

  const empresaGrid = parseInt(posto.codigo_empresa_externo)
  const movtosRaw = await buscarMovtosEmpresaDia(empresaGrid, data)

  const motivoGrids = [...new Set((movtosRaw as any[]).map(m => m.motivo).filter(Boolean))] as number[]
  const motivoLookup: Record<number, string> = {}
  if (motivoGrids.length) {
    const motivos = await buscarMotivos(motivoGrids)
    for (const m of motivos) motivoLookup[m.grid] = m.nome ?? ''
  }

  const movtos = (movtosRaw as any[]).map(m => ({
    mlid:      m.mlid,
    valor:     m.valor,
    motivo:    m.motivo ? (motivoLookup[m.motivo] ?? String(m.motivo)) : null,
    data:      m.data,
    documento: m.documento,
    obs:       m.obs,
    child:     m.child,
  })).sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))

  const usados = new Set<number>()
  const updates: any[] = []

  for (const lanc of lancamentos) {
    const vlrLanc = parseFloat(lanc.valor)

    const match = movtos.find((m, i) => {
      if (usados.has(i)) return false
      const diff = Math.abs((m.valor ?? 0) - vlrLanc)
      const pct  = vlrLanc > 0 ? diff / vlrLanc : diff
      return pct <= TOLERANCIA
    })

    if (!match) {
      updates.push({ id: lanc.id, status: 'so_sistema', movto_mlid: null, valor_autosystem: null, divergencia_valor: null })
    } else {
      const idx = movtos.indexOf(match)
      usados.add(idx)
      const diverge = Math.abs((match.valor ?? 0) - vlrLanc) > IGUALDADE
      updates.push({
        id: lanc.id,
        status: diverge ? 'divergente' : 'encontrado',
        movto_mlid: Number(match.mlid),
        valor_autosystem: match.valor,
        divergencia_valor: diverge ? parseFloat(((match.valor ?? 0) - vlrLanc).toFixed(2)) : 0,
      })
    }
  }

  for (const u of updates) {
    const { id, ...payload } = u
    await admin.from('cp_lancamentos').update(payload).eq('id', id)
  }

  const soAutosystem = movtos
    .filter((_, i) => !usados.has(i))
    .map(m => ({ mlid: m.mlid, valor: m.valor, motivo: m.motivo, documento: m.documento }))

  return NextResponse.json({
    reconciliados: updates.length,
    encontrados:   updates.filter(u => u.status === 'encontrado').length,
    divergentes:   updates.filter(u => u.status === 'divergente').length,
    so_sistema:    updates.filter(u => u.status === 'so_sistema').length,
    so_autosystem: soAutosystem,
  })
}
