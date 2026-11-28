/**
 * Shared toast notification for the extension pages (options, popup,
 * translator).
 *
 * Loaded as a classic script before the page script. The page markup provides
 * a #toast element containing .toast-icon and .toast-message; createToast()
 * binds the shared show/hide behaviour to it, so each page only has to wire
 * its own element once:
 *
 *     const showToast = createToast(elements.toast);
 *     showToast(t('toast.saved'));
 *     showToast(t('toast.saveFailed'), 'error');
 */

/**
 * Bind a toast element and return showToast(message, type, duration).
 * @param {HTMLElement|null} toast - the #toast element
 * @param {object} [config]
 *  - duration?: number - how long the toast stays visible (default 3000ms)
 */
function createToast(toast, config = {}) {
    const defaultDuration = config.duration ?? 3000;

    return function showToast(message, type = 'success', duration = defaultDuration) {
        if (!toast) return;

        const icon = toast.querySelector('.toast-icon');
        const msg = toast.querySelector('.toast-message');

        if (icon) icon.textContent = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
        if (msg) msg.textContent = message;

        if (type === 'error') {
            toast.style.borderColor = 'var(--red)';
            toast.style.color = 'var(--red)';
        } else {
            toast.style.borderColor = 'var(--accent)';
            toast.style.color = 'var(--accent)';
        }

        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    };
}

// Export for other classic scripts (the pages load this before their own JS).
if (typeof window !== 'undefined') {
    window.createToast = createToast;
}
