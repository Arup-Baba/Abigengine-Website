

export const setAsyncImage = async (element, url) => {
    const parent = element.parentElement;

    const resetParentState = () => {
        if(parent) {
            parent.classList.remove('error', 'no-image', 'loading');
        }
    }

    if (!url || typeof url !== 'string' || url.includes('.mp4')) {
        resetParentState();
        if (parent) parent.classList.add('no-image');
         if(typeof url === 'string' && url.includes('.mp4')) {
            console.error(`Attempted to load video URL in img tag: ${url}`);
         }
        return;
    }

    // Simplified logic for direct URLs (Cloudflare R2, etc.)
    resetParentState();
    if (parent) parent.classList.add('loading');
    
    element.onload = () => {
        if(parent) parent.classList.remove('loading');
    };
    element.onerror = () => {
        if (parent) {
            parent.classList.remove('loading');
            parent.classList.add('error');
        }
        console.error(`Failed to load direct image URL: ${url}`);
    };
    
    element.src = url;
};

export const showLoadingOverlay = (show, text = 'Loading...') => {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    const textSpan = overlay.querySelector('span');
    if (textSpan) textSpan.textContent = text;
    overlay.style.display = show ? 'flex' : 'none';
};

export const showUploadProgress = (show, percent = 0) => {
    const overlay = document.getElementById('upload-progress-overlay');
    const bar = document.getElementById('upload-progress-bar');
    const text = document.getElementById('upload-progress-text');

    if (!overlay || !bar || !text) return;

    overlay.classList.toggle('hidden', !show);
    if (show) {
        bar.style.width = `${percent}%`;
        text.textContent = `${Math.round(percent)}%`;
    }
};

export const getDragAfterElement = (container, y) => {
    const draggableElements = [...container.querySelectorAll('.reel-list-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
};

/**
 * Parses a standard tyre title string into a structured object.
 * Robustly handles multi-word model names.
 * @param title The tyre title string (e.g., "CEAT SecuraDrive 185/65 R15 88T")
 * @returns A TyreDetails object or null if parsing fails.
 */
export const parseTyreTitle = (title) => {
    const specRegex = /(?<width>\d+)\/(?<profile>\d+)\s*R(?<radius>\d+)\s+(?<loadIndex>\d+)(?<speedRating>[A-Za-z])$/;
    const specMatch = title.match(specRegex);

    if (specMatch && specMatch.groups && typeof specMatch.index === 'number') {
        const brandAndModelStr = title.substring(0, specMatch.index).trim();
        const brandModelParts = brandAndModelStr.split(/\s+/);
        
        if (brandModelParts.length < 2) return null; // Must have at least a brand and a model part

        const brand = brandModelParts[0];
        const model = brandModelParts.slice(1).join(' ');

        return {
            brand: brand,
            model: model,
            width: specMatch.groups.width,
            profile: specMatch.groups.profile,
            radius: specMatch.groups.radius,
            loadIndex: specMatch.groups.loadIndex,
            speedRating: specMatch.groups.speedRating.toUpperCase(),
        };
    }
    return null;
};

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param func The function to debounce.
 * @param waitFor The number of milliseconds to delay.
 * @returns The new debounced function.
 */
export function debounce(func, waitFor) {
    let timeout = null;

    return (...args) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => func(...args), waitFor);
    };
}