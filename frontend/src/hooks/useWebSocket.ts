import { useEffect, useRef, useCallback, useState } from 'react'

interface WSMessage {
  type: string
  progress?: number
  message?: string
  [key: string]: unknown
}

const MAX_RETRIES = 10
const BASE_DELAY = 1000
const MAX_DELAY = 30000

export function useWebSocket(path: string) {
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
      const host = window.location.host
      const url = `${protocol}//${host}${path}`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (unmounted) { ws.close(); return }
        setConnected(true)
        retryCountRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
        } catch {
          // ignore non-JSON
        }
      }

      ws.onclose = () => {
        if (unmounted) return
        setConnected(false)

        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(
            BASE_DELAY * Math.pow(2, retryCountRef.current),
            MAX_DELAY,
          )
          retryCountRef.current++
          timeoutRef.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      unmounted = true
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      wsRef.current?.close()
    }
  }, [path])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { lastMessage, connected, send }
}
