import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminClient()
  const { searchParams } = new URL(req.url)
  const postoNomeParam = searchParams.get('posto_nome')
  const data = searchParams.get('data') ?? new Date().toISOString().slice(0, 10)

  let q = admin.from('tanques_postos').select('*').eq('ativo', true).order('posto_nome').order('ordem')

  if (postoNomeParam) {
    // Admin selecionou posto pelo nome
    q = q.ilike('posto_nome', postoNomeParam)
  } else {
    // Gerente: descobre posto via posto_fechamento_id
    const { data: usr } = await admin
      .from('usuarios').select('posto_fechamento_id').eq('id', user.id).single()

    if (usr?.posto_fechamento_id) {
      // Tenta primeiro por posto_id direto (após migration 055)
      const { data: porId } = await admin
        .from('tanques_postos')
        .select('*')
        .eq('ativo', true)
        .eq('posto_id', usr.posto_fechamento_id)
        .order('ordem')

      if (porId && porId.length > 0) {
        // Encontrou por posto_id — usa esse resultado direto
        const ids = porId.map(t => t.id)
        const { data: medicoes } = await admin
          .from('medicoes_tanques').select('tanque_id, medida_litros').in('tanque_id', ids).eq('data', data)
        const medicaoMap = new Map((medicoes ?? []).map(m => [m.tanque_id, m.medida_litros]))
        const result = porId.map(t => ({ ...t, medida_litros: medicaoMap.get(t.id) ?? null }))
        const porPosto: Record<string, typeof result> = {}
        for (const t of result) {
          if (!porPosto[t.posto_nome]) porPosto[t.posto_nome] = []
          porPosto[t.posto_nome].push(t)
        }
        return NextResponse.json({ tanques: result, porPosto, data })
      }

      // Fallback: tenta por nome (case-insensitive, com e sem prefixo "POSTO ")
      const { data: posto } = await admin
        .from('postos').select('nome').eq('id', usr.posto_fechamento_id).single()

      if (posto?.nome) {
        const nome = posto.nome.trim()
        const nomeLimpo = nome.replace(/^posto\s+/i, '').trim()
        // Busca onde posto_nome bate com o nome completo OU sem o prefixo
        q = q.or(
          `posto_nome.ilike.${nome},posto_nome.ilike.${nomeLimpo},posto_nome.ilike.%${nomeLimpo}%`
        )
      }
    }
  }

  const { data: tanques, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (tanques ?? []).map(t => t.id)
  const { data: medicoes } = ids.length
    ? await admin.from('medicoes_tanques').select('tanque_id, medida_litros').in('tanque_id', ids).eq('data', data)
    : { data: [] }

  const medicaoMap = new Map((medicoes ?? []).map(m => [m.tanque_id, m.medida_litros]))

  const result = (tanques ?? []).map(t => ({
    ...t,
    medida_litros: medicaoMap.get(t.id) ?? null,
  }))

  const porPosto: Record<string, typeof result> = {}
  for (const t of result) {
    if (!porPosto[t.posto_nome]) porPosto[t.posto_nome] = []
    porPosto[t.posto_nome].push(t)
  }

  return NextResponse.json({ tanques: result, porPosto, data })
}
