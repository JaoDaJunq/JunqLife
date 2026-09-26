import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

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
