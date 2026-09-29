/**
 * Motor Gráfico Avançado de Simulação & Visão Computacional - Lagoinha Alphaville
 * Padrão Apple HIG com Suporte a:
 *  - Câmera Real CCTV (Perspectiva Óptica de Segurança)
 *  - Visão de Satélite / Ortofoto Aérea HD
 *  - Simulação Procedural Vetorial
 *  - Heatmap Dinâmico de Densidade
 *  - Zoom Digital (1x / 1.5x / 2x) & Snapshot Export
 *  - Filtros Térmicos (FLIR), Noturno (IR) e Grade de Homografia
 */

class ParkingSimulator {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    this.width = 1280;
    this.height = 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Fundos carregados só quando desenhados pela primeira vez: são 2,2 MB que o portal não usa.
    // Mantidos em JPEG original para preservar o manifesto C2PA de procedência (ver IMAGE_SOURCES.md).
    this.backgroundSources = { cctv_real: 'assets/cctv_lagoinha.jpg', satellite_real: 'assets/satellite_lagoinha.jpg' };
    this.backgroundImages = {};

    // State & Modes
    this.visible = true; // o app desliga o desenho do canvas enquanto o painel está oculto
    this.isRunning = true;
    this.isSignalLost = false;
    this.weatherCondition = 'clear'; // 'clear' | 'rain' | 'night'
    this.visionFilter = 'normal'; // 'normal' | 'thermal' | 'night_vision' | 'grid'
    this.activeSource = 'cctv_real'; // 'cctv_real' | 'satellite_real' | 'synthetic' | 'local_video'
    this.localVideoElement = null;

    // Camera Features: Zoom & Heatmap
    this.zoomLevel = 1.0; // 1.0 | 1.5 | 2.0
    this.showHeatmap = false;
    this.isPresentationMode = false;

    // Dynamic car density modifiers
    this.cctvOccupancyModifier = 0;

    // Simulation Vehicles for Synthetic mode
    this.vehicles = [];
    this.spawnTimer = 0;
    this.spawnRate = 90;
    this.maxVehicles = 24;

    this.carColors = [
      '#ffffff', '#1e293b', '#cbd5e1', '#94a3b8', 
      '#dc2626', '#2563eb', '#475569', '#0f172a', '#b91c1c'
    ];

    this.initDefaultSimulationScene();
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    // Base calibrated vehicle detection spots on the official Lagoinha Alphaville CCTV image
    this.cctvCarSpots = [
      // Left Cluster (Sector A - Fileiras em frente ao auditório)
      { x: 0.03, y: 0.84, w: 0.05, h: 0.07, conf: 0.95 },
      { x: 0.07, y: 0.78, w: 0.05, h: 0.07, conf: 0.94 },
      { x: 0.12, y: 0.72, w: 0.055, h: 0.07, conf: 0.96 },
      { x: 0.17, y: 0.66, w: 0.05, h: 0.065, conf: 0.93 },
      { x: 0.22, y: 0.61, w: 0.045, h: 0.06, conf: 0.91 },
      { x: 0.26, y: 0.56, w: 0.04, h: 0.055, conf: 0.90 },
      { x: 0.31, y: 0.52, w: 0.035, h: 0.05, conf: 0.89 },
      { x: 0.13, y: 0.92, w: 0.07, h: 0.08, conf: 0.97 },
      { x: 0.19, y: 0.85, w: 0.06, h: 0.075, conf: 0.95 },
      { x: 0.25, y: 0.77, w: 0.055, h: 0.07, conf: 0.94 },
      { x: 0.30, y: 0.70, w: 0.05, h: 0.065, conf: 0.92 },
      { x: 0.35, y: 0.64, w: 0.045, h: 0.06, conf: 0.91 },
      { x: 0.39, y: 0.58, w: 0.04, h: 0.055, conf: 0.90 },
      { x: 0.25, y: 0.93, w: 0.07, h: 0.08, conf: 0.96 },
      { x: 0.32, y: 0.86, w: 0.065, h: 0.075, conf: 0.95 },
      { x: 0.38, y: 0.79, w: 0.06, h: 0.07, conf: 0.94 },
      { x: 0.43, y: 0.72, w: 0.05, h: 0.065, conf: 0.92 },
      
      // Right Cluster (Sector B - Pátio Lateral)
      { x: 0.61, y: 0.87, w: 0.065, h: 0.08, conf: 0.96 },
      { x: 0.64, y: 0.79, w: 0.06, h: 0.075, conf: 0.95 },
      { x: 0.67, y: 0.71, w: 0.055, h: 0.07, conf: 0.93 },
      { x: 0.70, y: 0.64, w: 0.05, h: 0.065, conf: 0.92 },
      { x: 0.73, y: 0.58, w: 0.045, h: 0.06, conf: 0.90 },
      { x: 0.75, y: 0.88, w: 0.065, h: 0.08, conf: 0.97 },
      { x: 0.78, y: 0.80, w: 0.06, h: 0.075, conf: 0.95 },
      { x: 0.80, y: 0.72, w: 0.055, h: 0.07, conf: 0.94 },
      { x: 0.83, y: 0.65, w: 0.05, h: 0.065, conf: 0.91 },
      { x: 0.88, y: 0.85, w: 0.065, h: 0.08, conf: 0.96 },
      { x: 0.90, y: 0.76, w: 0.06, h: 0.075, conf: 0.94 },
      { x: 0.92, y: 0.68, w: 0.055, h: 0.07, conf: 0.92 },

      // Central Corridor Vehicle
      { x: 0.52, y: 0.75, w: 0.05, h: 0.065, conf: 0.92 }
    ];

