"use strict";

importScripts(
	"https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js"
);

const { registerRoute, Route } = workbox.routing;
const { CacheFirst } = workbox.strategies;

const scripts_route = new Route(({ request }) => {
  return request.destination === 'script';
}, new CacheFirst({
  cacheName: "scripts",
}));

const styles_route = new Route(({ request }) => {
  return request.destination === 'style';
}, new CacheFirst({
  cacheName: "styles",
}));

const fonts_route = new Route(({ request }) => {
  return request.destination === 'font';
}, new CacheFirst({
  cacheName: "fonts",
}));

const pyodide_cdn_route = new Route(({ request }) => {
	return request.destination !== 'script' && request.url.startsWith("https://cdn.jsdelivr.net/pyodide/");
}, new CacheFirst({
	cacheName: "pyodide",
}));

const wheels_route = new Route(({ request }) => {
	return !request.url.startsWith("https://cdn.jsdelivr.net/pyodide/") && request.url.endsWith(".whl");
}, new CacheFirst({
	cacheName: "wheels",
}));

registerRoute(scripts_route);
registerRoute(styles_route);
registerRoute(fonts_route);
registerRoute(pyodide_cdn_route);
registerRoute(wheels_route);
