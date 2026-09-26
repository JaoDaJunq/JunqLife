import { Image, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/src/theme'

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/brand/junqlife-mark.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="Logo JunqLife"
    />
  )
}

export default function Brand({ size = 32, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <View style={styles.row}>
      <BrandMark size={size} />
      <View>
        <Text style={[styles.wordmark, { fontSize: size * 0.7, lineHeight: size * 0.9 }]}>
          <Text style={styles.junq}>Junq</Text><Text style={styles.life}>Life</Text>
        </Text>
        {tagline && <Text style={styles.tagline}>Pessoas mais presentes.</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  wordmark: { fontWeight: '900', letterSpacing: -1.2 },
  junq: { color: colors.plum },
  life: { color: colors.gold },
  tagline: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
})
