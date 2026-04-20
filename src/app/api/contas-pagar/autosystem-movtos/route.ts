import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarMovtosAutosystem, buscarMotivos } from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const posto_id = searchParams.get('posto_id')
  const data     = searchParams.get('data')

  if (!posto_id || !data)
    return NextResponse.json({ error: 'posto_id e data são obrigatórios' }, { status: 400 })

  const admin = createAdminClient()
  const { data: posto } = await admin.from('postos').select('codigo_empresa_externo, nome').eq('id', posto_id).single()

  if (!posto?.codigo_empresa_externo)
    return NextResponse.json({ error: 'Posto sem código externo configurado' }, { status: 400 })

  const movtosRaw = await buscarMovtosAutosystem(parseInt(posto.codigo_empresa_externo), [data])

  const motivoGrids = [...new Set((movtosRaw as any[]).map((m: any) => m.motivo).filter(Boolean))] as number[]
  const motivosData = await buscarMotivos(motivoGrids)
  const motivoLookup: Record<number, string> = {}
  for (const m of motivosData) motivoLookup[m.grid] = m.nome

  const rows = (movtosRaw as any[]).map((m: any) => ({
    mlid: m.mlid, valor: m.valor,
    motivo: m.motivo ? (motivoLookup[m.motivo] ?? String(m.motivo)) : null,
    documento: m.documento, obs: m.obs,
  })).sort((a: any, b: any) => (b.valor ?? 0) - (a.valor ?? 0))

  const total = rows.reduce((s: number, m: any) => s + (m.valor ?? 0), 0)
  return NextResponse.json({ movtos: rows, total: parseFloat(total.toFixed(2)) })
}
