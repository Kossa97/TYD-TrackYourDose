import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureReactException: vi.fn(),
}))
vi.mock('@sentry/react', () => sdk)

import { initMonitoring, reactRootErrorOptions, reportError } from './monitoring'

describe('Monitoring — was an Sentry geht', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await initMonitoring('https://key@o1.ingest.de.sentry.io/1')
  })

  it('erhebt nichts über Nutzer', () => {
    const optionen = sdk.init.mock.calls[0][0]
    expect(optionen.dataCollection).toMatchObject({
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      stackFrameVariables: false, frameContextLines: 0, databaseQueryData: false, queues: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
    })
  })

  it('meldet einen React-Absturz mit Komponentenkette als nicht behandelt', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fehler = new TypeError('x')
    reactRootErrorOptions.onUncaughtError(fehler, { componentStack: '\n    at Dashboard (https://app/a.js:1:2)' })
    expect(sdk.captureReactException).toHaveBeenCalledWith(
      fehler,
      { componentStack: '\n    at Dashboard (https://app/a.js:1:2)' },
      expect.objectContaining({
        captureContext: { tags: { where: 'react.uncaught' } },
        mechanism: { handled: false, type: 'auto.function.react.error_handler' },
      }),
    )
  })

  it('meldet trotzdem, wenn die Kette nicht anzuhängen ist', () => {
    sdk.captureReactException.mockImplementationOnce(() => { throw new TypeError('Cannot create property cause on string') })
    const fehler = new Error('x', { cause: 'timeout' })
    reportError(fehler, 'test', 'at Dashboard (https://app/a.js:1:2)')
    expect(sdk.captureException).toHaveBeenCalledWith(fehler, expect.objectContaining({ captureContext: { tags: { where: 'test' } } }))
  })

  it('meldet Nicht-Fehler ohne Kette, behandelte Fehler ohne Absturz-Markierung', () => {
    reportError('kaputt', 'test', 'at Dashboard (https://app/a.js:1:2)')
    expect(sdk.captureReactException).not.toHaveBeenCalled()
    expect(sdk.captureException).toHaveBeenCalledWith('kaputt', { captureContext: { tags: { where: 'test' } } })
  })
})
