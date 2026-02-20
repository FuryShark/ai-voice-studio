import type { HealthResponse, EngineInfo, VoiceProfile, PreviewResponse, ParlerStatus } from '@/types'

const API_BASE = '/api'
const DEFAULT_TIMEOUT = 15_000
const LONG_TIMEOUT = 600_000 // 10 min for installs/cuda fixes

async function fetchJSON<T>(
  url: string,
  options?: RequestInit & { timeout?: number },
): Promise<T> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  const callerSignal = options?.signal
  if (callerSignal?.aborted) {
    clearTimeout(timeoutId)
    throw new DOMException('Aborted', 'AbortError')
  }
  callerSignal?.addEventListener('abort', () => controller.abort())

  try {
    const { timeout: _t, ...fetchOpts } = options ?? {}
    const res = await fetch(`${API_BASE}${url}`, {
      ...fetchOpts,
      signal: controller.signal,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(error.detail || error.message || `HTTP ${res.status}`)
    }
    return res.json()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (callerSignal?.aborted) throw err
      throw new Error('Request timed out')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

export interface GpuStatus {
  available: boolean
  name?: string
  memory_total_gb?: number
  memory_used_gb?: number
  memory_free_gb?: number
  memory_percent?: number
  gpu_utilization?: number
  temperature_c?: number | null
  error?: string
}

export const api = {
  health: () => fetchJSON<HealthResponse>('/health'),

  // Engines
  getEngines: () => fetchJSON<EngineInfo[]>('/tts/engines'),

  installEngine: (name: string) =>
    fetchJSON<{ status: string; engine: string; message: string }>(
      `/tts/engines/install/${name}`,
      { method: 'POST', timeout: LONG_TIMEOUT },
    ),

  // Voice creation - from prompt
  getParlerStatus: () => fetchJSON<ParlerStatus>('/voices/create/parler-status'),

  previewFromPrompt: async (description: string, sampleText?: string, modelId?: string, temperature?: number): Promise<PreviewResponse> => {
    const formData = new FormData()
    formData.append('description', description)
    if (sampleText) formData.append('sample_text', sampleText)
    if (modelId) formData.append('model_id', modelId)
    if (temperature !== undefined) formData.append('temperature', String(temperature))
    // No timeout — generation can take minutes. Backend heartbeat shows progress,
    // and disconnect detection cancels if the tab is closed.
    const res = await fetch(`${API_BASE}/voices/create/preview-from-prompt`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Preview generation failed' }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },

  saveFromPrompt: async (name: string, description: string, audioUrl: string, engine: string): Promise<VoiceProfile> => {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('description', description)
    formData.append('audio_url', audioUrl)
    formData.append('engine', engine)
    const res = await fetch(`${API_BASE}/voices/create/save-from-prompt`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Save failed' }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },

  // Voice creation - from audio
  createFromAudio: async (formData: FormData): Promise<VoiceProfile> => {
    const res = await fetch(`${API_BASE}/voices/create/from-audio`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Voice creation failed' }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },

  // Voice library
  getVoices: () => fetchJSON<VoiceProfile[]>('/voices'),

  deleteVoice: (id: string) =>
    fetchJSON<{ status: string }>(`/voices/${id}`, { method: 'DELETE' }),

  getVoiceAudioUrl: (id: string) => `${API_BASE}/voices/${id}/audio`,

  exportVoice: (id: string) => {
    window.open(`${API_BASE}/voices/${id}/export`, '_blank')
  },

  importVoice: async (file: File): Promise<VoiceProfile> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/voices/import`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Import failed' }))
      throw new Error(error.detail || `HTTP ${res.status}`)
    }
    return res.json()
  },

  // GPU
  getGpuStatus: () => fetchJSON<GpuStatus>('/gpu/status'),

  fixCuda: () =>
    fetchJSON<{ status: string; message: string }>(
      '/gpu/fix-cuda',
      { method: 'POST', timeout: LONG_TIMEOUT },
    ),

  restart: () =>
    fetchJSON<{ status: string }>(
      '/restart',
      { method: 'POST' },
    ),
}
