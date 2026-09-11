import 'server-only'

import { captureOperationalError } from '../../monitoring'
import { providerOperationalDiagnostic } from './provider'

export function captureAnalystOperationalError(route: string, error: unknown) {
  const diagnostic = providerOperationalDiagnostic(error)
  return captureOperationalError({ route, errorType: diagnostic.errorType, source: 'ai', status: diagnostic.status })
}
