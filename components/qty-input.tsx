'use client'

import { useState, type KeyboardEvent } from 'react'

interface QtyInputProps {
  value: number
  onChange: (quantity: number) => void
  className?: string
  min?: number
}

const ALLOWED_KEYS = [
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End',
]

// border-current/ring-current pick up whatever text-* color each call site
// already applies, so the field reads as editable (bordered box, hover/focus
// feedback) while automatically matching that site's color theme (blue,
// amber, or white-on-dark) without needing to know it here.
const BASE_CLASSES =
  'rounded-md border border-current/25 px-1.5 py-0.5 cursor-text ' +
  'transition-colors hover:border-current/50 ' +
  'focus:outline-none focus:border-current focus:ring-2 focus:ring-current/20'

// Typeable quantity field — lets a shopper type e.g. "250" directly instead
// of clicking +/- hundreds of times for a bulk order. Supports decimals for
// weight-sold items (kg, etc.). Mirrors the cart-quantity-input pattern used
// in syd-pos: a raw text buffer decoupled from the committed value while
// focused (so backspacing to clear or typing a trailing "." doesn't snap
// back), select-all on focus, and reverts to `min` on blur if left invalid.
export function QtyInput({ value, onChange, className = '', min = 1 }: QtyInputProps) {
  const [raw, setRaw] = useState(String(value))
  const [prevValue, setPrevValue] = useState(value)
  const [focused, setFocused] = useState(false)

  if (value !== prevValue) {
    setPrevValue(value)
    if (!focused) setRaw(String(value))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (ALLOWED_KEYS.includes(e.key) || e.ctrlKey || e.metaKey) return
    if (/^[0-9]$/.test(e.key)) return
    if (e.key === '.' && !e.currentTarget.value.includes('.')) return
    e.preventDefault()
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={raw}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const text = e.target.value
        setRaw(text)
        const parsed = parseFloat(text)
        if (!isNaN(parsed) && parsed > 0) onChange(parsed)
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(raw)
        if (isNaN(parsed) || parsed < min) {
          setRaw(String(min))
          onChange(min)
        } else {
          setRaw(String(parsed))
        }
      }}
      className={`${BASE_CLASSES} ${className}`}
    />
  )
}
