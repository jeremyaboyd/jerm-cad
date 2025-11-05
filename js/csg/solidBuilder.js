/**
 * Solid builder - creates Three.js meshes from solid definitions
 */

import * as THREE from 'three';
import { createGeometry } from './shapes.js';
import { collectDependencies } from '../utils/dependencyResolver.js';
import { applyModifiers } from '../modifiers/index.js';
import { debug, debugLabel } from '../utils/debug.js';

/**
 * Create a solid mesh from a solid definition
 * @param {string} name - Name of the solid
 * @param {Object} solid - Solid definition
 * @param {Object} allSolids - All solids in the model
 * @param {Map} processedSolids - Map of processed solids (for caching and dependency resolution)
 * @param {Object} materials - Map of material definitions
 * @returns {THREE.Mesh} Created mesh
 */
export function createSolid(name, solid, allSolids, processedSolids = new Map(), materials = {}) {
    // Check if already processed (and not just marked as in-progress)
    if (processedSolids.has(name) && processedSolids.get(name) !== null) {
        debug(`[Solid: ${name}] Already processed, returning cached mesh`);
        return processedSolids.get(name);
    }
    
    debug(`[Solid: ${name}] Starting creation`);
    
    // Mark as being processed to prevent infinite recursion
    processedSolids.set(name, null);
    debug(`[Solid: ${name}] Marked as in-progress`);
    
    // First, ensure all dependencies are fully created
    const dependencies = collectDependencies(solid, allSolids);
    debugLabel(`[Solid: ${name}] Dependencies found`, Array.from(dependencies));
    
    if (dependencies.size > 0) {
        debug(`[Solid: ${name}] Processing ${dependencies.size} dependency/dependencies...`);
    }
    
    for (const depName of dependencies) {
        // Skip if already fully processed
        if (processedSolids.has(depName) && processedSolids.get(depName) !== null) {
            debug(`[Solid: ${name}] Dependency "${depName}" already processed, skipping`);
            continue;
        }
        // Skip if currently being processed (circular dependency - will be handled later)
        if (processedSolids.has(depName) && processedSolids.get(depName) === null) {
            debug(`[Solid: ${name}] Dependency "${depName}" is currently being processed (circular?), skipping`);
            continue;
        }
        // Process the dependency
        const depSolid = allSolids[depName];
        if (depSolid) {
            debug(`[Solid: ${name}] Creating dependency "${depName}"`);
            createSolid(depName, depSolid, allSolids, processedSolids, materials);
            debug(`[Solid: ${name}] Dependency "${depName}" created`);
        }
    }
    
    if (dependencies.size > 0) {
        debug(`[Solid: ${name}] All dependencies processed`);
    }
    
    // Create base geometry
    debug(`[Solid: ${name}] Creating base geometry (${solid.shape})`);
    const geometry = createGeometry(solid);
    debugLabel(`[Solid: ${name}] Base geometry created`, {
        vertices: geometry.attributes.position?.count || 0,
        faces: geometry.attributes.position?.count ? Math.floor(geometry.attributes.position.count / 3) : 0
    });
    
    // Apply anchor offset if specified
    // Anchor is a Vector3 [0-1, 0-1, 0-1] that determines which point on the bounding box
    // the center position refers to. [0.5, 0.5, 0.5] is the center (default).
    if (solid.anchor) {
        const anchor = solid.anchor;
        // Ensure anchor has 3 components, default to 0.5 (center) for missing components
        const anchorX = anchor[0] !== undefined ? anchor[0] : 0.5;
        const anchorY = anchor[1] !== undefined ? anchor[1] : 0.5;
        const anchorZ = anchor[2] !== undefined ? anchor[2] : 0.5;
        
        // Clamp anchor values to [0, 1]
        const clampedAnchorX = Math.max(0, Math.min(1, anchorX));
        const clampedAnchorY = Math.max(0, Math.min(1, anchorY));
        const clampedAnchorZ = Math.max(0, Math.min(1, anchorZ));
        
        debug(`[Solid: ${name}] Applying anchor [${clampedAnchorX}, ${clampedAnchorY}, ${clampedAnchorZ}]`);
        
        // Compute bounding box
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        
        if (bbox) {
            // Calculate the anchor point in local space
            // 0 = min corner, 1 = max corner, 0.5 = center
            const anchorPointX = bbox.min.x + (bbox.max.x - bbox.min.x) * clampedAnchorX;
            const anchorPointY = bbox.min.y + (bbox.max.y - bbox.min.y) * clampedAnchorY;
            const anchorPointZ = bbox.min.z + (bbox.max.z - bbox.min.z) * clampedAnchorZ;
            
            // Translate geometry so the anchor point becomes the origin
            geometry.translate(-anchorPointX, -anchorPointY, -anchorPointZ);
            
            debugLabel(`[Solid: ${name}] Anchor applied`, {
                bboxMin: [bbox.min.x, bbox.min.y, bbox.min.z],
                bboxMax: [bbox.max.x, bbox.max.y, bbox.max.z],
                anchorPoint: [anchorPointX, anchorPointY, anchorPointZ],
                offset: [-anchorPointX, -anchorPointY, -anchorPointZ]
            });
        } else {
            console.warn(`[Solid: ${name}] Could not compute bounding box for anchor, skipping anchor offset`);
        }
    }
    
    // Determine material properties from material reference or direct properties
    let materialColor = 0x4287f5; // Default blue
    let materialOpacity = 1;
    
    if (solid.material) {
        if (materials[solid.material]) {
            // Use material from materials section
            const materialDef = materials[solid.material];
            materialColor = materialDef.color || materialColor;
            materialOpacity = materialDef.opacity !== undefined ? materialDef.opacity : materialOpacity;
            debug(`[Solid: ${name}] Using material "${solid.material}" (color: ${materialColor.toString(16)}, opacity: ${materialOpacity})`);
        } else {
            // Material referenced but not found - warn and fall back to defaults
            console.warn(`Material "${solid.material}" not found for solid "${name}", using default material`);
            debug(`[Solid: ${name}] WARNING: Material "${solid.material}" not found, using defaults`);
        }
    } else {
        // Use direct color/opacity properties (backward compatible)
        if (solid.color !== undefined) {
            materialColor = solid.color;
        }
        if (solid.opacity !== undefined) {
            materialOpacity = solid.opacity;
        }
        if (solid.color !== undefined || solid.opacity !== undefined) {
            debug(`[Solid: ${name}] Using direct color/opacity properties`);
        }
    }
    
    // Create mesh to apply transformations
    const material = new THREE.MeshPhongMaterial({
        color: materialColor,
        transparent: materialOpacity < 1,
        opacity: materialOpacity,
        side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Apply transformations
    const center = solid.center || [0, 0, 0];
    mesh.position.set(center[0], center[1], center[2]);
    debugLabel(`[Solid: ${name}] Position set`, center);
    
    if (solid.rotation) {
        mesh.rotation.x = (solid.rotation[0] || 0) * Math.PI / 180;
        mesh.rotation.y = (solid.rotation[1] || 0) * Math.PI / 180;
        mesh.rotation.z = (solid.rotation[2] || 0) * Math.PI / 180;
        debugLabel(`[Solid: ${name}] Rotation set`, solid.rotation);
    }
    
    // Apply modifiers
    if (solid.modifiers) {
        debug(`[Solid: ${name}] Applying modifiers...`);
        applyModifiers(mesh, geometry, solid.modifiers, allSolids, processedSolids);
        debug(`[Solid: ${name}] Modifiers applied`);
    } else {
        debug(`[Solid: ${name}] No modifiers to apply`);
    }
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    
    processedSolids.set(name, mesh);
    debug(`[Solid: ${name}] ✓ Finished processing (final vertex count: ${mesh.geometry.attributes.position?.count || 0})`);
    return mesh;
}

