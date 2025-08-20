// script.js

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');

    // --- NEW/UPDATED VALUES to match the updated CSS cell dimensions ---
    const actualGridRowHeight = 40; // Matches line height in CSS
    const actualGridColWidth = 20;  // Matches grid-template-columns in CSS
    // --- END NEW/UPDATED VALUES ---

    const growDuration = 500; // milliseconds for the line to become wider
    const shrinkDelay = 1500;  // Delay before shrinking back
    const initialScaleX = 1.2; // Match the initial scale in CSS
    const targetScaleX = 10;   // How wide the line becomes on hover

    const lineStates = new Map();
    const lineTimeouts = new Map();

    const clearAllLineAnimations = () => {
        lineStates.forEach(state => {
            if (state.animationFrameId) {
                cancelAnimationFrame(state.animationFrameId);
            }
            state.isActive = false;
            state.isGrowing = false; // Reset new state
            state.shouldShrinkAfterGrowth = false; // Reset new state
            state.animationFrameId = null;
            // Ensure lines are reset if grid is cleared
            if (state.lineElement) {
                state.lineElement.style.setProperty('--line-width-scale', `${initialScaleX}`);
            }
        });
        lineTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        lineTimeouts.clear();
        lineStates.clear();
    };

    const populateGrid = () => {
        clearAllLineAnimations();
        gridContainer.innerHTML = '';

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const rowsThatFit = Math.floor(viewportHeight / actualGridRowHeight);
        const colsThatFit = Math.floor(viewportWidth / actualGridColWidth);

        const numLinesToCreate = rowsThatFit * colsThatFit;

        for (let i = 0; i < numLinesToCreate; i++) {
            const line = document.createElement('div');
            line.classList.add('line');
            gridContainer.appendChild(line);

            lineStates.set(line, {
                lineElement: line,
                currentScaleX: initialScaleX,
                isActive: false, // Overall state (growing or shrinking)
                isGrowing: false, // Specifically tracking if growth animation is in progress
                shouldShrinkAfterGrowth: false, // Flag to indicate shrinking should follow growth
                animationFrameId: null,
                startTime: 0,
                startScaleX: initialScaleX,
                endScaleX: initialScaleX
            });

            line.addEventListener('mouseenter', () => {
                const state = lineStates.get(line);

                // If currently shrinking, stop shrink and immediately start growth
                if (!state.isGrowing && state.isActive) { // if active but not growing, it's shrinking
                     if (state.animationFrameId) {
                         cancelAnimationFrame(state.animationFrameId);
                         state.animationFrameId = null;
                     }
                     state.isActive = false; // Reset overall state
                }

                if (lineTimeouts.has(line)) {
                    clearTimeout(lineTimeouts.get(line));
                    lineTimeouts.delete(line);
                }

                if (!state.isActive) { // Only start new animation if not already active (growing or shrinking)
                    state.isActive = true;
                    state.isGrowing = true; // Set growing flag
                    state.shouldShrinkAfterGrowth = false; // Clear flag for subsequent shrink
                    state.startTime = performance.now();
                    state.startScaleX = state.currentScaleX; // Start from current scale
                    state.endScaleX = targetScaleX;


                    const animateGrowth = (currentTime) => {
                        // Check if animation was stopped (e.g., by populateGrid or another mouseenter/leave)
                        if (!state.isActive || !state.isGrowing) {
                            state.animationFrameId = null;
                            return;
                        }

                        const elapsed = currentTime - state.startTime;
                        let progress = Math.min(elapsed / growDuration, 1);
                        // --- REVERTED: Using the original easeOutQuad (which is easeInOutQuad) ---
                        progress = easeOutQuad(progress);

                        state.currentScaleX = state.startScaleX + (state.endScaleX - state.startScaleX) * progress;

                        state.lineElement.style.setProperty('--line-width-scale', `${state.currentScaleX}`);

                        if (progress < 1) {
                            state.animationFrameId = requestAnimationFrame(animateGrowth);
                        } else {
                            // Growth animation complete
                            state.animationFrameId = null;
                            state.isGrowing = false; // Growth is finished

                            // If mouse left during growth, start shrink now
                            if (state.shouldShrinkAfterGrowth) {
                                // Reset shouldShrinkAfterGrowth before starting new shrink animation
                                state.shouldShrinkAfterGrowth = false;
                                // Directly call animateShrink setup logic
                                state.startTime = performance.now();
                                state.startScaleX = state.currentScaleX;
                                state.endScaleX = initialScaleX;
                                const animateShrinkNow = (time) => {
                                    const elapsed = time - state.startTime;
                                    let progress = Math.min(elapsed / shrinkDelay, 1);
                                    // --- REVERTED: Using the original easeOutQuad ---
                                    progress = easeOutQuad(progress);

                                    state.currentScaleX = state.startScaleX + (state.endScaleX - state.startScaleX) * progress;
                                    state.lineElement.style.setProperty('--line-width-scale', `${state.currentScaleX}`);

                                    if (progress < 1) {
                                        state.animationFrameId = requestAnimationFrame(animateShrinkNow);
                                    } else {
                                        state.lineElement.style.setProperty('--line-width-scale', `${initialScaleX}`);
                                        state.isActive = false; // Animation fully complete
                                        lineTimeouts.delete(line);
                                    }
                                };
                                state.animationFrameId = requestAnimationFrame(animateShrinkNow);

                            } else {
                                // If mouse is still over, keep line wide
                                state.isActive = true; // Still active (fully grown)
                            }
                        }
                    };
                    state.animationFrameId = requestAnimationFrame(animateGrowth);
                }
            });

            line.addEventListener('mouseleave', () => {
                const state = lineStates.get(line);

                if (state.isGrowing) {
                    // Mouse left during growth, set flag to shrink when growth completes
                    state.shouldShrinkAfterGrowth = true;
                    // Do NOT stop the current growth animation here
                    return;
                }

                // If not currently growing, proceed with shrink animation
                if (state.isActive) {
                    // Cancel any pending shrink timeout if mouse re-entered and left quickly
                    if (lineTimeouts.has(line)) {
                        clearTimeout(lineTimeouts.get(line));
                        lineTimeouts.delete(line);
                    }

                    // This setTimeout initiates the shrink after a delay if it's not already growing
                    const timeoutId = setTimeout(() => {
                        state.isActive = false; // Now ready to shrink
                        if (state.animationFrameId) {
                            cancelAnimationFrame(state.animationFrameId); // Cancel any previous animation frame
                            state.animationFrameId = null;
                        }

                        // Store current state to animate back from
                        state.startScaleX = state.currentScaleX;
                        state.endScaleX = initialScaleX;
                        state.startTime = performance.now();


                        const animateShrink = (currentTime) => {
                            // Check if animation was stopped
                            if (state.isActive) { // If isActive is true, it means mouse re-entered during shrink
                                state.animationFrameId = null;
                                return;
                            }

                            const elapsed = currentTime - state.startTime;
                            let progress = Math.min(elapsed / shrinkDelay, 1);
                            // --- REVERTED: Using the original easeOutQuad ---
                            progress = easeOutQuad(progress);

                            state.currentScaleX = state.startScaleX + (state.endScaleX - state.startScaleX) * progress;

                            state.lineElement.style.setProperty('--line-width-scale', `${state.currentScaleX}`);


                            if (progress < 1) {
                                state.animationFrameId = requestAnimationFrame(animateShrink);
                            } else {
                                // Ensure it snaps to perfect initial width at the end
                                state.lineElement.style.setProperty('--line-width-scale', `${initialScaleX}`);
                                state.isActive = false; // Animation fully complete
                                lineTimeouts.delete(line);
                            }
                        };
                        state.animationFrameId = requestAnimationFrame(animateShrink);
                    }, 0); // Start shrink animation immediately after mouseleave

                    lineTimeouts.set(line, timeoutId);
                }
            });
        }
    };

    // --- REVERTED: Original easeOutQuad function body (which is easeInOutQuad) ---
    function easeOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    populateGrid();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(populateGrid, 200);
    });
});