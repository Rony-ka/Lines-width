// script.js

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');

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
            state.isGrowing = false;
            state.shouldShrinkAfterGrowth = false;
            state.animationFrameId = null;
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
        
        // --- NEW/UPDATED LOGIC: Extract numerical values from computed styles ---
        const computedStyle = window.getComputedStyle(gridContainer);

        // Function to extract the pixel value from a grid-template string
        const getGridPixelValue = (styleString) => {
            const match = styleString.match(/minmax\((\d+)px/);
            return match ? parseInt(match[1], 10) : 0;
        };
        
        const actualGridRowHeight = getGridPixelValue(computedStyle.gridTemplateRows);
        const actualGridColWidth = getGridPixelValue(computedStyle.gridTemplateColumns);

        if (actualGridRowHeight === 0 || actualGridColWidth === 0) {
            console.error("Could not determine grid dimensions from CSS. Please ensure 'minmax' is used with a pixel value.");
            return;
        }
        // --- END NEW/UPDATED LOGIC ---

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
                isActive: false,
                isGrowing: false,
                shouldShrinkAfterGrowth: false,
                animationFrameId: null,
                startTime: 0,
                startScaleX: initialScaleX,
                endScaleX: initialScaleX
            });

            line.addEventListener('mouseenter', () => {
                const state = lineStates.get(line);

                if (!state.isGrowing && state.isActive) {
                     if (state.animationFrameId) {
                         cancelAnimationFrame(state.animationFrameId);
                         state.animationFrameId = null;
                     }
                     state.isActive = false;
                }

                if (lineTimeouts.has(line)) {
                    clearTimeout(lineTimeouts.get(line));
                    lineTimeouts.delete(line);
                }

                if (!state.isActive) {
                    state.isActive = true;
                    state.isGrowing = true;
                    state.shouldShrinkAfterGrowth = false;
                    state.startTime = performance.now();
                    state.startScaleX = state.currentScaleX;
                    state.endScaleX = targetScaleX;

                    const animateGrowth = (currentTime) => {
                        if (!state.isActive || !state.isGrowing) {
                            state.animationFrameId = null;
                            return;
                        }

                        const elapsed = currentTime - state.startTime;
                        let progress = Math.min(elapsed / growDuration, 1);
                        progress = easeOutQuad(progress);

                        state.currentScaleX = state.startScaleX + (state.endScaleX - state.startScaleX) * progress;

                        state.lineElement.style.setProperty('--line-width-scale', `${state.currentScaleX}`);

                        if (progress < 1) {
                            state.animationFrameId = requestAnimationFrame(animateGrowth);
                        } else {
                            state.animationFrameId = null;
                            state.isGrowing = false;
                            if (state.shouldShrinkAfterGrowth) {
                                state.shouldShrinkAfterGrowth = false;
                                state.startTime = performance.now();
                                state.startScaleX = state.currentScaleX;
                                state.endScaleX = initialScaleX;
                                const animateShrinkNow = (time) => {
                                    const elapsed = time - state.startTime;
                                    let progress = Math.min(elapsed / shrinkDelay, 1);
                                    progress = easeOutQuad(progress);

                                    state.currentScaleX = state.startScaleX + (state.endScaleX - state.startScaleX) * progress;
                                    state.lineElement.style.setProperty('--line-width-scale', `${state.currentScaleX}`);

                                    if (progress < 1) {
                                        state.animationFrameId = requestAnimationFrame(animateShrinkNow);
                                    } else {
                                        state.lineElement.style.setProperty('--line-width-scale', `${initialScaleX}`);
                                        state.isActive = false;
                                        lineTimeouts.delete(line);
                                    }
                                };
                                state.animationFrameId = requestAnimationFrame(animateShrinkNow);
                            } else {
                                state.isActive = true;
                            }
                        }
                    };
                    state.animationFrameId = requestAnimationFrame(animateGrowth);
                }
            });

            line.addEventListener('mouseleave', () => {
                const state = lineStates.get(line);

                if (state.isGrowing) {
                    state.shouldShrinkAfterGrowth = true;
                    return;
                }

                if (state.isActive) {
                    if (lineTimeouts.has(line)) {
                        clearTimeout(lineTimeouts.get(line));
                        lineTimeouts.delete(line);
                    }

                    const timeoutId = setTimeout(() => {
                        state.isActive = false;
                        if (state.animationFrameId) {
                            cancelAnimationFrame(state.animationFrameId);
                            state.animationFrameId = null;
                        }

                        state.startScaleX = state.currentScaleX;
                        state.endScaleX = initialScaleX;
                        state.startTime = performance.now();

                        const animateShrink = (currentTime) => {
                            if (state.isActive) {
                                state.animationFrameId = null;
                                return;
                            }

                            const elapsed = currentTime - state.startTime;
                            let progress = Math.min(elapsed / shrinkDelay, 1);
                            progress = easeOutQuad(progress);

                            state.currentScaleX = state.startScaleX + (state.endScaleX - state.startScaleX) * progress;

                            state.lineElement.style.setProperty('--line-width-scale', `${state.currentScaleX}`);

                            if (progress < 1) {
                                state.animationFrameId = requestAnimationFrame(animateShrink);
                            } else {
                                state.lineElement.style.setProperty('--line-width-scale', `${initialScaleX}`);
                                state.isActive = false;
                                lineTimeouts.delete(line);
                            }
                        };
                        state.animationFrameId = requestAnimationFrame(animateShrink);
                    }, 0);

                    lineTimeouts.set(line, timeoutId);
                }
            });
        }
    };

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
