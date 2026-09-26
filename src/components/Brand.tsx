import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { colors } from '@/src/theme'

export function BrandMark({ size = 32, style }: { size?: number; style?: ViewStyle }) {
  const head = size * 0.23
  return (
    <View style={[styles.mark, { width: size, height: size }, style]} accessibilityLabel="Logo JunqLife">
      <View style={[styles.person, styles.personLeft, { width: size * 0.48, height: size * 0.7 }]}>
        <View style={[styles.head, { width: head, height: head, borderRadius: head / 2, top: 0 }]} />
      </View>
      <View style={[styles.person, styles.personRight, { width: size * 0.48, height: size * 0.7 }]}>
        <View style={[styles.head, styles.goldHead, { width: head, height: head, borderRadius: head / 2, top: 0 }]} />
      </View>
      <View style={[styles.pinCut, { width: size * 0.22, height: size * 0.22, borderRadius: size * 0.11 }]} />
    </View>
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
  mark: { position: 'relative', overflow: 'hidden' },
  person: { position: 'absolute', top: '18%', borderTopLeftRadius: 999, borderTopRightRadius: 999 },
  personLeft: { left: 0, backgroundColor: colors.plum, borderBottomRightRadius: 999 },
  personRight: { right: 0, backgroundColor: colors.gold, borderBottomLeftRadius: 999 },
  head: { position: 'absolute', alignSelf: 'center', backgroundColor: colors.plum },
  goldHead: { backgroundColor: colors.gold },
  pinCut: { position: 'absolute', backgroundColor: colors.cream, left: '39%', top: '46%' },
  wordmark: { fontWeight: '900', letterSpacing: -1.2 },
  junq: { color: colors.plum },
  life: { color: colors.gold },
  tagline: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
})
