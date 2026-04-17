import { SupabaseClient } from '@supabase/supabase-js'

export interface MovtoRow {
  conta_debitar:  string | null
  conta_creditar: string | null
  valor:          number | null
  data?:          string | null
}

// Busca todos os registros de as_movto para uma empresa/data(s) via paginação.
// Contorna o limite máximo de linhas do PostgREST (padrão 1000).
export async function fetchMovtos(
  admin: SupabaseClient,
  empresaId: number,
  datas: string | string[],
  incluirData = false,
  pageSize = 1000,
): Promise<MovtoRow[]> {
  const datasArr = Array.isArray(datas) ? datas : [datas]
  const campos   = incluirData
    ? 'conta_debitar, conta_creditar, valor, data'
    : 'conta_debitar, conta_creditar, valor'
  const all: MovtoRow[] = []
  let from = 0

  while (true) {
    let q = admin
      .from('as_movto')
      .select(campos)
      .eq('empresa', empresaId)
      .range(from, from + pageSize - 1)

    q = datasArr.length === 1
      ? q.eq('data', datasArr[0])
      : q.in('data', datasArr)

    const { data: rows, error } = await q
    if (error) throw new Error(`fetchMovtos: ${error.message}`)
    if (!rows || rows.length === 0) break

    all.push(...(rows as unknown as MovtoRow[]))
    if (rows.length < pageSize) break
    from += pageSize
  }

  return all
}
