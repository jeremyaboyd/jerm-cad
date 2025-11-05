/**
 * Debug logging utility
 */

let debugEnabled = false;

/**
 * Enable or disable debug logging
 * @param {boolean} enabled - Whether debug logging should be enabled
 */
export function setDebugEnabled(enabled) {
    debugEnabled = enabled;
    if (enabled) {
        console.log('[DEBUG] Debug logging enabled');
    }
}

/**
 * Check if debug logging is enabled
 * @returns {boolean} Whether debug logging is enabled
 */
export function isDebugEnabled() {
    return debugEnabled;
}

/**
 * Log a debug message if debug is enabled
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
    if (debugEnabled) {
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Log a debug message with a label
 * @param {string} label - Label for the debug message
 * @param {...any} args - Arguments to log
 */
export function debugLabel(label, ...args) {
    if (debugEnabled) {
        console.log(`[DEBUG] ${label}:`, ...args);
    }
}

