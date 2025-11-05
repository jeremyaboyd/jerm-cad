/**
 * YAML parsing utilities
 */

/**
 * Substitute parameters in a value (recursively handles objects, arrays, and strings)
 */
function substituteParameters(value, paramMap) {
    if (typeof value === 'string') {
        // Replace parameter references like $diameter with their values
        let result = value;
        for (const [paramName, paramValue] of Object.entries(paramMap)) {
            // Replace $paramName with paramValue, handling word boundaries
            const regex = new RegExp(`\\$${paramName}\\b`, 'g');
            result = result.replace(regex, paramValue.toString());
        }
        return result;
    } else if (Array.isArray(value)) {
        return value.map(item => substituteParameters(item, paramMap));
    } else if (value && typeof value === 'object') {
        const result = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = substituteParameters(val, paramMap);
        }
        return result;
    }
    return value;
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Process stamps - expand stamp definitions into actual solids
 */
function processStamps(data) {
    if (!data.stamps || !data.solids) {
        return data;
    }
    
    const stamps = data.stamps;
    const solids = deepClone(data.solids);
    const newSolids = {};
    
    // Process each solid that has stamps
    for (const [solidName, solid] of Object.entries(solids)) {
        if (!solid.stamps) {
            // No stamps, keep as-is
            newSolids[solidName] = solid;
            continue;
        }
        
        // Clone the solid (we'll modify it)
        const processedSolid = deepClone(solid);
        
        // Initialize modifiers if they don't exist
        if (!processedSolid.modifiers) {
            processedSolid.modifiers = {};
        }
        if (!processedSolid.modifiers.boolean) {
            processedSolid.modifiers.boolean = [];
        }
        
        // Process each stamp instance
        for (const [stampInstanceName, stampInstance] of Object.entries(solid.stamps)) {
            // Handle case where stampInstance might be the stamp name directly, or an object
            let stampName, stampParams, stampPosition, stampRotation;
            
            if (typeof stampInstance === 'string') {
                // Simple case: just a stamp name
                stampName = stampInstance;
                stampParams = {};
                stampPosition = [0, 0, 0];
                stampRotation = [0, 0, 0];
            } else {
                // Object case: has stamp, parameters, at, and optionally rotate
                stampName = stampInstance.stamp;
                stampPosition = stampInstance.at || [0, 0, 0];
                stampRotation = stampInstance.rotate || [0, 0, 0];
                
                // Extract all parameters (everything except 'stamp', 'at', and 'rotate')
                stampParams = {};
                for (const [key, value] of Object.entries(stampInstance)) {
                    if (key !== 'stamp' && key !== 'at' && key !== 'rotate') {
                        stampParams[key] = value;
                    }
                }
            }
            
            if (!stamps[stampName]) {
                console.warn(`Stamp "${stampName}" not found for solid "${solidName}"`);
                continue;
            }
            
            const stampDef = stamps[stampName];
            
            // Build parameter map from stamp definition params and instance values
            const paramMap = {};
            if (stampDef.params && Array.isArray(stampDef.params)) {
                stampDef.params.forEach((paramName, index) => {
                    // Remove $ prefix if present
                    const cleanParamName = paramName.replace(/^\$/, '');
                    // Get the parameter value from the instance (by name or by index)
                    let paramValue = null;
                    
                    // Try to get by name first
                    if (stampParams.hasOwnProperty(cleanParamName)) {
                        paramValue = stampParams[cleanParamName];
                    } else {
                        // Try to get by index (if params are ordered)
                        const paramKeys = Object.keys(stampParams);
                        if (paramKeys[index]) {
                            paramValue = stampParams[paramKeys[index]];
                        }
                    }
                    
                    if (paramValue !== null && paramValue !== undefined) {
                        paramMap[cleanParamName] = paramValue;
                    }
                });
            } else {
                // If no params array defined, use all stampParams as the param map
                for (const [key, value] of Object.entries(stampParams)) {
                    paramMap[key] = value;
                }
            }
            
            // Generate unique names for all shapes in this stamp
            const shapeNameMap = {}; // Maps original shape names to new unique names
            const processedShapes = {}; // Store processed shapes temporarily
            
            // First pass: create all shapes with parameter substitution and position offset
            if (stampDef.shapes) {
                for (const [shapeName, shapeDef] of Object.entries(stampDef.shapes)) {
                    const uniqueName = `${solidName}_${stampInstanceName}_${shapeName}`;
                    shapeNameMap[shapeName] = uniqueName;
                    
                    // Clone and process the shape
                    let processedShape = deepClone(shapeDef);
                    
                    // Substitute parameters
                    processedShape = substituteParameters(processedShape, paramMap);
                    
                    // Helper function to evaluate math expressions in center coordinates
                    function evaluateCenterExpressions(center) {
                        return center.map(val => {
                            if (typeof val === 'string' && hasMathOperators(val)) {
                                try {
                                    const safePattern = /^[0-9+*/()\.\s-]+$/;
                                    if (safePattern.test(val.trim())) {
                                        const result = Function(`"use strict"; return (${val.trim()})`)();
                                        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                                            return result;
                                        }
                                    }
                                } catch (e) {
                                    // If evaluation fails, return as string
                                }
                            }
                            return val;
                        });
                    }
                    
                    // Apply translation and rotation
                    // Strategy: Translate first, then rotate around the translated position
                    if (processedShape.center && Array.isArray(processedShape.center)) {
                        const rotX = stampRotation[0] || 0;
                        const rotY = stampRotation[1] || 0;
                        const rotZ = stampRotation[2] || 0;
                        const offsetX = stampPosition[0] || 0;
                        const offsetY = stampPosition[1] || 0;
                        const offsetZ = stampPosition[2] || 0;
                        
                        // Check if we need to apply rotation
                        const hasRotation = rotX !== 0 || rotY !== 0 || rotZ !== 0;
                        
                        // First, try to evaluate math expressions in center
                        const evaluatedCenter = evaluateCenterExpressions(processedShape.center);
                        const allNumeric = evaluatedCenter.every(v => typeof v === 'number');
                        
                        if (hasRotation) {
                            // Rotate center coordinates around stamp origin, then translate to stamp position
                            // This ensures all shapes rotate together around the stamp position
                            if (allNumeric) {
                                // Numeric: rotate then translate
                                const [cx, cy, cz] = evaluatedCenter;
                                
                                // Convert rotation to radians
                                const rotXRad = rotX * Math.PI / 180;
                                const rotYRad = rotY * Math.PI / 180;
                                const rotZRad = rotZ * Math.PI / 180;
                                
                                // Start with shape's center (relative to stamp origin)
                                let x = cx;
                                let y = cy;
                                let z = cz;
                                
                                // Apply rotations in ZYX order (standard Euler angles)
                                // Rotate around Z axis
                                if (rotZRad !== 0) {
                                    const cosZ = Math.cos(rotZRad);
                                    const sinZ = Math.sin(rotZRad);
                                    const newX = x * cosZ - y * sinZ;
                                    const newY = x * sinZ + y * cosZ;
                                    x = newX;
                                    y = newY;
                                }
                                
                                // Rotate around Y axis
                                if (rotYRad !== 0) {
                                    const cosY = Math.cos(rotYRad);
                                    const sinY = Math.sin(rotYRad);
                                    const newX = x * cosY + z * sinY;
                                    const newZ = -x * sinY + z * cosY;
                                    x = newX;
                                    z = newZ;
                                }
                                
                                // Rotate around X axis
                                if (rotXRad !== 0) {
                                    const cosX = Math.cos(rotXRad);
                                    const sinX = Math.sin(rotXRad);
                                    const newY = y * cosX - z * sinX;
                                    const newZ = y * sinX + z * cosX;
                                    y = newY;
                                    z = newZ;
                                }
                                
                                // Translate to stamp position
                                processedShape.center = [x + offsetX, y + offsetY, z + offsetZ];
                            } else {
                                // Has expressions: translate first, then add rotation property
                                // For expressions, we can't easily compute rotation, so we translate
                                // and add rotation property (will be applied to geometry)
                                processedShape.center = processedShape.center.map((val, index) => {
                                    const offset = index === 0 ? offsetX : index === 1 ? offsetY : offsetZ;
                                    if (typeof val === 'number') {
                                        return val + offset;
                                    } else if (typeof val === 'string') {
                                        if (offset !== 0) {
                                            return `(${val}) + ${offset}`;
                                        }
                                        return val;
                                    }
                                    return val;
                                });
                                
                                // Add rotation property (will be applied when shape is created)
                                if (!processedShape.rotation) {
                                    processedShape.rotation = [0, 0, 0];
                                }
                                const existingRot = processedShape.rotation;
                                processedShape.rotation = [
                                    (existingRot[0] || 0) + rotX,
                                    (existingRot[1] || 0) + rotY,
                                    (existingRot[2] || 0) + rotZ
                                ];
                            }
                        } else {
                            // No rotation, just offset center by stamp position
                            processedShape.center = processedShape.center.map((val, index) => {
                                const offset = index === 0 ? offsetX : index === 1 ? offsetY : offsetZ;
                                if (typeof val === 'number') {
                                    return val + offset;
                                } else if (typeof val === 'string') {
                                    // Wrap in parentheses and add offset if it's an expression
                                    if (offset !== 0) {
                                        return `(${val}) + ${offset}`;
                                    }
                                    return val;
                                }
                                return val;
                            });
                        }
                    } else if (stampRotation && (stampRotation[0] !== 0 || stampRotation[1] !== 0 || stampRotation[2] !== 0)) {
                        // No center but has rotation - add rotation property
                        if (!processedShape.rotation) {
                            processedShape.rotation = [0, 0, 0];
                        }
                        const existingRot = processedShape.rotation;
                        processedShape.rotation = [
                            (existingRot[0] || 0) + (stampRotation[0] || 0),
                            (existingRot[1] || 0) + (stampRotation[1] || 0),
                            (existingRot[2] || 0) + (stampRotation[2] || 0)
                        ];
                    }
                    
                    // Store for second pass
                    processedShapes[uniqueName] = processedShape;
                }
            }
            
            // Helper function to recursively update boolean references
            function updateBooleanReferences(obj, nameMap) {
                if (Array.isArray(obj)) {
                    return obj.map(item => updateBooleanReferences(item, nameMap));
                } else if (obj && typeof obj === 'object') {
                    const updated = {};
                    for (const [key, value] of Object.entries(obj)) {
                        if (key === 'boolean' && Array.isArray(value)) {
                            // Update boolean operation references
                            updated[key] = value.map(op => {
                                const [opType, refName] = Object.entries(op)[0];
                                if (nameMap[refName]) {
                                    return { [opType]: nameMap[refName] };
                                }
                                return op;
                            });
                        } else {
                            // Recursively update nested structures
                            updated[key] = updateBooleanReferences(value, nameMap);
                        }
                    }
                    return updated;
                }
                return obj;
            }
            
            // Second pass: update all boolean references in modifiers using the complete shapeNameMap
            for (const [uniqueName, processedShape] of Object.entries(processedShapes)) {
                // Update references in modifiers
                if (processedShape.modifiers) {
                    processedShape.modifiers = updateBooleanReferences(processedShape.modifiers, shapeNameMap);
                }
                
                // Add the fully processed shape to newSolids
                newSolids[uniqueName] = processedShape;
            }
            
            // Apply parent modifiers to the parent solid
            if (stampDef.parent && stampDef.parent.modifiers) {
                // Update references in parent modifiers to use new shape names
                const parentModifiers = deepClone(stampDef.parent.modifiers);
                
                // Use the helper function to update all boolean references
                const updatedParentModifiers = updateBooleanReferences(parentModifiers, shapeNameMap);
                
                if (updatedParentModifiers.boolean && Array.isArray(updatedParentModifiers.boolean)) {
                    // Merge with existing boolean operations
                    processedSolid.modifiers.boolean = [
                        ...processedSolid.modifiers.boolean,
                        ...updatedParentModifiers.boolean
                    ];
                }
            }
        }
        
        // Remove stamps property from the solid
        delete processedSolid.stamps;
        newSolids[solidName] = processedSolid;
    }
    
    return {
        ...data,
        solids: newSolids
    };
}

