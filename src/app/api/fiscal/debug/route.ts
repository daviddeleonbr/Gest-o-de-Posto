import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { queryAS } from '@/lib/autosystem'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // 1. Postos
    const { data: postos, error: errPostos } = await supabase
      .from('postos')
      .select('id, nome, codigo_empresa_externo')
      .order('nome')

    const postosComCodigo = (postos ?? []).filter((p: any) => p.codigo_empresa_externo != null)
    const postosSemCodigo = (postos ?? []).filter((p: any) => p.codigo_empresa_externo == null)

    const empresaGrids = postosComCodigo.map((p: any) => Number(p.codigo_empresa_externo))

    // 2. Tarefas existentes
    const { data: tarefas } = await supabase
      .from('fiscal_tarefas')
      .select('id, empresa_grid, posto_id, status, fornecedor_nome')
      .limit(20)

    // 3. Explorar estrutura do AS
    let colunasNfeResumo: any[] = []
    let amostraNfeResumo: any[] = []
    let erroAS: string | null = null
    try {
      // Colunas da tabela nfe_resumo
      colunasNfeResumo = await queryAS(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'nfe_resumo'
         ORDER BY ordinal_position`,
        [],
      )
      // Amostra de 3 registros para ver os valores
      const dataIni = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      amostraNfeResumo = await queryAS(
        `SELECT * FROM nfe_resumo WHERE data_emissao >= $1::date LIMIT 3`,
        [dataIni],
      )
      // Verificar códigos reais de nfe_evento usados na nfe_manifestacao
      const eventosUsados = await queryAS(
        `SELECT nm.nfe_evento, COUNT(*)::int AS total
         FROM nfe_manifestacao nm
         GROUP BY nm.nfe_evento
         ORDER BY total DESC
         LIMIT 20`,
        [],
      )

      // Ver o que nfe_tipo_evento tem (tabela de lookup dos códigos)
      let tiposEvento: any[] = []
      try {
        tiposEvento = await queryAS(
          `SELECT * FROM nfe_tipo_evento LIMIT 20`,
          [],
        )
      } catch {}

      // Contar NFs que passariam pelo nosso filtro atual
      const contaFiltroAtual = await queryAS(
        `SELECT COUNT(*)::int AS total
         FROM nfe_resumo nr
         WHERE nr.data_emissao >= (NOW() - INTERVAL '1 year')::date
           AND EXISTS (SELECT 1 FROM nfe_manifestacao nm WHERE nm.nfe = nr.nfe)
           AND NOT EXISTS (
             SELECT 1 FROM nfe_manifestacao nm
             WHERE nm.nfe = nr.nfe
               AND nm.nfe_evento IN (210200, 210220, 210240)
           )`,
        [],
      )

      // Procurar tabelas de manifestação/evento no AS
      const tabelasManifesto = await queryAS(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND (table_name ILIKE '%manifes%'
             OR table_name ILIKE '%evento%'
             OR table_name ILIKE '%situac%'
             OR table_name ILIKE '%nfe_%')
         ORDER BY table_name`,
        [],
      )

      // Tentar acessar nfe_manifestacao se existir
      let colunasManifestacao: any[] = []
      let amostrasManifestacao: any[] = []
      try {
        colunasManifestacao = await queryAS(
          `SELECT column_name, data_type FROM information_schema.columns
           WHERE table_name = 'nfe_manifestacao'
           ORDER BY ordinal_position`,
          [],
        )
        amostrasManifestacao = await queryAS(
          `SELECT * FROM nfe_manifestacao LIMIT 3`,
          [],
        )
      } catch {}

      // Investigar NFs de Bela Vista (empresa 13760205) que passam pelo nosso filtro
      // e mostrar todos os eventos que cada uma tem em nfe_manifestacao
      let nfsBellaVistaComEventos: any[] = []
      try {
        // Pega as NFs de Bela Vista que passam nosso filtro
        const nfsBV = await queryAS(
          `SELECT nr.grid::bigint, nr.nfe::bigint, nr.emitente_nome::text,
                  to_char(nr.data_emissao, 'YYYY-MM-DD') AS data_emissao, nr.valor::float
           FROM nfe_resumo nr
           WHERE nr.empresa = 13760205
             AND nr.data_emissao >= (NOW() - INTERVAL '1 year')::date
             AND EXISTS (SELECT 1 FROM nfe_manifestacao nm WHERE nm.nfe = nr.nfe)
             AND NOT EXISTS (
               SELECT 1 FROM nfe_manifestacao nm
               WHERE nm.nfe = nr.nfe
                 AND nm.nfe_evento IN (210200, 210220, 210240)
             )
           ORDER BY nr.data_emissao ASC
           LIMIT 10`,
          [],
        )
        // Para cada NF, busca todos os eventos em nfe_manifestacao
        for (const nf of nfsBV.slice(0, 5)) {
          const eventos = await queryAS(
            `SELECT * FROM nfe_manifestacao WHERE nfe = $1`,
            [nf.nfe],
          )
          nfsBellaVistaComEventos.push({ nf, eventos_manifestacao: eventos })
        }
        // Também verifica: existem NFs de Bela Vista com evento final que NÃO passam no filtro?
        const nfsBVComEventoFinal = await queryAS(
          `SELECT COUNT(*)::int AS total
           FROM nfe_resumo nr
           WHERE nr.empresa = 13760205
             AND nr.data_emissao >= (NOW() - INTERVAL '1 year')::date
             AND EXISTS (
               SELECT 1 FROM nfe_manifestacao nm
               WHERE nm.nfe = nr.nfe
                 AND nm.nfe_evento IN (210200, 210220, 210240)
             )`,
          [],
        )
        nfsBellaVistaComEventos.push({
          _resumo_bela_vista: {
            passam_filtro: nfsBV.length,
            tem_evento_final: nfsBVComEventoFinal,
          },
        })
      } catch (e: any) {
        nfsBellaVistaComEventos = [{ erro: e.message }]
      }

      amostraNfeResumo = [...amostraNfeResumo, {
        _eventos_usados_na_nfe_manifestacao: eventosUsados,
        _tipos_evento: tiposEvento,
        _total_com_filtro_atual: contaFiltroAtual,
        _tabelas_relacionadas: tabelasManifesto,
        _colunas_nfe_manifestacao: colunasManifestacao,
        _amostra_nfe_manifestacao: amostrasManifestacao,
        _nfs_bela_vista_detalhado: nfsBellaVistaComEventos,
      }] as any
    } catch (e: any) {
      erroAS = e.message
    }

    // 4. Dados do usuário logado
    const { data: usuarioLogado } = await supabase
      .from('usuarios')
      .select('id, nome, role, posto_fechamento_id, empresa_id')
      .eq('id', user.id)
      .single()

    // 5. Postos distintos das tarefas
    const postoIdsNasTarefas = [...new Set((tarefas ?? []).map((t: any) => t.posto_id).filter(Boolean))]

    return NextResponse.json({
      usuario_logado: usuarioLogado,
      postos_total: postos?.length ?? 0,
      erro_postos: errPostos?.message ?? null,
      postos_com_codigo_empresa_externo: postosComCodigo,
      postos_sem_codigo_empresa_externo: postosSemCodigo.map((p: any) => ({ id: p.id, nome: p.nome })),
      tarefas_existentes: tarefas?.length ?? 0,
      postos_ids_nas_tarefas: postoIdsNasTarefas,
      tarefas_amostra: tarefas ?? [],
      colunas_nfe_resumo: colunasNfeResumo,
      amostra_nfe_resumo: amostraNfeResumo,
      erro_autosystem: erroAS,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
