/**
 * IndexedDB store for PDF translation (FR-1 / FR-2).
 *
 * Holds raw PDF bytes (and nothing else) so the bytes fetched by the
 * background service worker can be handed to the viewer page without
 * exceeding runtime.sendMessage size limits. Shared origin (extension
 * page / service worker / moz-extension page), newest MAX_FILES kept.
 *
 * Loaded as a classic script in background/entry.js (importScripts) and the
 * viewer page; exposed as `LctPdfStore`.
 */
(function (scope) {
    'use strict';

    const DB_NAME = 'lct-pdf-translate';
    const DB_VERSION = 1;
    const STORE = 'files';
    const MAX_FILES = 8;

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
        });
    }

    function store(db, mode) {
        return db.transaction(STORE, mode).objectStore(STORE);
    }

    function asPromise(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
        });
    }

    /** Save bytes; returns the record id (also used as the viewer URL key). */
    async function savePdf(bytes, meta) {
        const db = await openDb();
        const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const id = (meta && meta.id) || ('pdf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
        const rec = {
            id,
            bytes: data,
            size: data.byteLength,
            name: (meta && meta.name) || '',
            url: (meta && meta.url) || '',
            savedAt: Date.now()
        };
        await asPromise(store(db, 'readwrite').put(rec));
        await prune(db);
        db.close();
        return id;
    }

    /** Read a record; null when missing. */
    async function loadPdf(id) {
        const db = await openDb();
        const rec = await asPromise(store(db, 'readonly').get(id));
        db.close();
        if (!rec) return null;
        return {
            id: rec.id,
            bytes: rec.bytes,
            size: rec.size,
            name: rec.name,
            url: rec.url,
            savedAt: rec.savedAt
        };
    }

    async function deletePdf(id) {
        const db = await openDb();
        await asPromise(store(db, 'readwrite').delete(id));
        db.close();
    }

    /** All records, newest first. */
    async function listPdfs() {
        const db = await openDb();
        const all = (await asPromise(store(db, 'readonly').getAll())) || [];
        db.close();
        return all
            .map(r => ({ id: r.id, size: r.size, name: r.name, url: r.url, savedAt: r.savedAt }))
            .sort((a, b) => b.savedAt - a.savedAt);
    }

    /** Keep only the MAX_FILES most recent records. */
    async function prune(db) {
        const all = (await asPromise(store(db, 'readonly').getAll())) || [];
        if (all.length <= MAX_FILES) return;
        all.sort((a, b) => b.savedAt - a.savedAt);
        const doomed = all.slice(MAX_FILES);
        for (const r of doomed) {
            await asPromise(store(db, 'readwrite').delete(r.id));
        }
    }

    scope.LctPdfStore = { savePdf, loadPdf, deletePdf, listPdfs };
})(typeof window !== 'undefined' ? window : globalThis);
