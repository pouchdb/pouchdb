/* eslint-disable no-undef */
// 'use strict'; is default when ESM

// AbortController was introduced quite a while after fetch and
// isnt required for PouchDB to function so polyfill if needed
const AbortController = globalThis.AbortController ||
    function () { return {abort: function () {}}; };

const fetch = globalThis.fetch;
const Headers = globalThis.Headers;

export {fetch, Headers, AbortController};
