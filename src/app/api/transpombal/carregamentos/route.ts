import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dataIni = searchParams.get('data_ini')
  const dataFim = searchParams.get('data_fim')
  const status  = searchParams.get('status')

  const admin = createAdminClient()
  let q = admin
    .from('transpombal_carregamentos')
    .select(`
      *,
      motorista:transpombal_motoristas(id, nome),
      itens:transpombal_itens(*)
    `)
    .order('data_carregamento', { ascending: false })
    .order('criado_em',         { ascending: false })

  if (dataIni) q = q.gte('data_carregamento', dataIni)
  if (dataFim) q = q.lte('data_carregamento', dataFim)
  if (status && status !== 'todos') q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ carregamentos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { data_carregamento, origem, motorista_id, motorista_nome, placas, status, observacoes, itens } = body

  if (!data_carregamento) return NextResponse.json({ error: 'data_carregamento obrigatória' }, { status: 400 })

  const admin = createAdminClient()

  const { data: carr, error: errC } = await admin
    .from('transpombal_carregamentos')
    .insert({
      data_carregamento,
      origem:          origem ?? 'CAXIAS',
      motorista_id:    motorista_id ?? null,
      motorista_nome:  motorista_nome ?? null,
      placas:          placas ?? [],
      status:          status ?? 'planejado',
      observacoes:     observacoes ?? null,
      criado_por:      user.id,
    })
    .select()
    .single()

  if (errC) return NextResponse.json({ error: errC.message }, { status: 500 })

  if (itens?.length) {
    const rows = (itens as any[]).map((item: any, i: number) => ({
      carregamento_id: carr.id,
      ordem:           i,
      capacidade_m3:   item.capacidade_m3,
      produto:         item.produto,
      posto_nome:      item.posto_nome,
      posto_id:        item.posto_id ?? null,
      numero_pedido:   item.numero_pedido ?? null,
      status:          'pendente',
    }))
    const { error: errI } = await admin.from('transpombal_itens').insert(rows)
    if (errI) return NextResponse.json({ error: errI.message }, { status: 500 })
  }

  const { data: full } = await admin
    .from('transpombal_carregamentos')
    .select('*, motorista:transpombal_motoristas(id, nome), itens:transpombal_itens(*)')
    .eq('id', carr.id)
    .single()

  return NextResponse.json({ carregamento: full })
}
