/**
 * UI display updates (stats, errors)
 */

/**
 * Show error message
 */
export function showError(message) {
    const errorDisplay = document.getElementById('error-display');
    errorDisplay.textContent = `Error: ${message}`;
    errorDisplay.classList.add('show');
}

/**
 * Hide error message
 */
export function hideError() {
    const errorDisplay = document.getElementById('error-display');
    errorDisplay.classList.remove('show');
}

/**
 * Update model statistics display
 */
export function updateStats(data, visibleCount, totalVertices, upVector) {
    const upAxis = upVector[0] === 1 ? 'X' : upVector[1] === 1 ? 'Y' : upVector[2] === 1 ? 'Z' : 'Custom';
    document.getElementById('model-stats').innerHTML = `
        <strong>Solids:</strong> ${visibleCount} visible / ${Object.keys(data.solids).length} total<br>
        <strong>Vertices:</strong> ${totalVertices.toLocaleString()}<br>
        <strong>Units:</strong> ${data.settings?.units || 'mm'}<br>
        <strong>Up Axis:</strong> ${upAxis} ${upVector.join(',')}<br>
        <strong>Tolerance:</strong> ${data.settings?.tolerance || '1e-4'}
    `;
}

