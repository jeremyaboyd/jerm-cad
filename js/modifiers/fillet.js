/**
 * Fillet modifier (simplified - adds edge highlighting)
 */

import * as THREE from 'three';

/**
 * Apply fillet modifier to a mesh
 * @param {THREE.Mesh} mesh - The mesh to modify
 * @param {Object} filletConfig - Fillet configuration
 */
export function applyFilletModifier(mesh, filletConfig) {
    // Simplified fillet - just add edge highlighting
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 0.5 })
    );
    mesh.add(line);
}

