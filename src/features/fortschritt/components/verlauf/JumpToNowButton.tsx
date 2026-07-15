interface Props {
  onClick: () => void
}

/** Springt aus der Vergangenheit zurück ans rechte Ende des Verlaufs. */
export function JumpToNowButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 10,
        zIndex: 3,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: '0.6rem',
        fontWeight: 800,
        cursor: 'pointer',
        background: 'var(--accent-weak)',
        color: 'var(--accent)',
        border: '1px solid var(--accent-border)',
      }}
    >
      Jetzt
    </button>
  )
}
