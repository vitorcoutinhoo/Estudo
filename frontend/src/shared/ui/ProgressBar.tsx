export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`progress-fill ${value >= 100 ? 'is-complete' : ''}`} style={{ width: `${value}%` }} />
    </div>
  )
}
