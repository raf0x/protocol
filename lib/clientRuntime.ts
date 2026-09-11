export type CapacitorRuntime = {
  isNativePlatform?: () => boolean
}

type RuntimeScope = {
  Capacitor?: CapacitorRuntime
}

/** Detects the Capacitor bridge without importing native code into the web build. */
export function isNativeAppRuntime(scope: RuntimeScope = globalThis as RuntimeScope) {
  try {
    return scope.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}
