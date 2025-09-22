// WebQX Service Worker - Enhanced Offline Support
const CACHE_NAME = 'webqx-v2.0.0';
const API_CACHE_NAME = 'webqx-api-v2.0.0';

// Cache strategy for different resource types
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

// Resources to cache on install
const STATIC_RESOURCES = [
    '/',
    '/index.html',
    '/login.html',
    '/assets/webqx-styles.css',
    '/assets/healthcare-themes.css',
    '/manifest.json'
];

// API endpoints to cache
const API_PATTERNS = [
    /\/api\/emr\//,
    /\/api\/telehealth\//,
    /\/api\/auth\//,
    /\/fhir\//,
    /\/health/
];

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('🔧 WebQX SW: Installing...');
    
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => {
                return cache.addAll(STATIC_RESOURCES.filter(url => {
                    // Only cache resources that exist
                    return !url.includes('undefined');
                }));
            }),
            self.skipWaiting()
        ])
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', event => {
    console.log('✅ WebQX SW: Activating...');
    
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => 
                            cacheName.startsWith('webqx-') && 
                            cacheName !== CACHE_NAME && 
                            cacheName !== API_CACHE_NAME
                        )
                        .map(cacheName => caches.delete(cacheName))
                );
            }),
            self.clients.claim()
        ])
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle API requests
    if (isApiRequest(url)) {
        event.respondWith(handleApiRequest(request));
        return;
    }
    
    // Handle static resources
    if (isStaticResource(url)) {
        event.respondWith(handleStaticResource(request));
        return;
    }
    
    // Default network-first for other requests
    event.respondWith(
        fetch(request).catch(() => {
            return caches.match(request);
        })
    );
});

// Check if request is for API
function isApiRequest(url) {
    return API_PATTERNS.some(pattern => pattern.test(url.pathname)) ||
           url.pathname.includes('/api/') ||
           url.pathname.includes('/fhir/');
}

// Check if request is for static resource
function isStaticResource(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.svg', '.ico'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
           url.pathname === '/' ||
           url.pathname.endsWith('/');
}

// Handle API requests with network-first strategy and offline fallback
async function handleApiRequest(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        
        // If network fails, try cache
        return await getCachedResponse(request) || createOfflineResponse(request);
        
    } catch (error) {
        console.log('🔄 WebQX SW: Network failed, using cache or offline fallback');
        return await getCachedResponse(request) || createOfflineResponse(request);
    }
}

// Handle static resources with cache-first strategy
async function handleStaticResource(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache the response
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('🔄 WebQX SW: Failed to fetch static resource:', request.url);
        return new Response('Resource unavailable offline', { status: 503 });
    }
}

// Get cached response
async function getCachedResponse(request) {
    const apiCache = await caches.open(API_CACHE_NAME);
    return apiCache.match(request);
}

// Create offline fallback response for API requests
function createOfflineResponse(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Health check endpoints
    if (path.includes('/health')) {
        return new Response(JSON.stringify({
            status: 'offline',
            message: 'Service worker active - offline mode',
            timestamp: new Date().toISOString(),
            offline: true
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Authentication endpoints
    if (path.includes('/auth/') || path.includes('/login')) {
        return new Response(JSON.stringify({
            success: false,
            message: 'Authentication unavailable offline',
            offline: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // FHIR endpoints
    if (path.includes('/fhir/')) {
        return new Response(JSON.stringify({
            resourceType: 'OperationOutcome',
            issue: [{
                severity: 'error',
                code: 'not-available',
                details: {
                    text: 'FHIR service unavailable offline'
                }
            }],
            offline: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/fhir+json' }
        });
    }
    
    // Default offline response
    return new Response(JSON.stringify({
        error: 'Service unavailable offline',
        message: 'This feature requires an internet connection',
        offline: true,
        timestamp: new Date().toISOString()
    }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Background sync for failed requests
self.addEventListener('sync', event => {
    if (event.tag === 'webqx-retry') {
        event.waitUntil(retryFailedRequests());
    }
});

// Retry failed requests when connection is restored
async function retryFailedRequests() {
    console.log('🔄 WebQX SW: Retrying failed requests...');
    // Implementation for retry logic would go here
}

// Handle push notifications (if needed)
self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'WebQX Healthcare Platform';
    const options = {
        body: data.body || 'New healthcare notification',
        icon: '/assets/icon-192.png',
        badge: '/assets/badge-72.png',
        data: data.url || '/'
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow(event.notification.data || '/')
    );
});

console.log('🏥 WebQX Service Worker v2.0.0 loaded');