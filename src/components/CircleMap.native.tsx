import { useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Camera,
  Map,
  GeoJSONSource,
  Layer,
  Marker,
  type CameraRef,
  type InitialViewState,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native'
import type { CircleMapProps } from './CircleMap.types'

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function locationsForMap(members: CircleMapProps['members'], currentUserId: string) {
  return members.filter(
    (member) => member.location && (member.userId === currentUserId || member.sharingEnabled),
  )
}

function boundsFor(members: ReturnType<typeof locationsForMap>): LngLatBounds | null {
  if (members.length < 2) return null

  const longitudes = members.map((member) => member.location!.longitude)
  const latitudes = members.map((member) => member.location!.latitude)

  let west = Math.min(...longitudes)
  let east = Math.max(...longitudes)
  let south = Math.min(...latitudes)
  let north = Math.max(...latitudes)

  if (west === east) {
    west -= 0.002
    east += 0.002
  }
  if (south === north) {
    south -= 0.002
    north += 0.002
  }

  return [west, south, east, north]
}

export default function CircleMap({
  members,
  currentUserId,
  selectedUserId,
  routeCoordinates = [],
  onMemberPress,
}: CircleMapProps) {
  const cameraRef = useRef<CameraRef>(null)
  const visibleMembers = useMemo(
    () => locationsForMap(members, currentUserId),
    [members, currentUserId],
  )

  const initialViewState = useMemo<InitialViewState>(() => {
    const bounds = boundsFor(visibleMembers)
    if (bounds) {
      return {
        bounds,
        padding: { top: 70, right: 45, bottom: 70, left: 45 },
      }
    }

    const first = visibleMembers[0]?.location
    if (first) {
      return {
        center: [first.longitude, first.latitude],
        zoom: 14,
      }
    }

    return {
      center: [-52.0, -15.0],
      zoom: 3.4,
    }
  }, [visibleMembers])

  const fitEveryone = () => {
    const bounds = boundsFor(visibleMembers)
    if (bounds) {
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 80, right: 50, bottom: 80, left: 50 },
        duration: 700,
        easing: 'ease',
      })
      return
    }

    const first = visibleMembers[0]?.location
    if (first) {
      cameraRef.current?.easeTo({
        center: [first.longitude, first.latitude],
        zoom: 15,
        duration: 500,
      })
    }
  }

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={MAP_STYLE}>
        <Camera ref={cameraRef} initialViewState={initialViewState} maxZoom={18} />

        {routeCoordinates.length >= 2 && (
          <GeoJSONSource
            id="selected-history-route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates,
              },
            }}
          >
            <Layer
              id="selected-history-route-line"
              type="line"
              paint={{
                'line-color': '#356AE6',
                'line-width': 4,
                'line-opacity': 0.8,
              }}
            />
          </GeoJSONSource>
        )}

        {visibleMembers.map((member) => {
          const location = member.location!
          const isSelf = member.userId === currentUserId
          const isSelected = member.userId === selectedUserId

          return (
            <Marker
              key={member.userId}
              id={member.userId}
              lngLat={[location.longitude, location.latitude]}
              anchor="bottom"
              onPress={() => onMemberPress?.(member.userId)}
            >
              <View style={styles.markerWrap}>
                <View style={[
                  styles.marker,
                  isSelf && styles.markerSelf,
                  isSelected && styles.markerSelected,
                ]}>
                  <Text style={styles.markerText}>{initials(member.displayName)}</Text>
                </View>
                <View style={styles.markerPointer} />
              </View>
            </Marker>
          )
        })}
      </Map>

      <Pressable style={styles.fitButton} onPress={fitEveryone}>
        <Text style={styles.fitButtonText}>Enquadrar</Text>
      </Pressable>

      {visibleMembers.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Text style={styles.emptyTitle}>Nenhuma posição ainda</Text>
          <Text style={styles.emptyText}>Quando alguém enviar o primeiro ponto, o marcador aparece aqui.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 430,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#E7EBEF',
  },
  map: { flex: 1 },
  markerWrap: { alignItems: 'center' },
  marker: {
    minWidth: 46,
    height: 46,
    paddingHorizontal: 8,
    borderRadius: 23,
    backgroundColor: '#101418',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerSelf: { backgroundColor: '#356AE6' },
  markerSelected: { transform: [{ scale: 1.16 }] },
  markerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -2,
  },
  fitButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  fitButtonText: { color: '#101418', fontWeight: '800', fontSize: 13 },
  emptyOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  emptyTitle: { fontWeight: '800', color: '#1B2228' },
  emptyText: { color: '#68737D', marginTop: 4, lineHeight: 18 },
})
