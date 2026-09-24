export const TRACKING_SUPPORTED = false

export async function ensureDeviceCredential() {
  throw new Error('Tracking nativo requer Android ou iOS.')
}

export async function prepareTracking() {
  throw new Error('Tracking nativo requer Android ou iOS.')
}

export async function startTracking() {
  throw new Error('Tracking nativo requer Android ou iOS.')
}

export async function stopTracking() {
  return
}

export async function trackingIsActive() {
  return false
}

export async function sendPositionNow() {
  return false
}

export async function trackingLogs(): Promise<unknown[]> {
  return []
}
