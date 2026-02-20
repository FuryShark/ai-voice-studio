import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileAudio } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioUploaderProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
}

const ACCEPTED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/flac', 'audio/ogg', 'audio/x-wav', 'audio/wave']

export function AudioUploader({ onFileSelect, selectedFile, onClear }: AudioUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (ACCEPTED_TYPES.includes(file.type) || file.name.match(/\.(wav|mp3|flac|ogg)$/i))) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  if (selectedFile) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
        <FileAudio className="w-8 h-8 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
          <p className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground'
      )}
    >
      <Upload className={cn('w-8 h-8', isDragOver ? 'text-primary' : 'text-muted-foreground')} />
      <p className="text-sm text-muted-foreground">
        Drop audio file here or <span className="text-primary">browse</span>
      </p>
      <p className="text-xs text-muted-foreground">WAV, MP3, FLAC, OGG (10-30 seconds recommended)</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.flac,.ogg"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  )
}
