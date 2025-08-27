#!/usr/bin/env python3

from flask import Flask, render_template, request, jsonify, Response
import json
import time
import threading
import queue
import atexit
from datetime import datetime
import traceback

# GPIO Backend Selection and Initialization
GPIO_BACKEND = None
IS_PI = False

# Try gpiozero first (preferred), then RPi.GPIO, then mock
try:
    from gpiozero import OutputDevice, InputDevice, PWMOutputDevice, Device
    from gpiozero.pins.mock import MockFactory
    
    # Check if we're on a real Pi
    try:
        Device.ensure_pin_factory()
        if hasattr(Device.pin_factory, 'chips') or 'mock' not in str(type(Device.pin_factory)):
            IS_PI = True
    except:
        Device.pin_factory = MockFactory()
        IS_PI = False
    
    GPIO_BACKEND = 'gpiozero'
    
except ImportError:
    try:
        import RPi.GPIO as GPIO
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        GPIO_BACKEND = 'RPi.GPIO'
        IS_PI = True
    except (ImportError, RuntimeError):
        GPIO_BACKEND = 'mock'
        IS_PI = False
        
        # Mock GPIO for testing on non-Pi systems
        class MockGPIO:
            BCM = OUT = IN = HIGH = LOW = PUD_UP = PUD_DOWN = PUD_OFF = 1
            _pins = {}
            
            def setmode(self, mode): pass
            def setwarnings(self, flag): pass
            def setup(self, pin, mode, pull_up_down=None): 
                self._pins[pin] = {'mode': mode, 'value': 0, 'pull': pull_up_down}
            def output(self, pin, value): 
                if pin in self._pins: self._pins[pin]['value'] = value
            def input(self, pin): 
                return self._pins.get(pin, {}).get('value', 0)
            def PWM(self, pin, freq): 
                return type('PWM', (), {'start': lambda duty: None, 'stop': lambda: None, 'ChangeDutyCycle': lambda duty: None})()
            def cleanup(self): self._pins.clear()
        
        GPIO = MockGPIO()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'gpio-controller-key-2025'

# Global state management
pin_states = {}  # pin -> {'mode': 'input/output', 'value': 0/1, 'pull': 'up/down/off', 'device': device_obj}
pwm_devices = {}  # pin -> {'device': pwm_obj, 'frequency': Hz, 'duty_cycle': %}
input_monitors = set()  # pins being monitored for changes
event_queue = queue.Queue()  # for SSE events
monitor_thread = None
monitor_running = False

# Valid GPIO pins (BCM numbering) for Raspberry Pi
VALID_PINS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
# Hardware PWM capable pins (varies by Pi model, but these are common)
PWM_PINS = [12, 13, 18, 19]

def log_event(message, level='info'):
    """Add event to log with timestamp"""
    timestamp = datetime.now().strftime('%H:%M:%S')
    event = {
        'timestamp': timestamp,
        'message': message,
        'level': level
    }
    try:
        event_queue.put_nowait(event)
    except queue.Full:
        pass  # Drop events if queue is full

def cleanup_pin(pin):
    """Safely cleanup a single pin"""
    try:
        if pin in pin_states:
            device = pin_states[pin].get('device')
            if device and hasattr(device, 'close'):
                device.close()
            del pin_states[pin]
        
        if pin in pwm_devices:
            pwm_device = pwm_devices[pin].get('device')
            if pwm_device and hasattr(pwm_device, 'close'):
                pwm_device.close()
            del pwm_devices[pin]
            
    except Exception as e:
        log_event(f"Error cleaning up pin {pin}: {str(e)}", 'error')

def cleanup_all():
    """Cleanup all GPIO resources"""
    global monitor_running
    monitor_running = False
    
    for pin in list(pin_states.keys()):
        cleanup_pin(pin)
    
    for pin in list(pwm_devices.keys()):
        cleanup_pin(pin)
    
    if GPIO_BACKEND == 'RPi.GPIO':
        try:
            GPIO.cleanup()
        except:
            pass
    
    log_event("GPIO cleanup completed", 'info')

