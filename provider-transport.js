(function (root) {
    'use strict';

    async function postJson(url, body, options = {}) {
        const serializedBody = JSON.stringify(body);
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            options.timeoutMs ?? 300000
        );

        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: serializedBody,
                signal: controller.signal
            });
        } catch (e) {
            if (e.name === 'AbortError') {
                throw new Error(options.timeoutMessage || 'Request timed out');
            }
            if (e.name === 'TypeError' && options.connectionErrorMessage) {
                throw new Error(options.connectionErrorMessage);
            }
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const responseText = await response.text();
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            error.responseText = responseText;
            throw error;
        }

        return response.json();
    }

    root.ProviderTransport = { postJson };
})(typeof window !== 'undefined' ? window : globalThis);
