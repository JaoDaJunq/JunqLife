import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import {
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

export const TRACKING_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios'
export const LOCATION_INGEST_URL = `${SUPABASE_URL}/functions/v1/location-ingest`

type DeviceCredential = {
  deviceId: string
  ingestToken: string
}

async function storedCredential(): Promise<DeviceCredential | null> {
  const [deviceId, ingestToken] = await Promise.all([
    SecureStore.getItemAsync(DEVICE_ID_KEY),
    SecureStore.getItemAsync(DEVICE_TOKEN_KEY),
  ])

  return deviceId && ingestToken ? { deviceId, ingestToken } : null
}

async function saveCredential(credential: DeviceCredential) {
  await Promise.all([
    SecureStore.setItemAsync(DEVICE_ID_KEY, credential.deviceId),
    SecureStore.setItemAsync(DEVICE_TOKEN_KEY, credential.ingestToken),
  ])
}

async function registerDevice(): Promise<DeviceCredential> {
  const previousId = await SecureStore.getItemAsync(DEVICE_ID_KEY)
  const { data, error } = await supabase.functions.invoke('device-register', {
    body: {
      device_id: previousId ?? undefined,
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
  }
  await saveCredential(credential)
  return credential
}

export async function ensureDeviceCredential() {
  return (await storedCredential()) ?? registerDevice()
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
