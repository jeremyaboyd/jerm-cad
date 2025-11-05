/**
 * Quality settings management for curve segment resolution
 */

const QUALITY_PRESETS = {
    'low': 32,
    'medium': 64,
    'high': 128,
    'ultra': 256
};

let currentQuality = 'low'; // Default quality
let forceQuality = null; // Override for specific operations (e.g., STL export)

/**
 * Get the current segment count based on quality setting
 */
export function getSegmentCount() {
    if (forceQuality !== null) {
        return QUALITY_PRESETS[forceQuality] || 128;
    }
    return QUALITY_PRESETS[currentQuality] || 128;
}

/**
 * Set the current quality level
 */
export function setQuality(quality) {
    if (QUALITY_PRESETS.hasOwnProperty(quality)) {
        currentQuality = quality;
        console.log(`Quality set to: ${quality} (${QUALITY_PRESETS[quality]} segments)`);
    }
}

/**
 * Get the current quality level
 */
export function getQuality() {
    return currentQuality;
}

/**
 * Force a specific quality level (for operations like STL export)
 * Set to null to remove override
 */
export function forceQualityLevel(quality) {
    forceQuality = quality;
}

/**
 * Get quality presets for UI
 */
export function getQualityPresets() {
    return { ...QUALITY_PRESETS };
}

