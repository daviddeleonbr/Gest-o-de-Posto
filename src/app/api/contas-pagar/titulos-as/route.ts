import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buscarTitulosPagar, buscarPessoas, buscarMotivos } from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const posto_id = searchParams.get('posto_id')
  const vencto_ini = searchParams.get('vencto_ini')
  const vencto_fim = searchParams.get('vencto_fim')
  const situacao   = searchParams.get('situacao') ?? 'todas'

  if (!posto_id) return NextResponse.json({ error: 'posto_id obrigatório' }, { status: 400 })

  const admin = createAdminClient()
  const { data: posto } = await admin.from('postos').select('codigo_empresa_externo, nome').eq('id', posto_id).single()

  if (!posto?.codigo_empresa_externo)
    return NextResponse.json({ error: 'Posto sem código externo configurado' }, { status: 400 })

  const hoje = new Date().toISOString().slice(0, 10)
  const ini = vencto_ini ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const fim = vencto_fim ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)

  const movtos = await buscarTitulosPagar(parseInt(posto.codigo_empresa_externo), ini, fim, situacao)

  const pessoaIds = [...new Set(movtos.map((m: any) => m.pessoa).filter(Boolean))] as number[]
  const motivoIds = [...new Set(movtos.map((m: any) => m.motivo).filter(Boolean))] as number[]

  const [pessoas, motivosData] = await Promise.all([
    buscarPessoas(pessoaIds),
    buscarMotivos(motivoIds),
  ])

  const pessoaLookup: Record<number, string> = {}
  for (const p of pessoas) pessoaLookup[p.grid] = p.nome

  const motivoLookup: Record<number, string> = {}
  for (const m of motivosData) motivoLookup[m.grid] = m.nome

  const titulos = movtos.map((m: any) => {
    const child = m.child ?? 0
    const vencto = m.vencto as string
    const sit = child > 0 ? 'pago' : vencto < hoje ? 'em_atraso' : 'a_vencer'
    return { mlid: m.mlid, vencto, documento: m.documento, valor: m.valor, obs: m.obs, child,
      pessoa_nome: m.pessoa ? (pessoaLookup[m.pessoa] ?? '(sem nome)') : null,
      motivo_nome: m.motivo ? (motivoLookup[m.motivo] ?? null) : null, situacao: sit }
  })

  const totais = {
    total:        parseFloat(titulos.reduce((s: number, t: any) => s + (t.valor ?? 0), 0).toFixed(2)),
    a_vencer:     parseFloat(titulos.filter((t: any) => t.situacao === 'a_vencer').reduce((s: number, t: any) => s + (t.valor ?? 0), 0).toFixed(2)),
    em_atraso:    parseFloat(titulos.filter((t: any) => t.situacao === 'em_atraso').reduce((s: number, t: any) => s + (t.valor ?? 0), 0).toFixed(2)),
    pago:         parseFloat(titulos.filter((t: any) => t.situacao === 'pago').reduce((s: number, t: any) => s + (t.valor ?? 0), 0).toFixed(2)),
    qt_total:     titulos.length,
    qt_a_vencer:  titulos.filter((t: any) => t.situacao === 'a_vencer').length,
    qt_em_atraso: titulos.filter((t: any) => t.situacao === 'em_atraso').length,
    qt_pago:      titulos.filter((t: any) => t.situacao === 'pago').length,
  }

  return NextResponse.json({ titulos, totais, posto: posto.nome })
}
