// Service worker do PWA.
//
// REGRA DE OURO: este cache guarda APENAS asset estático (ícone, manifest).
// NUNCA HTML.
//
// Por quê: uma rota autenticada (/leads, /propostas, /agenda, /dashboard) renderiza
// nome e WhatsApp de cliente no HTML. Se o service worker guardar essa resposta, o dado
// fica gravado em disco no CacheStorage e volta a ser servido sempre que a rede falhar —
// sem sessão, sem RLS, para quem estiver naquele perfil do navegador (depois do logout,
// no modo avião, no wifi ruim). O RLS do Supabase não protege nada aqui: o que vaza é
// HTML já renderizado, não uma query nova.
//
// A versão do cache é parte do contrato: ao mudar o que se cacheia, SUBA a versão —
// o handler de activate apaga as versões antigas, e é isso que expulsa do disco dos
// usuários o que já tinha sido gravado errado.
const CACHE_NAME = 'vveronez-v3';

// Só o que é público e imutável. '/dashboard' saiu daqui de propósito: é página autenticada.
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/** Só é cacheável o que é público e imutável. Todo o resto (HTML, API, auth) passa
 *  direto para a rede, sem tocar no cache — nem na ida, nem na volta. */
function cacheavel(url) {
  return url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;
  // Navegação (HTML) nunca passa por aqui — deixa a rede responder, sempre.
  if (request.mode === 'navigate') return;
  if (!cacheavel(url)) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