def input_monitor_worker():
    """Background thread to monitor input pins for changes"""
    global monitor_running
    previous_states = {}
    
    while monitor_running:
        try:
            for pin in list(input_monitors):
                if pin in pin_states and pin_states[pin]['mode'] == 'input':
                    try:
                        current_value = read_pin_value(pin)
                        previous_value = previous_states.get(pin, current_value)
                        
                        if current_value != previous_value:
                            edge_type = 'rising' if current_value > previous_value else 'falling'
                            log_event(f"Pin {pin} {edge_type} edge detected (value: {current_value})", 'input')
                            previous_states[pin] = current_value
                    except Exception as e:
                        log_event(f"Error monitoring pin {pin}: {str(e)}", 'error')
            
            time.sleep(0.1)  # 100ms polling interval
            
        except Exception as e:
            log_event(f"Monitor thread error: {str(e)}", 'error')
            time.sleep(1)

def read_pin_value(pin):
    """Read current value from a pin"""
    if GPIO_BACKEND == 'gpiozero':
        device = pin_states.get(pin, {}).get('device')
        if device:
            return 1 if device.value else 0
        return 0
    elif GPIO_BACKEND == 'RPi.GPIO':
        return GPIO.input(pin)
    else:  # mock
        return GPIO.input(pin)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/pins', methods=['GET'])
def get_pins():
    """Get status of all configured pins"""
    try:
        pins_data = {}
        
        for pin in VALID_PINS:
            if pin in pin_states:
                state = pin_states[pin]
                pins_data[pin] = {
                    'mode': state['mode'],
                    'value': read_pin_value(pin) if state['mode'] == 'input' else state.get('value', 0),
                    'pull': state.get('pull', 'off'),
                    'configured': True
                }
            else:
                pins_data[pin] = {
                    'mode': 'unconfigured',
                    'value': 0,
                    'pull': 'off',
                    'configured': False
                }
        
        # Add PWM status
        for pin, pwm_info in pwm_devices.items():
            if pin in pins_data:
                pins_data[pin]['pwm'] = {
                    'active': True,
                    'frequency': pwm_info['frequency'],
                    'duty_cycle': pwm_info['duty_cycle']
                }
        
        return jsonify({
            'pins': pins_data,
            'backend': GPIO_BACKEND,
            'is_pi': IS_PI,
            'valid_pins': VALID_PINS,
            'pwm_pins': PWM_PINS
        })
        
    except Exception as e:
        log_event(f"Error getting pin status: {str(e)}", 'error')
        return jsonify({'error': str(e)}), 500

@app.route('/api/mode', methods=['POST'])
def set_pin_mode():
    """Configure a pin as input or output"""
    try:
        data = request.get_json()
        pin = int(data['pin'])
        mode = data['mode'].lower()
        pull = data.get('pull', 'off').lower()
        
        if pin not in VALID_PINS:
            return jsonify({'error': f'Invalid pin {pin}'}), 400
        
        if mode not in ['input', 'output']:
            return jsonify({'error': f'Invalid mode {mode}'}), 400
        
        # Cleanup existing configuration
        cleanup_pin(pin)
        
        # Configure new mode
        if GPIO_BACKEND == 'gpiozero':
            if mode == 'output':
                device = OutputDevice(pin)
                pin_states[pin] = {
                    'mode': 'output',
                    'value': 0,
                    'pull': 'off',
                    'device': device
                }
            else:  # input
                pull_up = None if pull == 'off' else (pull == 'up')
                device = InputDevice(pin, pull_up=pull_up)
                pin_states[pin] = {
                    'mode': 'input',
                    'value': 0,
                    'pull': pull,
                    'device': device
                }
                
        elif GPIO_BACKEND == 'RPi.GPIO':
            if mode == 'output':
                GPIO.setup(pin, GPIO.OUT)
                pin_states[pin] = {
                    'mode': 'output',
                    'value': 0,
                    'pull': 'off',
                    'device': None
                }
            else:  # input
                pull_config = GPIO.PUD_OFF
                if pull == 'up':
                    pull_config = GPIO.PUD_UP
                elif pull == 'down':
                    pull_config = GPIO.PUD_DOWN
                
                GPIO.setup(pin, GPIO.IN, pull_up_down=pull_config)
                pin_states[pin] = {
                    'mode': 'input',
                    'value': 0,
                    'pull': pull,
                    'device': None
                }
        else:  # mock
            GPIO.setup(pin, getattr(GPIO, mode.upper()), 
                      pull_up_down=getattr(GPIO, f'PUD_{pull.upper()}', GPIO.PUD_OFF))
            pin_states[pin] = {
                'mode': mode,
                'value': 0,
                'pull': pull,
                'device': None
            }
        
        log_event(f"Pin {pin} configured as {mode}" + (f" with pull-{pull}" if mode == 'input' and pull != 'off' else ""))
        return jsonify({'success': True})
        
    except Exception as e:
        error_msg = f"Error configuring pin: {str(e)}"
        log_event(error_msg, 'error')
        return jsonify({'error': error_msg}), 500

