'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { toast } from '@/hooks/use-toast'
import { Truck, Plus, Pencil, Trash2, Phone, Mail, User, MapPin, X, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const CATEGORIAS = [
  { value: 'combustivel',  label: 'Combustível' },
  { value: 'conveniencia', label: 'Conveniência' },
  { value: 'lubrificante', label: 'Lubrificante' },
  { value: 'geral',        label: 'Geral' },
]

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const EMPTY_FORM = { nome: '', telefone: '', email: '', contato: '', categoria: 'geral', observacoes: '' }

type Posto = { id: string; nome: string }
type Vinculo = { id: string; dias_visita: number[]; prazo_entrega_dias: number; observacoes: string | null; posto: Posto }
type Fornecedor = { id: string; nome: string; telefone: string | null; email: string | null; contato: string | null; categoria: string; observacoes: string | null; ativo: boolean; postos: Vinculo[] }

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [postos, setPostos]             = useState<Posto[]>([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState<'create' | 'edit' | null>(null)
  const [editando, setEditando]         = useState<Fornecedor | null>(null)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [saving, setSaving]             = useState(false)
  const [expanded, setExpanded]         = useState<string | null>(null)

  // Modal de vínculo posto
  const [vinculoModal, setVinculoModal]   = useState<Fornecedor | null>(null)
  const [vinculoPostoId, setVinculoPostoId] = useState('')
  const [vinculoDias, setVinculoDias]       = useState<number[]>([])
  const [vinculoPrazo, setVinculoPrazo]     = useState(1)
  const [vinculoObs, setVinculoObs]         = useState('')
  const [savingVinculo, setSavingVinculo]   = useState(false)

  async function load() {
    setLoading(true)
    const [fRes, pRes] = await Promise.all([
      fetch('/api/fornecedores'),
      fetch('/api/postos'),
    ])
    const fJson = await fRes.json()
    const pJson = await pRes.json()
    setFornecedores(fJson.fornecedores ?? [])
    setPostos(pJson.postos ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function abrirCriar() { setForm({ ...EMPTY_FORM }); setEditando(null); setModal('create') }
  function abrirEditar(f: Fornecedor) { setForm({ nome: f.nome, telefone: f.telefone ?? '', email: f.email ?? '', contato: f.contato ?? '', categoria: f.categoria, observacoes: f.observacoes ?? '' }); setEditando(f); setModal('edit') }

  async function salvar() {
    if (!form.nome.trim()) { toast({ variant: 'destructive', title: 'Nome é obrigatório' }); return }
    setSaving(true)
    const url    = modal === 'edit' ? `/api/fornecedores/${editando!.id}` : '/api/fornecedores'
    const method = modal === 'edit' ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json   = await res.json()
    if (!res.ok) { toast({ variant: 'destructive', title: json.error }); setSaving(false); return }
    toast({ title: modal === 'edit' ? 'Fornecedor atualizado' : 'Fornecedor criado' })
    setModal(null)
    setSaving(false)
    load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este fornecedor?')) return
    const res = await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast({ variant: 'destructive', title: 'Erro ao excluir' }); return }
    toast({ title: 'Fornecedor excluído' })
    load()
  }

  async function salvarVinculo() {
    if (!vinculoPostoId) { toast({ variant: 'destructive', title: 'Selecione um posto' }); return }
    setSavingVinculo(true)
    const res = await fetch('/api/fornecedores/postos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fornecedor_id: vinculoModal!.id, posto_id: vinculoPostoId, dias_visita: vinculoDias, prazo_entrega_dias: vinculoPrazo, observacoes: vinculoObs || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast({ variant: 'destructive', title: json.error }); setSavingVinculo(false); return }
    toast({ title: 'Posto vinculado' })
    setSavingVinculo(false)
    setVinculoModal(null)
    load()
  }

  async function removerVinculo(id: string) {
    if (!confirm('Remover este posto do fornecedor?')) return
    await fetch(`/api/fornecedores/postos?id=${id}`, { method: 'DELETE' })
    load()
  }

  const catLabel = (v: string) => CATEGORIAS.find(c => c.value === v)?.label ?? v

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Fornecedores"
        description="Cadastro de fornecedores e rotina de visitas"
        actions={
          <button onClick={abrirCriar} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Novo Fornecedor
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-400 text-sm">Carregando...</div>
        ) : fornecedores.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">Nenhum fornecedor cadastrado.</div>
        ) : fornecedores.map(f => (
          <div key={f.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Truck className="w-4.5 h-4.5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">{f.nome}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
                    f.categoria === 'combustivel'  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
                    f.categoria === 'conveniencia' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                    f.categoria === 'lubrificante' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  )}>{catLabel(f.categoria)}</span>
                  {f.telefone && <span className="flex items-center gap-1 text-[11px] text-gray-500"><Phone className="w-3 h-3" />{f.telefone}</span>}
                  {f.contato  && <span className="flex items-center gap-1 text-[11px] text-gray-500"><User className="w-3 h-3" />{f.contato}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setExpanded(expanded === f.id ? null : f.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  {expanded === f.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <button onClick={() => { setVinculoModal(f); setVinculoPostoId(''); setVinculoDias([]); setVinculoPrazo(1); setVinculoObs('') }} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors" title="Vincular posto">
                  <MapPin className="w-4 h-4" />
                </button>
                <button onClick={() => abrirEditar(f)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => excluir(f.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Postos vinculados */}
            {expanded === f.id && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50/50 dark:bg-gray-800/30">
                {f.postos.length === 0 ? (
                  <p className="text-[12px] text-gray-400">Nenhum posto vinculado.</p>
                ) : (
                  <div className="space-y-2">
                    {f.postos.map(v => (
                      <div key={v.id} className="flex items-center gap-3 py-1.5 px-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                        <MapPin className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-gray-800 dark:text-gray-200">{v.posto.nome}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400">Visita: {v.dias_visita.length ? v.dias_visita.map(d => DIAS_SEMANA[d]).join(', ') : 'Não definido'}</span>
                            <span className="text-[10px] text-gray-400">· Prazo: {v.prazo_entrega_dias}d</span>
                          </div>
                        </div>
                        <button onClick={() => removerVinculo(v.id)} className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal criar/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">{modal === 'create' ? 'Novo Fornecedor' : 'Editar Fornecedor'}</h2>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Nome *', key: 'nome', placeholder: 'Nome do fornecedor' },
                { label: 'Telefone', key: 'telefone', placeholder: '(00) 00000-0000' },
                { label: 'E-mail', key: 'email', placeholder: 'email@fornecedor.com' },
                { label: 'Contato', key: 'contato', placeholder: 'Nome do representante' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-[11px] font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    value={(form as any)[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Categoria</label>
                <select value={form.categoria} onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value }))} className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                  {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))} rows={2} className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={saving} className="px-4 py-2 text-[13px] font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal vincular posto */}
      {vinculoModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">Vincular Posto — {vinculoModal.nome}</h2>
              <button onClick={() => setVinculoModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Posto *</label>
                <select value={vinculoPostoId} onChange={e => setVinculoPostoId(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                  <option value="">Selecione um posto</option>
                  {postos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-2">Dias de Visita</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS_SEMANA.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setVinculoDias(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      className={cn('px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors',
                        vinculoDias.includes(i)
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-orange-300'
                      )}
                    >{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Prazo de Entrega (dias)</label>
                <input type="number" min={0} value={vinculoPrazo} onChange={e => setVinculoPrazo(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setVinculoModal(null)} className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancelar</button>
              <button onClick={salvarVinculo} disabled={savingVinculo} className="px-4 py-2 text-[13px] font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                {savingVinculo ? 'Salvando...' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
