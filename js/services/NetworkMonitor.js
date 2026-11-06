/**
 * @file js/services/NetworkMonitor.js
 * @description Monitor de conectividad que implementa el patrón Observer
 * para notificar cambios de estado Online/Offline al SyncService y a la interfaz.
 */

import { appEventBus, EVENTS } from '../core/EventBus.js';
import { supabaseService } from './SupabaseService.js';

export class NetworkMonitor {
    /**
     * @param {import('../core/EventBus.js').EventBus} [eventBus]
     */
    constructor(eventBus = appEventBus) {
        this._eventBus = eventBus;
        this._isOnline = typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true;
        this._checkPromise = null;

        this._handleBrowserOnline = this._handleBrowserOnline.bind(this);
        this._handleBrowserOffline = this._handleBrowserOffline.bind(this);
        this._handleForeground = this._handleForeground.bind(this);

        if (typeof window !== 'undefined') {
            window.addEventListener('online', this._handleBrowserOnline);
            window.addEventListener('offline', this._handleBrowserOffline);
            window.addEventListener('focus', this._handleForeground);
            window.addEventListener('pageshow', this._handleForeground);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this._handleForeground);
        }
    }

    /**
     * Indica el estado de conectividad actual.
     * @returns {boolean}
     */
    get isOnline() {
        return this._isOnline;
    }

    /**
     * Permite que cualquier servicio (ej. SyncService) se suscriba a cambios de conectividad.
     * @param {(status: { isOnline: boolean, timestamp: string }) => void} observerCallback
     * @returns {Function} Función para cancelar suscripción.
     */
    subscribe(observerCallback) {
        return this._eventBus.on(EVENTS.NETWORK_STATUS_CHANGED, observerCallback);
    }

    /**
     * Verifica activamente si hay salida real hacia Supabase.
     * @returns {Promise<boolean>}
     */
    checkConnectivity() {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            this._updateStatus(false);
            return Promise.resolve(false);
        }

        if (this._checkPromise) return this._checkPromise;

        this._checkPromise = this._probeConnectivity();
        return this._checkPromise;
    }

    async _probeConnectivity() {
        try {
            const reachable = await supabaseService.ping();
            const isOnline = reachable && (typeof navigator === 'undefined' || navigator.onLine);
            this._updateStatus(isOnline);
            return isOnline;
        } catch {
            this._updateStatus(false);
            return false;
        } finally {
            this._checkPromise = null;
        }
    }

    async _handleBrowserOnline() {
        for (let attempt = 0; attempt < 3; attempt++) {
            if (await this.checkConnectivity()) return;
            if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
            }
        }
    }

    async _handleForeground() {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        await this.checkConnectivity();
    }

    _handleBrowserOffline() {
        this._updateStatus(false);
    }

    /**
     * Actualiza el estado interno y notifica a los observadores si cambió.
     * @param {boolean} nextState
     */
    _updateStatus(nextState) {
        const previous = this._isOnline;
        this._isOnline = Boolean(nextState);

        if (previous !== this._isOnline) {
            this._eventBus.emit(EVENTS.NETWORK_STATUS_CHANGED, {
                isOnline: this._isOnline,
                timestamp: new Date().toISOString()
            });
        }
    }
}

export const networkMonitor = new NetworkMonitor();