@app.route('/api/write', methods=['POST'])
def write_pin():
    """Set output pin high/low or send pulse"""
    try:
        data = request.get_json()
        pin = int(data['pin'])
        action = data['action'].lower()
        
        if pin not in pin_states or pin_states[pin]['mode'] != 'output':
            return jsonify({'error': f'Pin {pin} is not configured as output'}), 400
        
        if action in ['high', 'low']:
            value = 1 if action == 'high' else 0
            
            if GPIO_BACKEND == 'gpiozero':
                device = pin_states[pin]['device']
                if value:
                    device.on()
                else:
                    device.off()
            elif GPIO_BACKEND == 'RPi.GPIO':
                GPIO.output(pin, GPIO.HIGH if value else GPIO.LOW)
            else:  # mock
                GPIO.output(pin, value)
            
            pin_states[pin]['value'] = value
            log_event(f"Pin {pin} set to {action.upper()}")
            
        elif action == 'pulse':
            duration = float(data.get('duration', 100)) / 1000.0  # ON time in seconds
            loops = int(data.get('loops', 5))
            off_time = duration  
            if GPIO_BACKEND == 'gpiozero':
                device = pin_states[pin]['device']
                for _ in range(loops):
                    device.on()
                    time.sleep(duration)
                    device.off()
                    time.sleep(off_time)
            elif GPIO_BACKEND == 'RPi.GPIO':
                for _ in range(loops):
                    GPIO.output(pin, GPIO.HIGH)
                    time.sleep(duration)
                    GPIO.output(pin, GPIO.LOW)
                    time.sleep(off_time)
            else:  # mock
                for _ in range(loops):
                    GPIO.output(pin, 1)
                    time.sleep(duration)
                    GPIO.output(pin, 0)
                    time.sleep(off_time)
            
            pin_states[pin]['value'] = 0  # Pulse ends in LOW state
            log_event(f"Pin {pin} pulsed for {duration*1000:.1f}ms")
            
        else:
            return jsonify({'error': f'Invalid action {action}'}), 400
        
        return jsonify({'success': True})
        
    except Exception as e:
        error_msg = f"Error writing to pin: {str(e)}"
        log_event(error_msg, 'error')
        return jsonify({'error': error_msg}), 500

