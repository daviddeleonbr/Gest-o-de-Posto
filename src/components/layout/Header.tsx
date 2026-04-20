'use client'

import Link from 'next/link'
import { useAuthContext } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ROLE_LABELS, ROLE_COLORS, can } from '@/lib/utils/permissions'
import { cn } from '@/lib/utils/cn'
import type { Role } from '@/types/database.types'
import { Layers, CheckSquare, Sun, Moon, Menu, Bell, X, CheckCheck } from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

interface Notificacao {
  id: string
  tipo: string
  titulo: string
  mensagem: string | null
  lida: boolean
  tarefa_id: string | null
  posto_nome: string | null
  criado_em: string
}

function NotificationBell() {
  const [naoLidas, setNaoLidas]           = useState(0)
  const [notifs, setNotifs]               = useState<Notificacao[]>([])
  const [aberto, setAberto]               = useState(false)
  const [carregando, setCarregando]       = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async () => {
    try {
      const res  = await fetch('/api/notificacoes')
      if (!res.ok) return
      const json = await res.json()
      setNotifs(json.notificacoes ?? [])
      setNaoLidas(json.naoLidas ?? 0)
    } catch { /* silencioso */ }
  }, [])

  // Carrega ao montar e a cada 2 minutos
  useEffect(() => {
    carregar()
    const id = setInterval(carregar, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [carregar])

  // Fecha ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function marcarLida(id: string) {
    await fetch('/api/notificacoes/ler', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    setNaoLidas(prev => Math.max(0, prev - 1))
  }

  async function marcarTodasLidas() {
    setCarregando(true)
    await fetch('/api/notificacoes/ler', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
    setNaoLidas(0)
    setCarregando(false)
  }

  function fmtData(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => { setAberto(v => !v); if (!aberto) carregar() }}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-10 w-[340px] max-h-[480px] flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header do dropdown */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">Notificações</span>
            <div className="flex items-center gap-2">
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  disabled={carregando}
                  className="text-[11px] text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                </button>
              )}
              <button onClick={() => setAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-gray-400">Nenhuma notificação</div>
            ) : notifs.map(n => (
              <div
                key={n.id}
                className={cn(
                  'px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0',
                  !n.lida && n.tipo === 'divergencia_extrato'  && 'bg-red-50/60 dark:bg-red-500/5',
                  !n.lida && n.tipo === 'divergencia_resolvida' && 'bg-green-50/60 dark:bg-green-500/5',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {n.tipo === 'divergencia_extrato'   && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                      {n.tipo === 'divergencia_resolvida' && <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                      <p className={cn('text-[12px] font-semibold leading-tight', n.lida ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100')}>
                        {n.titulo}
                      </p>
                    </div>
                    {n.mensagem && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{n.mensagem}</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{fmtData(n.criado_em)}</p>
                  </div>
                  {!n.lida && (
                    <button
                      onClick={() => marcarLida(n.id)}
                      className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors"
                      title="Marcar como lida"
                    >
                      <span className="w-2 h-2 rounded-full bg-gray-400 block" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Header({ title, description, actions }: HeaderProps) {
  const { usuario } = useAuthContext()
  const { theme, toggleTheme } = useTheme()
  const role = usuario?.role as Role | undefined

  const initials = usuario?.nome
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? 'U'

  return (
    <header className="sticky top-0 z-10 flex items-center h-[56px] px-3 md:px-6 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200/80 dark:border-gray-800 gap-2">
      {/* Hamburguer — só mobile */}
      <button
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
        onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Título */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[14px] md:text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">{title}</h1>
        {description && <p className="hidden sm:block text-[11px] text-gray-400 dark:text-gray-500 leading-tight truncate">{description}</p>}
      </div>

      {/* Actions (botões passados pela página) */}
      {actions && (
        <div className="header-actions flex items-center gap-1.5 flex-shrink-0">
          {actions}
        </div>
      )}

      {/* Atalhos rápidos — ocultos no mobile */}
      <div className="hidden md:flex items-center gap-1 flex-shrink-0">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4" />
            : <Moon className="w-4 h-4" />
          }
        </button>
        {can(role ?? null, 'bobinas.view') && (
          <Link href="/bobinas" title="Bobinas"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Layers className="w-4 h-4" />
          </Link>
        )}
        {can(role ?? null, 'controle_caixas.view') && (
          <Link href="/controle-caixas" title="Controle de Caixas"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
            <CheckSquare className="w-4 h-4" />
          </Link>
        )}
        <NotificationBell />
      </div>

      {/* Tema — só mobile (compacto) */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0"
      >
        {theme === 'dark'
          ? <Sun className="w-4 h-4" />
          : <Moon className="w-4 h-4" />
        }
      </button>

      {/* Notificações — só mobile */}
      <div className="md:hidden flex-shrink-0">
        <NotificationBell />
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
          {initials}
        </div>
        <div className="hidden md:block">
          <p className="text-[13px] font-medium text-gray-900 dark:text-gray-100 leading-tight">{usuario?.nome}</p>
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{usuario?.empresa?.nome ?? 'Todas as empresas'}</p>
            {role && (
              <span className={cn(
                'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide',
                ROLE_COLORS[role],
              )}>
                {ROLE_LABELS[role].split(' ')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
