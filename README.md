# Raspberry Pi Web GPIO Controller

A complete web-based GPIO controller for Raspberry Pi with real-time monitoring, PWM control, and a modern interface.

## One-Step Installation

Run the following code in your Raspberry Pi

```bash
curl -sL https://raw.githubusercontent.com/SiddhantSilwal/RaspberryPI-GPIO-Web-Controller/refs/heads/main/webinstaller.sh | bash
```

## Alternative Installation Methods

For custom

```bash
git clone https://github.com/SiddhantSilwal/RaspberryPI-GPIO-Web-Controller.git
cd RaspberryPI-GPIO-Web-Controller/
chmod +x ./install.sh
./intstall.sh
```

## Requirements

- Python 3.7 or higher
- Packages listed in `requirements.txt`

## Running the Application

### Autostart:

For default installation the script will autostart on boot

### Manual Start:

If autostart is disabled at installation type the following command to start the server

```bash
$ rwgpio
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

## API Endpoints

- `GET /api/pins` - Get status of all GPIO pins
- `POST /api/mode` - Configure pin mode (input/output)
- `POST /api/write` - Set output values or send pulses
- `POST /api/pwm` - Control PWM (start/stop/configure)
- `POST /api/monitor` - Toggle input pin monitoring
- `POST /api/reset` - Reset all pins to safe defaults
- `GET /api/events` - Server-Sent Events stream for real-time updates

## Keyboard Shortcuts

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
