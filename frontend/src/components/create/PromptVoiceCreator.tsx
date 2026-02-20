import { useState, useCallback, useEffect, useRef } from 'react'
import { Sparkles, Save, RotateCcw, Loader2, Star, Zap, HardDrive, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { PromptBuilder } from './PromptBuilder'
import type { VoiceProfile, ParlerModel } from '@/types'

interface PromptVoiceCreatorProps {
  onVoiceCreated: (voice: VoiceProfile) => void
  parlerAvailable: boolean
  models: ParlerModel[]
}

const PROMPT_SUGGESTIONS = [
  "A deep, gravelly male voice with an American accent, speaking slowly and confidently",
  "A soft, melodic young female voice, clear and warm with a gentle tone",
  "An authoritative older male voice, like a news anchor, crisp and professional",
  "A cheerful, energetic young female voice with bright intonation",
]

function StarRating({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground w-11 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <Star
            key={i}
            className={cn(
              'w-3 h-3',
              i < value ? 'fill-[#d4a259] text-[#d4a259]' : 'text-muted-foreground/30'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export function PromptVoiceCreator({ onVoiceCreated, parlerAvailable, models }: PromptVoiceCreatorProps) {
  const [description, setDescription] = useState('')
  const [sampleText, setSampleText] = useState('Hello, this is a preview of my custom voice. I hope you like how it sounds.')
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [voiceName, setVoiceName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [progressPercent, setProgressPercent] = useState(0)
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [temperature, setTemperature] = useState(1.0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPromptBuilder, setShowPromptBuilder] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // Set default model when models are loaded
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      const defaultModel = models.find(m => m.default) || models[0]
      setSelectedModelId(defaultModel.id)
    }
  }, [models, selectedModelId])

  // Connect WebSocket for progress updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/progress`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setProgressMessage(data.message || null)
          setProgressPercent(data.percent || 0)
        }
      } catch {}
    }

    ws.onerror = () => {}
    ws.onclose = () => {}

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!description.trim() || isGenerating) return
    setIsGenerating(true)
    setPreviewAudioUrl(null)
    setShowSave(false)
    setProgressMessage('Starting generation...')
    setProgressPercent(0)

    try {
      const result = await api.previewFromPrompt(
        description.trim(),
        sampleText.trim() || undefined,
        selectedModelId || undefined,
        temperature !== 1.0 ? temperature : undefined,
      )
      setPreviewAudioUrl(result.audio_url)
      setShowSave(true)
      toast.success(`Preview generated (${result.duration.toFixed(1)}s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Preview generation failed')
    } finally {
      setIsGenerating(false)
      setProgressMessage(null)
      setProgressPercent(0)
    }
  }, [description, sampleText, isGenerating, selectedModelId, temperature])

  const handleSave = useCallback(async () => {
    if (!voiceName.trim() || !previewAudioUrl || isSaving) return
    setIsSaving(true)

    try {
      const voice = await api.saveFromPrompt(voiceName.trim(), description.trim(), previewAudioUrl, 'parler-tts')
      toast.success(`Voice saved: ${voice.name}`)
      onVoiceCreated(voice)
      // Reset
      setDescription('')
      setVoiceName('')
      setPreviewAudioUrl(null)
      setShowSave(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save voice')
    } finally {
      setIsSaving(false)
    }
  }, [voiceName, previewAudioUrl, description, isSaving, onVoiceCreated])

  if (!parlerAvailable) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Sparkles className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">Parler-TTS Not Installed</p>
          <p className="text-xs mt-1 text-center max-w-sm">
            Text-prompted voice creation requires Parler-TTS. Run the installer again or install manually:
          </p>
          <code className="mt-2 text-xs bg-black/30 rounded px-3 py-1.5 text-[#6b8f71]">
            pip install parler-tts
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Voice Description */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Describe your voice
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the voice you want to create..."
          rows={3}
          disabled={isGenerating}
          className="w-full px-4 py-3 rounded-lg resize-none bg-secondary/50 border border-border text-foreground text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />

        {/* Prompt builder + suggestion chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPromptBuilder(true)}
            disabled={isGenerating}
            className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3 h-3" />
            Prompt Builder
          </button>
          {PROMPT_SUGGESTIONS.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => setDescription(suggestion)}
              disabled={isGenerating}
              className="text-xs px-3 py-1.5 rounded-full bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              {suggestion.length > 50 ? suggestion.slice(0, 50) + '...' : suggestion}
            </button>
          ))}
        </div>

        {/* Sample text */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sample text (what the voice will say)
          </label>
          <input
            type="text"
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
      </div>

      {/* Model Selection */}
      {models.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Generation Model
          </label>
          <div className="grid gap-2">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                disabled={isGenerating}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all disabled:opacity-50',
                  selectedModelId === model.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border hover:border-muted-foreground bg-secondary/30 hover:bg-secondary/50'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{model.name}</span>
                      {model.default && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{model.description}</p>
                    <div className="flex items-center gap-4 pt-0.5">
                      <StarRating value={model.quality} label="Quality" />
                      <StarRating value={model.speed} label="Speed" />
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <HardDrive className="w-3 h-3" />
                      {model.vram_gb} GB VRAM
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Zap className="w-3 h-3" />
                      {model.download_gb} GB download
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          Advanced Settings
          <ChevronDown className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">
                  Temperature
                </label>
                <span className="text-xs font-mono text-foreground">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={isGenerating}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Consistent</span>
                <span>Default (1.0)</span>
                <span>Creative</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Lower values produce more consistent, predictable voices. Higher values introduce more variation and expressiveness but may sound less stable.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={!description.trim() || isGenerating}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Preview
            </>
          )}
        </button>
        {previewAudioUrl && !isGenerating && (
          <button
            onClick={handleGenerate}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        )}
      </div>

      {/* Progress indicator */}
      {isGenerating && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            <span>{progressMessage || 'Starting generation...'}</span>
          </div>
          {progressPercent > 0 && (
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Audio Preview */}
      {previewAudioUrl && !isGenerating && (
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-3">
            Preview
          </label>
          <audio controls src={previewAudioUrl} className="w-full" />
        </div>
      )}

      {/* Save Section */}
      {showSave && !isGenerating && (
        <div className="rounded-xl border border-[#d4a259]/30 bg-card p-5 space-y-4">
          <p className="text-xs font-medium text-[#d4a259] uppercase tracking-wider">
            Save to Library
          </p>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Voice Name</label>
            <input
              type="text"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              placeholder="My Custom Voice"
              className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={!voiceName.trim() || isSaving}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'bg-[#6b8f71] text-white hover:bg-[#6b8f71]/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save to Library
              </>
            )}
          </button>
        </div>
      )}

      <PromptBuilder
        open={showPromptBuilder}
        onClose={() => setShowPromptBuilder(false)}
        onApply={(prompt) => setDescription(prompt)}
      />
    </div>
  )
}
