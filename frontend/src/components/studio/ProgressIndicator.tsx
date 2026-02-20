import { Loader2 } from 'lucide-react'

interface ProgressIndicatorProps {
  progress: number
  message: string
  isActive: boolean
}

export function ProgressIndicator({ progress, message, isActive }: ProgressIndicatorProps) {
  if (!isActive) return null

  const percentage = Math.round(progress * 100)

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>{message}</span>
        </div>
        <span className="text-xs text-muted-foreground">{percentage}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
