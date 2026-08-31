# IMPLEMENTACIÓN DE UNA APLICACIÓN MULTIPLATAFORMA CON GEOLOCALIZACIÓN EN TIEMPO REAL PARA SOLUCIONAR EL MONITOREO INEFICIENTE Y FALTA DE SEGUIMIENTO EN TIEMPO REAL DEL RECORRIDO DE CHOFERES

## Descripción general

Este proyecto consiste en una solución multiplataforma para supervisar recorridos de choferes en tiempo real mediante geolocalización. Su objetivo es mejorar la trazabilidad, reducir la falta de control operativo y facilitar el monitoreo del recorrido, la ubicación y el comportamiento del transporte en campo.

La aplicación combina una interfaz móvil/web desarrollada con Expo + React Native y un backend en Python con FastAPI para exponer servicios y gestionar la lógica de la API.

---

## 📦 Estructura del proyecto

```text
proyect_6/
├── application/   # Frontend (Expo / React Native)
├── backend/       # Backend (FastAPI)
├── README.md      # Documentación general del proyecto
└── .git/
```

---

## Frontend

### Tecnologías

- Expo
- React Native
- Expo Location
- React Native Maps
- Expo Router
- TypeScript

### Requisitos

- Node.js 18 o superior
- npm
- Android Studio / emulator o dispositivo físico para pruebas móviles
- Expo SDK compatible con el proyecto

### Instalación

Desde la carpeta raíz del proyecto:

```bash
cd application
npm ci
```

> Se utiliza `npm ci` para instalar exactamente las dependencias lockeadas por `package-lock.json`, evitando inconsistencias con el proyecto Expo.

### Ejecución

La forma recomendada por la documentación de Expo es:

```bash
cd application
npx expo start
```

Luego puedes abrir la app en:

- Android emulator
- iOS simulator
- Expo Go
- Web

Para web, también puedes usar:

```bash
cd application
npx expo start --web
```

---

## Backend

### Tecnologías

- Python 3.12+
- FastAPI
- SQLAlchemy
- GeoAlchemy2
- Scalar FastAPI

### Requisitos

- Python 3.12 o superior
- uv instalado

### Instalación

Sigue la instalación recomendada por la documentación de uv:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Luego, desde la carpeta del backend:

```bash
cd backend
uv venv
source .venv/bin/activate
uv sync
```

> `uv sync` instala las dependencias definidas en `pyproject.toml` y crea el entorno del proyecto de forma consistente con la recomendación oficial.

### Ejecución

```bash
cd backend
uv run uvicorn main:app --reload
```

La API quedará disponible en:

- http://127.0.0.1:8000
- Documentación interactiva: http://127.0.0.1:8000/docs
- Documentación alternativa con Scalar: http://127.0.0.1:8000/scalar

---

## 🔄 Flujo recomendado de trabajo

1. Activar el entorno virtual del backend.
2. Iniciar la API con `uvicorn`.
3. Desde la carpeta `application`, ejecutar `npm ci` si aún no están instaladas las dependencias.
4. Levantar la app con `npm start`.
5. Probar la integración entre la geolocalización en tiempo real y la API.

---

## Objetivo del sistema

La solución busca automatizar y centralizar el monitoreo de choferes para:

- visualizar ubicaciones en tiempo real,
- seguir recorridos reales,
- detectar desviaciones o retrasos,
- mejorar la supervisión operativa,
- reducir pérdidas de tiempo y falta de control en la gestión del transporte.

---

## Notas

Este README presenta una visión general del proyecto y la configuración inicial de ambos lados del sistema: backend y frontend. Si en el futuro se desarrollan más módulos, se recomienda ampliar esta documentación con:

- endpoints del API,
- estructura de base de datos,
- flujo de geolocalización,
- diagramas de arquitectura,
- variables de entorno y configuración de despliegue.