@app.route('/api/pwm', methods=['POST'])
def control_pwm():
    """Start/stop/configure PWM on a pin"""
    try:
        data = request.get_json()
        pin = int(data['pin'])
        action = data['action'].lower()
        
        if pin not in VALID_PINS:
            return jsonify({'error': f'Invalid pin {pin}'}), 400
        
        if action == 'start':
            frequency = float(data.get('frequency', 1000))
            duty_cycle = float(data.get('duty_cycle', 50))
            
            if duty_cycle < 0 or duty_cycle > 100:
                return jsonify({'error': 'Duty cycle must be 0-100%'}), 400
            
            # Stop existing PWM if running
            if pin in pwm_devices:
                old_device = pwm_devices[pin]['device']
                if hasattr(old_device, 'close'):
                    old_device.close()
            
            # Cleanup regular pin configuration
            cleanup_pin(pin)
            
            if GPIO_BACKEND == 'gpiozero':
                pwm_device = PWMOutputDevice(pin, frequency=frequency)
                pwm_device.value = duty_cycle / 100.0
                
            elif GPIO_BACKEND == 'RPi.GPIO':
                GPIO.setup(pin, GPIO.OUT)
                pwm_device = GPIO.PWM(pin, frequency)
                pwm_device.start(duty_cycle)
                
            else:  # mock
                pwm_device = GPIO.PWM(pin, frequency)
                pwm_device.start(duty_cycle)
            
            pwm_devices[pin] = {
                'device': pwm_device,
                'frequency': frequency,
                'duty_cycle': duty_cycle
            }
            
            log_event(f"PWM started on pin {pin}: {frequency}Hz, {duty_cycle}% duty cycle")
            
        elif action == 'stop':
            if pin in pwm_devices:
                pwm_device = pwm_devices[pin]['device']
                
                if GPIO_BACKEND == 'gpiozero':
                    pwm_device.close()
                elif GPIO_BACKEND == 'RPi.GPIO':
                    pwm_device.stop()
                else:  # mock
                    pwm_device.stop()
                
                del pwm_devices[pin]
                log_event(f"PWM stopped on pin {pin}")
            
        elif action == 'update':
            if pin not in pwm_devices:
                return jsonify({'error': f'PWM not active on pin {pin}'}), 400
            
            pwm_info = pwm_devices[pin]
            pwm_device = pwm_info['device']
            
            if 'frequency' in data:
                frequency = float(data['frequency'])
                pwm_info['frequency'] = frequency
                if GPIO_BACKEND == 'gpiozero':
                    pwm_device.frequency = frequency
                # RPi.GPIO doesn't support frequency changes after start
            
            if 'duty_cycle' in data:
                duty_cycle = float(data['duty_cycle'])
                if duty_cycle < 0 or duty_cycle > 100:
                    return jsonify({'error': 'Duty cycle must be 0-100%'}), 400
                
                pwm_info['duty_cycle'] = duty_cycle
                
                if GPIO_BACKEND == 'gpiozero':
                    pwm_device.value = duty_cycle / 100.0
                elif GPIO_BACKEND == 'RPi.GPIO':
                    pwm_device.ChangeDutyCycle(duty_cycle)
                
                log_event(f"PWM updated on pin {pin}: {duty_cycle}% duty cycle")
        
        return jsonify({'success': True})
        
    except Exception as e:
        error_msg = f"Error controlling PWM: {str(e)}"
        log_event(error_msg, 'error')
        return jsonify({'error': error_msg}), 500

@app.route('/api/monitor', methods=['POST'])
def toggle_monitor():
    """Toggle input monitoring for a pin"""
    try:
        data = request.get_json()
        pin = int(data['pin'])
        enable = data.get('enable', True)
        
        if pin not in pin_states or pin_states[pin]['mode'] != 'input':
            return jsonify({'error': f'Pin {pin} is not configured as input'}), 400
        
        if enable:
            input_monitors.add(pin)
            log_event(f"Started monitoring pin {pin}")
        else:
            input_monitors.discard(pin)
            log_event(f"Stopped monitoring pin {pin}")
        
        return jsonify({'success': True, 'monitoring': pin in input_monitors})
        
    except Exception as e:
        error_msg = f"Error toggling monitor: {str(e)}"
        log_event(error_msg, 'error')
        return jsonify({'error': error_msg}), 500

@app.route('/api/reset', methods=['POST'])
def reset_all_pins():
    """Reset all pins to safe defaults (inputs with pull-down)"""
    try:
        # Stop all monitoring
        input_monitors.clear()
        
        # Cleanup all pins
        cleanup_all()
        
        log_event("All pins reset to safe defaults", 'info')
        return jsonify({'success': True})
        
    except Exception as e:
        error_msg = f"Error resetting pins: {str(e)}"
        log_event(error_msg, 'error')
        return jsonify({'error': error_msg}), 500

@app.route('/api/events')
def event_stream():
    """Server-Sent Events endpoint for real-time updates"""
    def generate():
        try:
            while True:
                try:
                    # Wait for events with timeout
                    event = event_queue.get(timeout=30)
                    yield f"data: {json.dumps(event)}\n\n"
                except queue.Empty:
                    # Send heartbeat to keep connection alive
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
                    break
        except GeneratorExit:
            pass
    
    return Response(generate(), mimetype='text/plain', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    })

# Initialize application
def init_app():
    """Initialize the GPIO controller application"""
    global monitor_thread, monitor_running
    
    # Start input monitor thread
    monitor_running = True
    monitor_thread = threading.Thread(target=input_monitor_worker, daemon=True)
    monitor_thread.start()
    
    log_event(f"GPIO Controller started (Backend: {GPIO_BACKEND}, Pi: {IS_PI})", 'info')

# Cleanup on exit
atexit.register(cleanup_all)

if __name__ == '__main__':
    init_app()
    
    # Run Flask app
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
    except KeyboardInterrupt:
        log_event("Application stopped by user", 'info')
    finally:
        cleanup_all()
