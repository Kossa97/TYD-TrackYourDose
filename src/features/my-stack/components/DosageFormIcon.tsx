import type { ReactNode } from 'react'
import type { DosageFormKey } from '../types'

interface DosageFormIconProps {
  form: DosageFormKey
  size?: number
}

function IconFrame({
  form,
  size,
  children,
}: DosageFormIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      data-dosage-form-icon={form}
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function DosageFormIcon({ form, size = 22 }: DosageFormIconProps) {
  switch (form) {
    case 'vial':
      return (
        <IconFrame form={form} size={size}>
          <rect x="7.5" y="2.5" width="9" height="3.5" rx="1" />
          <path d="M8.5 6v2.5L6.8 11v8.5A2 2 0 0 0 8.8 21h6.4a2 2 0 0 0 2-1.5V11l-1.7-2.5V6" />
          <path d="M7 13.5h10M9.5 17.2h5" />
        </IconFrame>
      )
    case 'ampoule':
      return (
        <IconFrame form={form} size={size}>
          <path d="M10 2.5h4l-.7 3.2 1.8 3.1v8.4a3.1 3.1 0 0 1-6.2 0V8.8l1.8-3.1L10 2.5Z" />
          <path d="M9 10h6M10.2 15.3c1.2.7 2.4-.7 3.6 0" />
        </IconFrame>
      )
    case 'pen':
      return (
        <IconFrame form={form} size={size}>
          <rect x="3" y="8.5" width="14" height="7" rx="2" />
          <path d="M7 8.5v7M10 10.5v3M17 10.5h3.5v3H17M20.5 12h2" />
          <path d="M4.5 10.5v3" />
        </IconFrame>
      )
    case 'tablet':
      return (
        <IconFrame form={form} size={size}>
          <rect x="3.5" y="7" width="17" height="10" rx="5" />
          <path d="M12 7v10" />
        </IconFrame>
      )
    case 'capsule':
      return (
        <IconFrame form={form} size={size}>
          <path d="m8.2 19.3-3.5-3.5a4.2 4.2 0 0 1 0-6l5.1-5.1a4.2 4.2 0 0 1 6 0l3.5 3.5a4.2 4.2 0 0 1 0 6l-5.1 5.1a4.2 4.2 0 0 1-6 0Z" />
          <path d="m8.2 8.2 7.6 7.6" />
        </IconFrame>
      )
    case 'drops':
      return (
        <IconFrame form={form} size={size}>
          <path d="M12 3s4.5 5 4.5 8a4.5 4.5 0 0 1-9 0C7.5 8 12 3 12 3Z" />
          <path d="M5.5 15.5s2.5 2.8 2.5 4.2a2.5 2.5 0 0 1-5 0c0-1.4 2.5-4.2 2.5-4.2Z" />
          <path d="M18.5 15.5s2.5 2.8 2.5 4.2a2.5 2.5 0 0 1-5 0c0-1.4 2.5-4.2 2.5-4.2Z" />
        </IconFrame>
      )
    case 'liquid':
      return (
        <IconFrame form={form} size={size}>
          <path d="M8 3h8v4l2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l2-2V3Z" />
          <path d="M8 6h8M6 14h12" />
          <path d="M8 17c1.3-.8 2.7.8 4 0s2.7.8 4 0" />
        </IconFrame>
      )
    case 'powder':
      return (
        <IconFrame form={form} size={size}>
          <path d="M6.5 3h11l-1 3 1 3-1 3 1 3-1 6h-9l-1-6 1-3-1-3 1-3-1-3Z" />
          <circle cx="10" cy="14.5" r=".7" fill="currentColor" stroke="none" />
          <circle cx="13.5" cy="16.5" r=".7" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="12.8" r=".7" fill="currentColor" stroke="none" />
        </IconFrame>
      )
    case 'nasal_spray':
      return (
        <IconFrame form={form} size={size}>
          <path d="M8 10h7l2 3v8H7v-8l1-3Z" />
          <path d="M10 10V6h4.5l2-2H21M16.5 4v3M18.5 7h3" />
          <path d="M9 15h6" />
        </IconFrame>
      )
    case 'spray':
      return (
        <IconFrame form={form} size={size}>
          <path d="M7 10h10v10.5H7zM9 7h6v3H9zM11 4h5l2 2h-3" />
          <path d="M19 5.5h2M19.5 8l2 .7M19.5 3l1.8-.8" />
          <path d="M9.5 14.5h5" />
        </IconFrame>
      )
    case 'gel':
      return (
        <IconFrame form={form} size={size}>
          <path d="M12 3.2s4.2 4.7 4.2 7.3a4.2 4.2 0 0 1-8.4 0C7.8 7.9 12 3.2 12 3.2Z" />
          <path d="M4 19c2.2-2.8 4.3-1.3 6.2-2.2 1.6-.8 2.6-2.1 4.4-1.4 1.3.5 2 2 5.4 3.6H4Z" />
          <path d="M10.2 10.8c.2 1 1 1.7 2 1.9" />
        </IconFrame>
      )
    case 'patch':
      return (
        <IconFrame form={form} size={size}>
          <rect x="3.5" y="6" width="17" height="12" rx="4" />
          <rect x="8.5" y="9" width="7" height="6" rx="2" />
          <path d="M6 9h.01M18 9h.01M6 15h.01M18 15h.01" />
        </IconFrame>
      )
    case 'tube':
      return (
        <IconFrame form={form} size={size}>
          <path d="M8 3h8l1 3-2 12H9L7 6l1-3Z" />
          <path d="M7 6h10M9 18h6v3H9zM10 12h4" />
        </IconFrame>
      )
    case 'other':
      return (
        <IconFrame form={form} size={size}>
          <circle cx="7" cy="8" r="3" />
          <rect x="13" y="5" width="6" height="6" rx="1" />
          <path d="m8 19 4-6 4 6H8Z" />
        </IconFrame>
      )
  }
}
