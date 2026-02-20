import { useState, useEffect, useCallback } from 'react'
import { Settings, Cpu, HardDrive, Sparkles, Download, RefreshCw, Loader2, CheckCircle2, XCircle, Wrench, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useWSMessage } from '@/lib/WebSocketContext'
import type { EngineInfo } from '@/types'
import type { GpuStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

type InstallState = {
  engine: string
  stage: 'installing' | 'complete' | 'error'
  message: string
}

export function SettingsPage() {
  const [engines, setEngines] = useState<EngineInfo[]>([])
  const [gpuName, setGpuName] = useState<string | null>(null)
  const [gpuAvailable, setGpuAvailable] = useState(false)
  const [gpuStatus, setGpuStatus] = useState<GpuStatus | null>(null)
  const [parlerAvailable, setParlerAvailable] = useState<boolean | null>(null)
  const [installing, setInstalling] = useState<InstallState | null>(null)
  const wsMessage = useWSMessage()

  useEffect(() => {
    api.getEngines().then(setEngines).catch(() => {})
    api.health().then((data) => {
      setGpuAvailable(data.gpu_available)
      setGpuName(data.gpu_name)
    }).catch(() => {})
    api.getGpuStatus().then(setGpuStatus).catch(() => {})
    api.getParlerStatus().then((s) => setParlerAvailable(s.available)).catch(() => setParlerAvailable(false))
  }, [])

  // Handle install progress from shared WebSocket
  useEffect(() => {
    if (wsMessage?.type === 'install_progress') {
      setInstalling({
        engine: wsMessage.engine as string,
        stage: wsMessage.stage === 'complete' ? 'complete' : wsMessage.stage === 'error' ? 'error' : 'installing',
        message: (wsMessage.message as string) || '',
      })
    }
  }, [wsMessage])

  const refreshGpu = useCallback(() => {
    api.getGpuStatus()
      .then((status) => {
        setGpuStatus(status)
        toast.success('GPU status refreshed')
      })
      .catch(() => toast.error('Failed to fetch GPU status'))
  }, [])

  const handleInstall = useCallback(async (name: string) => {
    setInstalling({ engine: name, stage: 'installing', message: `Starting ${name} install...` })
    try {
      await api.installEngine(name)
      toast.success(`${name} installed! Restart the server to activate.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to install ${name}`)
    }
  }, [])

  const handleFixCuda = useCallback(async () => {
    setInstalling({ engine: 'cuda', stage: 'installing', message: 'Reinstalling PyTorch with CUDA...' })
    try {
      await api.fixCuda()
      toast.success('PyTorch CUDA installed! Restart the server.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to install CUDA')
    }
  }, [])

  const [restarting, setRestarting] = useState(false)

  const handleRestart = useCallback(async () => {
    setRestarting(true)
    try {
      await api.restart()
    } catch {
      // Expected — server shuts down so the request may fail
    }
    toast.info('Server restarting... page will reload shortly.')
    // Poll until server is back, then reload
    const poll = setInterval(async () => {
      try {
        await api.health()
        clearInterval(poll)
        window.location.reload()
      } catch {
        // Still restarting
      }
    }, 1000)
    // Stop polling after 30s
    setTimeout(() => clearInterval(poll), 30000)
  }, [])

  const isInstallingAny = installing?.stage === 'installing'
  const isInstallingEngine = (name: string) => installing?.engine === name && installing.stage === 'installing'

  const formatGb = (gb: number) => `${gb.toFixed(1)} GB`

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage engines, GPU, and system status
        </p>
      </div>

      {/* Parler-TTS Status */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#d4a259]" />
          <h2 className="font-medium">Voice Designer (Parler-TTS)</h2>
        </div>
        <div className="rounded-lg bg-secondary/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Text-prompted voice creation</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create voices by describing them in natural language
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium',
                parlerAvailable
                  ? 'bg-[#6b8f71]/15 text-[#6b8f71]'
                  : parlerAvailable === false
                  ? 'bg-[#d4a259]/15 text-[#d4a259]'
                  : 'bg-secondary text-muted-foreground'
              )}>
                {parlerAvailable ? 'Available' : parlerAvailable === false ? 'Not Installed' : 'Checking...'}
              </span>
              {parlerAvailable === false && (
                <button
                  onClick={() => handleInstall('parler-tts')}
                  disabled={isInstallingAny}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
                >
                  {isInstallingEngine('parler-tts') ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Install
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GPU Status */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            <h2 className="font-medium">GPU Status</h2>
          </div>
          <button
            onClick={refreshGpu}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="text-xs text-muted-foreground">Device</p>
            <p className="text-sm font-medium mt-1">{gpuName || gpuStatus?.name || 'N/A'}</p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${gpuAvailable ? 'bg-[#6b8f71]' : gpuStatus?.available ? 'bg-[#d4a259]' : 'bg-[#c53d2e]'}`} />
                <p className="text-sm font-medium">{gpuAvailable ? 'CUDA Ready' : gpuStatus?.available ? 'No CUDA' : 'CPU Only'}</p>
              </div>
              {!gpuAvailable && gpuStatus?.available && (
                <button
                  onClick={handleFixCuda}
                  disabled={isInstallingAny}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#d4a259]/15 hover:bg-[#d4a259]/25 text-[#d4a259] transition-colors disabled:opacity-50"
                >
                  {isInstallingEngine('cuda') ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wrench className="w-3.5 h-3.5" />
                  )}
                  Fix
                </button>
              )}
            </div>
          </div>
        </div>

        {gpuStatus?.available && gpuStatus.memory_total_gb && gpuStatus.memory_used_gb && (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-xs text-muted-foreground">VRAM Usage</p>
              <p className="text-sm font-medium mt-1">
                {formatGb(gpuStatus.memory_used_gb)} / {formatGb(gpuStatus.memory_total_gb)}
              </p>
              <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    (gpuStatus.memory_percent ?? 0) > 90 ? 'bg-[#c53d2e]' :
                    (gpuStatus.memory_percent ?? 0) > 70 ? 'bg-[#d4a259]' :
                    'bg-[#6b8f71]'
                  )}
                  style={{ width: `${gpuStatus.memory_percent ?? 0}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-xs text-muted-foreground">GPU Utilization</p>
              <p className="text-sm font-medium mt-1">{gpuStatus.gpu_utilization ?? 0}%</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-4">
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="text-sm font-medium mt-1">
                {gpuStatus.temperature_c != null ? `${gpuStatus.temperature_c}°C` : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Voice Engines */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-primary" />
          <h2 className="font-medium">Voice Engines</h2>
        </div>

        <div className="space-y-3">
          {engines.map((engine) => (
            <div
              key={engine.name}
              className="rounded-lg border border-border p-4 flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{engine.name}</h3>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium',
                    engine.available
                      ? 'bg-[#6b8f71]/15 text-[#6b8f71]'
                      : 'bg-[#d4a259]/15 text-[#d4a259]'
                  )}>
                    {engine.available ? 'Available' : 'Not Installed'}
                  </span>
                  {engine.loaded && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary">
                      Loaded
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{engine.description}</p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>VRAM: {engine.required_vram_gb}GB</span>
                  {engine.supports_cloning && <span>Voice Cloning</span>}
                </div>
              </div>

              {!engine.available && (
                <button
                  onClick={() => handleInstall(engine.name)}
                  disabled={isInstallingAny}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
                >
                  {isInstallingEngine(engine.name) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Install
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Install progress */}
        {installing && (
          <div className={cn(
            'rounded-lg border p-4 space-y-2',
            installing.stage === 'complete' ? 'border-[#6b8f71]/30 bg-[#6b8f71]/5' :
            installing.stage === 'error' ? 'border-[#c53d2e]/30 bg-[#c53d2e]/5' :
            'border-border bg-secondary/30'
          )}>
            <div className="flex items-center gap-2">
              {installing.stage === 'installing' && (
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              )}
              {installing.stage === 'complete' && (
                <CheckCircle2 className="w-4 h-4 text-[#6b8f71] shrink-0" />
              )}
              {installing.stage === 'error' && (
                <XCircle className="w-4 h-4 text-[#c53d2e] shrink-0" />
              )}
              <p className="text-xs font-medium">
                {installing.stage === 'installing' ? `Installing ${installing.engine}...` :
                 installing.stage === 'complete' ? `${installing.engine} installed` :
                 `Failed to install ${installing.engine}`}
              </p>
            </div>
            <p className={cn(
              'text-[11px] text-muted-foreground font-mono pl-6',
              installing.stage === 'installing' ? 'truncate' : 'whitespace-pre-wrap wrap-break-word'
            )}>
              {installing.message}
            </p>
            {installing.stage === 'complete' && (
              <p className="text-[11px] text-[#6b8f71] pl-6">
                Restart the server for changes to take effect.
              </p>
            )}
          </div>
        )}
      </div>

      {/* About */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="font-medium">About</h2>
          </div>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-secondary hover:bg-secondary/80 text-foreground transition-colors disabled:opacity-50"
          >
            {restarting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCw className="w-3.5 h-3.5" />
            )}
            Restart Server
          </button>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>AI Voice Studio v0.1.0</p>
          <p>Local AI-powered voice creation with text-to-voice and audio reference.</p>
          <p>All processing runs on your GPU — no cloud APIs, no fees.</p>
        </div>
      </div>
    </div>
  )
}
