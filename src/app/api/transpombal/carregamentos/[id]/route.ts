import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { itens, ...campos } = body

  // Atualiza campos do carregamento
  if (Object.keys(campos).length) {
    const { error } = await admin.from('transpombal_carregamentos').update(campos).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Substitui itens se enviados
  if (itens !== undefined) {
    await admin.from('transpombal_itens').delete().eq('carregamento_id', id)
    if (itens.length) {
      const rows = (itens as any[]).map((item: any, i: number) => ({
        carregamento_id: id,
        ordem:           i,
        capacidade_m3:   item.capacidade_m3,
        produto:         item.produto,
        posto_nome:      item.posto_nome,
        posto_id:        item.posto_id ?? null,
        numero_pedido:   item.numero_pedido ?? null,
        status:          item.status ?? 'pendente',
      }))
      const { error } = await admin.from('transpombal_itens').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data } = await admin
    .from('transpombal_carregamentos')
    .select('*, motorista:transpombal_motoristas(id, nome), itens:transpombal_itens(*)')
    .eq('id', id)
    .single()

  return NextResponse.json({ carregamento: data })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { error } = await admin.from('transpombal_carregamentos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
