/**
 * @file js/viewmodels/AuthViewModel.js
 * @description ViewModel para autenticación con Supabase Auth y resolución
 * del rol desde la tabla `profiles` con soporte de arranque en frío Offline.
 */

import { ENV } from '../config/env.js';
import { appEventBus, EVENTS } from '../core/EventBus.js';
import { supabaseService } from '../services/SupabaseService.js';
import { indexedDBService } from '../services/IndexedDBService.js';
import { networkMonitor } from '../services/NetworkMonitor.js';

export class AuthViewModel {
    /**
     * @param {Object} deps
     */
    constructor({
        supabase = supabaseService,
        idb = indexedDBService,
        network = networkMonitor,
        eventBus = appEventBus
    } = {}) {
        this._supabase = supabase;
        this._idb = idb;
        this._network = network;
        this._eventBus = eventBus;

        /** @type {Object|null} */
        this._user = null;
        /** @type {{ id: string, full_name: string|null, role: string, created_at: string }|null} */
        this._profile = null;
    }

    get user() {
        return this._user;
    }

    get profile() {
        return this._profile ? Object.freeze({ ...this._profile }) : null;
    }

    get isAuthenticated() {
        return Boolean(this._user && this._profile);
    }

    get isAdmin() {
        return this._profile?.role === ENV.ROLES.ADMIN;
    }

    get isRanger() {
        return this._profile?.role === ENV.ROLES.RANGER;
    }

    /**
     * Inicializa el estado de sesión al abrir la aplicación.
     * Soporta recuperación de perfil desde IndexedDB cuando se abre en modo Offline.
     * @returns {Promise<{ isAuthenticated: boolean, profile: Object|null }>}
     */
    async initializeSession() {
        await this._idb.init();

        try {
            const session = await this._supabase.getSession();
            if (session?.user) {
                this._user = session.user;
                await this._loadUserProfile(session.user.id, session.user.email);
                this._emitAuthChange();
                return { isAuthenticated: true, profile: this.profile };
            }
        } catch (err) {
            console.warn('[AuthViewModel] No fue posible validar sesión remota, verificando caché local:', err.message);
        }

        // Fallback Offline: si hay un perfil cacheado de una sesión previa activa
        const cachedProfiles = await this._idb.getAll(ENV.IDB_STORES.SESSION_CACHE);
        if (cachedProfiles.length > 0 && !this._network.isOnline) {
            const cached = cachedProfiles[0];
            this._user = { id: cached.id, email: cached.email };
            this._profile = {
                id: cached.id,
                full_name: cached.full_name,
                role: cached.role,
                created_at: cached.created_at
            };
            this._emitAuthChange();
            return { isAuthenticated: true, profile: this.profile };
        }

        this._clearState();
        this._emitAuthChange();
        return { isAuthenticated: false, profile: null };
    }

    /**
     * Inicia sesión con correo y contraseña y carga el rol desde `profiles`.
     * @param {string} email
     * @param {string} password
     */
    async login(email, password) {
        if (!email || !password) {
            throw new Error('Por favor ingrese su correo electrónico y contraseña.');
        }

        const { user } = await this._supabase.signInWithPassword(email, password);
        if (!user) {
            throw new Error('No se pudo obtener la información del usuario.');
        }

        this._user = user;
        await this._loadUserProfile(user.id, user.email);
        this._emitAuthChange();
        return this.profile;
    }

    /**
     * Cierra la sesión actual tanto en Supabase como en la caché de perfil local.
     * Nota: No borra hallazgos pendientes de sincronización en IndexedDB para evitar pérdida de datos.
     */
    async logout() {
        try {
            if (this._network.isOnline) {
                await this._supabase.signOut();
            }
        } catch (err) {
            console.warn('[AuthViewModel] Advertencia al cerrar sesión remota:', err.message);
        } finally {
            await this._idb.clearStore(ENV.IDB_STORES.SESSION_CACHE);
            this._clearState();
            this._emitAuthChange();
        }
    }

    /**
     * Consulta el perfil en la tabla `profiles` de Supabase o recurre a IndexedDB si está sin red.
     * @param {string} userId
     * @param {string} email
     */
    async _loadUserProfile(userId, email) {
        try {
            const remoteProfile = await this._supabase.getUserProfile(userId);
            this._profile = {
                id: remoteProfile.id,
                full_name: remoteProfile.full_name || email?.split('@')[0] || 'Usuario',
                role: remoteProfile.role,
                created_at: remoteProfile.created_at
            };

            // Guardar perfil básico en IndexedDB para permitir apertura en frío sin conexión
            await this._idb.clearStore(ENV.IDB_STORES.SESSION_CACHE);
            await this._idb.put(ENV.IDB_STORES.SESSION_CACHE, {
                ...this._profile,
                email: email || '',
                cached_at: new Date().toISOString()
            });
        } catch (error) {
            const cached = await this._idb.getById(ENV.IDB_STORES.SESSION_CACHE, userId);
            if (cached) {
                this._profile = {
                    id: cached.id,
                    full_name: cached.full_name,
                    role: cached.role,
                    created_at: cached.created_at
                };
                return;
            }
            throw new Error('No se pudo obtener el perfil de usuario desde la tabla "profiles". Verifique su conexión.');
        }
    }

    _clearState() {
        this._user = null;
        this._profile = null;
    }

    _emitAuthChange() {
        this._eventBus.emit(EVENTS.AUTH_STATE_CHANGED, {
            isAuthenticated: this.isAuthenticated,
            user: this._user,
            profile: this.profile
        });
    }
}

export const authViewModel = new AuthViewModel();