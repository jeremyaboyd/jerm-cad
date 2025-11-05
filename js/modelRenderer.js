/**
 * Model rendering - coordinates parsing, solid creation, and scene updates
 */

import * as THREE from 'three';
import { parseYAML } from './utils/yamlParser.js';
import { createSolid } from './csg/solidBuilder.js';
import { getScene, updateGridOrientation, updateCameraUp } from './renderer/scene.js';
import { setModels, getModels, getWireframeMode } from './renderer/controls.js';
import { showError, hideError, updateStats } from './ui/display.js';
import { setDebugEnabled, debug, debugLabel } from './utils/debug.js';
import { collectDependencies } from './utils/dependencyResolver.js';
import { getEditorValue } from './ui/editor.js';

/**
 * Render model from YAML text
 */
export function renderModel() {
    hideError();
    
    try {
        const yamlText = getEditorValue();
        const data = parseYAML(yamlText);
        
        // Enable/disable debug based on settings
        const debugMode = data.settings?.debug === true;
        setDebugEnabled(debugMode);
        
        debug('='.repeat(60));
        debug('Starting model render');
        debugLabel('Settings', data.settings);
        debugLabel('Total solids', Object.keys(data.solids || {}).length);
        
        const scene = getScene();
        
        // Clear existing models
        const oldModels = getModels();
        debugLabel('Clearing old models', oldModels.length);
        oldModels.forEach(model => scene.remove(model));
        setModels([]);
        
        // Set camera up vector
        const upVector = data.settings?.up || [0, 0, 1];  // Default to Z-up
        debugLabel('Camera up vector', upVector);
        updateCameraUp(upVector);
        
        // Update grid orientation based on up axis
        updateGridOrientation(upVector);
        
        // Parse materials if provided
        const materials = data.materials || {};
        debugLabel('Materials defined', Object.keys(materials).length);
        if (Object.keys(materials).length > 0) {
            debug('Materials:', Object.keys(materials));
        }
        
        // Create solids
        const newModels = [];
        const allMeshes = new Map(); // Track all meshes by name
        const usedAsDependencies = new Set(); // Track which solids are used in boolean operations
        
        if (data.solids) {
            const processedSolids = new Map();
            let visibleCount = 0;
            let totalVertices = 0;
            
            // First pass: Collect all solids that are used as dependencies
            debug('Collecting boolean operation dependencies...');
            for (const [name, solid] of Object.entries(data.solids)) {
                if (solid.modifiers && solid.modifiers.boolean) {
                    const dependencies = collectDependencies(solid, data.solids);
                    dependencies.forEach(depName => {
                        usedAsDependencies.add(depName);
                        debug(`  "${depName}" is used as a dependency by "${name}"`);
                    });
                }
            }
            
            // Second pass: Create all solids
            debug('\nProcessing solids in order:');
            for (const [name, solid] of Object.entries(data.solids)) {
                debug(`\n[Solid: ${name}] Attempting to create solid`);
                debugLabel(`  Shape type`, solid.shape);
                debugLabel(`  Center`, solid.center || [0, 0, 0]);
                debugLabel(`  Visible`, solid.visible !== false);
                if (solid.material) {
                    debugLabel(`  Material`, solid.material);
                }
                
                const mesh = createSolid(name, solid, data.solids, processedSolids, materials);
                allMeshes.set(name, mesh);
                
                // Check visibility - but we'll filter out dependencies later
                if (solid.visible !== false) {
                    scene.add(mesh);
                    newModels.push(mesh);
                    visibleCount++;
                    
                    // Count vertices
                    if (mesh.geometry.attributes.position) {
                        totalVertices += mesh.geometry.attributes.position.count;
                    }
                    
                    debugLabel(`  Added to scene`, true);
                    debugLabel(`  Vertex count`, mesh.geometry.attributes.position?.count || 0);
                } else {
                    debugLabel(`  Hidden (visible: false)`, true);
                }
            }
            
            // Third pass: Hide all meshes that are used as dependencies in boolean operations
            // Only keep visible the final results that aren't dependencies
            debug('\nHiding solids used in boolean operations...');
            for (const [name, mesh] of allMeshes) {
                if (usedAsDependencies.has(name)) {
                    // This solid is used as a dependency, hide it
                    scene.remove(mesh);
                    const index = newModels.indexOf(mesh);
                    if (index !== -1) {
                        newModels.splice(index, 1);
                        visibleCount--;
                        // Subtract vertices from total count
                        if (mesh.geometry.attributes.position) {
                            totalVertices -= mesh.geometry.attributes.position.count;
                        }
                    }
                    debug(`  Hidden "${name}" (used as dependency)`);
                }
            }
            
            // Fourth pass: If "final" section exists, merge all visible meshes into one final mesh
            if (data.final && newModels.length > 0) {
                debug('\nCreating final merged mesh...');
                
                // Clone and transform all geometries
                const geometriesToMerge = [];
                for (const mesh of newModels) {
                    mesh.updateMatrixWorld();
                    const geometry = mesh.geometry.clone();
                    geometry.applyMatrix4(mesh.matrixWorld);
                    geometriesToMerge.push(geometry);
                }
                
                // Merge all geometries into one
                let mergedGeometry;
                if (geometriesToMerge.length === 1) {
                    mergedGeometry = geometriesToMerge[0];
                    // Ensure normals are computed for single geometry
                    if (!mergedGeometry.attributes.normal) {
                        mergedGeometry.computeVertexNormals();
                    }
                } else {
                    // Combine geometries
                    const positions = [];
                    const normals = [];
                    const indices = [];
                    let indexOffset = 0;
                    
                    for (const geometry of geometriesToMerge) {
                        const pos = geometry.attributes.position;
                        const norm = geometry.attributes.normal;
                        const idx = geometry.index;
                        
                        // Add positions
                        for (let i = 0; i < pos.count; i++) {
                            positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                        }
                        
                        // Add normals
                        if (norm) {
                            for (let i = 0; i < norm.count; i++) {
                                normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
                            }
                        }
                        
                        // Add indices with offset
                        if (idx) {
                            for (let i = 0; i < idx.count; i++) {
                                indices.push(idx.getX(i) + indexOffset);
                            }
                        } else {
                            // Non-indexed geometry - create indices
                            for (let i = 0; i < pos.count; i += 3) {
                                indices.push(indexOffset + i, indexOffset + i + 1, indexOffset + i + 2);
                            }
                        }
                        
                        indexOffset += pos.count;
                    }
                    
                    mergedGeometry = new THREE.BufferGeometry();
                    mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                    if (normals.length > 0) {
                        mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
                    } else {
                        // Recompute normals if they weren't available
                        mergedGeometry.computeVertexNormals();
                    }
                    if (indices.length > 0) {
                        mergedGeometry.setIndex(indices);
                    }
                    
                    mergedGeometry.computeBoundingBox();
                    mergedGeometry.computeBoundingSphere();
                }
                
                // Determine material from final section
                let finalMaterialColor = 0x4287f5;
                let finalMaterialOpacity = 1;
                
                if (data.final.material && materials[data.final.material]) {
                    const materialDef = materials[data.final.material];
                    finalMaterialColor = materialDef.color || finalMaterialColor;
                    finalMaterialOpacity = materialDef.opacity !== undefined ? materialDef.opacity : finalMaterialOpacity;
                    debug(`Using material "${data.final.material}" for final mesh`);
                } else if (data.final.color !== undefined || data.final.opacity !== undefined) {
                    if (data.final.color !== undefined) {
                        finalMaterialColor = data.final.color;
                    }
                    if (data.final.opacity !== undefined) {
                        finalMaterialOpacity = data.final.opacity;
                    }
                    debug('Using direct color/opacity from final section');
                }
                
                // Create final mesh with merged geometry
                const finalMaterial = new THREE.MeshPhongMaterial({
                    color: finalMaterialColor,
                    transparent: finalMaterialOpacity < 1,
                    opacity: finalMaterialOpacity,
                    side: THREE.DoubleSide
                });
                
                const finalMesh = new THREE.Mesh(mergedGeometry, finalMaterial);
                finalMesh.castShadow = true;
                finalMesh.receiveShadow = true;
                finalMesh.name = 'final';
                
                // Hide all individual meshes
                debug(`Hiding ${newModels.length} individual meshes...`);
                for (const mesh of newModels) {
                    scene.remove(mesh);
                }
                
                // Show only the final merged mesh
                scene.add(finalMesh);
                setModels([finalMesh]);
                
                const finalVertexCount = mergedGeometry.attributes.position?.count || 0;
                debug(`Final merged mesh created with ${finalVertexCount} vertices`);
                debugLabel('Final mesh material', { color: finalMaterialColor.toString(16), opacity: finalMaterialOpacity });
                
                // Update stats with final mesh info
                updateStats(data, 1, finalVertexCount, upVector);
            } else {
                // No final section - use individual meshes as before
                setModels(newModels);
                
                debug('\n' + '='.repeat(60));
                debugLabel('Render complete', {
                    visibleCount,
                    totalVertices,
                    totalSolids: Object.keys(data.solids).length,
                    hiddenDependencies: usedAsDependencies.size
                });
                
                // Update stats
                updateStats(data, visibleCount, totalVertices, upVector);
            }
        }
        
        // Apply wireframe mode if active
        const finalModels = getModels();
        const wireframeMode = getWireframeMode();
        if (wireframeMode) {
            finalModels.forEach(model => {
                if (model.material) {
                    model.material.wireframe = true;
                }
            });
        }
        
    } catch (error) {
        showError(error.message);
        console.error('Render error:', error);
    }
}

