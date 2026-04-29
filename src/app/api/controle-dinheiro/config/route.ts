import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ContaSel {
  conta_grid:   string
  conta_codigo: string
  conta_nome:   string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('controle_dinheiro_contas')
    .select('id, conta_grid, conta_codigo, conta_nome, ativo')
    .eq('ativo', true)
    .order('conta_codigo')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normaliza conta_grid para string (bigint pode vir como number ou string)
  const contas = (data ?? []).map(r => ({
    ...r,
    conta_grid: String(r.conta_grid),
  }))
  return NextResponse.json({ contas })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const novas = (body.contas as ContaSel[]) ?? []

  // Estratégia: substituir tudo. Marca as antigas como inativas e
  // upsert das novas (re-ativando se já existirem).
  const { error: e1 } = await supabase
    .from('controle_dinheiro_contas')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000')  // todas
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  if (novas.length > 0) {
    const { error: e2 } = await supabase
      .from('controle_dinheiro_contas')
      .upsert(novas.map(c => ({
        conta_grid:    c.conta_grid,
        conta_codigo:  c.conta_codigo,
        conta_nome:    c.conta_nome,
        ativo:         true,
        atualizado_em: new Date().toISOString(),
      })), { onConflict: 'conta_grid' })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
