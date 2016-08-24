---
---

// Useful resources:
// - https://eduardoboucas.com/blog/2015/06/04/supercharging-jekyll-with-a-serviceworker.html
// - https://jakearchibald.com/2014/offline-cookbook

var newCacheName = 'pouchdb-assets-cache-v{{ site.time }}';

var criticalAssets = [
  '/offline.html',
  '/static/css/pouchdb.css',
];

var pages = [
  {% for page in site.pages %}
    {% if page.url != '/manifest.appcache' %}
      '{{ page.url | replace:'index.html','' }}',
    {% endif %}
  {% endfor %}
  {% for page in site.guides %}
    '{{ page.url | replace:'index.html','' }}',
  {% endfor %}
];

var blogPosts = [
  {% for page in site.posts %}
    '{{ page.url | replace:'index.html','' }}',
  {% endfor %}
];

// Only cache the first blog page
var nonCriticalAssets =
  [
    '/static/favicon.ico',
    '/static/js/code.min.js',
    'http://code.jquery.com/jquery.min.js',
    'http://netdna.bootstrapcdn.com/bootstrap/3.1.1/js/bootstrap.min.js',
    'http://cdn.jsdelivr.net/pouchdb/latest/pouchdb.min.js',
  ]
  .concat(pages)
  .filter(function(file) {
    return file.indexOf('/blog/page') === -1;
  })
  .concat(blogPosts.slice(0, 5)); // Let's only cache the first five by default

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(newCacheName)
      .then(function(cache) {
        cache.addAll(nonCriticalAssets);
        // Only return the criticalAssets to waitUntil
        // This will allow the noncritical assets to fail
        return cache.addAll(criticalAssets);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function(event) {
  // remove caches beginning "pouchdb-" that aren't the new cache
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (!/^pouchdb-/.test(cacheName)) {
              return;
            }
            if (newCacheName !== cacheName) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function(event) {
  // Try the cache, if it's not in there try the network, then cache that response
  // if that network request fails show the offline.html page.
  event.respondWith(
    caches.open(newCacheName).then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        }).catch(function () {
          return cache.match('/offline.html');
        });
      });
   })
  );
});
