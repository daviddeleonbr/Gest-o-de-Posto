import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarMovtosContasReceber, buscarContas } from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const empresaId = searchParams.get('empresa')
  const contaCod  = searchParams.get('conta')
  const dataIni   = searchParams.get('data_ini')
  const dataFim   = searchParams.get('data_fim')
  const venctoIni = searchParams.get('vencto_ini')
  const venctoFim = searchParams.get('vencto_fim')

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
  if (!empresaIds.length) {
    return NextResponse.json({ titulos: [], contas: [], total: 0, em_atraso: 0, total_valor: 0, total_atraso: 0 })
  }

  const venctoIniEfetivo = (!venctoIni || venctoIni < '2026-01-01') ? '2026-01-01' : venctoIni

  const [movtos, contasData] = await Promise.all([
    buscarMovtosContasReceber(empresaIds, { contaCod, dataIni, dataFim, venctoIni: venctoIniEfetivo, venctoFim }),
    buscarContas('1.3.%'),
  ])

  const contaLookup: Record<string, string> = {}
  for (const c of contasData) contaLookup[c.codigo] = c.nome ?? ''

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const titulos = movtos.map((r: any) => {
    const vencto = new Date(r.vencto)
    vencto.setHours(0, 0, 0, 0)
    const atrasado = vencto < hoje
    return {
      data:          r.data,
      vencto:        r.vencto,
      documento:     r.documento,
      tipo_doc:      r.tipo_doc,
      valor:         r.valor,
      empresa:       String(r.empresa),
      conta_debitar: r.conta_debitar,
      conta_nome:    contaLookup[r.conta_debitar ?? ''] ?? null,
      posto_nome:    postoMap[String(r.empresa)] ?? String(r.empresa),
      atrasado,
      dias_atraso:   atrasado ? Math.floor((hoje.getTime() - vencto.getTime()) / 86400000) : 0,
    }
  })

  const total_valor  = titulos.reduce((s, t) => s + (t.valor ?? 0), 0)
  const total_atraso = titulos.filter(t => t.atrasado).reduce((s, t) => s + (t.valor ?? 0), 0)

  return NextResponse.json({
    titulos,
    contas:       contasData,
    total:        titulos.length,
    em_atraso:    titulos.filter(t => t.atrasado).length,
    total_valor:  parseFloat(total_valor.toFixed(2)),
    total_atraso: parseFloat(total_atraso.toFixed(2)),
  })
}
