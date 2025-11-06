# Extending JermCAD

This document explains how to extend JermCAD by adding new shapes and modifiers. The examples below show how to implement a **cone** shape and an **array** modifier, but the same patterns apply to any new shape or modifier.

## Table of Contents

- [Adding New Shapes](#adding-new-shapes)
  - [Example: Cone Shape](#example-cone-shape)
- [Adding New Modifiers](#adding-new-modifiers)
  - [Example: Array Modifier](#example-array-modifier)

---

## Adding New Shapes

Shapes are the basic geometric primitives that users can create in their YAML models. All shapes are defined in `js/csg/shapes.js`.

### Shape Architecture

1. **Create Function**: Each shape needs a dedicated creation function that takes a `solid` object and returns a `THREE.BufferGeometry`
2. **Registration**: The shape must be registered in the `createGeometry()` function's switch statement
3. **Properties**: Shape-specific properties are read from the `solid` object

### Example: Cone Shape

A cone shape takes `diameter` and `height` properties.

#### Step 1: Create the Shape Function

Add a new function `createCone()` in `js/csg/shapes.js`:

```javascript
export function createCone(solid) {
    const diameter = solid.diameter || 1;
    const height = solid.height || 1;
    const segments = getSegmentCount();
    debug(`Creating cone with diameter ${diameter}, height ${height}, segments ${segments}`);
    
    // Three.js ConeGeometry takes: radiusBottom, radiusTop, height, radialSegments
    // For a cone, radiusTop is 0
    const geometry = new THREE.ConeGeometry(
        diameter / 2,  // radiusBottom (half of diameter)
        0,             // radiusTop (0 for a cone, >0 for a truncated cone)
        height,        // height
        segments        // radialSegments (from quality settings)
    );
    
    debugLabel('Cone created', { vertices: geometry.attributes.position?.count || 0 });
    return geometry;
}
```

**Key Points:**
- Use `getSegmentCount()` to respect user quality settings
- Use `debug()` and `debugLabel()` for debugging output
- Extract properties from `solid` object with defaults
- Return a `THREE.BufferGeometry` instance

#### Step 2: Register the Shape

Add the cone case to the `createGeometry()` function's switch statement in `js/csg/shapes.js`:

```javascript
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
        case 'cone':  // <-- Add this
            return createCone(solid);  // <-- Add this
        default:
            debug(`Unknown shape type "${shapeType}", using default box`);
            return new THREE.BoxGeometry(1, 1, 1);
    }
}
```

#### Step 3: Usage in YAML

After implementation, users can use the cone shape like this:

```yaml
solids:
    my_cone:
        shape: cone
        center: [0, 0, 0]
        diameter: 5
        height: 10
        rotation: [0, 0, 0]  # Optional rotation
```

**Note:** All shapes automatically support:
- `center`: `[x, y, z]` - Position of the shape
- `anchor`: `[x, y, z]` - Anchor point (0-1) for positioning
- `rotation`: `[x, y, z]` - Rotation in degrees
- `material`: Material name reference
- `color` and `opacity`: Direct material properties
- `visible`: `true`/`false` - Visibility toggle

---

## Adding New Modifiers

Modifiers transform or enhance existing geometries. They are applied after the base geometry is created but before the mesh is finalized. Modifiers are defined in the `js/modifiers/` directory.

### Modifier Architecture

1. **Modifier File**: Create a new file in `js/modifiers/` (e.g., `array.js`)
2. **Apply Function**: Export an `applyArrayModifier()` function that performs the modification
3. **Optional Initialize**: If the modifier needs dependencies (like CSG evaluator), export an `initialize()` function
4. **Registration**: Register the modifier in `js/modifiers/index.js` in the `applyModifiers()` function

### Example: Array Modifier

The array modifier creates multiple copies of a solid along a direction vector. It has these properties:
- `count`: Number of copies (e.g., `5`)
- `direction`: Direction vector `[x, y, z]` (e.g., `[0, 0, 1]`)
- `both_dirs`: Boolean - if `true`, distributes copies in both positive and negative directions centered around the origin

#### Step 1: Create the Modifier File

Create `js/modifiers/array.js`:

```javascript
/**
 * Array modifier - creates multiple copies of a solid along a direction
 */

import * as THREE from 'three';
import { debug, debugLabel } from '../utils/debug.js';

/**
 * Apply array modifier to a mesh
 * @param {THREE.Mesh} mesh - The mesh to modify
 * @param {THREE.BufferGeometry} geometry - The base geometry
 * @param {Object} arrayConfig - Array configuration
 * @param {Object} allSolids - All solids in the model
 * @param {Map} processedSolids - Map of processed solids
 * @returns {THREE.BufferGeometry} Modified geometry (may return original or merged geometry)
 */
export function applyArrayModifier(mesh, geometry, arrayConfig, allSolids, processedSolids) {
    const count = arrayConfig.count || 1;
    const direction = arrayConfig.direction || [0, 0, 1];
    const bothDirs = arrayConfig.both_dirs !== undefined ? arrayConfig.both_dirs : false;
    
    debug(`Applying array modifier to "${mesh.name}"`);
    debugLabel('Array config', { count, direction, both_dirs: bothDirs });
    
    if (count <= 1) {
        debug('Array count is 1 or less, no duplication needed');
        return geometry;
    }
    
    // Normalize direction vector
    const dirVec = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize();
    
    // Calculate spacing and offsets
    let offsets = [];
    
    if (bothDirs) {
        // Distribute copies in both directions, centered around origin
        // For count=5: [-2, -1, 0, 1, 2] offsets
        const halfCount = Math.floor(count / 2);
        const isOdd = count % 2 === 1;
        
        for (let i = 0; i < count; i++) {
            let offset;
            if (isOdd) {
                // Odd count: center at 0
                offset = i - halfCount;
            } else {
                // Even count: center between -0.5 and 0.5
                offset = i - (count - 1) / 2;
            }
            offsets.push(offset);
        }
    } else {
        // Single direction: [0, 1, 2, 3, 4] offsets
        for (let i = 0; i < count; i++) {
            offsets.push(i);
        }
    }
    
    debugLabel('Calculated offsets', offsets);
    
    // Clone geometry for each copy and translate
    const geometries = [];
    const spacing = 1.0; // Unit spacing - you might want to make this configurable
    
    for (const offset of offsets) {
        const clonedGeometry = geometry.clone();
        const translation = dirVec.clone().multiplyScalar(offset * spacing);
        clonedGeometry.translate(translation.x, translation.y, translation.z);
        geometries.push(clonedGeometry);
    }
    
    // Merge all geometries into one
    // Note: This is a simplified approach. For proper CSG union, you'd want to use
    // the CSG evaluator similar to how boolean operations work.
    const mergedGeometry = mergeGeometries(geometries);
    
    debug(`Array modifier complete: created ${count} copies`);
    return mergedGeometry;
}

/**
 * Helper function to merge multiple geometries
 * @param {Array<THREE.BufferGeometry>} geometries - Array of geometries to merge
 * @returns {THREE.BufferGeometry} Merged geometry
 */
function mergeGeometries(geometries) {
    if (geometries.length === 0) {
        return new THREE.BufferGeometry();
    }
    
    if (geometries.length === 1) {
        return geometries[0];
    }
    
    // Use Three.js BufferGeometryUtils if available, otherwise manual merge
    // This is a simplified version - full implementation would handle
    // attributes, indices, normals, etc. properly
    const merged = new THREE.BufferGeometry();
    // ... implementation to merge attributes and indices ...
    
    return merged;
}
```

**Key Points:**
- Read configuration from `arrayConfig` object
- Use `debug()` and `debugLabel()` for debugging
- Clone and transform geometries as needed
- Return the modified geometry (or original if no changes)

**Note:** For a proper implementation, you'd want to:
- Use the CSG evaluator to union the copies (like boolean operations do)
- Calculate spacing based on bounding box or make it configurable
- Handle edge cases (count = 0, direction = [0,0,0], etc.)

#### Step 2: Register the Modifier

Add the array modifier to `js/modifiers/index.js`:

**Import the modifier:**
```javascript
import * as booleanModifier from './boolean.js';
import * as filletModifier from './fillet.js';
import * as arrayModifier from './array.js';  // <-- Add this
import { debug, debugLabel } from '../utils/debug.js';
```

**Add initialization if needed:**
```javascript
export function initialize(csgEvaluator) {
    booleanModifier.initialize(csgEvaluator);
    // arrayModifier.initialize(csgEvaluator);  // Uncomment if array needs CSG evaluator
}
```

**Add to applyModifiers function:**
```javascript
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
        // ... existing boolean code ...
    }
    
    // Apply array modifier (creates copies, should happen before fillet)
    if (modifiers.array) {
        debug(`Applying array modifier...`);
        resultGeometry = arrayModifier.applyArrayModifier(
            mesh,
            resultGeometry,
            modifiers.array,
            allSolids,
            processedSolids
        );
        
        // Update mesh geometry if it changed
        if (mesh.geometry !== resultGeometry) {
            mesh.geometry.dispose();
            mesh.geometry = resultGeometry;
        }
        
        debug(`Array modifier applied, new vertex count: ${resultGeometry.attributes.position?.count || 0}`);
    }
    
    // Apply fillet (visual only, doesn't modify geometry)
    if (modifiers.fillet) {
        // ... existing fillet code ...
    }
    
    debug(`All modifiers applied for "${mesh.name}"`);
    return resultGeometry;
}
```

**Modifier Order Considerations:**
- Boolean operations typically come first (they fundamentally change geometry)
- Array modifier should come before visual-only modifiers like fillet
- The order in `applyModifiers()` determines execution order

#### Step 3: Usage in YAML

After implementation, users can use the array modifier like this:

```yaml
solids:
    base_shape:
        shape: cuboid
        center: [0, 0, 0]
        size: [5, 5, 2]
        modifiers:
            array:
                count: 5
                direction: [0, 0, 1]
                both_dirs: true
```

**How `both_dirs` works:**
- `both_dirs: false` (default): Creates copies at offsets `[0, 1, 2, 3, 4]` along the direction
- `both_dirs: true`: Creates copies at offsets `[-2, -1, 0, 1, 2]` centered around the origin (for count=5)

---

## Summary

### Adding a Shape
1. Create a `create[ShapeName]()` function in `js/csg/shapes.js`
2. Add a case to the `createGeometry()` switch statement
3. Extract properties from the `solid` object
4. Return a `THREE.BufferGeometry`

### Adding a Modifier
1. Create a new file `js/modifiers/[modifierName].js`
2. Export an `apply[ModifierName]Modifier()` function
3. Optionally export an `initialize()` function if dependencies are needed
4. Import and register in `js/modifiers/index.js`
5. Add handling in `applyModifiers()` function

### Common Patterns

**Reading Properties:**
```javascript
const property = solid.property || defaultValue;
```

**Debugging:**
```javascript
debug(`Creating shape with property ${property}`);
debugLabel('Label', { key: value });
```

**Geometry Creation:**
```javascript
const geometry = new THREE.[GeometryType](...params);
```

**Modifier Return:**
- Return modified geometry if geometry changed
- Return original geometry if modifier is visual-only (like fillet)
- Update `mesh.geometry` if geometry was replaced

**Error Handling:**
- Always provide defaults for optional properties
- Validate inputs (e.g., count > 0, direction not zero vector)
- Use `console.warn()` for user-facing warnings

---

## Additional Resources

- **Three.js Documentation**: https://threejs.org/docs/
- **Existing Shapes**: See `js/csg/shapes.js` for reference implementations
- **Existing Modifiers**: See `js/modifiers/boolean.js` and `js/modifiers/fillet.js` for examples
- **Debug Utilities**: Use `debug()` and `debugLabel()` from `js/utils/debug.js`
- **Quality Settings**: Use `getSegmentCount()` from `js/utils/qualitySettings.js` for shape tessellation

