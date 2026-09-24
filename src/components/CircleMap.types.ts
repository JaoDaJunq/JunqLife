import type { CircleMapMember } from '@/src/lib/mapData'

export type CircleMapProps = {
  members: CircleMapMember[]
  currentUserId: string
  selectedUserId?: string | null
  routeCoordinates?: Array<[number, number]>
  onMemberPress?: (userId: string) => void
}
