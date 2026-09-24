import type { CircleMapMember } from '@/src/lib/mapData'
import type { Place } from '@/src/lib/api'

export type CircleMapProps = {
  members: CircleMapMember[]
  currentUserId: string
  selectedUserId?: string | null
  routeCoordinates?: Array<[number, number]>
  places?: Place[]
  draftCoordinate?: [number, number] | null
  onMemberPress?: (userId: string) => void
  onMapLongPress?: (coordinate: [number, number]) => void
}
