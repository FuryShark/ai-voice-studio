import { Cpu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

export function Header() {
  const [gpuName, setGpuName] = useState<string | null>(null)
  const [gpuAvailable, setGpuAvailable] = useState(false)
  const [gpuDetected, setGpuDetected] = useState(false)

  useEffect(() => {
    api.health().then((data) => {
      setGpuAvailable(data.gpu_available)
      setGpuName(data.gpu_name)
    }).catch(() => {})
    api.getGpuStatus().then((status) => {
      if (status.available && status.name) {
        setGpuDetected(true)
        setGpuName((prev) => prev || status.name!)
      }
    }).catch(() => {})
  }, [])

  const label = gpuAvailable
    ? gpuName || 'GPU Ready'
    : gpuDetected
    ? gpuName || 'GPU (No CUDA)'
    : 'CPU Mode'

  const dotColor = gpuAvailable
    ? 'bg-[#6b8f71]'
    : gpuDetected
    ? 'bg-[#d4a259]'
    : 'bg-[#c53d2e]'

  return (
    <header className="h-14 border-b border-[#d4a259]/20 flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Cpu className="w-4 h-4" />
        <span>{label}</span>
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      </div>
    </header>
  )
}
