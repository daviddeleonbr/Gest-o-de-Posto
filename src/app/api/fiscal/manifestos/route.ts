import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { buscarNfeManifestos } from '@/lib/autosystem'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Busca todos os postos com empresa_grid mapeado
    const { data: postos } = await supabase
      .from('postos')
      .select('id, nome, codigo_empresa_externo')
      .not('codigo_empresa_externo', 'is', null)

    if (!postos?.length) return NextResponse.json([])

    const empresaGrids = postos.map((p: any) => Number(p.codigo_empresa_externo))
    const manifestos = await buscarNfeManifestos(empresaGrids)

    // Busca tarefas já criadas para não duplicar
    const { data: tarefasExistentes } = await supabase
      .from('fiscal_tarefas')
      .select('nfe_resumo_grid')

    const gridsJaCriados = new Set((tarefasExistentes ?? []).map((t: any) => t.nfe_resumo_grid))

    // Mapa empresa_grid → posto
    const postoMap = Object.fromEntries(postos.map((p: any) => [Number(p.codigo_empresa_externo), p]))

    const resultado = manifestos
      .filter(m => !gridsJaCriados.has(m.grid))
      .map(m => ({
        ...m,
        posto: postoMap[m.empresa] ?? null,
      }))

    return NextResponse.json(resultado)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
