import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notificacoes — lista notificações do usuário logado (não lidas primeiro)
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('notificacoes')
    .select('id, tipo, titulo, mensagem, lida, tarefa_id, posto_nome, criado_em')
    .eq('usuario_id', user.id)
    .order('lida', { ascending: true })
    .order('criado_em', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const naoLidas = (data ?? []).filter(n => !n.lida).length
  return NextResponse.json({ notificacoes: data ?? [], naoLidas })
}