/**
 * Check if a string contains math operators
 */
function hasMathOperators(str) {
    if (typeof str !== 'string') return false;
    // Check for math operators (but not in quoted strings or as part of hex numbers)
    return /[+\-*/()]/.test(str) && !/^0x[0-9a-fA-F]+$/.test(str);
}

/**
 * Evaluate a simple math expression with references
 * Supports: +, -, *, /, parentheses, and references to other solids
 */
function evaluateMathExpression(expr, currentProperty, allSolids, currentSolidName, arrayIndex, visited = new Set()) {
    if (typeof expr !== 'string') return expr;
    
    // Trim whitespace
    expr = expr.trim();
    
    // First, resolve all references in the expression
    let resolvedExpr = expr;
    const referencePattern = /([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const references = new Set(expr.match(referencePattern) || []);
    
    for (const refName of references) {
        // Skip if it's a number or math operator keyword
        if (!isNaN(refName) || ['sin', 'cos', 'tan', 'sqrt', 'abs', 'pi', 'e'].includes(refName.toLowerCase())) {
            continue;
        }
        
        // Check if it's a reference to another solid
        if (allSolids.hasOwnProperty(refName)) {
            const referencedSolid = allSolids[refName];
            let refValue = referencedSolid[currentProperty];
            
            // If we're in an array context, get the specific element
            if (Array.isArray(refValue) && arrayIndex !== undefined && refValue[arrayIndex] !== undefined) {
                refValue = refValue[arrayIndex];
            } else if (refValue === undefined) {
                // Property doesn't exist, keep the reference name
                continue;
            }
            
            // Resolve nested references
            const visitKey = `${refName}.${currentProperty}`;
            if (!visited.has(visitKey)) {
                const newVisited = new Set(visited);
                newVisited.add(visitKey);
                refValue = resolveReferences(refValue, currentProperty, allSolids, refName, newVisited);
            }
            
            // Convert to number if it's a number
            if (typeof refValue === 'number') {
                // Replace the reference name with its numeric value
                const regex = new RegExp(`\\b${refName}\\b`, 'g');
                resolvedExpr = resolvedExpr.replace(regex, refValue.toString());
            } else if (typeof refValue === 'string' && hasMathOperators(refValue)) {
                // If the referenced value is also a math expression, evaluate it first
                const evaluated = evaluateMathExpression(refValue, currentProperty, allSolids, refName, arrayIndex, visited);
                if (typeof evaluated === 'number') {
                    const regex = new RegExp(`\\b${refName}\\b`, 'g');
                    resolvedExpr = resolvedExpr.replace(regex, evaluated.toString());
                }
            }
        }
    }
    
    // Now evaluate the math expression safely
    try {
        // Validate that the expression only contains safe characters
        // Allow: numbers, operators (+, -, *, /), parentheses, decimal points, whitespace
        // Note: - must be at the end of character class to avoid being interpreted as range
        const safePattern = /^[0-9+*/()\.\s-]+$/;
        if (!safePattern.test(resolvedExpr)) {
            // If it still contains non-math characters, return as-is (might be an unresolved reference)
            return expr;
        }
        
        // Use Function constructor for safer evaluation than eval()
        // This prevents access to global scope
        const result = Function(`"use strict"; return (${resolvedExpr})`)();
        
        // Ensure we got a number
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            return result;
        }
    } catch (e) {
        // If evaluation fails, return original expression
        console.warn(`Failed to evaluate math expression "${expr}":`, e);
        return expr;
    }
    
    return expr;
}

/**
 * Resolve property references in solid definitions
 * A string value that matches a solid name will be replaced with the corresponding property value
 * 
 * Examples:
 * - center: [0, 0, cable_holder] → center: [0, 0, cable_holder.center[2]]
 * - center: [0, 0, cable_holder + 1] → center: [0, 0, cable_holder.center[2] + 1]
 * - diameter: cable_holder → diameter: cable_holder.diameter
 * - center: cable_holder → center: cable_holder.center
 */
function resolveReferences(value, currentProperty, allSolids, currentSolidName, visited = new Set()) {
    // Prevent infinite recursion
    const visitKey = `${currentSolidName}.${currentProperty}`;
    if (visited.has(visitKey)) {
        return value;
    }
    const newVisited = new Set(visited);
    newVisited.add(visitKey);
    
    // If value is an array, resolve each element
    if (Array.isArray(value)) {
        return value.map((item, index) => {
            // Check if item is a math expression
            if (typeof item === 'string' && hasMathOperators(item)) {
                const evaluated = evaluateMathExpression(item, currentProperty, allSolids, currentSolidName, index, newVisited);
                // If evaluation resulted in a number, return it; otherwise continue resolving
                if (typeof evaluated === 'number') {
                    return evaluated;
                }
                // Fall through to handle as regular reference if evaluation didn't produce a number
            }
            
            if (typeof item === 'string' && allSolids.hasOwnProperty(item)) {
                // This is a reference to another solid
                const referencedSolid = allSolids[item];
                // Get the property with the same name from the referenced solid
                const refValue = referencedSolid[currentProperty];
                if (Array.isArray(refValue) && refValue[index] !== undefined) {
                    // Get the element at the same index, and recursively resolve it
                    const resolvedElement = refValue[index];
                    return resolveReferences(resolvedElement, currentProperty, allSolids, item, newVisited);
                } else if (refValue !== undefined) {
                    // If the referenced property exists but is not an array, return the whole value
                    // (This might be an edge case, but we'll handle it)
                    return resolveReferences(refValue, currentProperty, allSolids, item, newVisited);
                }
                // Property doesn't exist, return original
                return item;
            }
            // Recursively resolve nested structures (though arrays shouldn't contain objects in this context)
            return resolveReferences(item, currentProperty, allSolids, currentSolidName, newVisited);
        });
    }
    
    // If value is a string, check if it's a math expression or a reference
    if (typeof value === 'string') {
        // Check if it's a math expression first
        if (hasMathOperators(value)) {
            const evaluated = evaluateMathExpression(value, currentProperty, allSolids, currentSolidName, undefined, newVisited);
            // If evaluation resulted in a number, return it
            if (typeof evaluated === 'number') {
                return evaluated;
            }
            // If evaluation produced a string that's still a reference, continue resolving
            if (typeof evaluated === 'string' && allSolids.hasOwnProperty(evaluated)) {
                // Fall through to reference resolution
            } else {
                // Return the evaluated result (might be a string or number)
                return evaluated;
            }
        }
        
        // Check if it's a direct reference to another solid
        if (allSolids.hasOwnProperty(value)) {
            const referencedSolid = allSolids[value];
            // Get the property with the same name from the referenced solid
            const refValue = referencedSolid[currentProperty];
            if (refValue !== undefined) {
                // Recursively resolve the referenced value in case it also has references
                return resolveReferences(refValue, currentProperty, allSolids, value, newVisited);
            }
            return value; // Fallback to original if property doesn't exist
        }
    }
    
    // If value is an object, resolve all its properties
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const resolved = {};
        for (const [key, val] of Object.entries(value)) {
            resolved[key] = resolveReferences(val, key, allSolids, currentSolidName, newVisited);
        }
        return resolved;
    }
    
    return value;
}

