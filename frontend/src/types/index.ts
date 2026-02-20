export interface EngineInfo {
  name: string
  description: string
  available: boolean
  supports_cloning: boolean
  supports_emotion: boolean
  required_vram_gb: number
  builtin_voices: string[]
  loaded: boolean
}

export interface VoiceProfile {
  id: string
  name: string
  engine: string
  reference_audio_path: string | null
  reference_text: string | null
  settings: Record<string, unknown>
  created_at: string
  source: 'audio' | 'prompt'
  description: string | null
}

export interface HealthResponse {
  status: string
  gpu_available: boolean
  gpu_name: string | null
}

export interface PreviewResponse {
  audio_url: string
  duration: number
  model_id: string
}

export interface ParlerModel {
  id: string
  hf_name: string
  name: string
  quality: number
  speed: number
  vram_gb: number
  download_gb: number
  description: string
  sample_rate: number
  default: boolean
}

export interface ParlerStatus {
  available: boolean
  models: ParlerModel[]
}

export type PageId = 'create' | 'library' | 'settings'
