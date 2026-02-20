import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PromptBuilderProps {
  open: boolean
  onClose: () => void
  onApply: (prompt: string) => void
}

// --- Data ---

interface AccentRegion {
  country: string
  regions: string[]
}

const ACCENT_OPTIONS: AccentRegion[] = [
  { country: 'American', regions: ['General American', 'Southern', 'New York', 'Midwestern', 'Californian', 'Boston', 'Texan'] },
  { country: 'British', regions: ['Received Pronunciation', 'London', 'Northern English', 'Scottish', 'Welsh', 'Irish'] },
  { country: 'Australian', regions: ['General Australian', 'Broad Australian'] },
  { country: 'Indian', regions: ['General Indian', 'Hindi-accented', 'Tamil-accented'] },
  { country: 'Canadian', regions: ['General Canadian', 'Quebecois-influenced'] },
  { country: 'South African', regions: ['General South African'] },
  { country: 'German', regions: ['German-accented'] },
  { country: 'French', regions: ['French-accented'] },
  { country: 'Spanish', regions: ['Spanish-accented', 'Latin American-accented'] },
  { country: 'East Asian', regions: ['Chinese-accented', 'Japanese-accented', 'Korean-accented'] },
]

interface LabeledOption {
  label: string
  description: string
  promptText: string
}

const AGE_OPTIONS: LabeledOption[] = [
  { label: 'Child', description: '~5-12 years', promptText: "A child's voice" },
  { label: 'Teenager', description: '~13-19 years', promptText: "A teenager's voice" },
  { label: 'Young Adult', description: '~20-35 years', promptText: 'A young adult voice' },
  { label: 'Middle-Aged', description: '~36-55 years', promptText: 'A middle-aged voice' },
  { label: 'Senior', description: '~56+ years', promptText: 'An older voice' },
]

interface SliderOption {
  value: number
  label: string
  promptText: string
}

const VOICE_CHARACTER_OPTIONS: SliderOption[] = [
  { value: 1, label: 'Very Feminine', promptText: 'very feminine' },
  { value: 2, label: 'Feminine', promptText: 'feminine' },
  { value: 3, label: 'Androgynous', promptText: 'androgynous' },
  { value: 4, label: 'Masculine', promptText: 'masculine' },
  { value: 5, label: 'Very Masculine', promptText: 'very masculine' },
]

const PITCH_OPTIONS: SliderOption[] = [
  { value: 1, label: 'Very Low', promptText: 'very low pitch' },
  { value: 2, label: 'Low', promptText: 'low pitch' },
  { value: 3, label: 'Medium', promptText: 'medium pitch' },
  { value: 4, label: 'High', promptText: 'high pitch' },
  { value: 5, label: 'Very High', promptText: 'very high pitch' },
]

const SPEED_OPTIONS: SliderOption[] = [
  { value: 1, label: 'Very Slow', promptText: 'speaking very slowly' },
  { value: 2, label: 'Slow', promptText: 'speaking slowly' },
  { value: 3, label: 'Moderate', promptText: 'speaking at a moderate pace' },
  { value: 4, label: 'Fast', promptText: 'speaking quickly' },
  { value: 5, label: 'Very Fast', promptText: 'speaking very quickly' },
]

const ENERGY_OPTIONS: SliderOption[] = [
  { value: 1, label: 'Very Calm', promptText: 'speaking very calmly' },
  { value: 2, label: 'Calm', promptText: 'speaking calmly' },
  { value: 3, label: 'Moderate', promptText: 'with moderate energy' },
  { value: 4, label: 'Energetic', promptText: 'speaking energetically' },
  { value: 5, label: 'Very Energetic', promptText: 'speaking with high energy and enthusiasm' },
]

const HEALTH_OPTIONS: LabeledOption[] = [
  { label: 'Clear', description: 'Clean, healthy voice', promptText: 'clear and clean' },
  { label: 'Slightly Hoarse', description: 'Mild roughness', promptText: 'slightly hoarse' },
  { label: 'Breathy', description: 'Airy, whispery quality', promptText: 'breathy and airy' },
  { label: 'Gravelly', description: 'Rough, textured voice', promptText: 'gravelly and rough' },
  { label: 'Nasal', description: 'Resonating through the nose', promptText: 'with a nasal quality' },
  { label: 'Raspy', description: 'Scratchy, worn quality', promptText: 'raspy' },
]

interface SimpleOption {
  label: string
  promptText: string
}

