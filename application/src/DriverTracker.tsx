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
          sendLocationToBackend(newLocation.coords)
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

  const sendLocationToBackend = (coords: Location.LocationObjectCoords) => {
    console.log('Nueva ubicación enviada:', coords.latitude, coords.longitude)
  }

  return (
    <View style={styles.container}>
      {errorMsg ? (
        <Text>{errorMsg}</Text>
      ) : location ? (
        <Text>
          Lat: {location.coords.latitude}, Lng: {location.coords.longitude}
        </Text>
      ) : (
        <Text>Obteniendo ubicación...</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
})