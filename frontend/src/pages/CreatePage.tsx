import { useState, useEffect } from 'react'
import { Sparkles, Mic } from 'lucide-react'
import { api } from '@/lib/api'
import { PromptVoiceCreator } from '@/components/create/PromptVoiceCreator'
import { AudioVoiceCreator } from '@/components/create/AudioVoiceCreator'
import { cn } from '@/lib/utils'
import type { VoiceProfile, ParlerModel } from '@/types'

type CreateMode = 'prompt' | 'audio'

interface CreatePageProps {
  onVoiceCreated?: (voice: VoiceProfile) => void
}

export function CreatePage({ onVoiceCreated }: CreatePageProps) {
  const [mode, setMode] = useState<CreateMode>('prompt')
  const [parlerAvailable, setParlerAvailable] = useState<boolean | null>(null)
  const [parlerModels, setParlerModels] = useState<ParlerModel[]>([])

  useEffect(() => {
    api.getParlerStatus()
      .then((status) => {
        setParlerAvailable(status.available)
        setParlerModels(status.models || [])
      })
      .catch(() => setParlerAvailable(false))
  }, [])

  const handleVoiceCreated = (voice: VoiceProfile) => {
    onVoiceCreated?.(voice)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Voice</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Design a new voice from a description or clone from audio
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
        <button
          onClick={() => setMode('prompt')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors',
            mode === 'prompt'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Sparkles className="w-4 h-4" />
          Describe a Voice
        </button>
        <button
          onClick={() => setMode('audio')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors',
            mode === 'audio'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Mic className="w-4 h-4" />
          From Audio Reference
        </button>
      </div>

      {/* Content */}
      {mode === 'prompt' ? (
        <PromptVoiceCreator
          onVoiceCreated={handleVoiceCreated}
          parlerAvailable={parlerAvailable === true}
          models={parlerModels}
        />
      ) : (
        <AudioVoiceCreator onVoiceCreated={handleVoiceCreated} />
      )}
    </div>
  )
}
