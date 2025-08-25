/**
 * GPIO Controller JavaScript Application
 * Raspberry Pi GPIO Control Interface
 */

class GPIOController {
    constructor() {
        this.pins = {};
        this.eventSource = null;
        this.isConnected = false;
        this.monitoredPins = new Set();
        this.pwmStates = {};
        
        // DOM elements
        this.elements = {};
        
        // Constants
        this.VALID_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27];
        this.PWM_PINS = [12, 13, 18, 19];
        
        this.init();
    }
    
    /**
     * Initialize the application
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.loadTheme();
        this.createGPIOGrid();
        this.populateDropdowns();
        this.connectEventStream();
        this.refreshPinStatus();
    }
    
    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Header elements
            darkModeToggle: document.getElementById('darkModeToggle'),
            resetAllBtn: document.getElementById('resetAllBtn'),
            connectionStatus: document.getElementById('connectionStatus'),
            backendStatus: document.getElementById('backendStatus'),
            loops: document.getElementById('loops'),
            
            // GPIO grid
            gpioGrid: document.getElementById('gpioGrid'),
            
            // Configuration panel
            configPin: document.getElementById('configPin'),
            configurePinBtn: document.getElementById('configurePinBtn'),
            pullResistorGroup: document.getElementById('pullResistorGroup'),
            
            // Output control panel
            outputPin: document.getElementById('outputPin'),
            setHighBtn: document.getElementById('setHighBtn'),
            setLowBtn: document.getElementById('setLowBtn'),
            pulseBtn: document.getElementById('pulseBtn'),
            pulseDuration: document.getElementById('pulseDuration'),
            
            // Input monitor panel
            inputPin: document.getElementById('inputPin'),
            inputValue: document.getElementById('inputValue'),
            toggleMonitorBtn: document.getElementById('toggleMonitorBtn'),
            inputEventLog: document.getElementById('inputEventLog'),
            
            // PWM control panel
            pwmPin: document.getElementById('pwmPin'),
            pwmFrequency: document.getElementById('pwmFrequency'),
            pwmDutyCycle: document.getElementById('pwmDutyCycle'),
            dutyCycleValue: document.getElementById('dutyCycleValue'),
            pwmStatus: document.getElementById('pwmStatus'),
            startPwmBtn: document.getElementById('startPwmBtn'),
            stopPwmBtn: document.getElementById('stopPwmBtn'),
            
            // Activity log
            activityLog: document.getElementById('activityLog'),
            clearLogBtn: document.getElementById('clearLogBtn')
        };
    }
    
    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Header controls
        this.elements.darkModeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.resetAllBtn.addEventListener('click', () => this.resetAllPins());
        
        // Pin configuration
        this.elements.configurePinBtn.addEventListener('click', () => this.configurePin());
        document.querySelectorAll('input[name="pinMode"]').forEach(radio => {
            radio.addEventListener('change', () => this.handleModeChange());
        });
        
        // Output control
        this.elements.outputPin.addEventListener('change', () => this.handleOutputPinChange());
        this.elements.setHighBtn.addEventListener('click', () => this.setOutput('high'));
        this.elements.setLowBtn.addEventListener('click', () => this.setOutput('low'));
        this.elements.pulseBtn.addEventListener('click', () => this.sendPulse());
        
        // Input monitor
        this.elements.inputPin.addEventListener('change', () => this.handleInputPinChange());
        this.elements.toggleMonitorBtn.addEventListener('click', () => this.toggleInputMonitor());
        
        // PWM control
        this.elements.pwmPin.addEventListener('change', () => this.handlePwmPinChange());
        this.elements.pwmDutyCycle.addEventListener('input', () => this.updateDutyCycleDisplay());
        this.elements.startPwmBtn.addEventListener('click', () => this.startPWM());
        this.elements.stopPwmBtn.addEventListener('click', () => this.stopPWM());
        
        // Activity log
        this.elements.clearLogBtn.addEventListener('click', () => this.clearActivityLog());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }
    
    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'd':
                    e.preventDefault();
                    this.toggleTheme();
                    break;
                case 'r':
                    e.preventDefault();
                    this.resetAllPins();
                    break;
            }
        }
    }
    
    /**
     * Load and apply saved theme
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('gpio-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }
    
    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('gpio-theme', newTheme);
        this.updateThemeIcon(newTheme);
    }
    
    /**
     * Update theme toggle icon
     */
    updateThemeIcon(theme) {
        const sunIcon = this.elements.darkModeToggle.querySelector('.sun-icon');
        const moonIcon = this.elements.darkModeToggle.querySelector('.moon-icon');
        
        if (theme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
    
    /**
     * Create the GPIO pin grid
     */
    createGPIOGrid() {
        this.elements.gpioGrid.innerHTML = '';
        
        this.VALID_PINS.forEach(pin => {
            const pinElement = document.createElement('div');
            pinElement.className = 'gpio-pin';
            pinElement.setAttribute('data-pin', pin);
            pinElement.setAttribute('role', 'gridcell');
            pinElement.setAttribute('tabindex', '0');
            pinElement.setAttribute('aria-label', `GPIO Pin ${pin}`);
            
            pinElement.innerHTML = `
                <div class="pin-number">GPIO ${pin}</div>
                <div class="pin-mode"><i>NotSet</i></div>
                <div class="pin-value">-</div>
            `;
            
            pinElement.addEventListener('click', () => this.selectPinForConfig(pin));
            pinElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectPinForConfig(pin);
                }
            });
            
            this.elements.gpioGrid.appendChild(pinElement);
        });
    }
    
    /**
     * Select a pin for configuration
     */
    selectPinForConfig(pin) {
        this.elements.configPin.value = pin;
        this.elements.configPin.focus();
    }
    
    /**
     * Populate dropdown menus
     */
    populateDropdowns() {
        // Configuration pin dropdown
        this.elements.configPin.innerHTML = '<option value="">Select pin...</option>';
        this.VALID_PINS.forEach(pin => {
            const option = document.createElement('option');
            option.value = pin;
            option.textContent = `GPIO ${pin}`;
            this.elements.configPin.appendChild(option);
        });
        
        // PWM pin dropdown
        this.elements.pwmPin.innerHTML = '<option value="">Select PWM pin...</option>';
        this.PWM_PINS.forEach(pin => {
            const option = document.createElement('option');
            option.value = pin;
            option.textContent = `GPIO ${pin}`;
            this.elements.pwmPin.appendChild(option);
        });
        
        // Add all pins to PWM dropdown for software PWM
        this.VALID_PINS.forEach(pin => {
            if (!this.PWM_PINS.includes(pin)) {
                const option = document.createElement('option');
                option.value = pin;
                option.textContent = `GPIO ${pin} (Software)`;
                this.elements.pwmPin.appendChild(option);
            }
        });
    }
    
    /**
     * Update dropdowns based on pin configurations
     */
    updateDropdowns() {
        // Update output pin dropdown
        const outputPins = Object.keys(this.pins).filter(pin => 
            this.pins[pin].configured && this.pins[pin].mode === 'output'
        );
        
        this.elements.outputPin.innerHTML = outputPins.length > 0 ? 
            '<option value="">Select output pin...</option>' : 
            '<option value="">No output pins configured</option>';
            
        outputPins.forEach(pin => {
            const option = document.createElement('option');
            option.value = pin;
            option.textContent = `GPIO ${pin}`;
            this.elements.outputPin.appendChild(option);
        });
        
        // Update input pin dropdown
        const inputPins = Object.keys(this.pins).filter(pin => 
            this.pins[pin].configured && this.pins[pin].mode === 'input'
        );
        
        this.elements.inputPin.innerHTML = inputPins.length > 0 ? 
            '<option value="">Select input pin...</option>' : 
            '<option value="">No input pins configured</option>';
            
        inputPins.forEach(pin => {
            const option = document.createElement('option');
            option.value = pin;
            option.textContent = `GPIO ${pin}`;
            this.elements.inputPin.appendChild(option);
        });
    }
    
    /**
     * Handle pin mode change in configuration
     */
    handleModeChange() {
        const mode = document.querySelector('input[name="pinMode"]:checked').value;
        this.elements.pullResistorGroup.style.display = mode === 'input' ? 'block' : 'none';
    }
    
    /**
     * Handle output pin selection change
     */
    handleOutputPinChange() {
        const pin = this.elements.outputPin.value;
        const hasPin = pin !== '';
        
        this.elements.setHighBtn.disabled = !hasPin;
        this.elements.setLowBtn.disabled = !hasPin;
        this.elements.pulseBtn.disabled = !hasPin;
    }
    
    /**
     * Handle input pin selection change
     */
    handleInputPinChange() {
        const pin = this.elements.inputPin.value;
        const hasPin = pin !== '';
        
        this.elements.toggleMonitorBtn.disabled = !hasPin;
        
        if (hasPin) {
            this.updateInputValue(pin);
            this.elements.toggleMonitorBtn.textContent = this.monitoredPins.has(pin) ? 'Stop Monitor' : 'Start Monitor';
        } else {
            this.elements.inputValue.textContent = '-';
            this.elements.inputValue.className = 'value-indicator';
            this.elements.toggleMonitorBtn.textContent = 'Start Monitor';
        }
    }
    
    /**
     * Handle PWM pin selection change
     */
    handlePwmPinChange() {
        const pin = this.elements.pwmPin.value;
        const hasPin = pin !== '';
        
        this.elements.startPwmBtn.disabled = !hasPin;
        this.elements.stopPwmBtn.disabled = !hasPin || !this.pwmStates[pin];
        
        if (hasPin && this.pwmStates[pin]) {
            this.elements.pwmFrequency.value = this.pwmStates[pin].frequency;
            this.elements.pwmDutyCycle.value = this.pwmStates[pin].duty_cycle;
            this.updateDutyCycleDisplay();
            this.elements.pwmStatus.textContent = `PWM Active: ${this.pwmStates[pin].frequency}Hz, ${this.pwmStates[pin].duty_cycle}%`;
            this.elements.pwmStatus.classList.add('active');
        } else {
            this.elements.pwmStatus.textContent = 'PWM Stopped';
            this.elements.pwmStatus.classList.remove('active');
        }
    }
    
    /**
     * Update duty cycle display
     */
    updateDutyCycleDisplay() {
        this.elements.dutyCycleValue.textContent = this.elements.pwmDutyCycle.value;
    }
    
    /**
     * Connect to server-sent events stream
     */
    connectEventStream() {
        if (this.eventSource) {
            this.eventSource.close();
        }
        
        this.eventSource = new EventSource('/api/events');
        
        this.eventSource.onopen = () => {
            this.isConnected = true;
            this.updateConnectionStatus(true);
        };
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerEvent(data);
            } catch (e) {
                console.error('Error parsing server event:', e);
            }
        };
        
        this.eventSource.onerror = () => {
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Attempt reconnection after delay
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connectEventStream();
                }
            }, 5000);
        };
    }
    
    /**
     * Handle server-sent events
     */
    handleServerEvent(data) {
        switch (data.type) {
            case 'heartbeat':
                // Keep connection alive
                break;
            case 'error':
                this.logActivity(`Server error: ${data.message}`, 'error');
                break;
            default:
                // Regular log events
                if (data.timestamp && data.message) {
                    this.logActivity(data.message, data.level, data.timestamp);
                    
                    // Handle input events
                    if (data.level === 'input') {
                        this.logInputEvent(data.message, data.timestamp);
                    }
                }
                break;
        }
    }
    
    /**
     * Update connection status indicator
     */
    updateConnectionStatus(connected, error = false) {
        const statusDot = this.elements.connectionStatus;
        const statusText = this.elements.backendStatus;
        
        statusDot.className = 'status-dot';
        
        if (error) {
            statusDot.classList.add('error');
            statusText.textContent = 'Connection Error';
        } else if (connected) {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.add('inactive');
            statusText.textContent = 'Disconnected';
        }
    }
    
    /**
     * Refresh pin status from server
     */
    async refreshPinStatus() {
        try {
            const response = await fetch('/api/pins');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            this.pins = data.pins;
            
            // Update backend status
            this.elements.backendStatus.textContent = `Connected (${data.backend})`;
            
            this.updatePinDisplay();
            this.updateDropdowns();
            
        } catch (error) {
            console.error('Error refreshing pin status:', error);
            this.updateConnectionStatus(false, true);
            this.logActivity(`Failed to refresh pin status: ${error.message}`, 'error');
        }
    }
    
    /**
     * Update GPIO pin display
     */
    updatePinDisplay() {
        Object.keys(this.pins).forEach(pin => {
            const pinData = this.pins[pin];
            const pinElement = document.querySelector(`[data-pin="${pin}"]`);
            
            if (pinElement) {
                const modeElement = pinElement.querySelector('.pin-mode');
                const valueElement = pinElement.querySelector('.pin-value');
                
                // Reset classes
                pinElement.className = 'gpio-pin';
                
                if (pinData.configured) {
                    pinElement.classList.add('configured');
                    modeElement.textContent = pinData.mode.toUpperCase();
                    
                    if (pinData.mode === 'output') {
                        pinElement.classList.add(pinData.value ? 'output-high' : 'output-low');
                        valueElement.textContent = pinData.value ? 'HIGH' : 'LOW';
                    } else if (pinData.mode === 'input') {
                        pinElement.classList.add('input');
                        if (pinData.value) {
                            pinElement.classList.add('high');
                        }
                        valueElement.textContent = pinData.value ? 'HIGH' : 'LOW';
                        
                        // Add pull resistor info
                        if (pinData.pull && pinData.pull !== 'off') {
                            modeElement.textContent += ` (${pinData.pull.toUpperCase()})`;
                        }
                    }
                    
                    // Check for PWM
                    if (pinData.pwm && pinData.pwm.active) {
                        pinElement.classList.add('pwm-active');
                        valueElement.textContent = `PWM ${pinData.pwm.duty_cycle}%`;
                        this.pwmStates[pin] = pinData.pwm;
                    }
                } else {
                    modeElement.innerHTML = '<i>Not Set</i>';
                    valueElement.textContent = '-';
                }
            }
        });
        
        // Update current input values
        if (this.elements.inputPin.value) {
            this.updateInputValue(this.elements.inputPin.value);
        }
    }
    
    /**
     * Update input value display
     */
    updateInputValue(pin) {
        const pinData = this.pins[pin];
        if (pinData && pinData.mode === 'input') {
            this.elements.inputValue.textContent = pinData.value ? 'HIGH' : 'LOW';
            this.elements.inputValue.className = `value-indicator ${pinData.value ? 'high' : 'low'}`;
        }
    }
    
    /**
     * Configure a pin
     */
    async configurePin() {
        const pin = this.elements.configPin.value;
        const mode = document.querySelector('input[name="pinMode"]:checked').value;
        const pull = document.querySelector('input[name="pullResistor"]:checked').value;
        
        if (!pin) {
            this.showError('Please select a pin');
            return;
        }
        
        try {
            const response = await fetch('/api/mode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pin: parseInt(pin), mode, pull })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            await this.refreshPinStatus();
            this.logActivity(`Pin ${pin} configured as ${mode}${mode === 'input' && pull !== 'off' ? ` with pull-${pull}` : ''}`);
            
        } catch (error) {
            this.showError(`Failed to configure pin: ${error.message}`);
            this.logActivity(`Configuration failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Set output pin value
     */
    async setOutput(action) {
        const pin = this.elements.outputPin.value;
        
        if (!pin) {
            this.showError('Please select an output pin');
            return;
        }
        
        try {
            const response = await fetch('/api/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pin: parseInt(pin), action })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            await this.refreshPinStatus();
            
        } catch (error) {
            this.showError(`Failed to set output: ${error.message}`);
            this.logActivity(`Output control failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Send pulse to output pin
     */
    async sendPulse() {
        const pin = this.elements.outputPin.value;
        const duration = parseFloat(this.elements.pulseDuration.value);
        const loops = parseFloat(this.elements.loops.value);

        if (!pin) {
            this.showError('Please select an output pin');
            return;
        }

        if (loops < 1 || loops > 20) {
            this.showError('Number of pulses must be between 1 and 20');
            return;
        }
        
        if (duration < 1 || duration > 10000) {
            this.showError('Pulse duration must be between 1 and 10000 ms');
            return;
        }
        
        try {
            const response = await fetch('/api/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    pin: parseInt(pin), 
                    action: 'pulse', 
                    duration: duration,
                    loops: loops
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            // Refresh after pulse completes
            setTimeout(() => this.refreshPinStatus(), duration + 100);
            
        } catch (error) {
            this.showError(`Failed to send pulse: ${error.message}`);
            this.logActivity(`Pulse failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Toggle input monitoring
     */
    async toggleInputMonitor() {
        const pin = this.elements.inputPin.value;
        
        if (!pin) {
            this.showError('Please select an input pin');
            return;
        }
        
        const isMonitoring = this.monitoredPins.has(pin);
        
        try {
            const response = await fetch('/api/monitor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    pin: parseInt(pin), 
                    enable: !isMonitoring 
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            if (isMonitoring) {
                this.monitoredPins.delete(pin);
                this.elements.toggleMonitorBtn.textContent = 'Start Monitor';
            } else {
                this.monitoredPins.add(pin);
                this.elements.toggleMonitorBtn.textContent = 'Stop Monitor';
            }
            
        } catch (error) {
            this.showError(`Failed to toggle monitor: ${error.message}`);
            this.logActivity(`Monitor toggle failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Start PWM on selected pin
     */
    async startPWM() {
        const pin = this.elements.pwmPin.value;
        const frequency = parseFloat(this.elements.pwmFrequency.value);
        const dutyCycle = parseFloat(this.elements.pwmDutyCycle.value);
        
        if (!pin) {
            this.showError('Please select a PWM pin');
            return;
        }
        
        if (frequency < 1 || frequency > 100000) {
            this.showError('Frequency must be between 1 and 100000 Hz');
            return;
        }
        
        try {
            const response = await fetch('/api/pwm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    pin: parseInt(pin), 
                    action: 'start',
                    frequency: frequency,
                    duty_cycle: dutyCycle
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            this.pwmStates[pin] = { frequency, duty_cycle: dutyCycle };
            this.elements.stopPwmBtn.disabled = false;
            this.elements.pwmStatus.textContent = `PWM Active: ${frequency}Hz, ${dutyCycle}%`;
            this.elements.startPwmBtn.textContent = 'Update PWM';
            this.elements.pwmStatus.classList.add('active');
            
            await this.refreshPinStatus();
            
        } catch (error) {
            this.showError(`Failed to start PWM: ${error.message}`);
            this.logActivity(`PWM start failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Stop PWM on selected pin
     */
    async stopPWM() {
        const pin = this.elements.pwmPin.value;
        
        if (!pin) {
            this.showError('Please select a PWM pin');
            return;
        }
        
        try {
            const response = await fetch('/api/pwm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    pin: parseInt(pin), 
                    action: 'stop'
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            delete this.pwmStates[pin];
            this.elements.stopPwmBtn.disabled = true;
            this.elements.pwmStatus.textContent = 'PWM Stopped';
            this.elements.startPwmBtn.textContent = 'Start PWM';
            this.elements.pwmStatus.classList.remove('active');
            
            await this.refreshPinStatus();
            
        } catch (error) {
            this.showError(`Failed to stop PWM: ${error.message}`);
            this.logActivity(`PWM stop failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Reset all pins to safe defaults
     */
    async resetAllPins() {
        if (!confirm('This will reset all configured pins to safe defaults. Continue?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            // Clear local state
            this.monitoredPins.clear();
            this.pwmStates = {};
            
            // Reset UI elements
            this.elements.outputPin.value = '';
            this.elements.inputPin.value = '';
            this.elements.pwmPin.value = '';
            this.handleOutputPinChange();
            this.handleInputPinChange();
            this.handlePwmPinChange();
            
            await this.refreshPinStatus();
            
        } catch (error) {
            this.showError(`Failed to reset pins: ${error.message}`);
            this.logActivity(`Pin reset failed: ${error.message}`, 'error');
        }
    }
    
    /**
     * Log activity message (filtered for important events only)
     */
    logActivity(message, level = 'info', timestamp = null) {
        // Filter out UI-only changes that aren't relevant for GPIO operations
        const uiOnlyMessages = [
            /theme changed/i,
            /activity log cleared/i,
            /clear log/i,
            /dark mode/i,
            /light mode/i
        ];
        
        // Only log errors, warnings, and GPIO-related messages
        const isImportant = level === 'error' || 
                           level === 'warning' || 
                           level === 'input' ||
                           message.toLowerCase().includes('pin') ||
                           message.toLowerCase().includes('gpio') ||
                           message.toLowerCase().includes('pwm') ||
                           message.toLowerCase().includes('reset') ||
                           message.toLowerCase().includes('configur') ||
                           message.toLowerCase().includes('monitor') ||
                           message.toLowerCase().includes('connect') ||
                           message.toLowerCase().includes('backend') ||
                           message.toLowerCase().includes('server') ||
                           message.toLowerCase().includes('failed') ||
                           message.toLowerCase().includes('error') ||
                           message.toLowerCase().includes('started') ||
                           message.toLowerCase().includes('stopped') ||
                           message.toLowerCase().includes('initializ');
        
        // Skip if it's a UI-only message
        if (!isImportant && uiOnlyMessages.some(pattern => pattern.test(message))) {
            return;
        }
        
        // Skip if it's not an important message and not an error/warning
        if (!isImportant) {
            return;
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${level} slide-in`;
        
        const time = timestamp || new Date().toLocaleTimeString();
        logEntry.innerHTML = `
            <span class="timestamp">${time}</span>
            <span class="message">${message}</span>
        `;
        
        this.elements.activityLog.appendChild(logEntry);
        this.elements.activityLog.scrollTop = this.elements.activityLog.scrollHeight;
        
        // Remove old entries if too many
        const entries = this.elements.activityLog.children;
        if (entries.length > 100) {
            entries[0].remove();
        }
    }
    
    /**
     * Log input event to input monitor
     */
    logInputEvent(message, timestamp) {
        if (this.elements.inputEventLog.children.length === 0) {
            this.elements.inputEventLog.innerHTML = ''; // Clear any placeholder text
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry input slide-in';
        logEntry.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="message">${message}</span>
        `;
        
        this.elements.inputEventLog.appendChild(logEntry);
        this.elements.inputEventLog.scrollTop = this.elements.inputEventLog.scrollHeight;
        
        // Remove old entries if too many
        const entries = this.elements.inputEventLog.children;
        if (entries.length > 50) {
            entries[0].remove();
        }
    }
    
    /**
     * Clear activity log
     */
    clearActivityLog() {
        this.elements.activityLog.innerHTML = '';
        // Don't log the clearing action itself since it's UI-only
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.logActivity(`Error: ${message}`, 'error');
        
        // You could also show a toast notification here
        console.error('GPIO Controller Error:', message);
    }
    
    /**
     * Cleanup resources when page unloads
     */
    cleanup() {
        if (this.eventSource) {
            this.eventSource.close();
        }
    }
}

// Initialize the GPIO Controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const controller = new GPIOController();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        controller.cleanup();
    });
    
    // Refresh pin status periodically
    setInterval(() => {
        if (controller.isConnected) {
            controller.refreshPinStatus();
        }
    }, 5000);
    
    // Make controller available globally for debugging
    window.gpioController = controller;
});

// Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Service worker could be added here for offline functionality
    });
}
