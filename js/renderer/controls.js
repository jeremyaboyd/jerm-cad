/**
 * Camera controls and model manipulation
 */

import * as THREE from 'three';
import { getCamera, getControls, getScene } from './scene.js';
import { forceQualityLevel, getQuality } from '../utils/qualitySettings.js';
import { renderModel } from '../modelRenderer.js';

let models = [];
let wireframeMode = false;

export function getModels() { return models; }
export function setModels(newModels) { models = newModels; }
export function getWireframeMode() { return wireframeMode; }

/**
 * Reset camera to default position
 */
export function resetCamera() {
    const camera = getCamera();
    const controls = getControls();
    
    camera.position.set(50, 50, 50);
    controls.target.set(0, 0, 0);
    controls.update();
}

/**
 * Toggle wireframe mode
 */
export function toggleWireframe() {
    wireframeMode = !wireframeMode;
    models.forEach(model => {
        if (model.material) {
            model.material.wireframe = wireframeMode;
        }
    });
}

/**
 * Export model as STL
 */
export function exportModel() {
    exportSTL();
}

/**
 * Export model as STL file
 */
export async function exportSTL() {
    if (models.length === 0) {
        alert('No model to export!');
        return;
    }
    
    // Show loading indicator
    const btn = document.getElementById('btn-export');
    const originalText = btn.textContent;
    btn.textContent = '⏳ Exporting...';
    btn.disabled = true;
    
    try {
        console.log('[STL Export] Starting export...');
        
        // Save current quality and force ultra quality for STL export
        const originalQuality = getQuality();
        console.log('[STL Export] Forcing ultra quality (256 segments) for export...');
        forceQualityLevel('ultra');
        renderModel(); // Re-render with ultra quality
        console.log('[STL Export] Model re-rendered at ultra quality');
        
        // Collect all geometries and transform them to world space
        const transformedGeometries = models.map(model => {
            model.updateMatrixWorld();
            const geometry = model.geometry.clone();
            geometry.applyMatrix4(model.matrixWorld);
            return geometry;
        });
        
        console.log(`[STL Export] Processing ${transformedGeometries.length} geometries...`);
        
        // Merge all geometries into one (if multiple)
        let finalGeometry;
        if (transformedGeometries.length === 1) {
            finalGeometry = transformedGeometries[0];
        } else {
            // Manually merge geometries (consistent with modelRenderer.js approach)
            const positions = [];
            const normals = [];
            const indices = [];
            let indexOffset = 0;
            
            for (const geometry of transformedGeometries) {
                // Ensure geometry has normals
                if (!geometry.attributes.normal) {
                    geometry.computeVertexNormals();
                }
                
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
            
            finalGeometry = new THREE.BufferGeometry();
            finalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            if (normals.length > 0) {
                finalGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            } else {
                finalGeometry.computeVertexNormals();
            }
            if (indices.length > 0) {
                finalGeometry.setIndex(indices);
            }
        }
        
        // Convert to non-indexed geometry if needed (STL requires triangles)
        if (finalGeometry.index) {
            console.log('[STL Export] Converting indexed geometry to non-indexed...');
            finalGeometry = finalGeometry.toNonIndexed();
        }
        
        // Merge duplicate vertices to create manifold mesh
        console.log('[STL Export] Merging duplicate vertices for manifold mesh...');
        const vertexCountBefore = finalGeometry.attributes.position.count;
        finalGeometry.deleteAttribute('uv'); // Remove UVs if present (not needed for STL)
        finalGeometry.deleteAttribute('uv2');
        
        if (typeof finalGeometry.mergeVertices === 'function') {
            finalGeometry.mergeVertices(); // Modifies in place and returns this
            const vertexCountAfter = finalGeometry.attributes.position.count;
            console.log(`[STL Export] Merged vertices: ${vertexCountBefore} → ${vertexCountAfter}`);
        }
        
        // Recompute normals after merging
        finalGeometry.computeVertexNormals();
        console.log('[STL Export] Recomputed normals');
        
        // Convert back to non-indexed (mergeVertices might create indexed geometry)
        if (finalGeometry.index) {
            finalGeometry = finalGeometry.toNonIndexed();
            console.log('[STL Export] Converted back to non-indexed geometry');
        }
        
        // Create STL string (ASCII format)
        const positions = finalGeometry.attributes.position;
        const normals = finalGeometry.attributes.normal;
        const triangleCount = positions.count / 3;
        
        console.log(`[STL Export] Writing ${triangleCount} triangles to STL...`);
        
        let stl = 'solid model\n';
        
        for (let i = 0; i < positions.count; i += 3) {
            // Get the face normal (use first vertex normal as face normal)
            const normal = new THREE.Vector3(
                normals.getX(i),
                normals.getY(i),
                normals.getZ(i)
            );
            
            // Write facet
            stl += `  facet normal ${normal.x.toExponential(6)} ${normal.y.toExponential(6)} ${normal.z.toExponential(6)}\n`;
            stl += '    outer loop\n';
            
            // Write vertices
            for (let j = 0; j < 3; j++) {
                const idx = i + j;
                const x = positions.getX(idx);
                const y = positions.getY(idx);
                const z = positions.getZ(idx);
                stl += `      vertex ${x.toExponential(6)} ${y.toExponential(6)} ${z.toExponential(6)}\n`;
            }
            
            stl += '    endloop\n';
            stl += '  endfacet\n';
        }
        
        stl += 'endsolid model\n';
        
        console.log('[STL Export] STL string created, downloading...');
        
        // Download file
        const blob = new Blob([stl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'model.stl';
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('[STL Export] Export complete!');
        
        // Restore original quality and re-render
        console.log(`[STL Export] Restoring original quality (${originalQuality})...`);
        forceQualityLevel(null);
        renderModel(); // Re-render with original quality
        console.log('[STL Export] Viewport restored to original quality');
        
    } catch (error) {
        console.error('[STL Export] Export error:', error);
        alert(`STL export failed: ${error.message}`);
        
        // Make sure to restore quality even on error
        forceQualityLevel(null);
        renderModel();
    } finally {
        // Restore button
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

