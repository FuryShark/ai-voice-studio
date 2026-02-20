import { Sparkles, Library, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PageId } from '@/types'

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
}

const navItems: { id: PageId; label: string; icon: typeof Sparkles }[] = [
  { id: 'create', label: 'Create', icon: Sparkles },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-16 lg:w-56 bg-sidebar flex flex-col border-r border-border h-full shrink-0">
      {/* Logo — Enso circle with 声 kanji */}
      <div className="h-14 flex items-center px-3 lg:px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full border-2 border-primary/60 flex items-center justify-center">
            <span
              className="text-base font-bold text-primary"
              style={{ fontFamily: "'Noto Serif JP', serif" }}
            >
              声
            </span>
          </div>
          <div className="hidden lg:block">
            <span className="text-sm font-semibold text-foreground tracking-wide">
              Voice Studio
            </span>
            <span className="block text-[10px] text-muted-foreground tracking-widest uppercase">
              Voice Creator
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 lg:px-3 space-y-1">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              'w-full flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-lg text-sm transition-colors border-l-2',
              activePage === id
                ? 'bg-primary/10 text-primary border-primary'
                : 'text-sidebar-foreground hover:text-foreground hover:bg-secondary border-transparent'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </button>
        ))}
      </nav>

      {/* Version — with seigaiha wave texture */}
      <div className="px-3 lg:px-4 py-3 border-t border-border seigaiha-pattern">
        <p className="hidden lg:block text-xs text-muted-foreground">
          AI Voice Studio v0.1.0
        </p>
      </div>
    </aside>
  )
}
