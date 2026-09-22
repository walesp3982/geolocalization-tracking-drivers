import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import * as Location from 'expo-location'

export default function DriverTracker() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState<boolean>(false)
  const locationSubscription = useRef<Location.LocationSubscription | null>(null)
  const isMounted = useRef<boolean>(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      if (locationSubscription.current) {
        locationSubscription.current.remove()
      }
    }
  }, [])

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        if (isMounted.current) {
          setErrorMsg('Permiso de ubicación denegado')
        }
        Alert.alert('Error', 'Se requiere permiso de ubicación para continuar.')
        return
      }

      if (isMounted.current) {
        setErrorMsg(null)
        setIsTracking(true)
      }

      console.log('📡 Iniciando rastreo de ubicación...')

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 0,
        },
        (newLocation) => {
          console.log(
            '📍 Coordenadas (cada 5s):',
            newLocation.coords.latitude,
            newLocation.coords.longitude
          )
          if (isMounted.current) {
            setLocation(newLocation)
          }
        }
      )
    } catch (error) {
      console.error('❌ Error al iniciar rastreo:', error)
      if (isMounted.current) {
        setErrorMsg('Error al activar el GPS')
      }
    }
  }

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove()
      locationSubscription.current = null
    }
    if (isMounted.current) {
      setIsTracking(false)
    }
    console.log('🛑 Rastreo detenido')
  }

  return (
    <View style={styles.floatingCard}>
      {errorMsg ? (
        <Text style={styles.errorText}>{errorMsg}</Text>
      ) : location ? (
        <Text style={styles.text}>
          Lat: {location.coords.latitude.toFixed(4)}, Lng: {location.coords.longitude.toFixed(4)}
        </Text>
      ) : (
        <Text style={styles.text}>Estado: Inactivo</Text>
      )}

      <TouchableOpacity
        style={[styles.button, isTracking ? styles.buttonStop : styles.buttonStart]}
        onPress={isTracking ? stopTracking : startTracking}
      >
        <Text style={styles.buttonText}>
          {isTracking ? 'Detener Rastreo' : 'Iniciar Rastreo'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  floatingCard: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 20,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  text: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 8,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#d9534f',
    marginBottom: 8,
  },
  button: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonStart: {
    backgroundColor: '#28a745',
  },
  buttonStop: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
})