/**
 * Boolean operations modifier (difference, union, intersection)
 */

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { debug, debugLabel } from '../utils/debug.js';

let csgEvaluator;

export function initialize(evaluator) {
    csgEvaluator = evaluator;
}

/**
 * Normalize boolean operations to array format
 */
export function normalizeBooleanOperations(booleanOps) {
    let operations = [];
    
    if (Array.isArray(booleanOps)) {
        operations = booleanOps;
    } else {
        // Convert old format to new format
        for (const [op, target] of Object.entries(booleanOps)) {
            if (Array.isArray(target)) {
                target.forEach(t => operations.push({ [op]: t }));
            } else {
                operations.push({ [op]: target });
            }
        }
    }
    
    return operations;
}

/**
 * Apply boolean operations to a mesh
 * @param {THREE.Mesh} mesh - The mesh to modify
 * @param {THREE.BufferGeometry} geometry - The base geometry
 * @param {Array} operations - Array of boolean operations
 * @param {Object} allSolids - All solids in the model
 * @param {Map} processedSolids - Map of processed solids
 * @returns {THREE.BufferGeometry} Modified geometry
 */
export function applyBooleanModifier(mesh, geometry, operations, allSolids, processedSolids) {
    debug(`Applying boolean modifier to "${mesh.name}" with ${operations.length} operation(s)`);
    debugLabel('Initial geometry vertex count', geometry.attributes.position?.count || 0);
    
    mesh.updateMatrixWorld();
    
    // Ensure geometry has normals computed
    const baseGeometry = geometry.clone();
    if (!baseGeometry.attributes.normal) {
        baseGeometry.computeVertexNormals();
        debug('Computed normals for base geometry');
    }
    
    // Create brush from current geometry
    let resultBrush = new Brush(baseGeometry);
    resultBrush.position.copy(mesh.position);
    resultBrush.rotation.copy(mesh.rotation);
    resultBrush.scale.copy(mesh.scale);
    resultBrush.updateMatrixWorld();
    debug('Created base brush from geometry');
    
    // Process each boolean operation in order
    for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const [opType, targetName] = Object.entries(operation)[0];
        debug(`\n  Operation ${i + 1}/${operations.length}: ${opType} with "${targetName}"`);
        
        const targetSolid = allSolids[targetName];
        
        if (targetSolid) {
            // Get the already-processed mesh (guaranteed to exist because dependencies are resolved first)
            const targetMesh = processedSolids.get(targetName);
            if (!targetMesh) {
                console.warn(`Target solid "${targetName}" was not properly created`);
                debug(`  ERROR: Target mesh "${targetName}" not found in processedSolids`);
                continue;
            }
            targetMesh.updateMatrixWorld();
            debugLabel(`  Target mesh "${targetName}" vertex count`, targetMesh.geometry.attributes.position?.count || 0);
            
            // Ensure target geometry has normals computed
            const targetGeometry = targetMesh.geometry.clone();
            if (!targetGeometry.attributes.normal) {
                targetGeometry.computeVertexNormals();
                debug('  Computed normals for target geometry');
            }
            
            // Create brush from target geometry
            const targetBrush = new Brush(targetGeometry);
            targetBrush.position.copy(targetMesh.position);
            targetBrush.rotation.copy(targetMesh.rotation);
            targetBrush.scale.copy(targetMesh.scale);
            targetBrush.updateMatrixWorld();
            debug('  Created target brush');
            
            try {
                // Map operation types to CSG operations
                let csgOperation;
                switch (opType) {
                    case 'difference':
                        csgOperation = SUBTRACTION;
                        break;
                    case 'union':
                        csgOperation = ADDITION;
                        break;
                    case 'intersection':
                        csgOperation = INTERSECTION;
                        break;
                    default:
                        console.warn(`Unknown boolean operation: ${opType}`);
                        debug(`  ERROR: Unknown operation type "${opType}"`);
                        continue;
                }
                
                debug(`  Performing CSG ${opType} operation...`);
                const vertexCountBefore = resultBrush.geometry.attributes.position?.count || 0;
                
                // Perform CSG operation (returns a Brush)
                resultBrush = csgEvaluator.evaluate(resultBrush, targetBrush, csgOperation);
                resultBrush.updateMatrixWorld();
                
                const vertexCountAfter = resultBrush.geometry.attributes.position?.count || 0;
                debug(`  ✓ ${opType} operation complete (vertices: ${vertexCountBefore} → ${vertexCountAfter})`);
            } catch (e) {
                console.error(`Boolean ${opType} failed:`, e);
                debug(`  ERROR: ${opType} operation failed:`, e.message);
            }
        } else {
            console.warn(`Target solid "${targetName}" not found for boolean ${opType}`);
            debug(`  ERROR: Target solid "${targetName}" not found in allSolids`);
        }
    }
    
    // Return the final geometry
    // Clone to ensure we have a proper BufferGeometry instance
    let finalGeometry = resultBrush.geometry.clone();
    
    // Clean up geometry after CSG operations
    // CSG operations can create duplicate vertices and incorrect normals
    debug('Cleaning up geometry after CSG operations...');
    const vertexCountBeforeCleanup = finalGeometry.attributes.position?.count || 0;
    
    // Ensure all attributes are properly set up
    if (!finalGeometry.attributes.position) {
        debug('ERROR: Final geometry has no position attribute!');
        return finalGeometry;
    }
    
    // Merge duplicate vertices (critical for proper rendering)
    // This removes duplicate vertices that can cause rendering artifacts like missing faces
    // Try the instance method first (available in Three.js r125+)
    let merged = false;
    try {
        if (typeof finalGeometry.mergeVertices === 'function') {
            finalGeometry.mergeVertices();
            merged = true;
            const vertexCountAfterMerge = finalGeometry.attributes.position?.count || 0;
            debug(`Merged duplicate vertices using instance method (${vertexCountBeforeCleanup} → ${vertexCountAfterMerge})`);
        } else {
            debug('NOTE: mergeVertices() not available on geometry - attempting manual cleanup via normal recomputation');
            // Even without mergeVertices, recomputing normals with proper settings can help
            // The geometry cleanup below (normal recomputation) should still help with rendering
        }
    } catch (e) {
        debug(`WARNING: mergeVertices failed: ${e.message} - continuing with normal recomputation`);
    }
    
    // Recompute normals with proper settings for solid geometry
    // This ensures faces are correctly oriented after CSG operations
    // Force recomputation even if normals exist - this is critical for proper rendering
    finalGeometry.computeVertexNormals();
    debug('Recomputed vertex normals');
    
    // Ensure geometry is properly structured for rendering
    // CSG operations can create indexed geometry that needs proper setup
    if (finalGeometry.index) {
        // If indexed, ensure the index is valid
        debug(`Geometry is indexed with ${finalGeometry.index.count} indices`);
        finalGeometry.index.needsUpdate = true;
    } else {
        // If non-indexed, ensure it's set up correctly
        debug('Geometry is non-indexed');
    }
    
    // Mark all attributes as needing update to ensure GPU gets the new data
    for (const key in finalGeometry.attributes) {
        if (finalGeometry.attributes[key]) {
            finalGeometry.attributes[key].needsUpdate = true;
        }
    }
    
    // Normalize normals to ensure they're unit vectors (computeVertexNormals should do this, but ensure it)
    if (finalGeometry.attributes.normal) {
        const normals = finalGeometry.attributes.normal;
        for (let i = 0; i < normals.count; i++) {
            const nx = normals.getX(i);
            const ny = normals.getY(i);
            const nz = normals.getZ(i);
            const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (length > 0.0001) {
                normals.setX(i, nx / length);
                normals.setY(i, ny / length);
                normals.setZ(i, nz / length);
            }
        }
        normals.needsUpdate = true;
        debug('Normalized all normals');
    }
    
    // Update bounding box and sphere for proper culling and rendering
    finalGeometry.computeBoundingBox();
    finalGeometry.computeBoundingSphere();
    
    // Clear any cached data that might interfere with rendering
    // Force the geometry to be re-uploaded to GPU
    finalGeometry.setAttribute('position', finalGeometry.attributes.position);
    if (finalGeometry.attributes.normal) {
        finalGeometry.setAttribute('normal', finalGeometry.attributes.normal);
    }
    
    debugLabel(`Final geometry vertex count`, finalGeometry.attributes.position?.count || 0);
    debug(`Boolean modifier complete for "${mesh.name}"`);
    
    return finalGeometry;
}

