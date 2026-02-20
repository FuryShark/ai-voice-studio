import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface WSMessage {
  type: string
  [key: string]: unknown
}

interface WebSocketContextValue {
  lastMessage: WSMessage | null
  connected: boolean
}

const WebSocketContext = createContext<WebSocketContextValue>({
  lastMessage: null,
  connected: false,
})

const MAX_RETRIES = 10
const BASE_DELAY = 1000
const MAX_DELAY = 30000

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let unmounted = false

    function connect() {
      if (unmounted) return

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/progress`)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmounted) { ws.close(); return }
        setConnected(true)
        retryCountRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          setLastMessage(JSON.parse(event.data))
        } catch {}
      }

      ws.onclose = () => {
        if (unmounted) return
        setConnected(false)
        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY * 2 ** retryCountRef.current, MAX_DELAY)
          retryCountRef.current++
          timeoutRef.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      unmounted = true
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      wsRef.current?.close()
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ lastMessage, connected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWSMessage(): WSMessage | null {
  return useContext(WebSocketContext).lastMessage
}
