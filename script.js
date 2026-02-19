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
let timerSeconds = 0;
let timerRunning = false;

// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const counterDisplay = document.getElementById('counterDisplay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const intervalToggle = document.getElementById('intervalToggle');
const beepSound = document.getElementById('beepSound');
const minutesInput = document.getElementById('minutesInput');
const secondsInput = document.getElementById('secondsInput');
const timerModal = document.getElementById('timerModal');
const timePicker = document.getElementById('timePicker');
const hoursInput = document.getElementById('hoursInput');

// ============================================
// Timer Functions
// ============================================

/**
 * Start the countdown timer
 */
function startTimer() {
    if (!timerRunning) {
        const hours = parseInt(document.getElementById('hoursInput').value) || 0;
        const minutes = parseInt(document.getElementById('minutesInput').value) || 0;
        const seconds = parseInt(document.getElementById('secondsInput').value) || 0;
        
        timerSeconds = hours * 3600 + minutes * 60 + seconds;
        
        if (timerSeconds > 0) {
            timerRunning = true;
            document.getElementById('timerInputsContainer').classList.add('hidden');
            document.getElementById('timerDisplay').classList.remove('hidden');
            updateTimerDisplay();
            
            timerInterval = setInterval(() => {
                timerSeconds--;
                updateTimerDisplay();
                
                if (timerSeconds <= 0) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                }
            }, 1000);
        }
    }
}

/**
 * Pause the countdown timer
 */
function pauseTimer() {
    if (timerRunning) {
        timerRunning = false;
        clearInterval(timerInterval);
    }
}

/**
 * Reset the countdown timer
 */
function resetTimer() {
    timerRunning = false;
    clearInterval(timerInterval);
    timerSeconds = 0;
    document.getElementById('timerDisplay').classList.add('hidden');
    document.getElementById('timerInputsContainer').classList.remove('hidden');
    document.getElementById('hoursInput').value = '';
    document.getElementById('minutesInput').value = '';
    document.getElementById('secondsInput').value = '';
}

/**
 * Update the timer display
 */
function updateTimerDisplay() {
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const seconds = timerSeconds % 60;
    timerDisplay.textContent = 
        String(hours).padStart(2, '0') + ':' + 
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

// ============================================
// Timer Modal Functions
// ============================================

function openTimerModal() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('minutesInput').value = minutes;
    document.getElementById('secondsInput').value = String(seconds).padStart(2, '0');
    document.getElementById('timerModal').classList.add('active');
}

function closeTimerModal() {
    document.getElementById('timerModal').classList.remove('active');
}

function saveTimerTime() {
    const minutes = parseInt(document.getElementById('minutesInput').value) || 0;
    const seconds = parseInt(document.getElementById('secondsInput').value) || 0;
    timerSeconds = minutes * 60 + seconds;
    updateTimerDisplay();
    closeTimerModal();
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    document.getElementById('timerDisplay').textContent = 
        String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

// ============================================
// Timer Picker
// ============================================

function openTimerPicker() {
    const isMobile = /iPhone|iPad|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        const minutes = Math.floor(timerSeconds / 60);
        const seconds = timerSeconds % 60;
        const timeString = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        const picker = document.getElementById('timePicker');
        picker.value = timeString;
        picker.focus();
        picker.click();
    } else {
        openTimerModal();
    }
}

document.getElementById('timePicker').addEventListener('change', function() {
    if (this.value) {
        const [minutes, seconds] = this.value.split(':').map(Number);
        timerSeconds = minutes * 60 + seconds;
        updateTimerDisplay();
    }
});

// Limit input to 2 digits
document.addEventListener('DOMContentLoaded', function() {
    const inputs = ['hoursInput', 'minutesInput', 'secondsInput'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', function(e) {
            if (this.value.length > 2) {
                this.value = this.value.slice(0, 2);
            }
        });
    });
});