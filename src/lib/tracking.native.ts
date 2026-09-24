import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import {
  clearLogs,
  getLogs,
  init,
  isTracking,
  requestPosition,
  setConfig,
  start,
  stop,
  type Config,
  type LogEntry,
} from 'react-native-traccar-client-sdk'
import { supabase, SUPABASE_URL } from './supabase'

const DEVICE_ID_KEY = 'junqlife.device.id'
const DEVICE_TOKEN_KEY = 'junqlife.device.ingest-token'
const DEVICE_USER_ID_KEY = 'junqlife.device.user-id'

export const TRACKING_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios'
export const LOCATION_INGEST_URL = `${SUPABASE_URL}/functions/v1/location-ingest`

type DeviceCredential = {
  deviceId: string
  ingestToken: string
  userId: string
}

async function storedCredential(): Promise<DeviceCredential | null> {
  const [deviceId, ingestToken, userId] = await Promise.all([
    SecureStore.getItemAsync(DEVICE_ID_KEY),
    SecureStore.getItemAsync(DEVICE_TOKEN_KEY),
    SecureStore.getItemAsync(DEVICE_USER_ID_KEY),
  ])

  return deviceId && ingestToken && userId ? { deviceId, ingestToken, userId } : null
}

async function clearStoredCredential() {
  await Promise.all([
    SecureStore.deleteItemAsync(DEVICE_ID_KEY),
    SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY),
    SecureStore.deleteItemAsync(DEVICE_USER_ID_KEY),
  ])
}

async function saveCredential(credential: DeviceCredential) {
  await Promise.all([
    SecureStore.setItemAsync(DEVICE_ID_KEY, credential.deviceId),
    SecureStore.setItemAsync(DEVICE_TOKEN_KEY, credential.ingestToken),
    SecureStore.setItemAsync(DEVICE_USER_ID_KEY, credential.userId),
  ])
}

async function registerDevice(userId: string): Promise<DeviceCredential> {
  const { data, error } = await supabase.functions.invoke('device-register', {
    body: {
      platform: Platform.OS,
      label: Platform.OS === 'ios' ? 'iPhone' : 'Android',
    },
  })

  if (error) throw error
  if (!data?.device_id || !data?.ingest_token) {
    throw new Error('Não foi possível registrar este aparelho.')
  }

  const credential = {
    deviceId: String(data.device_id),
    ingestToken: String(data.ingest_token),
    userId,
  }
  await saveCredential(credential)
  return credential
}

export async function ensureDeviceCredential() {
  const { data, error } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (error || !userId) {
    throw new Error('Sua sessão não é mais válida. Entre novamente no JunqLife.')
  }

  const credential = await storedCredential()
  if (credential?.userId === userId) return credential

  if (credential) {
    try {
      await stop()
    } catch {}
  }

  await clearStoredCredential()
  return registerDevice(userId)
}

function trackerConfig(credential: DeviceCredential): Config {
  return {
    serverUrl: LOCATION_INGEST_URL,
    deviceId: `${credential.deviceId}.${credential.ingestToken}`,
    location: {
      accuracy: 'HIGH',
      distanceMeters: 40,
      intervalSeconds: 60,
      angleDegrees: 0,
      stopDetection: true,
      stopTimeoutSeconds: 120,
      stationaryRadiusMeters: 75,
      heartbeatIntervalSeconds: 300,
    },
    wakeLock: false,
    buffer: true,
    preferPlatformProviders: false,
    notification: {
      text: 'JunqLife está compartilhando sua localização',
    },
  }
}

export async function prepareTracking() {
  if (!TRACKING_SUPPORTED) throw new Error('Tracking nativo requer Android ou iOS.')
  const credential = await ensureDeviceCredential()
  const config = trackerConfig(credential)
  await init(config)
  await setConfig(config)
  return credential.deviceId
}

export async function startTracking() {
  await prepareTracking()
  await start()
}

export async function stopTracking() {
  if (!TRACKING_SUPPORTED) return
  await stop()
}

export async function trackingIsActive() {
  if (!TRACKING_SUPPORTED) return false
  return isTracking()
}

export async function sendPositionNow() {
  await prepareTracking()
  return requestPosition()
}

export async function trackingLogs(): Promise<LogEntry[]> {
  if (!TRACKING_SUPPORTED) return []
  return getLogs()
}


export async function getStoredDeviceId() {
  return SecureStore.getItemAsync(DEVICE_ID_KEY)
}

export async function clearTrackingLogs() {
  if (!TRACKING_SUPPORTED) return
  await clearLogs()
}


export async function clearTrackingCredential() {
  if (TRACKING_SUPPORTED) {
    try {
      await stop()
    } catch {}
  }
  await clearStoredCredential()
}
