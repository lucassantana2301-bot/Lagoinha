/**
 * Editor Interativo de Polígonos para Delimitação de Zonas e Corredores
 * Permite definir setores de estacionamento, corredores de manobra e áreas proibidas.
 */

class PolygonEditor {
  constructor(canvasElement, onZonesChangedCallback) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onZonesChanged = onZonesChangedCallback;

    this.zones = [];
    this.selectedZoneId = null;
    this.selectedPointIndex = null;
    this.isDragging = false;
    this.isCreatingNew = false;
    this.newZoneDraft = null;

    this.editModeEnabled = false;
    this.showPolygonsOverlay = true;

    this.bindEvents();
  }

  setZones(zones) {
    this.zones = JSON.parse(JSON.stringify(zones));
    if (this.zones.length > 0 && !this.selectedZoneId) {
      this.selectedZoneId = this.zones[0].id;
    }
  }

  getZones() {
    return this.zones;
  }

  setEditMode(enabled) {
    this.editModeEnabled = enabled;
  }

  bindEvents() {
    const getCanvasPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX / this.canvas.width,
        y: (e.clientY - rect.top) * scaleY / this.canvas.height
      };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.editModeEnabled) return;
      const pos = getCanvasPos(e);

      // Check if clicked near an existing vertex of the selected zone
      const currentZone = this.zones.find(z => z.id === this.selectedZoneId);
      if (currentZone) {
        for (let i = 0; i < currentZone.points.length; i++) {
          const pt = currentZone.points[i];
          const dist = Math.hypot(pt.x - pos.x, pt.y - pos.y);
          if (dist < 0.03) { // 3% tolerance
            this.selectedPointIndex = i;
            this.isDragging = true;
            return;
          }
        }
      }

      // Check if clicked inside any zone to select it
      for (let z of this.zones) {
        if (this.isPointInPolygon(pos, z.points)) {
          this.selectedZoneId = z.id;
          this.selectedPointIndex = null;
          if (this.onZonesChanged) this.onZonesChanged(this.zones, this.selectedZoneId);
          return;
        }
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.editModeEnabled || !this.isDragging) return;
      const pos = getCanvasPos(e);

      const currentZone = this.zones.find(z => z.id === this.selectedZoneId);
      if (currentZone && this.selectedPointIndex !== null) {
        // Clamp to [0, 1]
        currentZone.points[this.selectedPointIndex].x = Math.max(0.01, Math.min(0.99, pos.x));
        currentZone.points[this.selectedPointIndex].y = Math.max(0.01, Math.min(0.99, pos.y));
      }
    });

    const endDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.onZonesChanged) this.onZonesChanged(this.zones, this.selectedZoneId);
      }
    };

    this.canvas.addEventListener('mouseup', endDrag);
    this.canvas.addEventListener('mouseleave', endDrag);

    // Double click to add a new vertex to the active zone
    this.canvas.addEventListener('dblclick', (e) => {
      if (!this.editModeEnabled) return;
      const pos = getCanvasPos(e);
      const currentZone = this.zones.find(z => z.id === this.selectedZoneId);
      if (currentZone) {
        currentZone.points.push(pos);
        if (this.onZonesChanged) this.onZonesChanged(this.zones, this.selectedZoneId);
      }
    });
  }

  addNewZone(name, type = 'parking', color = '#38bdf8') {
    const id = `zone-${Date.now()}`;
    const newZone = {
      id: id,
      name: name || 'Novo Setor',
      type: type, // 'parking' | 'corridor' | 'restricted'
      color: color,
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.2 },
        { x: 0.4, y: 0.4 },
        { x: 0.2, y: 0.4 }
      ],
      maxEstimatedCapacity: type === 'parking' ? 10 : 0,
      confidenceThreshold: 0.7
    };

    this.zones.push(newZone);
    this.selectedZoneId = id;
    if (this.onZonesChanged) this.onZonesChanged(this.zones, this.selectedZoneId);
    return newZone;
  }

  deleteSelectedZone() {
    if (!this.selectedZoneId) return;
    this.zones = this.zones.filter(z => z.id !== this.selectedZoneId);
    this.selectedZoneId = this.zones.length > 0 ? this.zones[0].id : null;
    if (this.onZonesChanged) this.onZonesChanged(this.zones, this.selectedZoneId);
  }

  // Draw polygons and detections over the video canvas
  render(detections = []) {
    if (!this.showPolygonsOverlay) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Draw Zones Polygons
    this.zones.forEach(zone => {
      if (!zone.points || zone.points.length < 3) return;

      const isSelected = this.editModeEnabled && zone.id === this.selectedZoneId;

      ctx.beginPath();
      ctx.moveTo(zone.points[0].x * w, zone.points[0].y * h);
      for (let i = 1; i < zone.points.length; i++) {
        ctx.lineTo(zone.points[i].x * w, zone.points[i].y * h);
      }
      ctx.closePath();

      // Color styling based on type
      let fillColor = 'rgba(56, 189, 248, 0.12)';
      let strokeColor = zone.color || '#38bdf8';

      if (zone.type === 'corridor') {
        fillColor = 'rgba(234, 179, 8, 0.1)';
        strokeColor = '#eab308';
      } else if (zone.type === 'restricted') {
        fillColor = 'rgba(239, 68, 68, 0.15)';
        strokeColor = '#ef4444';
      }

      if (isSelected) {
        fillColor = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = 3;
      } else {
        ctx.lineWidth = 2;
      }

      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.stroke();

      // Zone Label in Center
      const center = this.getPolygonCenter(zone.points);
      ctx.fillStyle = strokeColor;
      ctx.font = isSelected ? 'bold 15px sans-serif' : 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      const typeLabel = zone.type === 'corridor' ? '[Corredor]' : (zone.type === 'restricted' ? '[Interditado]' : '');
      const displayText = typeLabel ? `${zone.name} ${typeLabel}` : zone.name;
      ctx.fillText(displayText, center.x * w, center.y * h);

      // Draw editable vertices if in edit mode
      if (this.editModeEnabled && isSelected) {
        zone.points.forEach((pt, idx) => {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 7, 0, Math.PI * 2);
          ctx.fillStyle = idx === this.selectedPointIndex ? '#facc15' : '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    });

    // 2. Draw Detected Vehicle Bounding Boxes
    detections.forEach(det => {
      const bx = det.x * w;
      const by = det.y * h;
      const bw = det.width * w;
      const bh = det.height * h;

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Label & Confidence Tag
      ctx.fillStyle = 'rgba(34, 197, 94, 0.85)';
      ctx.fillRect(bx, by - 18, 65, 18);
      ctx.fillStyle = '#052e16';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`CAR ${(det.confidence * 100).toFixed(0)}%`, bx + 4, by - 9);
    });
  }

  getPolygonCenter(points) {
    let cx = 0, cy = 0;
    points.forEach(p => { cx += p.x; cy += p.y; });
    return { x: cx / points.length, y: cy / points.length };
  }

  // Standard Ray-Casting algorithm for point in polygon
  isPointInPolygon(point, polygonPoints) {
    let inside = false;
    for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
      const xi = polygonPoints[i].x, yi = polygonPoints[i].y;
      const xj = polygonPoints[j].x, yj = polygonPoints[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
