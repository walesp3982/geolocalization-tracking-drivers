import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import * as Location from 'expo-location'

export default function DriverTracker() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setErrorMsg('Permiso de ubicación denegado')
        return
      }

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 0,
        },
        (newLocation) => {
          setLocation(newLocation)

          const { latitude, longitude, speed } = newLocation.coords
          console.log(`[CHOFER 5s] Latitud: ${latitude} | Longitud: ${longitude} | Vel: ${speed || 0} m/s`)
        }
      )
    }

    startTracking()

    return () => {
      if (watcher) {
        watcher.remove()
      }
    }
  }, [])

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <Text style={styles.text}>{errorMsg}</Text>
      ) : location ? (
        <Text style={styles.text}>
          Lat: {location.coords.latitude.toFixed(6)}, Lng: {location.coords.longitude.toFixed(6)}
        </Text>
      ) : (
        <Text style={styles.text}>Obteniendo ubicación...</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  text: {
    fontSize: 14,
  },
})