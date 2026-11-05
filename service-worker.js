/**
 * @file service-worker.js
 * @description Service Worker para soporte Offline-First de la PWA
 * Monitoreo de Biodiversidad en el Páramo de Santurbán.
 */

const CACHE_VERSION = 'santurban-pwa-v1.0.0';
const STATIC_CACHE_NAME = `${CACHE_VERSION}-static`;
const TILES_CACHE_NAME = `${CACHE_VERSION}-osm-tiles`;

/**
 * Lista completa de archivos del App Shell para que la PWA cargue 100% sin conexión.
 */
const APP_SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/icons/app-icon.svg',
    './css/styles.css',
    './css/components.css',
    './css/responsive.css',
    './js/app.js',
    './js/config/env.js',
    './js/config/santurban-route.js',
    './js/core/EventBus.js',
    './js/core/Validator.js',
    './js/models/ReporteAmbiental.js',
    './js/models/SyncItem.js',
    './js/repositories/LocalReportRepository.js',
    './js/repositories/RemoteReportRepository.js',
    './js/repositories/ReportRepository.js',
    './js/services/CameraService.js',
    './js/services/ExportService.js',
    './js/services/ImageCompressionService.js',
    './js/services/IndexedDBService.js',
    './js/services/LocationService.js',
    './js/services/NetworkMonitor.js',
    './js/services/SupabaseService.js',
    './js/services/SyncService.js',
    './js/utils/dom.js',
    './js/utils/uuid.js',
    './js/viewmodels/AdminViewModel.js',
    './js/viewmodels/AuthViewModel.js',
    './js/viewmodels/FieldViewModel.js',
    './js/views/AdminDashboardView.js',
    './js/views/AuthView.js',
    './js/views/FieldView.js',
    './js/views/MapView.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
];

// 1. Instalación: Pre-carga del App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(STATIC_CACHE_NAME)
            .then(async (cache) => {
                // Pre-cachear cada activo de manera resiliente
                await Promise.allSettled(
                    APP_SHELL_ASSETS.map((url) =>
                        cache.add(url).catch((err) => {
                            console.warn(`[ServiceWorker] No se pudo pre-cachear ${url}:`, err);
                        })
                    )
                );
            })
            .then(() => self.skipWaiting())
    );
});

// 2. Activación: Limpieza de versiones anteriores de caché
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter(
                            (key) => key !== STATIC_CACHE_NAME && key !== TILES_CACHE_NAME
                        )
                        .map((oldKey) => caches.delete(oldKey))
                )
            )
            .then(() => self.clients.claim())
    );
});

// 3. Interceptación de Peticiones (Fetch)
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Ignorar peticiones que no sean GET
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    // A. Nunca cachear respuestas de la API de Supabase (Auth, PostgREST, Storage firmado)
    // Los datos offline se administran de manera estructurada y segura en IndexedDB.
    if (url.hostname.includes('supabase.co')) {
        return;
    }

    // B. Cacheo oportunista de teselas de OpenStreetMap para visualización de mapa en campo
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(handleOsmTileRequest(request));
        return;
    }

    // C. Estrategia Stale-While-Revalidate para el App Shell y módulos estáticos
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const networkFetch = fetch(request)
                .then((networkResponse) => {
                    if (
                        networkResponse &&
                        networkResponse.status === 200 &&
                        (networkResponse.type === 'basic' || networkResponse.type === 'cors')
                    ) {
                        const responseClone = networkResponse.clone();
                        caches.open(STATIC_CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // Si falla la red y es navegación HTML, devolver index.html
                    if (request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return cachedResponse;
                });

            return cachedResponse || networkFetch;
        })
    );
});

/**
 * Sirve teselas de mapa desde caché si existen o las descarga y almacena.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleOsmTileRequest(request) {
    const cache = await caches.open(TILES_CACHE_NAME);
    const cachedTile = await cache.match(request);
    if (cachedTile) {
        return cachedTile;
    }

    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('', { status: 408, statusText: 'Offline Tile Unavailable' });
    }
}