# Jerm-CAD

A browser-based 3D CAD model renderer that lets you design 3D models using YAML syntax. Define geometric shapes, apply boolean operations, and visualize your designs in real-time with export capabilities.

## Features

- **YAML-Based Modeling**: Define 3D models using simple YAML syntax
- **Multiple Shape Types**: Cuboid, cylinder, sphere, and extrusion shapes
- **Boolean Operations**: Union, difference, and intersection operations
- **Property References**: Reference properties from other solids to maintain alignment and consistency
- **3D Visualization**: Interactive 3D viewer with camera controls
- **STL Export**: Export your models for 3D printing
- **Coordinate System Support**: Z-up (CAD convention) or Y-up (traditional 3D)
- **Wireframe Mode**: Toggle wireframe view for better visualization
- **Real-time Rendering**: See changes instantly as you edit
- **Quality Settings**: Adjustable render quality for optimal performance (Low/Med/High/Ultra)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

Start the development server:
```bash
npm start
```

This will start a local server at `http://localhost:8080` and automatically open it in your browser.

Alternatively, you can use:
```bash
npm run serve
```
This starts the server without automatically opening the browser.

## Usage

### Basic Workflow

1. **Edit the YAML** in the left panel editor
2. **Click "🔄 Render Model"** or press `Ctrl+Enter` to render your changes
3. **View your model** in the 3D viewer on the right
4. **Export** as STL when ready using the "💾 Export STL" button

### Camera Controls

- **Left Mouse Drag**: Rotate the camera around the model
- **Right Mouse Drag**: Pan the view
- **Middle Mouse Drag**: Pan the view (alternative)
- **Scroll Wheel**: Zoom in/out
- **Reset Camera Button**: Return to default view

### YAML Model Structure

A basic model consists of:

```yaml
settings:
    units: mm
    tolerance: 1e-3
    up: [0, 0, 1]  # Z-up (CAD convention) or [0, 1, 0] for Y-up
    debug: false   # Enable verbose console logging (default: false)

materials:
    my_material:
        color: 0xff0000  # Hex color code
        opacity: 1.0     # 0.0 (transparent) to 1.0 (opaque)

solids:
    my_shape:
        shape: cuboid
        center: [0, 0, 0]
        size: [10, 8, 3]
        material: my_material  # Reference to material defined above

final:
    material: my_material  # Apply material to the final merged mesh
    # OR use direct properties:
    # color: 0x4287f5
    # opacity: 1.0
```

### Materials

Materials allow you to define reusable color and opacity settings that can be referenced by multiple solids.

```yaml
materials:
    blue_plastic:
        color: 0x4287f5
        opacity: 1.0
    red_metal:
        color: 0xff0000
        opacity: 0.9
    transparent_glass:
        color: 0xffffff
        opacity: 0.5

solids:
    base:
        shape: cuboid
        center: [0, 0, 0]
        size: [10, 10, 5]
        material: blue_plastic  # Use the material defined above
    
    handle:
        shape: cylinder
        center: [0, 0, 5]
        diameter: 2
        length: 10
        material: red_metal  # Different material
```

**Material Properties:**
- `color`: Hex color code (e.g., `0xff0000` for red, `0x4287f5` for blue)
- `opacity`: Number between 0.0 (fully transparent) and 1.0 (fully opaque)

**Using Materials vs Direct Properties:**
- You can reference a material using `material: material_name`
- OR you can use direct `color` and `opacity` properties on the solid (backward compatible)
- If both are specified, the material takes precedence

### Final Mesh

The `final` section allows you to merge all visible meshes into a single final mesh and apply a material to it. This is useful when you want to show only the final result with a unified appearance.

```yaml
final:
    material: blue_plastic  # Reference to a material
    # OR use direct properties:
    # color: 0x4287f5
    # opacity: 1.0
```

**How it works:**
- After all solids are created and boolean operations are applied, all visible meshes are merged into one
- The material from the `final` section is applied to this merged mesh
- All individual meshes are hidden, showing only the final merged result
- If no `final` section is provided, individual meshes are shown as before

**Properties:**
- `material`: Name of a material defined in the `materials` section
- `color`: Hex color code (alternative to material)
- `opacity`: Number between 0.0 and 1.0 (alternative to material)

