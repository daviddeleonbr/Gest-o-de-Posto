import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('fornecedores')
    .select(`
      id, nome, telefone, email, contato, categoria, observacoes, ativo, criado_em,
      postos:fornecedor_postos(
        id, dias_visita, prazo_entrega_dias, observacoes,
        posto:postos(id, nome)
      )
    `)
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fornecedores: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('fornecedores')
    .insert({
      nome:        body.nome,
      telefone:    body.telefone    ?? null,
      email:       body.email       ?? null,
      contato:     body.contato     ?? null,
      categoria:   body.categoria   ?? 'geral',
      observacoes: body.observacoes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fornecedor: data })
}
