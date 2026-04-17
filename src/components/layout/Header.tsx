'use client'

import Link from 'next/link'
import { useAuthContext } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { ROLE_LABELS, ROLE_COLORS, can } from '@/lib/utils/permissions'
import { cn } from '@/lib/utils/cn'
import type { Role } from '@/types/database.types'
import { Layers, CheckSquare, Sun, Moon, Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
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
