interface DoseUnitControlProps {
  label: string
  unit: string
  units: string[]
  locked: boolean
  onChange: (unit: string) => void
  className?: string
}

export function DoseUnitControl({
  label,
  unit,
  units,
  locked,
  onChange,
  className = '',
}: DoseUnitControlProps) {
  if (locked) {
    return (
      <input
        aria-label={label}
        className={`input min-h-11 ${className}`}
        value={unit}
        readOnly
      />
    )
  }

  return (
    <select
      aria-label={label}
      className={`select min-h-11 ${className}`}
      value={unit}
      onChange={event => onChange(event.target.value)}
    >
      {units.map(option => <option key={option}>{option}</option>)}
    </select>
  )
}
