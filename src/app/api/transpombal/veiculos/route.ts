import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await createAdminClient()
    .from('transpombal_veiculos')
    .select('*')
    .eq('ativo', true)
    .order('placa')

  return NextResponse.json({ veiculos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  if (!body.placa?.trim()) return NextResponse.json({ error: 'Placa obrigatória' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('transpombal_veiculos')
    .insert({
      placa:          body.placa.trim().toUpperCase(),
      tipo:           body.tipo ?? 'carreta',
      compartimentos: body.compartimentos ?? [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ veiculo: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { id, ...campos } = body
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { data, error } = await createAdminClient()
    .from('transpombal_veiculos')
    .update(campos)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ veiculo: data })
}