const TONE_OPTIONS: SimpleOption[] = [
  { label: 'Warm', promptText: 'warm' },
  { label: 'Cold', promptText: 'cold' },
  { label: 'Soft', promptText: 'soft' },
  { label: 'Authoritative', promptText: 'authoritative' },
  { label: 'Cheerful', promptText: 'cheerful' },
  { label: 'Serious', promptText: 'serious' },
  { label: 'Soothing', promptText: 'soothing' },
  { label: 'Crisp', promptText: 'crisp and clear' },
]

// --- State ---

interface BuilderState {
  accentCountry: string | null
  accentRegion: string | null
  age: string | null
  voiceCharacter: number | null
  pitch: number | null
  speed: number | null
  energy: number | null
  health: string | null
  tone: string | null
}

const INITIAL_STATE: BuilderState = {
  accentCountry: null,
  accentRegion: null,
  age: null,
  voiceCharacter: null,
  pitch: null,
  speed: null,
  energy: null,
  health: null,
  tone: null,
}

// --- Prompt Assembly ---

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

function buildPrompt(state: BuilderState): string {
  const parts: string[] = []

  // Age + voice character
  const ageOpt = AGE_OPTIONS.find(a => a.label === state.age)
  const charOpt = state.voiceCharacter != null
    ? VOICE_CHARACTER_OPTIONS.find(v => v.value === state.voiceCharacter)
    : null

  if (ageOpt && charOpt) {
    parts.push(`${ageOpt.promptText} with a ${charOpt.promptText} quality`)
  } else if (ageOpt) {
    parts.push(ageOpt.promptText)
  } else if (charOpt) {
    parts.push(`A ${charOpt.promptText} voice`)
  }

  // Voice quality / health
  const healthOpt = HEALTH_OPTIONS.find(h => h.label === state.health)
  if (healthOpt) {
    if (parts.length === 0) {
      parts.push(`A ${healthOpt.promptText} voice`)
    } else {
      parts.push(healthOpt.promptText)
    }
  }

  // Tone
  const toneOpt = TONE_OPTIONS.find(t => t.label === state.tone)
  if (toneOpt) {
    if (parts.length === 0) {
      parts.push(`A ${toneOpt.promptText} voice`)
    } else {
      parts.push(`with a ${toneOpt.promptText} tone`)
    }
  }

  // Pitch
  const pitchOpt = state.pitch != null
    ? PITCH_OPTIONS.find(p => p.value === state.pitch)
    : null
  if (pitchOpt) {
    if (parts.length === 0) {
      parts.push(`A voice with ${pitchOpt.promptText}`)
    } else {
      parts.push(pitchOpt.promptText)
    }
  }

  // Speed
  const speedOpt = state.speed != null
    ? SPEED_OPTIONS.find(s => s.value === state.speed)
    : null
  if (speedOpt) parts.push(speedOpt.promptText)

  // Energy
  const energyOpt = state.energy != null
    ? ENERGY_OPTIONS.find(e => e.value === state.energy)
    : null
  if (energyOpt) parts.push(energyOpt.promptText)

  // Accent (always last)
  if (state.accentRegion) {
    parts.push(`with ${articleFor(state.accentRegion)} ${state.accentRegion} accent`)
  } else if (state.accentCountry) {
    parts.push(`with ${articleFor(state.accentCountry)} ${state.accentCountry} accent`)
  }

  if (parts.length === 0) return ''

  let result = parts.join(', ')
  result = result.charAt(0).toUpperCase() + result.slice(1)
  if (!result.endsWith('.')) result += '.'

  return result
}

// --- Sub-components ---

function CategoryLabel({ children, onClear }: { children: React.ReactNode; onClear?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {children}
      </span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function SelectableChip({
  label,
  description,
  selected,
  onClick,
}: {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2 rounded-lg text-xs border transition-colors text-left',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50'
      )}
    >
      <span className="font-medium">{label}</span>
      {description && (
        <span className="block text-[10px] opacity-70 mt-0.5">{description}</span>
      )}
    </button>
  )
}

