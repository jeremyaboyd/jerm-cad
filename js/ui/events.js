/**
 * UI event handlers
 */

import { renderModel } from '../modelRenderer.js';
import { resetCamera, toggleWireframe, exportModel, exportSTL } from '../renderer/controls.js';
import { setQuality } from '../utils/qualitySettings.js';
import { getEditor, getEditorValue, setEditorValue } from './editor.js';
import { handleResize } from '../renderer/animation.js';

// Re-export for global access if needed
window.renderModel = renderModel;
window.resetCamera = resetCamera;
window.toggleWireframe = toggleWireframe;
window.exportModel = exportModel;
window.exportSTL = exportSTL; // Legacy compatibility

/**
 * Initialize splitter resizing functionality
 */
function initializeSplitter() {
    const splitter = document.getElementById('splitter');
    const editorPanel = document.getElementById('editor-panel');
    
    if (!splitter || !editorPanel) {
        console.error('Splitter or editor panel not found');
        return;
    }
    
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;
    
    splitter.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = editorPanel.offsetWidth;
        splitter.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        const containerWidth = document.body.offsetWidth;
        const splitterWidth = splitter.offsetWidth;
        const minWidth = 200;
        const maxWidth = containerWidth - splitterWidth - minWidth;
        
        // Clamp the width between min and max
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        editorPanel.style.width = `${clampedWidth}px`;
        
        // Refresh CodeMirror editor size
        const editor = getEditor();
        if (editor) {
            editor.refresh();
        }
        
        // Handle canvas resize
        handleResize();
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            splitter.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
    
    // Prevent text selection while dragging
    splitter.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
}

/**
 * Default YAML template for new files
 */
const DEFAULT_YAML_TEMPLATE = `# New Model
settings:
    units: mm
    debug: false
    tolerance: 1e-3
    up: [0, 0, 1]  # Z-up (CAD convention). Use [0, 1, 0] for Y-up

materials:
    default_material:
        color: 0x4287f5
        opacity: 1.0

solids:
    example_cube:
        shape: cuboid
        center: [0, 0, 0]
        size: [10, 10, 10]

final:
    material: default_material
`;

/**
 * Create a new file
 */
function newFile() {
    if (confirm('Create a new file? Any unsaved changes will be lost.')) {
        setEditorValue(DEFAULT_YAML_TEMPLATE);
    }
}

/**
 * Save current file
 */
function saveFile() {
    const content = getEditorValue();
    const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.yaml';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Open a file
 */
function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            setEditorValue(content);
        };
        reader.readAsText(file);
    };
    input.click();
}

/**
 * Initialize keyboard shortcuts
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+N: New file
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            newFile();
        }
        // Ctrl+S: Save file
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveFile();
        }
        // Ctrl+O: Open file
        if (e.ctrlKey && e.key === 'o') {
            e.preventDefault();
            openFile();
        }
    });
}

/**
 * Initialize all UI event listeners
 */
export function initialize() {
    // Editor toolbar buttons
    document.getElementById('btn-new').addEventListener('click', newFile);
    document.getElementById('btn-open').addEventListener('click', openFile);
    document.getElementById('btn-save').addEventListener('click', saveFile);
    document.getElementById('btn-export').addEventListener('click', exportModel);
    
    // Viewer toolbar buttons
    document.getElementById('btn-render').addEventListener('click', renderModel);
    document.getElementById('btn-wireframe').addEventListener('click', toggleWireframe);
    
    // Quality selection
    document.getElementById('quality-select').addEventListener('change', (e) => {
        setQuality(e.target.value);
        renderModel(); // Auto-render on quality change
    });
    
    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts();
    
    // Initialize splitter resizing
    initializeSplitter();
    
    // Auto-render on Enter key (when Ctrl is held) - handled by CodeMirror extraKeys
    // CodeMirror handles this via the extraKeys configuration in editor.js
}

