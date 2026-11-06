# Monitoreo de Biodiversidad en el Páramo de Santurbán (PWA Offline-First)

Aplicación Web Progresiva (PWA) desarrollada en **HTML5, CSS3 y JavaScript Vanilla (ES6 Modules)** diseñada como herramienta de apoyo científico y operativo para **Guardabosques**, **Investigadores** y **Administradores Ambientales** en el complejo de páramos de Santurbán.

---

## 1. Requisitos Técnicos

- Navegador web moderno con soporte para ES6 Modules, `IndexedDB`, `Service Workers`, `Geolocation API` y `HTML5 Canvas` (Chrome, Edge, Firefox, Safari iOS/macOS).
- Servidor HTTP estático local para desarrollo (por ejemplo: extensión *Live Server* de VS Code, `python -m http.server 8080`, o `npx serve .`).
- Proyecto activo en **Supabase** (PostgreSQL + Authentication + Storage privado).
- Para compilar la aplicación Android: Node.js 20 o superior, JDK 21 y Android SDK Platform 35 con Android Build Tools.

---

## 2. Aplicación Android (APK)

La app puede empaquetarse como APK instalable en Android con Capacitor. El APK de depuración incluye los recursos web y los permisos nativos para solicitar ubicación GPS.

1. Instala Node.js 20+, JDK 21 y Android SDK Platform 35 con Android Build Tools. Configura `ANDROID_HOME` o `ANDROID_SDK_ROOT` para que Gradle encuentre el SDK.
2. Instala las dependencias con `npm install`.
3. Genera el proyecto Android una sola vez: `npx cap add android`.
4. Compila el APK instalable: `npm run android:apk`.
5. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk` y también en `public/downloads/SanturBio.apk`; la pantalla principal incluye el botón **Descargar APK**. En el teléfono, abre el archivo descargado y autoriza la instalación desde esa fuente cuando Android lo solicite.

**Importante:** los cambios realizados en el sitio web no actualizan por sí solos el APK ni las instalaciones que los usuarios ya tengan en sus celulares. Para incluir cambios nuevos en Android, vuelve a ejecutar `npm run android:apk` y distribuye el APK actualizado. Para publicar el sitio web con el enlace al APK nuevo, ejecuta también `npm run build` y publica la versión web resultante.

Después de compilar el APK, ejecuta `npm run build` para preparar la versión web lista para publicar, incluido el enlace de descarga. El APK de depuración se puede instalar directamente, pero para publicar en Google Play o distribuir actualizaciones consistentes se debe generar un APK/AAB de lanzamiento firmado con una clave privada protegida. No compartas esa clave junto con el APK. Los usuarios necesitan conexión para iniciar sesión y sincronizar con Supabase; los registros capturados sin conexión quedan guardados en el dispositivo.

## 3. Estructura del Proyecto

```text
santurban-biodiversidad/
│
├── index.html                        # Punto de entrada principal de la PWA
├── manifest.json                     # Manifiesto de instalación W3C
├── service-worker.js                 # Caché Offline-First del App Shell y teselas OSM
│
├── css/
│   ├── styles.css                    # Variables CSS (Paleta Páramo Modo Oscuro)
│   ├── components.css                # Botones táctiles grandes, tarjetas, formularios y mapa
│   └── responsive.css                # Diseño adaptable (Mobile-First para campo -> Desktop SIG)
│
├── js/
│   ├── app.js                        # Bootstrapper principal y enrutador según rol
│   ├── config/
│   │   ├── env.js                    # Credenciales públicas de Supabase y constantes de dominio
│   │   └── santurban-route.js        # Coordenadas reales del Páramo de Santurbán para simulación
│   ├── core/
│   │   ├── EventBus.js               # Patrón Observer desacoplado
│   │   └── Validator.js              # Validaciones de coordenadas, altitudes y sanitización
│   ├── models/
│   │   ├── ReporteAmbiental.js       # Entidad de dominio + Factory/Builder + Auditoría
│   │   └── SyncItem.js               # Modelo determinista para la cola de sincronización
│   ├── repositories/
│   │   ├── LocalReportRepository.js  # Persistencia en IndexedDB
│   │   ├── RemoteReportRepository.js # Persistencia idempotente (upsert) en Supabase
│   │   └── ReportRepository.js       # Fachada coordinadora Offline-First
│   ├── services/
│   │   ├── SupabaseService.js        # Cliente Supabase (Auth, PostgREST, URLs firmadas Storage)
│   │   ├── IndexedDBService.js       # Wrapper basado en Promesas para IndexedDB nativo
│   │   ├── NetworkMonitor.js         # Detección de conectividad con ping activo + Observer
│   │   ├── LocationService.js        # GPS bajo demanda + Simulador de Ruta de Santurbán
│   │   ├── CameraService.js          # Captura de cámara/archivo y estampado de metadatos
│   │   ├── ImageCompressionService.js# Compresión JPEG en Canvas (calidad científica 0.82)
│   │   ├── SyncService.js            # Motor de sincronización idempotente con reintentos
│   │   └── ExportService.js          # Exportación CSV y GeoJSON compatible con QGIS
│   ├── viewmodels/
│   │   ├── AuthViewModel.js          # Gestión de sesión y lectura de rol desde `profiles`
│   │   ├── FieldViewModel.js         # Lógica de captura de campo del Guardabosque
│   │   └── AdminViewModel.js         # Lógica de indicadores, filtros, alertas y exportación
│   ├── views/
│   │   ├── AuthView.js               # Pantalla de inicio de sesión
│   │   ├── FieldView.js              # Interfaz móvil de alto contraste para Guardabosques
│   │   ├── AdminDashboardView.js     # Consola analítica del Administrador
│   │   └── MapView.js                # Componente Leaflet.js + Leaflet.heat + Popups seguros
│   └── utils/
│       ├── dom.js                    # Creación segura de nodos DOM (protección anti-XSS)
│       └── uuid.js                   # Generador criptográfico UUID v4 en cliente
│
├── assets/
│   └── icons/
│       └── app-icon.svg              # Icono vectorial de la PWA
│
├── tests/
│   ├── test-runner.html              # Ejecutor visual de pruebas en el navegador
│   ├── unit.test.js                  # Suite de pruebas unitarias
│   └── integration.test.js           # Suite de pruebas de integración
│
├── README.md                         # Documentación del proyecto
└── .env.example                      # Plantilla de variables públicas