### Shape Types

#### Cuboid
```yaml
my_box:
    shape: cuboid
    center: [0, 0, 0]
    size: [width, depth, height]
    material: my_material  # Reference to material, OR use direct properties:
    # color: 0xff0000  # Optional hex color (if no material specified)
    # opacity: 0.8     # Optional (0-1) (if no material specified)
```

#### Cylinder
```yaml
my_cylinder:
    shape: cylinder
    center: [0, 0, 0]
    diameter: 5
    length: 10
    rotation: [90, 0, 0]  # Optional rotation in degrees [x, y, z]
```

#### Sphere
```yaml
my_sphere:
    shape: sphere
    center: [0, 0, 0]
    diameter: 5
```

#### Extrusion
```yaml
my_extrusion:
    shape: extrusion
    center: [0, 0, 0]
    profile:
        type: circle    # or rect, poly
        diameter: 3     # for circle
        # OR
        size: [2, 2]    # for rect [width, height]
        # OR
        points: [[0,0], [1,0], [1,1], [0,1]]  # for poly
    length: 5
    rotation: [90, 0, 0]
```

### Boolean Operations

Boolean operations allow you to combine shapes using union, difference, and intersection. Operations are applied in the order listed.

#### Difference (Subtract)
```yaml
base:
    shape: cuboid
    center: [0, 0, 0]
    size: [10, 10, 5]
    modifiers:
        boolean:
            - difference: cutout_shape

cutout_shape:
    shape: cuboid
    center: [0, 0, -1]
    size: [5, 5, 3]
    visible: false  # Hidden objects used only for boolean ops
```

#### Union (Add)
```yaml
base:
    shape: cuboid
    center: [0, 0, 0]
    size: [10, 10, 5]
    modifiers:
        boolean:
            - union: addon_shape

addon_shape:
    shape: cylinder
    center: [0, 0, 5]
    diameter: 3
    length: 2
```

#### Multiple Operations
You can chain multiple boolean operations:
```yaml
base:
    shape: cuboid
    center: [0, 0, 0]
    size: [10, 10, 5]
    modifiers:
        boolean:
            - difference: cutout1
            - difference: cutout2
            - union: addon1
            - intersection: intersection_shape
```

### Transformations

All shapes support:
- **center**: `[x, y, z]` - Position of the shape
- **anchor**: `[x, y, z]` - Anchor point (values 0-1) that determines which point on the bounding box the center refers to. Default is `[0.5, 0.5, 0.5]` (geometric center)
- **rotation**: `[x, y, z]` - Rotation in degrees around each axis
- **color**: Hex color code (e.g., `0xff0000` for red)
- **opacity**: Number between 0 and 1
- **visible**: `true` or `false` - Hide shapes used only for boolean operations

#### Anchor Point

The `anchor` property allows you to control which point on the shape's bounding box the `center` position refers to:

- `[0, 0, 0]` - Bottom-left-back corner (minimum corner)
- `[0.5, 0.5, 0.5]` - Geometric center (default)
- `[1, 1, 1]` - Top-right-front corner (maximum corner)
- `[0, 0.5, 0.5]` - Bottom edge center
- `[1, 0, 0]` - Top-left-back corner

**Example:**
```yaml
box_at_corner:
    shape: cuboid
    size: [10, 10, 10]
    center: [0, 0, 0]
    anchor: [0, 0, 0]  # Position the bottom-left-back corner at [0, 0, 0]

box_at_top:
    shape: cuboid
    size: [10, 10, 10]
    center: [0, 0, 20]
    anchor: [0.5, 0.5, 1]  # Position the top face center at [0, 0, 20]
```

### Property References

You can reference properties from other solids by using the solid name as a value. This allows you to keep related shapes aligned and maintain consistency across your model.

**How it works:**
- When a solid name appears as a value, it automatically resolves to the corresponding property from that solid
- In arrays, the reference resolves to the element at the same index position
- References are resolved recursively, so you can chain references (A references B, B references C)

#### Array Element References

When a solid name appears in an array, it resolves to the corresponding array element from that solid's property:

