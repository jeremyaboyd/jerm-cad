/**
 * UI event handlers
 */

import { renderModel } from '../modelRenderer.js';
import { resetCamera, toggleWireframe, exportModel, exportSTL } from '../renderer/controls.js';
import { setQuality } from '../utils/qualitySettings.js';

// Re-export for global access if needed
window.renderModel = renderModel;
window.resetCamera = resetCamera;
window.toggleWireframe = toggleWireframe;
window.exportModel = exportModel;
window.exportSTL = exportSTL; // Legacy compatibility

/**
 * Initialize all UI event listeners
 */
export function initialize() {
    // Set up button event listeners
    document.getElementById('btn-render').addEventListener('click', renderModel);
    document.getElementById('btn-reset-camera').addEventListener('click', resetCamera);
    document.getElementById('btn-wireframe').addEventListener('click', toggleWireframe);
    document.getElementById('btn-export').addEventListener('click', exportModel);
    
    // Quality selection
    document.getElementById('quality-select').addEventListener('change', (e) => {
        setQuality(e.target.value);
        renderModel(); // Auto-render on quality change
    });
    
    // Auto-render on Enter key (when Ctrl is held)
    document.getElementById('editor').addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            renderModel();
            e.preventDefault();
        }
    });
}

