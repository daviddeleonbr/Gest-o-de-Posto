import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buscarMovtosCRPorMotivos,
  buscarMotivosUsadosEmContas,
  buscarPessoas,
} from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conta     = searchParams.get('conta')
  const mes       = searchParams.get('mes')
  const empresaId = searchParams.get('empresa')

  if (!conta || !mes) return NextResponse.json({ error: 'Parâmetros obrigatórios: conta, mes' }, { status: 400 })

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
  if (!empresaIds.length) return NextResponse.json({ transacoes: [] })

  const [ano, mesNum] = mes.split('-').map(Number)
  const ultimoDia = new Date(ano, mesNum, 0).getDate()
  const dataIni   = `${mes}-01`
  const dataFim   = `${mes}-${String(ultimoDia).padStart(2, '0')}`

  // Resolve a chave em uma lista de motivos:
  //   • 'motivo:NNN' → [NNN]
  //   • '1.3.X'     → todos os motivos que postam nessa conta (DISTINCT no movto)
  let motivos: number[] = []
  if (conta.startsWith('motivo:')) {
    const grid = parseInt(conta.replace('motivo:', ''))
    if (!isNaN(grid)) motivos = [grid]
  } else {
    const lookup = await buscarMotivosUsadosEmContas(empresaIds, [conta])
    motivos = lookup.map(l => l.motivo)
  }

  if (!motivos.length) return NextResponse.json({ transacoes: [] })

  const data = await buscarMovtosCRPorMotivos(empresaIds, motivos, { dataIni, dataFim })

  const pessoaIds = [...new Set((data as any[]).map(m => m.pessoa).filter(Boolean))] as number[]
  const pessoaLookup: Record<number, string> = {}
  if (pessoaIds.length) {
    const pessoas = await buscarPessoas(pessoaIds)
    for (const p of pessoas) pessoaLookup[p.grid] = p.nome ?? '(sem cliente)'
  }

  // Para o detalhe via conta, filtra ainda pela própria conta — assim motivos que
  // também postam em outras contas não vazam linhas alheias para o drill.
  const filtrarPorConta = !conta.startsWith('motivo:')

  const movtos = (data as any[])
    .filter(m => filtrarPorConta ? m.conta_debitar === conta : true)
    .map(m => {
      const childVal = m.child as number | null
      const pago     = childVal !== null && childVal !== 0
      return {
        vencto:      (m.vencto as string | null) ?? (m.data as string),
        data:        m.data,
        documento:   m.documento,
        tipo_doc:    m.tipo_doc,
        valor:       m.valor,
        empresa:     String(m.empresa),
        child:       m.child,
        pago,
        data_baixa:  null as string | null,
        pessoa_nome: m.pessoa ? (pessoaLookup[m.pessoa] ?? '(sem cliente)') : '(sem cliente)',
        posto_nome:  postoMap[String(m.empresa)] ?? String(m.empresa),
      }
    })
    .sort((a, b) =>
      (a.pessoa_nome ?? '').localeCompare(b.pessoa_nome ?? '')
      || (a.data ?? '').localeCompare(b.data ?? '')
      || 0,
    )

  return NextResponse.json({ transacoes: movtos })
}
