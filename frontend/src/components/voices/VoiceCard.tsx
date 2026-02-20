import { useState, useRef } from 'react'
import { Trash2, Mic, Download, Play, Pause, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { VoiceProfile } from '@/types'

interface VoiceCardProps {
  voice: VoiceProfile
  onDelete: () => void
}

export function VoiceCard({ voice, onDelete }: VoiceCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlayToggle = () => {
    if (!audioRef.current) {
      const audio = new Audio(api.getVoiceAudioUrl(voice.id))
      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => setIsPlaying(false)
      audioRef.current = audio
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => setIsPlaying(false))
      setIsPlaying(true)
    }
  }

  const isFromPrompt = voice.source === 'prompt'

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-muted-foreground/50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
            isFromPrompt ? 'bg-[#d4a259]/15' : 'bg-primary/15'
          )}>
            {isFromPrompt ? (
              <Sparkles className="w-5 h-5 text-[#d4a259]" />
            ) : (
              <Mic className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-sm truncate">{voice.name}</h3>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{voice.engine}</span>
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-medium',
                isFromPrompt
                  ? 'bg-[#d4a259]/15 text-[#d4a259]'
                  : 'bg-primary/15 text-primary'
              )}>
                {isFromPrompt ? 'Prompt' : 'Audio'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Delete voice"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Description (for prompt-created voices) */}
      {voice.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {voice.description}
        </p>
      )}

      {/* Created date */}
      <p className="text-xs text-muted-foreground">
        {new Date(voice.created_at).toLocaleDateString()}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePlayToggle}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
            isPlaying
              ? 'bg-primary/15 text-primary'
              : 'bg-secondary hover:bg-secondary/80 text-foreground'
          )}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Playing' : 'Preview'}
        </button>
        <button
          onClick={() => api.exportVoice(voice.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-[#6b8f71]/15 text-[#6b8f71] hover:bg-[#6b8f71]/25 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </div>
    </div>
  )
}
