/**
 * CodeMirror editor initialization
 */

let codeEditor = null;

/**
 * Initialize CodeMirror editor
 */
export function initializeEditor() {
    const textarea = document.getElementById('editor');
    if (!textarea) {
        console.error('Editor textarea not found');
        return;
    }

    // Check if CodeMirror is available
    if (typeof CodeMirror === 'undefined') {
        console.error('CodeMirror is not loaded');
        return;
    }

    // Load from localStorage or use textarea content
    const savedContent = localStorage.getItem('jermcad-editor-content');
    const initialContent = savedContent || textarea.value;

    // Tab stop size
    const TAB_SIZE = 4;

    /**
     * Get the next tab stop column (next multiple of TAB_SIZE)
     */
    function getNextTabStop(column) {
        return Math.ceil((column + 1) / TAB_SIZE) * TAB_SIZE;
    }

    /**
     * Get the previous tab stop column (previous multiple of TAB_SIZE)
     */
    function getPreviousTabStop(column) {
        return Math.floor(column / TAB_SIZE) * TAB_SIZE;
    }

    /**
     * Smart Tab handler - inserts spaces up to next tab stop
     */
    function handleSmartTab(cm) {
        const ranges = cm.listSelections();
        const replacements = [];
        
        for (let i = ranges.length - 1; i >= 0; i--) {
            const range = ranges[i];
            const start = range.head;
            const line = cm.getLine(start.line);
            const currentColumn = start.ch;
            
            // Calculate spaces needed to reach next tab stop
            const nextTabStop = getNextTabStop(currentColumn);
            const spacesNeeded = nextTabStop - currentColumn;
            
            replacements.push({
                from: start,
                to: start,
                text: ' '.repeat(spacesNeeded)
            });
        }
        
        // Apply all replacements
        for (const rep of replacements) {
            cm.replaceRange(rep.text, rep.from, rep.to, '+input');
        }
    }

    /**
     * Smart Backspace handler - deletes spaces intelligently at line start
     */
    function handleSmartBackspace(cm) {
        const ranges = cm.listSelections();
        let handled = false;
        
        for (let i = ranges.length - 1; i >= 0; i--) {
            const range = ranges[i];
            const start = range.head;
            const line = cm.getLine(start.line);
            const currentColumn = start.ch;
            
            // Only handle if cursor is at the start of the line
            // or only whitespace exists before the cursor
            if (currentColumn === 0) {
                continue; // At very start, let default behavior handle it
            }
            
            // Check if only whitespace exists before cursor
            const beforeCursor = line.substring(0, currentColumn);
            if (!/^\s*$/.test(beforeCursor)) {
                continue; // Non-whitespace before cursor, use default behavior
            }
            
            // Check if we're on a tab stop (multiple of TAB_SIZE)
            if (currentColumn % TAB_SIZE === 0) {
                // On a tab stop: delete TAB_SIZE spaces at once
                const deleteFrom = Math.max(0, currentColumn - TAB_SIZE);
                cm.replaceRange('', 
                    { line: start.line, ch: deleteFrom },
                    { line: start.line, ch: currentColumn },
                    '+delete');
                handled = true;
            } else {
                // Not on a tab stop: delete 1 space at a time until we reach a tab stop
                // Delete just one space (will be called repeatedly until we reach tab stop)
                cm.replaceRange('',
                    { line: start.line, ch: currentColumn - 1 },
                    { line: start.line, ch: currentColumn },
                    '+delete');
                handled = true;
            }
        }
        
        return handled;
    }

    // Initialize CodeMirror
    codeEditor = CodeMirror.fromTextArea(textarea, {
        mode: 'yaml',
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 4,
        indentWithTabs: false,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        tabSize: TAB_SIZE,
        extraKeys: {
            'Ctrl-Enter': function() {
                // Trigger render on Ctrl+Enter
                const event = new CustomEvent('render');
                window.dispatchEvent(event);
            },
            'Tab': handleSmartTab,
            'Backspace': function(cm) {
                // Try smart backspace first, fall back to default if not handled
                if (!handleSmartBackspace(cm)) {
                    // Default backspace behavior
                    cm.execCommand('delCharBefore');
                }
            }
        }
    });

    // Set initial content
    codeEditor.setValue(initialContent);

    // Refresh CodeMirror to ensure proper sizing
    setTimeout(() => {
        if (codeEditor) {
            codeEditor.refresh();
        }
    }, 0);

    return codeEditor;
}

/**
 * Get the CodeMirror editor instance
 */
export function getEditor() {
    return codeEditor;
}

/**
 * Get the current editor content
 */
export function getEditorValue() {
    if (codeEditor) {
        return codeEditor.getValue();
    }
    // Fallback to textarea if CodeMirror not initialized
    const textarea = document.getElementById('editor');
    return textarea ? textarea.value : '';
}

/**
 * Set the editor content
 */
export function setEditorValue(value) {
    if (codeEditor) {
        codeEditor.setValue(value);
        codeEditor.refresh();
    } else {
        const textarea = document.getElementById('editor');
        if (textarea) {
            textarea.value = value;
        }
    }
}