function NullableSlider({
  value,
  onChange,
  options,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  options: SliderOption[]
  label: string
}) {
  const isSet = value !== null
  const displayValue = value ?? Math.ceil(options.length / 2)

  return (
    <div className="space-y-2">
      <CategoryLabel onClear={isSet ? () => onChange(null) : undefined}>
        {label}
      </CategoryLabel>
      <div className={cn('space-y-1.5 transition-opacity', !isSet && 'opacity-30')}>
        <input
          type="range"
          min={1}
          max={options.length}
          step={1}
          value={displayValue}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between">
          {options.map((opt) => (
            <span
              key={opt.value}
              className={cn(
                'text-[10px]',
                isSet && value === opt.value ? 'text-primary font-medium' : 'text-muted-foreground'
              )}
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>
      {!isSet && (
        <p className="text-[10px] text-muted-foreground italic">Drag slider to set</p>
      )}
    </div>
  )
}

// --- Main Component ---

export function PromptBuilder({ open, onClose, onApply }: PromptBuilderProps) {
  const [state, setState] = useState<BuilderState>(INITIAL_STATE)

  // Reset state when modal opens
  useEffect(() => {
    if (open) setState(INITIAL_STATE)
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const update = useCallback(<K extends keyof BuilderState>(key: K, value: BuilderState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }, [])

  const prompt = useMemo(() => buildPrompt(state), [state])

  const selectedCountry = ACCENT_OPTIONS.find(a => a.country === state.accentCountry)

  const handleApply = () => {
    if (prompt) {
      onApply(prompt)
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl mx-4 rounded-xl border border-border bg-card shadow-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Prompt Builder</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Accent */}
          <div className="space-y-2">
            <CategoryLabel onClear={state.accentCountry ? () => { update('accentCountry', null); update('accentRegion', null) } : undefined}>
              Accent
            </CategoryLabel>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={state.accentCountry ?? ''}
                onChange={(e) => {
                  const val = e.target.value || null
                  update('accentCountry', val)
                  update('accentRegion', null)
                }}
                className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Not set</option>
                {ACCENT_OPTIONS.map((a) => (
                  <option key={a.country} value={a.country}>{a.country}</option>
                ))}
              </select>
              {selectedCountry && (
                <select
                  value={state.accentRegion ?? ''}
                  onChange={(e) => update('accentRegion', e.target.value || null)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Regional (any)</option>
                  {selectedCountry.regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Age */}
          <div className="space-y-2">
            <CategoryLabel onClear={state.age ? () => update('age', null) : undefined}>
              Age
            </CategoryLabel>
            <div className="flex flex-wrap gap-2">
              {AGE_OPTIONS.map((opt) => (
                <SelectableChip
                  key={opt.label}
                  label={opt.label}
                  description={opt.description}
                  selected={state.age === opt.label}
                  onClick={() => update('age', state.age === opt.label ? null : opt.label)}
                />
              ))}
            </div>
          </div>

          {/* Voice Character */}
          <NullableSlider
            label="Voice Character"
            value={state.voiceCharacter}
            onChange={(v) => update('voiceCharacter', v)}
            options={VOICE_CHARACTER_OPTIONS}
          />

          {/* Pitch */}
          <NullableSlider
            label="Pitch"
            value={state.pitch}
            onChange={(v) => update('pitch', v)}
            options={PITCH_OPTIONS}
          />

          {/* Speed */}
          <NullableSlider
            label="Speed"
            value={state.speed}
            onChange={(v) => update('speed', v)}
            options={SPEED_OPTIONS}
          />

          {/* Energy */}
          <NullableSlider
            label="Energy"
            value={state.energy}
            onChange={(v) => update('energy', v)}
            options={ENERGY_OPTIONS}
          />

          {/* Voice Quality */}
          <div className="space-y-2">
            <CategoryLabel onClear={state.health ? () => update('health', null) : undefined}>
              Voice Quality
            </CategoryLabel>
            <div className="flex flex-wrap gap-2">
              {HEALTH_OPTIONS.map((opt) => (
                <SelectableChip
                  key={opt.label}
                  label={opt.label}
                  description={opt.description}
                  selected={state.health === opt.label}
                  onClick={() => update('health', state.health === opt.label ? null : opt.label)}
                />
              ))}
            </div>
          </div>

          {/* Tone */}
          <div className="space-y-2">
            <CategoryLabel onClear={state.tone ? () => update('tone', null) : undefined}>
              Tone
            </CategoryLabel>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((opt) => (
                <SelectableChip
                  key={opt.label}
                  label={opt.label}
                  selected={state.tone === opt.label}
                  onClick={() => update('tone', state.tone === opt.label ? null : opt.label)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 shrink-0 space-y-3">
          {/* Preview */}
          <div className="rounded-lg bg-secondary/30 px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Preview</p>
            {prompt ? (
              <p className="text-sm text-foreground italic">{prompt}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No characteristics selected</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setState(INITIAL_STATE)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!prompt}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                Apply to Description
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
