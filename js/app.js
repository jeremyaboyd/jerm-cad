/**
 * Main application entry point
 * Coordinates initialization and startup
 */

import { initialize as initializeScene, getCSGEvaluator } from './renderer/scene.js';
import { startAnimation, handleResize } from './renderer/animation.js';
import { initialize as initializeModifiers } from './modifiers/index.js';
import { initialize as initializeUI } from './ui/events.js';
import { initializeEditor, getEditorValue } from './ui/editor.js';
import { renderModel } from './modelRenderer.js';
import { compileYAML } from './utils/yamlParser.js';

// Initialize on load
window.addEventListener('load', () => {
    // Initialize CodeMirror editor
    initializeEditor();
    
    // Initialize Three.js scene
    const { csgEvaluator } = initializeScene();
    
    // Initialize modifiers with CSG evaluator
    initializeModifiers(csgEvaluator);
    
    // Start animation loop
    startAnimation();
    
    // Initialize UI event handlers
    initializeUI();
    
    // Handle window resize
    window.addEventListener('resize', handleResize);
    
    // Listen for render events (triggered by Ctrl+Enter in editor)
    window.addEventListener('render', renderModel);
    
    // Initial render
    renderModel();
});

// Expose compileYAML function to console for debugging
// Usage: compileYAML() - compiles current editor content
// Usage: compileYAML(yamlText) - compiles provided YAML text
window.compileYAML = function(yamlText) {
    if (yamlText === undefined) {
        // Get YAML from editor if no argument provided
        yamlText = getEditorValue();
    }
    if (!yamlText) {
        console.error('No YAML text provided and editor is empty');
        return null;
    }
    try {
        const compiled = compileYAML(yamlText);
        console.log('Compiled YAML:');
        console.log(compiled);
        return compiled;
    } catch (error) {
        console.error('Error compiling YAML:', error.message);
        throw error;
    }
};
