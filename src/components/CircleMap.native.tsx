import { useMemo, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Camera,
  Map,
  GeoJSONSource,
  Layer,
  Marker,
  type CameraRef,
  type MapRef,
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

function boundsFor(
  members: ReturnType<typeof locationsForMap>,
  places: CircleMapProps['places'] = [],
): LngLatBounds | null {
  const points = [
    ...members.map((member) => ({
      longitude: member.location!.longitude,
      latitude: member.location!.latitude,
    })),
    ...places.map((place) => ({
      longitude: place.longitude,
      latitude: place.latitude,
    })),
  ]

  if (points.length < 2) return null

  const longitudes = points.map((point) => point.longitude)
  const latitudes = points.map((point) => point.latitude)

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

function placeCircle(longitude: number, latitude: number, radiusM: number) {
  const points: Array<[number, number]> = []
  const latRadians = (latitude * Math.PI) / 180
  const metersPerDegreeLat = 111_320
  const metersPerDegreeLon = Math.max(1, 111_320 * Math.cos(latRadians))

  for (let index = 0; index <= 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2
    points.push([
      longitude + (Math.cos(angle) * radiusM) / metersPerDegreeLon,
      latitude + (Math.sin(angle) * radiusM) / metersPerDegreeLat,
    ])
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [points],
    },
  }
}

export default function CircleMap({
  members,
  currentUserId,
  selectedUserId,
  routeCoordinates = [],
  places = [],
  draftCoordinate = null,
  onMemberPress,
  onMapLongPress,
}: CircleMapProps) {
  const cameraRef = useRef<CameraRef>(null)
  const mapRef = useRef<MapRef>(null)
  const visibleMembers = useMemo(
    () => locationsForMap(members, currentUserId),
    [members, currentUserId],
  )

  const fallbackPoint = useMemo(() => {
    const member = visibleMembers[0]?.location
    if (member) return [member.longitude, member.latitude] as [number, number]
    const place = places[0]
    if (place) return [place.longitude, place.latitude] as [number, number]
    return draftCoordinate
  }, [visibleMembers, places, draftCoordinate])

  const initialViewState = useMemo<InitialViewState>(() => {
    const bounds = boundsFor(visibleMembers, places)
    if (bounds) {
      return {
        bounds,
        padding: { top: 70, right: 45, bottom: 70, left: 45 },
      }
    }

    if (fallbackPoint) {
      return {
        center: fallbackPoint,
        zoom: 14,
      }
    }

    return {
      center: [-52.0, -15.0],
      zoom: 3.4,
    }
  }, [visibleMembers, places, fallbackPoint])

  const zoomBy = async (delta: number) => {
    const currentZoom = await mapRef.current?.getZoom().catch(() => undefined)
    const nextZoom = Math.max(2, Math.min(19, (currentZoom ?? 15) + delta))
    cameraRef.current?.zoomTo(nextZoom, { duration: 220, easing: 'ease' })
  }

  const focusSelf = () => {
    const self = visibleMembers.find((member) => member.userId === currentUserId)
    if (!self?.location) return

    cameraRef.current?.easeTo({
      center: [self.location.longitude, self.location.latitude],
      zoom: 16.5,
      duration: 450,
      easing: 'ease',
    })
  }

  const fitEveryone = () => {
    const bounds = boundsFor(visibleMembers, places)
    if (bounds) {
      cameraRef.current?.fitBounds(bounds, {
        padding: { top: 80, right: 50, bottom: 80, left: 50 },
        duration: 700,
        easing: 'ease',
      })
      return
    }

    if (fallbackPoint) {
      cameraRef.current?.easeTo({
        center: fallbackPoint,
        zoom: 15,
        duration: 500,
      })
    }
  }

  return (
    <View style={styles.container}>
      <Map
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE}
        dragPan
        touchZoom
        doubleTapZoom
        doubleTapHoldZoom
        touchRotate
        touchPitch
        compass
        compassHiddenFacingNorth
        compassPosition={{ top: 62, right: 14 }}
        scaleBar={false}
        preferredFramesPerSecond={60}
        onLongPress={(event) => {
          if (!onMapLongPress) return
          const [longitude, latitude] = event.nativeEvent.lngLat
          onMapLongPress([longitude, latitude])
        }}
      >
        <Camera ref={cameraRef} initialViewState={initialViewState} minZoom={2} maxZoom={19} />

        {places.map((place) => (
          <GeoJSONSource
            key={`place-radius-${place.id}`}
            id={`place-radius-${place.id}`}
            data={placeCircle(place.longitude, place.latitude, place.radius_m)}
          >
            <Layer
              id={`place-radius-fill-${place.id}`}
              type="fill"
              paint={{
                'fill-color': '#7C5CFC',
                'fill-opacity': 0.12,
              }}
            />
            <Layer
              id={`place-radius-line-${place.id}`}
              type="line"
              paint={{
                'line-color': '#7C5CFC',
                'line-width': 2,
                'line-opacity': 0.7,
              }}
            />
          </GeoJSONSource>
        ))}

        {places.map((place) => (
          <Marker
            key={`place-marker-${place.id}`}
            id={`place-${place.id}`}
            lngLat={[place.longitude, place.latitude]}
            anchor="center"
          >
            <View style={styles.placeMarker}>
              <Text style={styles.placeMarkerText}>⌂</Text>
            </View>
          </Marker>
        ))}

        {draftCoordinate && (
          <Marker
            id="place-draft"
            lngLat={draftCoordinate}
            anchor="center"
          >
            <View style={styles.draftMarker}>
              <Text style={styles.draftMarkerText}>+</Text>
            </View>
          </Marker>
        )}

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
        <Text style={styles.fitButtonText}>Grupo</Text>
      </Pressable>

      <View style={styles.zoomControls}>
        <Pressable style={styles.mapControl} onPress={() => void zoomBy(1)}>
          <Text style={styles.mapControlText}>+</Text>
        </Pressable>
        <View style={styles.controlDivider} />
        <Pressable style={styles.mapControl} onPress={() => void zoomBy(-1)}>
          <Text style={styles.mapControlText}>−</Text>
        </Pressable>
      </View>

      <Pressable style={styles.selfButton} onPress={focusSelf}>
        <Text style={styles.selfButtonIcon}>◎</Text>
        <Text style={styles.selfButtonText}>Você</Text>
      </Pressable>

      {onMapLongPress && !draftCoordinate && (
        <View pointerEvents="none" style={styles.longPressHint}>
          <Text style={styles.longPressHintText}>Segure no mapa para marcar um local</Text>
        </View>
      )}

      {visibleMembers.length === 0 && places.length === 0 && !draftCoordinate && (
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
    height: 400,
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
  placeMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C5CFC',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeMarkerText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  draftMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftMarkerText: { color: '#7C5CFC', fontWeight: '900', fontSize: 24, lineHeight: 25 },
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
  zoomControls: {
    position: 'absolute',
    right: 14,
    bottom: 76,
    width: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    overflow: 'hidden',
  },
  mapControl: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlText: { color: '#101418', fontWeight: '700', fontSize: 27, lineHeight: 29 },
  controlDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#D8DDE1' },
  selfButton: {
    position: 'absolute',
    right: 14,
    bottom: 16,
    height: 46,
    minWidth: 78,
    borderRadius: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  selfButtonIcon: { color: '#356AE6', fontSize: 20, fontWeight: '900' },
  selfButtonText: { color: '#101418', fontWeight: '800', fontSize: 12 },
  longPressHint: {
    position: 'absolute',
    left: 14,
    bottom: 16,
    maxWidth: 220,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(16,20,24,0.82)',
  },
  longPressHintText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
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
