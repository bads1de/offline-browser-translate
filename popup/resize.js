/**
 * Popup: the resizable window grip. Size is persisted to localStorage.
 *
 * A classic script loaded last; it registers its own DOMContentLoaded handler.
 */

// ============================================================================
// Resizable popup — drag the corner grip to adjust width and height.
// Uses Pointer Capture so the drag keeps working even when the cursor moves
// outside the popup window quickly. Size is persisted to localStorage.
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const handle = document.querySelector('.resize-handle');
    if (!handle) return;

    const MIN_W = 260, MAX_W = 720, MIN_H = 280;
    const STORAGE_KEY_W = 'popupWidth';
    const STORAGE_KEY_H = 'popupHeight';

    // Restore previously saved size
    const savedW = localStorage.getItem(STORAGE_KEY_W);
    const savedH = localStorage.getItem(STORAGE_KEY_H);
    if (savedW) document.body.style.width = Math.max(MIN_W, Math.min(MAX_W, +savedW)) + 'px';
    if (savedH) document.body.style.height = Math.max(MIN_H, +savedH) + 'px';

    let dragging = false;
    let startX, startY, startW, startH;
    let rafId = null;       // pending animation frame
    let pendingW, pendingH; // latest values to commit on next frame

    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startW = document.body.offsetWidth;
        startH = document.body.offsetHeight;
        handle.setPointerCapture(e.pointerId); // keeps events firing even outside window
        handle.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        // Compute the desired size but don't write to the DOM yet
        pendingW = Math.max(MIN_W, Math.min(MAX_W, startW + (startX - e.clientX)));
        pendingH = Math.max(MIN_H, startH + (e.clientY - startY));
        // Schedule a single DOM write per animation frame (drops redundant intermediate events)
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                document.body.style.width  = pendingW + 'px';
                document.body.style.height = pendingH + 'px';
                rafId = null;
            });
        }
    });

    const stopDrag = () => {
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('dragging');
        localStorage.setItem(STORAGE_KEY_W, document.body.offsetWidth);
        localStorage.setItem(STORAGE_KEY_H, document.body.offsetHeight);
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
});
