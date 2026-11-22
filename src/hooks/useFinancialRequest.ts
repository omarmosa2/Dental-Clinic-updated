import { useRef } from 'react'

// Retain the key after a transport failure; edited data starts a new operation.
export function useFinancialRequest() {
  const request = useRef({ signature: '', id: '' })
  const getKey = (data: unknown) => {
    const signature = JSON.stringify(data)
    if (request.current.signature !== signature || !request.current.id) {
      request.current = { signature, id: crypto.randomUUID() }
    }
    return request.current.id
  }
  return Object.assign(getKey, { reset: () => { request.current = { signature: '', id: '' } } })
}
