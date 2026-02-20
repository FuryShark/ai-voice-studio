import { useState, useCallback } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { AudioUploader } from '@/components/voices/AudioUploader'
import { cn } from '@/lib/utils'
import type { VoiceProfile } from '@/types'

interface AudioVoiceCreatorProps {
  onVoiceCreated: (voice: VoiceProfile) => void
}

export function AudioVoiceCreator({ onVoiceCreated }: AudioVoiceCreatorProps) {
  const [name, setName] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [referenceText, setReferenceText] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !audioFile || isCreating) return
    setIsCreating(true)

    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('audio', audioFile)
      if (referenceText.trim()) {
        formData.append('reference_text', referenceText.trim())
      }

      const voice = await api.createFromAudio(formData)
      toast.success(`Voice created: ${voice.name}`)
      onVoiceCreated(voice)
      // Reset
      setName('')
      setAudioFile(null)
      setReferenceText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Voice creation failed')
    } finally {
      setIsCreating(false)
    }
  }, [name, audioFile, referenceText, isCreating, onVoiceCreated])

  return (
    <div className="space-y-4">
      {/* Voice Name */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Voice Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Voice"
            disabled={isCreating}
            className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>
      </div>

      {/* Audio Upload */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Reference Audio
        </label>
        <AudioUploader
          onFileSelect={setAudioFile}
          selectedFile={audioFile}
          onClear={() => setAudioFile(null)}
        />
      </div>

      {/* Reference Text */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Reference Text (optional)
        </label>
        <textarea
          value={referenceText}
          onChange={(e) => setReferenceText(e.target.value)}
          placeholder="Transcription of the audio clip (improves voice quality in other tools)..."
          rows={2}
          disabled={isCreating}
          className="w-full px-4 py-3 rounded-lg resize-none bg-secondary/50 border border-border text-foreground text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>

      {/* Create Button */}
      <button
        onClick={handleCreate}
        disabled={!name.trim() || !audioFile || isCreating}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating voice...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Create Voice
          </>
        )}
      </button>
    </div>
  )
}
