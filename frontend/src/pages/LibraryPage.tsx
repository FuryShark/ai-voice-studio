import { useState, useEffect, useCallback, useRef } from 'react'
import { Library, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { VoiceCard } from '@/components/voices/VoiceCard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { api } from '@/lib/api'
import type { VoiceProfile } from '@/types'

export function LibraryPage() {
  const [voices, setVoices] = useState<VoiceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<VoiceProfile | null>(null)

  const loadVoices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getVoices()
      setVoices(data)
    } catch (err) {
      console.error('Failed to load voices:', err)
      toast.error('Failed to load voices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVoices()
  }, [loadVoices])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await api.deleteVoice(deleteTarget.id)
      toast.success(`Deleted voice: ${deleteTarget.name}`)
      loadVoices()
    } catch (err) {
      console.error('Failed to delete voice:', err)
      toast.error('Failed to delete voice')
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, loadVoices])

  const importRef = useRef<HTMLInputElement>(null)
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imported = await api.importVoice(file)
      toast.success(`Imported voice: ${imported.name}`)
      loadVoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }, [loadVoices])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Voice Library</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and export your created voices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>

      {/* Voice Grid */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 mb-4 animate-spin opacity-50" />
            <p className="text-sm">Loading voices...</p>
          </div>
        </div>
      ) : voices.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Library className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No voices yet</p>
            <p className="text-sm mt-1">Create a voice from the Create page to get started</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              onDelete={() => setDeleteTarget(voice)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Voice"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
