import { StyleSheet, Text, View } from 'react-native'
import type { CircleMapProps } from './CircleMap.types'

export default function CircleMap({ members }: CircleMapProps) {
  const withLocation = members.filter((member) => member.location && member.sharingEnabled).length

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapa disponível no app mobile</Text>
      <Text style={styles.text}>
        {withLocation > 0
          ? `${withLocation} membro(s) já têm posição disponível.`
          : 'Ainda não há posições compartilhadas.'}
      </Text>
      <Text style={styles.text}>Use o Development Build do JunqLife para abrir o mapa MapLibre.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    minHeight: 280,
    borderRadius: 24,
    backgroundColor: '#E9EDF0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1A2025', textAlign: 'center' },
  text: { marginTop: 8, color: '#68737D', textAlign: 'center', lineHeight: 20 },
})
