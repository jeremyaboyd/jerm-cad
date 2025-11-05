/**
 * Shape creation functions for various geometry types
 */

import * as THREE from 'three';
import { debug, debugLabel } from '../utils/debug.js';
import { getSegmentCount } from '../utils/qualitySettings.js';

export function createCuboid(solid) {
    const size = solid.size || [1, 1, 1];
    debug(`Creating cuboid with size [${size[0]}, ${size[1]}, ${size[2]}]`);
    const geometry = new THREE.BoxGeometry(
        Math.abs(size[0]),
        Math.abs(size[1]),
        Math.abs(size[2])
    );
    debugLabel('Cuboid created', { vertices: geometry.attributes.position?.count || 0 });
    return geometry;
}

export function createCylinder(solid) {
    const diameter = solid.diameter || 1;
    const length = solid.length || 1;
    const segments = getSegmentCount();
    debug(`Creating cylinder with diameter ${diameter}, length ${length}, segments ${segments}`);
    // In Three.js, cylinders are created along Y axis by default
    // For Z-up systems, we'll handle orientation via rotation
    const geometry = new THREE.CylinderGeometry(
        diameter / 2,
        diameter / 2,
        length,
        segments
    );
    debugLabel('Cylinder created', { vertices: geometry.attributes.position?.count || 0 });
    return geometry;
}

export function createSphere(solid) {
    const diameter = solid.diameter || 1;
    const segments = getSegmentCount();
    debug(`Creating sphere with diameter ${diameter}, segments ${segments}x${Math.floor(segments / 2)}`);
    const geometry = new THREE.SphereGeometry(diameter / 2, segments, Math.floor(segments / 2));
    debugLabel('Sphere created', { vertices: geometry.attributes.position?.count || 0 });
    return geometry;
}

export function createExtrusion(solid) {
    const profile = solid.profile || {};
    const length = solid.length || 1;
    debug(`Creating extrusion with profile type "${profile.type || 'default'}", length ${length}`);
    
    let shape;
    
    if (profile.type === 'circle') {
        const radius = (profile.diameter || 2) / 2;
        const segments = getSegmentCount();
        debug(`  Circle profile with diameter ${profile.diameter || 2}, segments ${segments}`);
        shape = new THREE.Shape();
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector2(
                radius * Math.cos(angle),
                radius * Math.sin(angle)
            ));
        }
        shape.setFromPoints(points);
    } else if (profile.type === 'rect') {
        const size = profile.size || [2, 2];
        debug(`  Rect profile with size [${size[0]}, ${size[1]}]`);
        shape = new THREE.Shape();
        shape.moveTo(-size[0]/2, -size[1]/2);
        shape.lineTo(size[0]/2, -size[1]/2);
        shape.lineTo(size[0]/2, size[1]/2);
        shape.lineTo(-size[0]/2, size[1]/2);
        shape.closePath();
    } else if (profile.type === 'poly' && profile.points) {
        debug(`  Poly profile with ${profile.points.length} points`);
        shape = new THREE.Shape();
        const points = profile.points.map(p => new THREE.Vector2(p[0], p[1]));
        shape.setFromPoints(points);
    } else {
        // Default to a square
        debug('  Default square profile');
        shape = new THREE.Shape();
        shape.moveTo(-1, -1);
        shape.lineTo(1, -1);
        shape.lineTo(1, 1);
        shape.lineTo(-1, 1);
        shape.closePath();
    }
    
    const extrudeSettings = {
        depth: length,
        bevelEnabled: false
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center the extrusion
    geometry.translate(0, 0, -length/2);
    
    debugLabel('Extrusion created', { vertices: geometry.attributes.position?.count || 0 });
    return geometry;
}

/**
 * Create geometry based on solid shape type
 */
export function createGeometry(solid) {
    const shapeType = solid.shape || 'unknown';
    debug(`createGeometry called for shape type: "${shapeType}"`);
    
    switch (solid.shape) {
        case 'cuboid':
            return createCuboid(solid);
        case 'cylinder':
            return createCylinder(solid);
        case 'sphere':
            return createSphere(solid);
        case 'extrusion':
            return createExtrusion(solid);
        default:
            debug(`Unknown shape type "${shapeType}", using default box`);
            return new THREE.BoxGeometry(1, 1, 1);
    }
}

