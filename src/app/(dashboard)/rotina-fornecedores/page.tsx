'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { CalendarDays, Phone, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTO  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CAT_COLORS: Record<string, string> = {
  combustivel:  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  conveniencia: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  lubrificante: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  geral:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

type Visita = {
  fornecedor_id: string
  fornecedor_nome: string
  telefone: string | null
  contato: string | null
  categoria: string
  posto_nome: string
  dias_visita: number[]
  prazo_entrega_dias: number
}

export default function RotinaFornecedoresPage() {
  const [visitas, setVisitas]     = useState<Visita[]>([])
  const [loading, setLoading]     = useState(true)
  const [diaAtivo, setDiaAtivo]   = useState(new Date().getDay())
  const [filtroCategoria, setFiltroCategoria] = useState('todos')

  useEffect(() => {
    async function load() {
      const res  = await fetch('/api/fornecedores')
      const json = await res.json()
      const lista: Visita[] = []
      for (const f of json.fornecedores ?? []) {
        for (const vp of f.postos ?? []) {
          lista.push({
            fornecedor_id:   f.id,
            fornecedor_nome: f.nome,
            telefone:        f.telefone,
            contato:         f.contato,
            categoria:       f.categoria,
            posto_nome:      vp.posto.nome,
            dias_visita:     vp.dias_visita ?? [],
            prazo_entrega_dias: vp.prazo_entrega_dias ?? 1,
          })
        }
      }
      setVisitas(lista)
      setLoading(false)
    }
    load()
  }, [])

  const visitasDia = visitas.filter(v =>
    v.dias_visita.includes(diaAtivo) &&
    (filtroCategoria === 'todos' || v.categoria === filtroCategoria)
  )

  // Agrupa por posto
  const porPosto: Record<string, Visita[]> = {}
  for (const v of visitasDia) {
    if (!porPosto[v.posto_nome]) porPosto[v.posto_nome] = []
    porPosto[v.posto_nome].push(v)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Rotina de Visitas" description="Agenda semanal de visitas dos fornecedores por posto" />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">

        {/* Filtro de categoria */}
        <div className="flex gap-2 flex-wrap">
          {['todos', 'combustivel', 'conveniencia', 'lubrificante', 'geral'].map(c => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(c)}
              className={cn('px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors',
                filtroCategoria === c
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300'
              )}
            >
              {c === 'todos' ? 'Todos' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {/* Seletor de dia */}
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_CURTO.map((d, i) => {
            const count = visitas.filter(v => v.dias_visita.includes(i) && (filtroCategoria === 'todos' || v.categoria === filtroCategoria)).length
            const isHoje = i === new Date().getDay()
            return (
              <button
                key={i}
                onClick={() => setDiaAtivo(i)}
                className={cn(
                  'flex flex-col items-center py-2.5 rounded-xl border text-center transition-colors',
                  diaAtivo === i
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : isHoje
                      ? 'border-orange-300 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300 bg-white dark:bg-gray-900'
                )}
              >
                <span className="text-[11px] font-medium">{d}</span>
                {count > 0 && (
                  <span className={cn('text-[10px] font-bold mt-0.5', diaAtivo === i ? 'text-orange-100' : 'text-orange-500')}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Conteúdo do dia */}
        <div>
          <h2 className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {DIAS_SEMANA[diaAtivo]} — {visitasDia.length} visita{visitasDia.length !== 1 ? 's' : ''}
          </h2>

          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
          ) : Object.keys(porPosto).length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Nenhuma visita agendada para {DIAS_SEMANA[diaAtivo].toLowerCase()}.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(porPosto).sort().map(([posto, fornecs]) => (
                <div key={posto} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <p className="text-[12px] font-semibold text-gray-700 dark:text-gray-300">{posto}</p>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {fornecs.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{v.fornecedor_nome}</p>
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase', CAT_COLORS[v.categoria] ?? CAT_COLORS.geral)}>
                              {v.categoria}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {v.contato  && <span className="flex items-center gap-1 text-[11px] text-gray-500"><User className="w-3 h-3" />{v.contato}</span>}
                            {v.telefone && <span className="flex items-center gap-1 text-[11px] text-gray-500"><Phone className="w-3 h-3" />{v.telefone}</span>}
                            <span className="text-[11px] text-gray-400">Entrega em {v.prazo_entrega_dias}d</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
