      const MAX_PWM_HZ = 10.0;
      const MIN_PWM_HZ = 0.1;
      const VOLTAGE_LIMIT = 3.3;
      const DEFAULT_EQ = "1.65 + 1.65 * sin(x)";

      // Secure Math Parser (No Eval)
      class MathParser {
        constructor(str) {
          this.tokens = this.tokenize(str);
          this.pos = 0;
        }
        tokenize(str) {
          return (
            str
              .replace(/\s+/g, "")
              .match(/([0-9]*\.?[0-9]+|[a-z]+|[+\-*/^()]|x)/gi) || []
          );
        }
        consume() {
          return this.tokens[this.pos++];
        }
        peek() {
          return this.tokens[this.pos];
        }
        parseExpression() {
          let node = this.parseTerm();
          while (this.peek() === "+" || this.peek() === "-") {
            const op = this.consume();
            const right = this.parseTerm();
            const left = node;
            node = (x) =>
              op === "+" ? left(x) + right(x) : left(x) - right(x);
          }
          return node;
        }
        parseTerm() {
          let node = this.parsePower();
          while (this.peek() === "*" || this.peek() === "/") {
            const op = this.consume();
            const right = this.parsePower();
            const left = node;
            node = (x) => {
              const r = right(x);
              return op === "*" ? left(x) * r : r === 0 ? NaN : left(x) / r;
            };
          }
          return node;
        }
        parsePower() {
          let node = this.parseFactor();
          while (this.peek() === "^") {
            this.consume();
            const right = this.parseFactor();
            const left = node;
            node = (x) => Math.pow(left(x), right(x));
          }
          return node;
        }
        parseFactor() {
          const token = this.consume();
          if (token === "(") {
            const node = this.parseExpression();
            this.consume();
            return node;
          }
          if (token === "-") {
            const node = this.parseFactor();
            return (x) => -node(x);
          }
          if (token === "x") return (x) => x;
          if (!isNaN(parseFloat(token))) return (x) => parseFloat(token);
          const fnMap = {
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            abs: Math.abs,
            sqrt: Math.sqrt,
            log: Math.log,
            exp: Math.exp,
          };
          if (fnMap[token]) {
            this.consume();
            const arg = this.parseExpression();
            this.consume();
            return (x) => fnMap[token](arg(x));
          }
          throw new Error();
        }
      }

      const state = {
        eq: DEFAULT_EQ,
        fn: null,
        scanFreq: 1.0,
        isScanning: false,
        scanPos: 0,
        lastTime: 0,
        viewport: { xMin: 0, xMax: 10, yMin: -0.5, yMax: 4.5 },
        points: [],
      };

      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");
      const eqnInput = document.getElementById("eqnInput");
      const speedInput = document.getElementById("speedInput");
      const speedDial = document.getElementById("speedDial");
      const dialProgress = document.getElementById("dialProgress");
      const playBtn = document.getElementById("playBtn");

      function init() {
        window.addEventListener("resize", resize);
        resize();

        // Manual Graph trigger
        document.getElementById("graphBtn").onclick = updateEquation;

        // "ENTER" Key functionality added here
        eqnInput.onkeydown = (e) => {
          if (e.key === "Enter") {
            updateEquation();
            eqnInput.blur(); // Remove focus so graph is the priority
          }
        };

        document.getElementById("resetBtn").onclick = () => {
          state.scanPos = 0;
          updateEquation();
        };
        document.getElementById("exampleSelect").onchange = (e) => {
          eqnInput.value = e.target.value;
          updateEquation();
        };
        playBtn.onclick = () => {
          state.isScanning = !state.isScanning;
          playBtn.innerText = state.isScanning ? "Pause" : "Play";
        };

        let isDragging = false;
        const handleDial = (e) => {
          if (!isDragging) return;
          const rect = speedDial.getBoundingClientRect();
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          const val = Math.max(
            MIN_PWM_HZ,
            Math.min(
              MAX_PWM_HZ,
              state.scanFreq + (rect.top + rect.height / 2 - clientY) * 0.05,
            ),
          );
          setFreq(val);
        };
        speedDial.onmousedown = speedDial.ontouchstart = () =>
          (isDragging = true);
        window.onmouseup = window.ontouchend = () => (isDragging = false);
        window.onmousemove = window.ontouchmove = handleDial;
        speedInput.onchange = (e) => setFreq(parseFloat(e.target.value));

        eqnInput.value = state.eq;
        setFreq(1.0);
        updateEquation();
        requestAnimationFrame(animate);
      }

      function setFreq(v) {
        state.scanFreq = Math.max(MIN_PWM_HZ, Math.min(MAX_PWM_HZ, v || 0));
        speedInput.value = state.scanFreq.toFixed(1);
        dialProgress.style.strokeDashoffset =
          126 -
          ((state.scanFreq - MIN_PWM_HZ) / (MAX_PWM_HZ - MIN_PWM_HZ)) * 126;
      }

      function updateEquation() {
        try {
          state.fn = new MathParser(eqnInput.value).parseExpression();
          state.points = [];
          for (let i = 0; i <= 500; i++) {
            let x = i * (state.viewport.xMax / 500);
            state.points.push({ x, y: state.fn(x) });
          }
          document.getElementById("errorMsg").style.display = "none";

          // Auto-pause scan if equation is changed to prevent weird behavior
          state.isScanning = false;
          playBtn.innerText = "Play";
        } catch (e) {
          document.getElementById("errorMsg").style.display = "block";
        }
      }

      function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
      }

      function toScreen(x, y) {
        return {
          x: (x / state.viewport.xMax) * window.innerWidth,
          y:
            window.innerHeight -
            ((y - state.viewport.yMin) /
              (state.viewport.yMax - state.viewport.yMin)) *
              window.innerHeight,
        };
      }

      function animate(t) {
        const dt = (t - state.lastTime) / 1000;
        state.lastTime = t;
        if (state.isScanning)
          state.scanPos = (state.scanPos + dt * (state.scanFreq / 5)) % 1;
        draw();
        updateReadout();
        requestAnimationFrame(animate);
      }

      function draw() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // Pi Safe Range (0-3.3V)
        ctx.fillStyle = "rgba(0, 255, 157, 0.04)";
        const s0 = toScreen(0, 0).y,
          sMax = toScreen(0, VOLTAGE_LIMIT).y;
        ctx.fillRect(0, sMax, window.innerWidth, s0 - sMax);

        // GRID LINES
        ctx.strokeStyle = "#1a1d21";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
          let x = (i / 10) * window.innerWidth;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, window.innerHeight);
          ctx.stroke();
        }
        for (let i = 0; i <= 10; i++) {
          let yVal =
            state.viewport.yMin +
            (i * (state.viewport.yMax - state.viewport.yMin)) / 10;
          let yPos = toScreen(0, yVal).y;
          ctx.beginPath();
          ctx.moveTo(0, yPos);
          ctx.lineTo(window.innerWidth, yPos);
          ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = "#30363d";
        ctx.lineWidth = 2;
        const axOrigin = toScreen(0, 0);
        ctx.beginPath();
        ctx.moveTo(0, axOrigin.y);
        ctx.lineTo(window.innerWidth, axOrigin.y);
        ctx.stroke();

        // The Signal Curve
        if (state.points.length) {
          ctx.strokeStyle = "#00ff9d";
          ctx.lineWidth = 2.5;
          ctx.lineJoin = "round";
          ctx.beginPath();
          state.points.forEach((p, i) => {
            const s = toScreen(p.x, p.y);
            if (i === 0 || isNaN(p.y) || !isFinite(p.y)) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
        }

        // Scanning Cursor
        ctx.strokeStyle = "#fff";
        ctx.setLineDash([5, 5]);
        const scanX = state.scanPos * window.innerWidth;
        ctx.beginPath();
        ctx.moveTo(scanX, 0);
        ctx.lineTo(scanX, window.innerHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      function updateReadout() {
        const x = state.scanPos * state.viewport.xMax;
        let y = state.fn ? state.fn(x) : 0;
        const safeV = Math.max(0, Math.min(VOLTAGE_LIMIT, isNaN(y) ? 0 : y));
        document.getElementById("valX").innerText = x.toFixed(2);
        document.getElementById("valVolts").innerText = safeV.toFixed(2);
        document.getElementById("valDuty").innerText = (
          (safeV / VOLTAGE_LIMIT) *
          100
        ).toFixed(1);
      }

      // Populate GPIO select dropdown for graph control
      function populateGraphGpioDropdown() {
        fetch('/api/pins')
          .then(res => res.json())
          .then(data => {
            const select = document.getElementById('graphGpioSelect');
            if (!select) return;
            select.innerHTML = '<option value="">Select PWM pin...</option>';
            // Prefer hardware PWM pins, then all valid pins as software
            (data.pwm_pins || []).forEach(pin => {
              const opt = document.createElement('option');
              opt.value = pin;
              opt.textContent = `GPIO ${pin}`;
              select.appendChild(opt);
            });
            (data.valid_pins || []).forEach(pin => {
              if (!(data.pwm_pins || []).includes(pin)) {
                const opt = document.createElement('option');
                opt.value = pin;
                opt.textContent = `GPIO ${pin} (Software)`;
                select.appendChild(opt);
              }
            });
          });
      }

      populateGraphGpioDropdown();
      // --- Real-time voltage streaming integration ---
      let graphStreamSource = null;

      function startGraphStreaming() {
        if (graphStreamSource) {
          graphStreamSource.close();
          graphStreamSource = null;
        }
        const select = document.getElementById('graphGpioSelect');
        const pin = select && select.value ? parseInt(select.value) : null;
        if (!pin) return;
        const eqn = document.getElementById('eqnInput').value;
        const freq = parseFloat(document.getElementById('speedInput').value) || 1.0;
        const duration = state.viewport.xMax;
        const sample_rate = 60;
        const x_max = state.viewport.xMax;

        const streamParams = {
          equation: eqn,
          frequency: freq,
          duration: duration,
          pin: pin,
          sample_rate: sample_rate,
          x_max: x_max
        };

        graphStreamSource = new EventSourcePolyfill('/api/graph/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(streamParams)
        });
        
        graphStreamSource.onmessage = function(event) {
          try {
            // Parse JSON data from server
            const data = JSON.parse(event.data);
            if (data.error) {
              console.error('Stream error:', data.error);
              return;
            }
            // Data is in the format: {'t': ..., 'x': ..., 'y': ..., 'duty': ...}
            document.getElementById('valVolts').innerText = parseFloat(data.y).toFixed(2);
            document.getElementById('valX').innerText = parseFloat(data.x).toFixed(2);
            document.getElementById('valDuty').innerText = parseFloat(data.duty).toFixed(1);
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        };
        
        graphStreamSource.onerror = function(error) {
          console.error('Stream connection error:', error);
          if (graphStreamSource) graphStreamSource.close();
          graphStreamSource = null;
        };
      }

      // Polyfill for EventSource with POST (since native EventSource only supports GET)
      function EventSourcePolyfill(url, options) {
        const xhr = new XMLHttpRequest();
        const method = (options && options.method) || 'GET';
        xhr.open(method, url, true);
        
        // Set headers
        if (options && options.headers) {
          for (const k in options.headers) {
            xhr.setRequestHeader(k, options.headers[k]);
          }
        }
        
        let listeners = {};
        let buffer = '';
        
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            // Process response text
            const responseText = xhr.responseText;
            buffer += responseText.substring(buffer.length);
            
            // Split by double newline (SSE format)
            const lines = buffer.split('\n\n');
            
            // Keep the last incomplete line in buffer
            buffer = lines[lines.length - 1];
            
            // Process complete messages
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];
              if (line.startsWith('data:')) {
                const data = line.slice(5).trim();
                if (listeners['message']) {
                  listeners['message']({ data: data });
                }
              }
            }
          }
        };
        
        xhr.onerror = function() {
          if (listeners['error']) {
            listeners['error']({ type: 'error' });
          }
        };
        
        xhr.onload = function() {
          if (listeners['load']) {
            listeners['load']({ type: 'load' });
          }
        };
        
        // Send request with body if provided
        const body = (options && options.body) ? options.body : null;
        xhr.send(body);
        
        // Public API
        this.close = function() { 
          try {
            xhr.abort();
          } catch (e) {}
        };
        
        this.onmessage = null;
        this.onerror = null;
        this.onload = null;
        
        // Store listeners
        Object.defineProperty(this, 'onmessage', {
          set: function(handler) {
            listeners['message'] = (e) => {
              if (handler) handler(e);
            };
          },
          get: function() {
            return listeners['message'];
          }
        });
        
        Object.defineProperty(this, 'onerror', {
          set: function(handler) {
            listeners['error'] = (e) => {
              if (handler) handler(e);
            };
          },
          get: function() {
            return listeners['error'];
          }
        });
      }

      // Hook into Play button
      function patchPlayButton() {
        const playBtn = document.getElementById('playBtn');
        if (!playBtn) return;
        const origClick = playBtn.onclick;
        playBtn.onclick = function() {
          state.isScanning = !state.isScanning;
          playBtn.innerText = state.isScanning ? "Pause" : "Play";
          if (state.isScanning) {
            startGraphStreaming();
          } else {
            if (graphStreamSource) graphStreamSource.close();
            graphStreamSource = null;
          }
        };
      }

      populateGraphGpioDropdown();
      patchPlayButton();
      init();