/**
 * Resolve clone properties by copying properties from referenced solids
 * Handles cloning before reference resolution
 */
function resolveClones(solids) {
    if (!solids) {
        return solids;
    }
    
    const resolvedSolids = JSON.parse(JSON.stringify(solids));
    const clonesToProcess = [];
    
    // First pass: identify all solids that need cloning
    for (const [name, solid] of Object.entries(resolvedSolids)) {
        if (solid.clone) {
            clonesToProcess.push({ name, cloneRef: solid.clone });
        }
    }
    
    // Process clones in order (need to handle nested clones)
    let hasChanges = true;
    let maxPasses = 10;
    let pass = 0;
    
    while (hasChanges && pass < maxPasses) {
        hasChanges = false;
        pass++;
        
        for (const { name, cloneRef } of clonesToProcess) {
            const solid = resolvedSolids[name];
            
            // Check if clone property still exists (hasn't been processed yet)
            if (!solid.clone) {
                continue;
            }
            
            // Check if the referenced solid exists
            if (!resolvedSolids[cloneRef]) {
                console.warn(`Clone reference "${cloneRef}" not found for solid "${name}"`);
                // Remove clone property to prevent infinite loop
                delete solid.clone;
                continue;
            }
            
            // Check if the referenced solid itself needs cloning (circular dependency check)
            const refSolid = resolvedSolids[cloneRef];
            if (refSolid.clone) {
                // The referenced solid also needs cloning, skip for now
                continue;
            }
            
            // Deep copy all properties from the cloned solid
            const clonedProperties = JSON.parse(JSON.stringify(refSolid));
            
            // Override with properties from the current solid (except 'clone')
            const overrides = {};
            for (const [key, value] of Object.entries(solid)) {
                if (key !== 'clone') {
                    overrides[key] = value;
                }
            }
            
            // Merge: cloned properties first, then overrides
            // Important: Preserve shape from cloned properties if not explicitly overridden
            resolvedSolids[name] = {
                ...clonedProperties,
                ...overrides
            };
            
            // Ensure shape is preserved (should be from clonedProperties, but double-check)
            if (!resolvedSolids[name].shape && clonedProperties.shape) {
                resolvedSolids[name].shape = clonedProperties.shape;
            }
            
            // Remove the clone property
            delete resolvedSolids[name].clone;
            hasChanges = true;
        }
    }
    
    if (pass >= maxPasses) {
        console.warn('Clone resolution reached max passes - some clones may not be fully resolved');
    }
    
    return resolvedSolids;
}

