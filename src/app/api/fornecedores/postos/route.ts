import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — vincula fornecedor ao posto com dias de visita
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body  = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('fornecedor_postos')
    .upsert({
      fornecedor_id:      body.fornecedor_id,
      posto_id:           body.posto_id,
      dias_visita:        body.dias_visita        ?? [],
      prazo_entrega_dias: body.prazo_entrega_dias ?? 1,
      observacoes:        body.observacoes        ?? null,
    }, { onConflict: 'fornecedor_id,posto_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vinculo: data })
}

// DELETE — remove vínculo
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id    = searchParams.get('id')
  const admin = createAdminClient()

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await admin.from('fornecedor_postos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
