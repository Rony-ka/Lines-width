// script.js

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('grid-container');

    const actualGridRowHeight = 40; // Matches line height in CSS
    const actualGridColWidth = 20;  // Matches grid-template-columns in CSS

    const growDuration = 500;
    const shrinkDelay = 1500;
    const initialScaleX = 1.2;
    const targetScaleX = 10;

    const lineStates = new Map();
    const lineTimeouts = new Map();
    let previouslyTouchedLine = null;

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
        previouslyTouchedLine = null;
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
                isActive: false,
                isGrowing: false,
                shouldShrinkAfterGrowth: false,
                animationFrameId: null,
                startTime: 0,
                startScaleX: initialScaleX,
                endScaleX: initialScaleX
            });
        }
    };
    
    // Helper function to get the element at a specific coordinate
    const getTouchedLine = (x, y) => {
        const element = document.elementFromPoint(x, y);
        if (element && element.classList.contains('line')) {
            return element;
        }
        return null;
    };

    const startGrowAnimation = (line) => {
        if (!line) return;
        const state = lineStates.get(line);
        if (!state) return;

        // If currently shrinking, stop shrink and immediately start growth
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
                        startShrinkAnimation(line, 0); // Start shrink immediately
                    } else {
                        state.isActive = true;
                    }
                }
            };
            state.animationFrameId = requestAnimationFrame(animateGrowth);
        }
    };

    const startShrinkAnimation = (line, delay) => {
        if (!line) return;
        const state = lineStates.get(line);
        if (!state) return;

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
            }, delay);

            lineTimeouts.set(line, timeoutId);
        }
    };

    gridContainer.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const currentLine = getTouchedLine(touch.clientX, touch.clientY);
        if (currentLine) {
            startGrowAnimation(currentLine);
            previouslyTouchedLine = currentLine;
        }
    });

    gridContainer.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling
        const touch = e.touches[0];
        const currentLine = getTouchedLine(touch.clientX, touch.clientY);

        if (currentLine && currentLine !== previouslyTouchedLine) {
            // Shrink the old line
            if (previouslyTouchedLine) {
                startShrinkAnimation(previouslyTouchedLine, 0); // Shrink immediately
            }
            // Grow the new line
            startGrowAnimation(currentLine);
            previouslyTouchedLine = currentLine;
        }
    });

    gridContainer.addEventListener('touchend', () => {
        if (previouslyTouchedLine) {
            startShrinkAnimation(previouslyTouchedLine, shrinkDelay);
            previouslyTouchedLine = null;
        }
    });

    // --- Original easeOutQuad function body (which is easeInOutQuad) ---
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
