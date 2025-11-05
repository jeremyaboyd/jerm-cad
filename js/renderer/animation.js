/**
 * Animation loop and window resize handling
 */

import { getRenderer, getCamera, getControls, getScene } from './scene.js';

let animationId;

/**
 * Start the animation loop
 */
export function startAnimation() {
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        const controls = getControls();
        const renderer = getRenderer();
        const camera = getCamera();
        const scene = getScene();
        
        // Update controls (required for damping)
        controls.update();
        
        renderer.render(scene, camera);
    }
    
    animate();
}

/**
 * Stop the animation loop
 */
export function stopAnimation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
}

/**
 * Handle window resize
 */
export function handleResize() {
    const container = document.getElementById('canvas-container');
    const camera = getCamera();
    const renderer = getRenderer();
    const controls = getControls();
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    controls.handleResize(); // Update controls on resize
}

