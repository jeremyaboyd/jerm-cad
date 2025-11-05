/**
 * Modifier registry and coordinator
 */

import * as booleanModifier from './boolean.js';
import * as filletModifier from './fillet.js';
import { debug, debugLabel } from '../utils/debug.js';

/**
 * Initialize modifiers with required dependencies
 */
export function initialize(csgEvaluator) {
    booleanModifier.initialize(csgEvaluator);
}

/**
 * Apply all modifiers to a mesh
 * @param {THREE.Mesh} mesh - The mesh to modify
 * @param {THREE.BufferGeometry} geometry - The base geometry
 * @param {Object} modifiers - Modifiers configuration
 * @param {Object} allSolids - All solids in the model
 * @param {Map} processedSolids - Map of processed solids
 * @returns {THREE.BufferGeometry} Modified geometry
 */
export function applyModifiers(mesh, geometry, modifiers, allSolids, processedSolids) {
    let resultGeometry = geometry;
    
    if (!modifiers) {
        debug('No modifiers to apply');
        return resultGeometry;
    }
    
    debug(`Applying modifiers for "${mesh.name}"`);
    debugLabel('Modifiers', Object.keys(modifiers));
    
    // Apply boolean operations first (as they modify geometry)
    if (modifiers.boolean) {
        debug(`Normalizing boolean operations...`);
        const operations = booleanModifier.normalizeBooleanOperations(modifiers.boolean);
        debugLabel('Boolean operations', operations.length);
        resultGeometry = booleanModifier.applyBooleanModifier(
            mesh,
            resultGeometry,
            operations,
            allSolids,
            processedSolids
        );
        
        // Dispose of old geometry to free memory
        if (mesh.geometry !== resultGeometry) {
            mesh.geometry.dispose();
        }
        
        // Update mesh geometry with the new geometry from CSG operations
        mesh.geometry = resultGeometry;
        
        // Reset transformations since CSG operations apply them to the geometry
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.set(1, 1, 1);
        
        // Force update of the mesh
        mesh.updateMatrix();
        mesh.updateMatrixWorld(true);
        
        debug(`Boolean operations complete, new vertex count: ${resultGeometry.attributes.position?.count || 0}`);
    }
    
    // Apply fillet (visual only, doesn't modify geometry)
    if (modifiers.fillet) {
        debug(`Applying fillet modifier...`);
        filletModifier.applyFilletModifier(mesh, modifiers.fillet);
        debug('Fillet modifier applied');
    }
    
    debug(`All modifiers applied for "${mesh.name}"`);
    return resultGeometry;
}

