# Raspberry Pi Web GPIO Controller

A complete web-based GPIO controller for Raspberry Pi with real-time monitoring, PWM control, and a modern interface.

## One-Step Installation

Run the following command in your Raspberry Pi terminal

```bash
curl -sL https://github.com/your/repo.git | bash
```

## Alternative Installation Methods

For custom installation to review and change python scripts as per your setup, clone and install the git repo as follows

```bash
git clone https://github.com/your/repo.git
cd RaspberryPI-GPIO-Web-Controller/
chmod +x ./install.sh
./intstall.sh
```

## Requirements

- Python 3.7 or higher
- Curl
- Packages listed in `requirements.txt`

## Running the Application

### Autostart:

For default installation the script will autostart on boot

### Manual Start:

If autostart is disabled at installation type the following command to start the server

```bash
$ webgpio
```

### Access the Interface:

1. Open a web browser
2. Navigate to `http://localhost:5000` (local) or `http://[PI_IP_ADDRESS]:5000` (network)

## File Structure

```
Final/
├── app.py                      # Flask backend application
├── requirements.txt            # Python dependencies
├── templates/
│   └── index.html             # Main HTML template
└── static/
    ├── css/
    │   └── styles.css
    └── js/
        └── app.js
```

## Features

- **Visual GPIO Grid**: Real-time status display of all GPIO pins
- **Input Monitoring**: Live monitoring with event logging for input pins with pull-resistor options
- **Output Control**: Set Output signal to HIGH, LOW or send a pulse
- **PWM Control**: Hardware and software PWM with frequency and duty cycle control
- **Real-time Updates**: Server-Sent Events for live status updates
- **Activity Logging**: Comprehensive logging of all user actions and system events
- **Modern Interface**: User friendly design that works on desktop, tablet, and mobile devices

### API Endpoints

- `GET /api/pins` - Get status of all GPIO pins
- `POST /api/mode` - Configure pin mode (input/output)
- `POST /api/write` - Set output values or send pulses
- `POST /api/pwm` - Control PWM (start/stop/configure)
- `POST /api/monitor` - Toggle input pin monitoring
- `POST /api/reset` - Reset all pins to safe defaults
- `GET /api/events` - Server-Sent Events stream for real-time updates

### Keyboard Shortcuts

- `Ctrl+D` (or `Cmd+D` on Mac) - Toggle dark mode
- `Ctrl+R` (or `Cmd+R` on Mac) - Reset all pins
- `Enter`/`Space` on GPIO pins - Select for configuration
- `Tab` - Navigate between controls

## Browser Compatibility

- Modern browsers with ES6+ support
- Chrome/Chromium 70+
- Firefox 65+
- Safari 12+
- Edge 79+