```yaml
cable_holder:
    center: [0, 0, 3]
    diameter: 5

cable_cutout:
    center: [0, 0, cable_holder]  # Gets cable_holder.center[2] = 3
    diameter: 3
```

In this example, `cable_cutout.center` becomes `[0, 0, 3]` because `cable_holder` in the third position resolves to `cable_holder.center[2]`.

#### Direct Property References

When a solid name is used as a direct property value, it resolves to the same property from that solid:

```yaml
base_shape:
    center: [0, 0, 0]
    diameter: 10

aligned_shape:
    center: base_shape        # Gets base_shape.center = [0, 0, 0]
    diameter: base_shape      # Gets base_shape.diameter = 10
```

#### Common Use Cases

**Aligning shapes:**
```yaml
base:
    center: [0, 0, 0]
    size: [10, 10, 5]

cover:
    center: [0, 0, base]  # Aligns cover's Z position with base's top (base.center[2] + base.size[2]/2)
    size: [10, 10, 1]
```

**Reusing dimensions:**
```yaml
main_body:
    diameter: 20
    length: 50

inner_core:
    diameter: main_body      # Same diameter as main_body
    length: main_body        # Same length as main_body
```

**Chained references:**
```yaml
base:
    center: [0, 0, 0]

middle:
    center: [0, 0, base]    # References base.center[2]

top:
    center: [0, 0, middle]  # References middle.center[2], which resolves through base
```

**Note:** References must point to existing solids. Circular references are detected and prevented to avoid infinite loops.

### Complete Example

```yaml
settings:
    units: mm
    tolerance: 1e-3
    up: [0, 0, 1]  # Z-up

solids:
    base:
        shape: cuboid
        center: [0, 0, 0]
        size: [10, 8, 3]
        modifiers:
            boolean:
                - difference: base_cutout
                - union: cable_holder
    
    base_cutout:
        shape: cuboid
        center: [0, 0, -1]
        size: [9, 7, 1.5]
        visible: false
    
    cable_holder:
        shape: cylinder
        center: [0, 0, 3]
        diameter: 5
        length: 3
        modifiers:
            boolean:
                - difference: cable_cutout
    
    cable_cutout:
        shape: cylinder
        center: [0, 0, cable_holder]  # References cable_holder.center[2] = 3
        diameter: 3
        length: 5.5
        visible: false
```

## Tips

- **Dependency Resolution**: The system automatically resolves dependencies for boolean operations. Solids referenced in boolean operations are created first.
- **Property References**: Use property references to keep related shapes aligned. For example, `center: [0, 0, cable_holder]` automatically aligns the Z position with `cable_holder.center[2]`.
- **Invisible Solids**: Set `visible: false` on shapes used only for boolean operations to keep them hidden in the viewer.
- **Performance**: Complex models with many boolean operations may take longer to render. Be patient! Use the quality dropdown to adjust render quality for better performance during editing.
- **Keyboard Shortcut**: Use `Ctrl+Enter` in the editor to quickly render your model.
- **Debug Mode**: Set `debug: true` in settings to enable verbose console logging. This will show detailed information about each solid being created, its dependencies, boolean operations, and processing steps. Useful for troubleshooting complex models.
- **STL Export Quality**: STL exports always use ultra quality (256 segments) for maximum detail, regardless of your current viewport quality setting.

## Export

Click the "💾 Export STL" button to download your model as an STL file, ready for 3D printing or use in other CAD software.

## Troubleshooting

- **Model not rendering?** Check your YAML syntax for errors. The error panel will display specific issues.
- **Boolean operations not working?** Ensure all referenced solids are defined in the `solids` section. Enable `debug: true` in settings to see detailed console output about dependency resolution and boolean operations.
- **Camera stuck?** Use the "📷 Reset Camera" button to return to default view.
- **Performance issues?** Try simplifying your model or reducing the number of boolean operations.
- **Need more information?** Enable debug mode (`debug: true` in settings) and check the browser console (F12) for detailed logging about solid creation, dependencies, and processing steps.

## Technologies

- **Three.js**: 3D graphics library
- **three-bvh-csg**: Constructive Solid Geometry operations
- **js-yaml**: YAML parsing

## License

ISC

