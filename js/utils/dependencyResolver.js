/**
 * Dependency resolution for solids with boolean operations
 */

import { debug, debugLabel } from './debug.js';

/**
 * Collect all referenced solid names from boolean operations
 * @param {Object} solid - The solid definition
 * @param {Object} allSolids - All solids in the model
 * @param {Set} dependencies - Set to collect dependencies (optional)
 * @returns {Set} Set of dependency names
 */
export function collectDependencies(solid, allSolids, dependencies = new Set()) {
    if (!solid.modifiers || !solid.modifiers.boolean) {
        return dependencies;
    }
    
    const booleanOps = solid.modifiers.boolean;
    let operations = [];
    
    // Handle both array format and object format
    if (Array.isArray(booleanOps)) {
        operations = booleanOps;
    } else {
        for (const [op, target] of Object.entries(booleanOps)) {
            if (Array.isArray(target)) {
                target.forEach(t => operations.push({ [op]: t }));
            } else {
                operations.push({ [op]: target });
            }
        }
    }
    
    debug(`Collecting dependencies from ${operations.length} boolean operation(s)`);
    
    // Collect all referenced solid names
    for (const operation of operations) {
        const [opType, targetName] = Object.entries(operation)[0];
        debug(`  Found ${opType} operation referencing "${targetName}"`);
        if (allSolids[targetName] && !dependencies.has(targetName)) {
            dependencies.add(targetName);
            debug(`  Added "${targetName}" to dependencies`);
            // Recursively collect dependencies of referenced solids
            collectDependencies(allSolids[targetName], allSolids, dependencies);
        } else if (!allSolids[targetName]) {
            debug(`  Warning: "${targetName}" not found in allSolids`);
        } else {
            debug(`  "${targetName}" already in dependencies, skipping`);
        }
    }
    
    return dependencies;
}

