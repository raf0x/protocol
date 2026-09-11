import type { Instrumentation } from 'next'
import { captureOperationalError } from './lib/monitoring'

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  await captureOperationalError({
    route: context.routePath || '/server-error',
    error,
    source: context.routeType === 'route' ? 'api' : 'server',
    status: 500,
  })
}
