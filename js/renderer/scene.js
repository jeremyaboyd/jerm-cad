/**
 * Three.js scene setup and management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Evaluator } from 'three-bvh-csg';

let scene, camera, renderer, controls, gridHelper, axesHelper;
let csgEvaluator;

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getControls() { return controls; }
export function getCSGEvaluator() { return csgEvaluator; }

/**
 * Create a bold axes helper with thicker lines
 * @param {number} size - Size of the axes
 * @returns {THREE.Group} Group containing the axis lines
 */
function createBoldAxesHelper(size) {
    const group = new THREE.Group();
    const lineWidth = 0.03; // Thickness of the axis lines
    const halfSize = size / 2;
    
    // X axis (red) - using cylinder geometry for thickness
    const xAxisGeometry = new THREE.CylinderGeometry(lineWidth, lineWidth, size, 8);
    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
    xAxis.rotation.z = -Math.PI / 2; // Rotate to align with X axis
    xAxis.position.x = halfSize; // Position so it extends from origin to +X
    group.add(xAxis);
    
    // Y axis (green) - using cylinder geometry for thickness
    const yAxisGeometry = new THREE.CylinderGeometry(lineWidth, lineWidth, size, 8);
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
    // Already aligned with Y axis (cylinders default to Y-up)
    yAxis.position.y = halfSize; // Position so it extends from origin to +Y
    group.add(yAxis);
    
    // Z axis (blue) - using cylinder geometry for thickness
    const zAxisGeometry = new THREE.CylinderGeometry(lineWidth, lineWidth, size, 8);
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
    zAxis.rotation.x = Math.PI / 2; // Rotate to align with Z axis
    zAxis.position.z = halfSize; // Position so it extends from origin to +Z
    group.add(zAxis);
    
    return group;
}

/**
 * Initialize Three.js scene, camera, renderer, and lights
 */
export function initialize() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);
    
    // Camera
    const container = document.getElementById('canvas-container');
    camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    
    // Set default up vector to Z-up
    camera.up.set(0, 0, 1);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    // Soft light attached to camera
    const cameraLight = new THREE.PointLight(0xffffff, 100, 1000);
    cameraLight.position.set(0, 0, 0); // At camera position
    camera.add(cameraLight);
    scene.add(camera); // Camera must be in scene for its children to render
    
    // Grid (will be oriented based on up axis)
    gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    gridHelper.rotateX(Math.PI / 2); // Rotate to XY plane for Z-up default
    scene.add(gridHelper);
    
    // Axes helper (custom thicker lines)
    axesHelper = createBoldAxesHelper(10);
    scene.add(axesHelper);
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Enable smooth camera movement
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false; // Pan parallel to camera plane
    controls.minDistance = 5;
    controls.maxDistance = 200;
    controls.target.set(0, 0, 0);
    
    // Initialize CSG evaluator
    csgEvaluator = new Evaluator();
    
    return { scene, camera, renderer, controls, csgEvaluator };
}

/**
 * Update grid orientation based on up axis
 */
export function updateGridOrientation(upVector) {
    if (gridHelper) {
        scene.remove(gridHelper);
        gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
        
        // Rotate grid to match up axis
        if (Math.abs(upVector[2]) > 0.9) {
            // Z is up - rotate grid to XY plane
            gridHelper.rotateX(Math.PI / 2);
        } else if (Math.abs(upVector[0]) > 0.9) {
            // X is up - rotate grid to YZ plane
            gridHelper.rotateZ(Math.PI / 2);
        }
        // Y is up (default for Three.js GridHelper) - no rotation needed
        
        scene.add(gridHelper);
    }
}

/**
 * Update camera up vector
 */
export function updateCameraUp(upVector) {
    camera.up.set(upVector[0], upVector[1], upVector[2]);
    controls.target.set(0, 0, 0);
    controls.update();
}

