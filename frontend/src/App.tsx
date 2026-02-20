import { MainLayout } from '@/components/layout/MainLayout'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { WebSocketProvider } from '@/lib/WebSocketContext'
import { Toaster } from 'sonner'

function App() {
  return (
    <ErrorBoundary>
      <WebSocketProvider>
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            },
          }}
        />
        <MainLayout />
      </WebSocketProvider>
    </ErrorBoundary>
  )
}

export default App
