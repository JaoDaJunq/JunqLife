import Constants from 'expo-constants'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { registerPushToken } from '@/src/lib/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

let permissionRequested = false

export async function prepareLocalNotifications() {
  if (Platform.OS === 'web' || permissionRequested) return false
  permissionRequested = true

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('places', {
      name: 'Locais do JunqLife',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
    })
  }

  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

export async function notifyPlaceEvent(input: {
  placeName: string
  memberName: string
  eventType: 'entered' | 'exited'
}) {
  if (Platform.OS === 'web') return
  const allowed = await prepareLocalNotifications()
  if (!allowed) return

  const entered = input.eventType === 'entered'
  await Notifications.scheduleNotificationAsync({
    content: {
      title: entered ? 'Entrada em local' : 'Saída de local',
      body: `${input.memberName} ${entered ? 'entrou em' : 'saiu de'} ${input.placeName}.`,
      data: { type: 'place_event', eventType: input.eventType },
    },
    trigger: null,
  })
}

export async function registerForRemoteNotifications(userId: string) {
  if (Platform.OS === 'web') return false
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId
  if (!projectId) return false
  const allowed = await prepareLocalNotifications()
  if (!allowed) return false
  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  if (!/^Expo\[|^ExponentPushToken\[/.test(token.data)) {
    throw new Error('O aparelho retornou um token de notificações inválido.')
  }
  await registerPushToken({
    userId,
    token: token.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  })
  return true
}