    // Base calibrated vehicle detection spots on the Satellite image of Alphaville
    this.satCarSpots = [];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 12; c++) {
        this.satCarSpots.push({
          x: 0.22 + c * 0.024,
          y: 0.32 + r * 0.07,
          w: 0.018,
          h: 0.038,
          conf: 0.88 + Math.random() * 0.09
        });
      }
    }

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setSource(source) {
    this.activeSource = source;
  }

  setVisionFilter(filter) {
    this.visionFilter = filter;
  }

  setZoom(level) {
    this.zoomLevel = level;
  }

  toggleHeatmap() {
    this.showHeatmap = !this.showHeatmap;
    return this.showHeatmap;
  }

  exportSnapshot() {
    try {
      const link = document.createElement('a');
      link.download = `Lagoinha_CCTV_Snapshot_${Date.now()}.png`;
      link.href = this.canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Erro ao exportar snapshot:', e);
    }
  }

  initDefaultSimulationScene() {
    this.vehicles = [];
    const sectorASpots = [
      { x: 120, y: 320, angle: 0 },
      { x: 220, y: 320, angle: 0.05 },
      { x: 320, y: 320, angle: -0.04 },
      { x: 420, y: 320, angle: 0.02 },
      { x: 120, y: 460, angle: 0 },
      { x: 220, y: 460, angle: 0.03 },
      { x: 320, y: 460, angle: -0.02 },
    ];
    const sectorBSpots = [
      { x: 800, y: 220, angle: 0.1 },
      { x: 900, y: 220, angle: 0.08 },
      { x: 1000, y: 220, angle: 0.12 },
      { x: 1100, y: 220, angle: 0.09 },
      { x: 800, y: 360, angle: 0.1 },
      { x: 900, y: 360, angle: 0.07 },
      { x: 1000, y: 360, angle: 0.11 },
    ];
    [...sectorASpots, ...sectorBSpots].forEach((spot, idx) => {
      this.vehicles.push({
        id: `car-init-${idx}`,
        x: spot.x,
        y: spot.y,
        width: 75,
        height: 38,
        color: this.carColors[idx % this.carColors.length],
        angle: spot.angle,
        state: 'parked',
        speed: 0
      });
    });
  }

  loadLocalVideo(file) {
    if (!this.localVideoElement) {
      this.localVideoElement = document.createElement('video');
      this.localVideoElement.loop = true;
      this.localVideoElement.muted = true;
      this.localVideoElement.playsInline = true;
    }
    const url = URL.createObjectURL(file);
    this.localVideoElement.src = url;
    this.localVideoElement.play().then(() => {
      this.activeSource = 'local_video';
    });
  }

  toggleSignalLoss() {
    this.isSignalLost = !this.isSignalLost;
    return this.isSignalLost;
  }

  setWeather(weather) {
    this.weatherCondition = weather;
  }

  addCarBurst(count = 5) {
    this.cctvOccupancyModifier = Math.min(6, this.cctvOccupancyModifier + count);
    if (this.activeSource === 'synthetic') {
      for (let i = 0; i < count; i++) {
        setTimeout(() => this.spawnCar(), i * 500);
      }
    }
  }

  clearSomeCars(count = 4) {
    this.cctvOccupancyModifier = Math.max(-10, this.cctvOccupancyModifier - count);
    if (this.activeSource === 'synthetic') {
      let removed = 0;
      for (let v of this.vehicles) {
        if (v.state === 'parked' && removed < count) {
          v.state = 'leaving';
          removed++;
        }
      }
    }
  }

  spawnCar() {
    if (this.vehicles.length >= this.maxVehicles) return;
    const startX = 640;
    const startY = 720;
    const color = this.carColors[Math.floor(Math.random() * this.carColors.length)];
    const targetSector = Math.random() > 0.5 ? 'A' : 'B';
    let targetX = targetSector === 'A' ? 120 + Math.random() * 320 : 780 + Math.random() * 350;
    let targetY = targetSector === 'A' ? 280 + Math.random() * 240 : 180 + Math.random() * 260;

    this.vehicles.push({
      id: `car-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      x: startX,
      y: startY,
      width: 75,
      height: 38,
      color: color,
      angle: -Math.PI / 2,
      state: 'entering',
      targetX: targetX,
      targetY: targetY,
      speed: 2.5
    });
  }

  updateSimulation() {
    if (this.activeSource !== 'synthetic' || this.isSignalLost) return;

    this.spawnTimer++;
    if (this.spawnTimer >= this.spawnRate) {
      this.spawnTimer = 0;
      if (Math.random() > 0.3) this.spawnCar();
    }

    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.state === 'entering') {
        if (v.y > 450) {
          v.y -= v.speed;
        } else {
          const dx = v.targetX - v.x;
          const dy = v.targetY - v.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            v.x += (dx / dist) * v.speed;
            v.y += (dy / dist) * v.speed;
            v.angle = Math.atan2(dy, dx);
          } else {
            v.state = 'parked';
            v.angle = (Math.random() - 0.5) * 0.2;
          }
        }
      } else if (v.state === 'leaving') {
        v.y -= v.speed * 1.5;
        v.angle = -Math.PI / 2;
        if (v.y < -50) this.vehicles.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();

    // Handle Digital Zoom
    if (this.zoomLevel > 1.0) {
      ctx.translate(this.width / 2, this.height / 2);
      ctx.scale(this.zoomLevel, this.zoomLevel);
      ctx.translate(-this.width / 2, -this.height / 2);
    }

    // 1. SIGNAL LOSS SCREEN
    if (this.isSignalLost) {
      ctx.fillStyle = '#05070d';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = 'rgba(255, 69, 58, 0.2)';
      for (let i = 0; i < 18; i++) {
        const y = Math.random() * this.height;
        ctx.fillRect(0, y, this.width, Math.random() * 8);
      }

      ctx.fillStyle = '#ff453a';
      ctx.font = 'bold 32px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ALERTA: PERDA DE SINAL DE VÍDEO (NO SIGNAL)', this.width / 2, this.height / 2 - 20);

      ctx.fillStyle = '#8e8e93';
      ctx.font = '18px -apple-system, sans-serif';
      ctx.fillText('A análise automática foi interrompida para evitar falsas indicações.', this.width / 2, this.height / 2 + 25);
      ctx.restore();
      return;
    }

    // 2. RENDER SELECTED BACKGROUND
    const background = this.backgroundFor(this.activeSource);
    if (background) {
      ctx.drawImage(background, 0, 0, this.width, this.height);
    } else if (this.activeSource === 'local_video' && this.localVideoElement && !this.localVideoElement.paused) {
      try {
        ctx.drawImage(this.localVideoElement, 0, 0, this.width, this.height);
      } catch (e) {}
    } else {
      // SYNTHETIC BACKDROP
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, this.width, 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('FACHADA LAGOINHA ALPHAVILLE', 40, 55);

      ctx.fillRect(0, 0, 30, this.height);
      ctx.fillRect(this.width - 30, 0, 30, this.height);

      // Central Corridor
      ctx.strokeStyle = 'rgba(255, 159, 10, 0.4)';
      ctx.setLineDash([20, 15]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(540, 100);
      ctx.lineTo(540, this.height);
      ctx.moveTo(740, 100);
      ctx.lineTo(740, this.height);
      ctx.stroke();
      ctx.setLineDash([]);

      this.vehicles.forEach(v => this.drawSyntheticVehicle(ctx, v));
    }

    // 3. RENDER DYNAMIC HEATMAP OVERLAY IF ENABLED
    if (this.showHeatmap) {
      this.renderHeatmapLayer();
    }

    // 4. APPLY VISION FILTERS
    this.applyVisionFilterOverlay();

    // 5. APPLY WEATHER OVERLAY
    this.applyWeatherOverlay();

    ctx.restore();

    // 6. RENDER APPLE CCTV HUD (Unscaled on top)
    this.renderCctvHud();
  }

  renderHeatmapLayer() {
    const ctx = this.ctx;
    const detections = this.getCurrentDetections();

    ctx.save();
    detections.forEach(det => {
      const cx = (det.x + det.width / 2) * this.width;
      const cy = (det.y + det.height / 2) * this.height;
      const rad = 65;

      const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, rad);
      grad.addColorStop(0, 'rgba(255, 69, 58, 0.55)');
      grad.addColorStop(0.5, 'rgba(255, 159, 10, 0.3)');
      grad.addColorStop(1, 'rgba(48, 209, 88, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  drawSyntheticVehicle(ctx, v) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(-v.width / 2 + 3, -v.height / 2 + 4, v.width, v.height, 8);
    ctx.fill();
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.roundRect(-v.width / 2, -v.height / 2, v.width, v.height, 6);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.roundRect(-v.width / 4, -v.height / 2 + 4, v.width / 2, v.height - 8, 4);
    ctx.fill();
    ctx.restore();
  }

  applyVisionFilterOverlay() {
    const ctx = this.ctx;

    if (this.visionFilter === 'thermal') {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = '#0a84ff';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 69, 58, 0.45)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    } else if (this.visionFilter === 'night_vision') {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#30d158';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(48, 209, 88, 0.2)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    } else if (this.visionFilter === 'grid') {
      ctx.save();
      ctx.strokeStyle = 'rgba(10, 132, 255, 0.35)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < this.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke();
      }
      for (let y = 0; y < this.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  applyWeatherOverlay() {
    const ctx = this.ctx;
    if (this.weatherCondition === 'rain') {
      ctx.fillStyle = 'rgba(10, 15, 25, 0.4)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.3)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 45; i++) {
        const rx = Math.random() * this.width;
        const ry = Math.random() * this.height;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 10, ry + 24);
        ctx.stroke();
      }
    } else if (this.weatherCondition === 'night') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  renderCctvHud() {
    const ctx = this.ctx;
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 23);

    // Apple Glass Top Capsule OSD
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(24, 24, 430, 36, 18);
    ctx.fill();
    ctx.stroke();

    // Blinking REC dot
    const isBlinkOn = Math.floor(Date.now() / 600) % 2 === 0;
    ctx.fillStyle = isBlinkOn ? '#ff453a' : 'rgba(255, 69, 58, 0.3)';
    ctx.beginPath();
    ctx.arc(44, 42, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`DEMONSTRAÇÃO · IMAGEM ILUSTRATIVA`, 58, 46);

    // Zoom & Filter Tag
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '500 11px -apple-system, sans-serif';
    ctx.fillText(`• ${this.zoomLevel}x ZOOM DIGITAL`, 285, 46);

    // Bottom Timestamp Capsule
    ctx.beginPath();
    ctx.roundRect(this.width - 325, this.height - 52, 305, 32, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0a84ff';
    ctx.font = '600 12px -apple-system, sans-serif';
    ctx.fillText(`${timeStr} UTC-3`, this.width - 308, this.height - 32);

    ctx.restore();
  }

  getCurrentDetections() {
    if (this.isSignalLost) return [];

    if (this.activeSource === 'cctv_real') {
      const countToTake = Math.max(8, Math.min(this.cctvCarSpots.length, this.cctvCarSpots.length + this.cctvOccupancyModifier));
      return this.cctvCarSpots.slice(0, countToTake).map((s, idx) => {
        const jitter = (Math.sin(Date.now() / 800 + idx) * 0.001);
        return {
          id: `cctv-car-${idx}`,
          x: s.x + jitter,
          y: s.y + jitter,
          width: s.w,
          height: s.h,
          confidence: s.conf,
          label: 'car'
        };
      });
    }

    if (this.activeSource === 'satellite_real') {
      const count = Math.max(12, Math.min(this.satCarSpots.length, 28 + this.cctvOccupancyModifier * 2));
      return this.satCarSpots.slice(0, count).map((s, idx) => ({
        id: `sat-car-${idx}`,
        x: s.x,
        y: s.y,
        width: s.w,
        height: s.h,
        confidence: s.conf,
        label: 'car'
      }));
    }

    if (this.activeSource === 'synthetic') {
      return this.vehicles.map(v => ({
        id: v.id,
        x: (v.x - v.width / 2) / this.width,
        y: (v.y - v.height / 2) / this.height,
        width: v.width / this.width,
        height: v.height / this.height,
        confidence: 0.91 + Math.random() * 0.07,
        label: 'car'
      }));
    }

    return [];
  }

  backgroundFor(source) {
    const src = this.backgroundSources[source];
    if (!src) return null;
    if (!this.backgroundImages[source]) {
      const image = new Image();
      image.src = src;
      this.backgroundImages[source] = image;
    }
    const image = this.backgroundImages[source];
    return image.complete && image.naturalWidth ? image : null;
  }

  animate(timestamp) {
    this.updateSimulation();
    if (this.visible) this.render();

    this.frameCount++;
    if (timestamp - this.fpsTimer >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = timestamp;
    }

    requestAnimationFrame(this.animate);
  }
}
