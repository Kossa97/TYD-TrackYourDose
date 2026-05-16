import { useEffect, useState } from 'react'

/** Returns [isNew, dismiss]. "isNew" is true until the user interacts once. */
export function useNew(key: string): [boolean, () => void] {
  const storageKey = `_new_${key}`
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(!localStorage.getItem(storageKey))
  }, [storageKey])

  const dismiss = () => {
    localStorage.setItem(storageKey, '1')
    setShow(false)
  }

  return [show, dismiss]
}
