import type { CircleMapMember } from '@/src/lib/mapData'

export type CircleMapProps = {
  members: CircleMapMember[]
  currentUserId: string
  selectedUserId?: string | null
  onMemberPress?: (userId: string) => void
}