/**
 * Resolve all property references in solids
 * Uses multiple passes to handle transitive references (A references B, B references C)
 */
function resolveAllReferences(data) {
    if (!data.solids) {
        return data;
    }
    
    // First, resolve clones before resolving references
    const solidsWithClonesResolved = resolveClones(data.solids);
    
    let resolvedSolids = {};
    let hasChanges = true;
    let maxPasses = 10; // Prevent infinite loops
    let pass = 0;
    
    // Start with solids that have clones resolved
    resolvedSolids = JSON.parse(JSON.stringify(solidsWithClonesResolved));
    
    // Multiple passes until no more changes occur
    while (hasChanges && pass < maxPasses) {
        hasChanges = false;
        pass++;
        
        const newResolvedSolids = {};
        
        for (const [name, solid] of Object.entries(resolvedSolids)) {
            newResolvedSolids[name] = {};
            for (const [key, value] of Object.entries(solid)) {
                // Skip reference resolution for 'shape' property - it should always be a literal
                if (key === 'shape') {
                    newResolvedSolids[name][key] = value;
                    continue;
                }
                
                const originalValue = JSON.stringify(value);
                const resolved = resolveReferences(value, key, resolvedSolids, name);
                const resolvedStr = JSON.stringify(resolved);
                
                if (originalValue !== resolvedStr) {
                    hasChanges = true;
                }
                
                newResolvedSolids[name][key] = resolved;
            }
        }
        
        resolvedSolids = newResolvedSolids;
    }
    
    if (pass >= maxPasses) {
        console.warn('Reference resolution reached max passes - some references may not be fully resolved');
    }
    
    return {
        ...data,
        solids: resolvedSolids
    };
}

export function parseYAML(yamlText) {
    try {
        const data = jsyaml.load(yamlText);
        // First, process stamps (expand stamp definitions into solids)
        const dataWithStamps = processStamps(data);
        // Then resolve property references
        return resolveAllReferences(dataWithStamps);
    } catch (e) {
        throw new Error(`YAML Parse Error: ${e.message}`);
    }
}

/**
 * Compile YAML text (process stamps and resolve references) and return as YAML string
 * Useful for debugging and seeing the expanded YAML
 * @param {string} yamlText - Input YAML text
 * @returns {string} Compiled YAML as string
 */
export function compileYAML(yamlText) {
    try {
        const compiledData = parseYAML(yamlText);
        // Convert back to YAML string
        return jsyaml.dump(compiledData, {
            indent: 4,
            lineWidth: -1, // No line width limit
            noRefs: true,
            sortKeys: false
        });
    } catch (e) {
        throw new Error(`YAML Compile Error: ${e.message}`);
    }
}

