'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils/cn'
import { ClipboardList, Wallet, CheckCircle2, AlertTriangle, Clock, ChevronRight, Loader2, RefreshCw, TrendingDown, Inbox, CheckCheck, XCircle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Solicitações recebidas de outros setores ─────────────────────
interface Solicitacao {
  id: string; titulo: string; setor: string; fornecedor: string | null
  valor: number | null; data_vencimento: string | null; status: string
  criado_por_nome: string | null; criado_em: string; observacoes: string | null
}

const SETOR_COLOR: Record<string, string> = {
  fiscal:     'bg-indigo-100 text-indigo-700',
  marketing:  'bg-pink-100 text-pink-700',
  transpombal:'bg-yellow-100 text-yellow-700',
  outro:      'bg-gray-100 text-gray-600',
}
const SETOR_LABEL: Record<string, string> = {
  fiscal: 'Fiscal', marketing: 'Marketing', transpombal: 'Transpombal', outro: 'Outro',
}
const STATUS_COLOR: Record<string, string> = {
  pendente:   'bg-yellow-100 text-yellow-700',
  em_analise: 'bg-blue-100 text-blue-700',
  aprovado:   'bg-emerald-100 text-emerald-700',
  pago:       'bg-green-100 text-green-700',
  rejeitado:  'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', em_analise: 'Em Análise', aprovado: 'Aprovado', pago: 'Pago', rejeitado: 'Rejeitado',
}
function fmtBRLSol(v: number | null) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDateSol(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}

function SolicitacoesRecebidas() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [loading, setLoading]           = useState(true)
  const [atualizando, setAtualizando]   = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente')
  const [detalhes, setDetalhes]         = useState<string | null>(null)
  const [motivoRej, setMotivoRej]       = useState('')
  const [idRejeitar, setIdRejeitar]     = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroStatus !== 'todos') params.set('status', filtroStatus)
    const r = await fetch(`/api/solicitacoes-pagamento?${params}`)
    const json = await r.json()
    setSolicitacoes(json.solicitacoes ?? [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [filtroStatus])

  async function mudarStatus(id: string, status: string, motivo?: string) {
    setAtualizando(id)
    const r = await fetch('/api/solicitacoes-pagamento', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, motivo_rejeicao: motivo }),
    })
    if (r.ok) {
      toast({ title: `Solicitação marcada como "${STATUS_LABEL[status]}"` })
      carregar()
    } else { toast({ variant: 'destructive', title: 'Erro ao atualizar' }) }
    setAtualizando(null)
    setIdRejeitar(null); setMotivoRej('')
  }

  const solAtual = solicitacoes.find(s => s.id === detalhes)

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-gray-800 text-[13px]">Solicitações de Outros Setores</span>
        </div>
        <div className="flex gap-1">
          {['pendente', 'em_analise', 'aprovado', 'pago', 'rejeitado', 'todos'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={cn('text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors',
                filtroStatus === s ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100')}>
              {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-[13px] text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" /> Carregando...
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className="p-8 text-center text-[13px] text-gray-400">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          Nenhuma solicitação {filtroStatus !== 'todos' ? `com status "${STATUS_LABEL[filtroStatus]}"` : ''}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {solicitacoes.map(s => (
            <div key={s.id} className="px-5 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide', SETOR_COLOR[s.setor] ?? 'bg-gray-100 text-gray-600')}>
                      {SETOR_LABEL[s.setor] ?? s.setor}
                    </span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_COLOR[s.status] ?? 'bg-gray-100 text-gray-500')}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{s.titulo}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {s.fornecedor ? `${s.fornecedor} · ` : ''}
                    <span className="font-semibold text-gray-700">{fmtBRLSol(s.valor)}</span>
                    {s.data_vencimento ? ` · vence ${fmtDateSol(s.data_vencimento)}` : ''}
                    {s.criado_por_nome ? ` · por ${s.criado_por_nome}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setDetalhes(detalhes === s.id ? null : s.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    title="Ver detalhes">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {s.status === 'pendente' && (
                    <button onClick={() => mudarStatus(s.id, 'em_analise')} disabled={atualizando === s.id}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors">
                      Analisar
                    </button>
                  )}
                  {(s.status === 'pendente' || s.status === 'em_analise') && (
                    <>
                      <button onClick={() => mudarStatus(s.id, 'aprovado')} disabled={atualizando === s.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Aprovar">
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setIdRejeitar(s.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Rejeitar">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {s.status === 'aprovado' && (
                    <button onClick={() => mudarStatus(s.id, 'pago')} disabled={atualizando === s.id}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-colors">
                      Marcar Pago
                    </button>
                  )}
                </div>
              </div>

              {/* Detalhes expandidos */}
              {detalhes === s.id && s.observacoes && (
                <div className="mt-2 pl-0 text-[12px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-600">Obs:</span> {s.observacoes}
                </div>
              )}

              {/* Campo rejeição */}
              {idRejeitar === s.id && (
                <div className="mt-2 flex gap-2">
                  <input value={motivoRej} onChange={e => setMotivoRej(e.target.value)}
                    placeholder="Motivo da rejeição (opcional)"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-[12px] focus:outline-none focus:ring-2 focus:ring-red-500/20" />
                  <button onClick={() => mudarStatus(s.id, 'rejeitado', motivoRej)}
                    className="px-3 py-1.5 bg-red-500 text-white text-[12px] rounded-lg hover:bg-red-600 font-medium">
                    Rejeitar
                  </button>
                  <button onClick={() => { setIdRejeitar(null); setMotivoRej('') }}
                    className="px-3 py-1.5 text-gray-500 text-[12px] rounded-lg hover:bg-gray-100">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
      <div className={cn('p-2 rounded-lg', color)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-base md:text-xl font-bold text-gray-800 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function ContasPagarPage() {
  const hoje = new Date()
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const [comps, setComps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/contas-pagar/competencias?competencia=${competencia}`)
      const json = await res.json()
      setComps(json.competencias ?? [])
    } catch {
      toast({ title: 'Erro ao carregar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalPrevisto = comps.reduce((s, c) => s + Number(c.valor_previsto), 0)
  const totalPago     = comps.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor_pago ?? c.valor_previsto), 0)
  const emAtraso      = comps.filter(c => c.em_atraso).length
  const pendentes     = comps.filter(c => c.status === 'previsto' && !c.em_atraso).length
  const pagos         = comps.filter(c => c.status === 'pago').length

  const mesLabel = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Contas a Pagar" description={`Resumo — ${mesLabel}`} />

      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6">

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Mês atual</h2>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-8 gap-1.5 text-[12px]">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Previsto no mês"  value={fmtBRL(totalPrevisto)} sub={`${comps.length} conta(s)`}          icon={TrendingDown}  color="bg-blue-500" />
              <KpiCard label="Pago"             value={fmtBRL(totalPago)}     sub={`${pagos} conta(s) quitada(s)`}       icon={CheckCircle2}  color="bg-emerald-500" />
              <KpiCard label="Pendente"         value={String(pendentes)}     sub="A vencer no mês"                      icon={Clock}         color="bg-amber-500" />
              <KpiCard label="Em Atraso"        value={String(emAtraso)}      sub={emAtraso > 0 ? 'Atenção!' : 'Tudo em dia'} icon={AlertTriangle} color={emAtraso > 0 ? 'bg-red-500' : 'bg-gray-400'} />
            </div>

            {emAtraso > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-[13px]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><strong>{emAtraso}</strong> conta(s) em atraso</span>
                <Link href="/contas-pagar/fixas" className="ml-auto text-red-600 hover:underline text-[12px] flex items-center gap-1">
                  Ver <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { href: '/contas-pagar/conferencia', icon: ClipboardList, label: 'Conferência Diária', desc: 'Lançar e conferir com AutoSystem', color: 'text-blue-600 bg-blue-50' },
                { href: '/contas-pagar/fixas',       icon: Wallet,        label: 'Despesas Fixas',     desc: 'Contas fixas por posto',           color: 'text-emerald-600 bg-emerald-50' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow group"
                >
                  <div className={cn('p-2.5 rounded-lg', item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-gray-800">{item.label}</p>
                    <p className="text-[11px] text-gray-400">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>
              ))}
            </div>

            {/* Solicitações de outros setores */}
            <SolicitacoesRecebidas />
          </>
        )}
      </div>
    </div>
  )
}
