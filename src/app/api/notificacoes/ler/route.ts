import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/notificacoes/ler — marca uma ou todas as notificações como lidas
// Body: { id?: string }  — se omitido, marca todas
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const notifId: string | undefined = body?.id

  let query = supabase
    .from('notificacoes')
    .update({ lida: true })
    .eq('usuario_id', user.id)

  if (notifId) query = query.eq('id', notifId)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
