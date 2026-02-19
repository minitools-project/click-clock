// ============================================
// ClickClock - Timer & Counter App
// ============================================

// State variables
let timerInterval = null;
let timeRemaining = 20 * 60; // 20 minutes in seconds
let isRunning = false;
let counterValue = 0;
let lastIntervalTime = 0;
let intervalEnabled = false;
let lastSecondPlayed = -1; // Track last second for 25-second interval

// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const counterDisplay = document.getElementById('counterDisplay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const intervalToggle = document.getElementById('intervalToggle');
const beepSound = document.getElementById('beepSound');

// ============================================
// Timer Functions
// ============================================

/**
 * Start the countdown timer
 */
function startTimer() {
    if (isRunning) return; // Prevent multiple intervals
    
    isRunning = true;
    lastSecondPlayed = -1;
    
    // Update UI
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    
    // Record the exact start time for accurate countdown
    const startTime = Date.now();
    const adjustedStart = startTime - ((20 * 60 - timeRemaining) * 1000);
    
    // Clear any existing interval
    if (timerInterval) clearInterval(timerInterval);
    
    // Run timer every 100ms for smooth updates and accurate calculation
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - adjustedStart) / 1000);
        timeRemaining = Math.max(0, 20 * 60 - elapsed);
        
        updateTimerDisplay();
        
        // Check for 25-second interval signal
        if (intervalEnabled && timeRemaining > 0) {
            checkIntervalSignal();
        }
        
        // Timer finished
        if (timeRemaining <= 0) {
            finishTimer();
        }
    }, 100);
}

/**
 * Pause the countdown timer
 */
function pauseTimer() {
    if (!isRunning) return;
    
    isRunning = false;
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Update UI
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

/**
 * Reset the countdown timer
 */
function resetTimer() {
    pauseTimer();
    timeRemaining = 20 * 60;
    lastSecondPlayed = -1;
    updateTimerDisplay();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

/**
 * Update the timer display
 */
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    timerDisplay.textContent = 
        String(minutes).padStart(2, '0') + ':' + 
        String(seconds).padStart(2, '0');
}

/**
 * Called when timer reaches 00:00
 */
function finishTimer() {
    pauseTimer();
    playSound();
    vibrate(500); // Vibrate for 500ms
    
    // Show alert
    alert('Time\'s up! 🎉');
    
    // Reset for next use
    resetTimer();
}

/**
 * Check if 25-second interval has passed and play beep
 */
function checkIntervalSignal() {
    // Calculate elapsed time from start of timer
    const elapsed = 20 * 60 - timeRemaining;
    
    // Check if we've crossed a 25-second boundary
    const currentInterval = Math.floor(elapsed / 25);
    const lastInterval = Math.floor((elapsed - 0.1) / 25);
    
    if (currentInterval > lastInterval && elapsed % 25 < 1) {
        playSound();
        vibrate(100); // Short vibration for interval signal
    }
}

// ============================================
// Counter Functions
// ============================================

/**
 * Increment the counter
 */
function incrementCounter() {
    counterValue++;
    updateCounterDisplay();
    vibrate(50); // Light vibration feedback
}

/**
 * Decrement the counter (not below zero)
 */
function decrementCounter() {
    if (counterValue > 0) {
        counterValue--;
        updateCounterDisplay();
        vibrate(50);
    }
}

/**
 * Reset the counter to zero
 */
function resetCounter() {
    counterValue = 0;
    updateCounterDisplay();
}

/**
 * Update the counter display
 */
function updateCounterDisplay() {
    counterDisplay.textContent = counterValue;
}

// ============================================
// Interval Toggle
// ============================================

/**
 * Toggle the 25-second interval signal
 */
function toggleInterval() {
    intervalEnabled = intervalToggle.checked;
    lastSecondPlayed = -1;
}

// ============================================
// Audio & Vibration
// ============================================

/**
 * Play beep sound (simple sine wave beep)
 */
function playSound() {
    try {
        // Create a more complex beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Create beep sound
        oscillator.frequency.value = 800; // 800 Hz frequency
        oscillator.type = 'sine';
        
        // Envelope
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        console.log('Audio API not available:', e);
    }
}

/**
 * Vibrate device using Vibration API
 * @param {number} duration - Duration in milliseconds
 */
function vibrate(duration) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duration);
    }
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize the app on page load
 */
function init() {
    updateTimerDisplay();
    updateCounterDisplay();
    
    // Ensure buttons start in correct state
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// Cleanup on page unload
// ============================================

window.addEventListener('beforeunload', () => {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});