import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import type { PageId } from '@/types'
import { CreatePage } from '@/pages/CreatePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { SettingsPage } from '@/pages/SettingsPage'

export function MainLayout() {
  const [activePage, setActivePage] = useState<PageId>('create')
  const [libraryKey, setLibraryKey] = useState(0)

  const handleVoiceCreated = useCallback(() => {
    setLibraryKey((k) => k + 1)
    setActivePage('library')
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className={activePage === 'create' ? '' : 'hidden'}>
            <CreatePage onVoiceCreated={handleVoiceCreated} />
          </div>
          <div className={activePage === 'library' ? '' : 'hidden'}>
            <LibraryPage key={libraryKey} />
          </div>
          <div className={activePage === 'settings' ? '' : 'hidden'}>
            <SettingsPage />
          </div>
        </main>
      </div>
    </div>
  )
}
