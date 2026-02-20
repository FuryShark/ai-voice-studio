import { useRef, useEffect, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Download, RotateCcw, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudioPlayerProps {
  audioUrl: string | null
}

export function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [volume, setVolume] = useState(1.0)

  useEffect(() => {
    if (!containerRef.current) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#292220',
      progressColor: '#c53d2e',
      cursorColor: '#d4a259',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 80,
      normalize: true,
      backend: 'WebAudio',
    })

    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))
    ws.on('timeupdate', (time) => setCurrentTime(time))
    ws.on('decode', (duration) => setTotalDuration(duration))

    wavesurferRef.current = ws

    return () => {
      ws.destroy()
    }
  }, [])

  useEffect(() => {
    if (audioUrl && wavesurferRef.current) {
      wavesurferRef.current.load(audioUrl)
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [audioUrl])

  const togglePlayPause = useCallback(() => {
    wavesurferRef.current?.playPause()
  }, [])

  const restart = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(0)
      wavesurferRef.current.play()
    }
  }, [])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(v)
    }
  }, [])

  const toggleMute = useCallback(() => {
    const newVol = volume > 0 ? 0 : 1.0
    setVolume(newVol)
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVol)
    }
  }, [volume])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!audioUrl) {
    return (
      <div className="rounded-lg border border-border bg-secondary/30 p-6">
        <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
          Generated audio will appear here
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
      <div ref={containerRef} className="w-full" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <button
            onClick={restart}
            aria-label="Restart"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground ml-2">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Volume"
              className="w-20 h-1.5 rounded-lg appearance-none cursor-pointer accent-primary bg-secondary"
            />
          </div>

          <a
            href={audioUrl}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </div>
    </div>
  )
}
