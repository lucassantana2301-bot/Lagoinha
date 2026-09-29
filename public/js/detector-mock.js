/**
 * Módulo de Análise Espacial e Avaliação de Ocupação/Incerteza - Lagoinha Parking
 * Aplica regras heurísticas de segurança para estacionamento sem vagas pintadas.
 */

class SectorAnalyzer {
  constructor() {
    this.history = {};
  }

  analyze(zones, detections, videoState) {
    // 1. If video is offline, invalidate all sectors
    if (videoState.visibilityQuality === 'offline' || !videoState.active) {
      return zones.map(zone => ({
        id: zone.id,
        name: zone.name,
        type: zone.type,
        color: zone.color,
        detectedCarsCount: 0,
        aiStatus: 'offline',
        uncertaintyReason: 'Sinal de câmera indisponível ou telemetria estagnada. Análise suspensa.',
        notes: 'Verifique a conexão da câmera ou reinicie a captura.'
      }));
    }

    // 2. Count cars per zone
    const counts = {};
    zones.forEach(z => { counts[z.id] = []; });

    detections.forEach(det => {
      // Ground-plane position (bottom center of bounding box)
      const groundPoint = {
        x: det.x + det.width / 2,
        y: det.y + det.height * 0.85
      };

      for (let z of zones) {
        if (this.isPointInPolygon(groundPoint, z.points)) {
          counts[z.id].push(det);
          break;
        }
      }
    });

    // Check if corridors are blocked
    const corridorZones = zones.filter(z => z.type === 'corridor');
    let isCorridorChoked = false;
    corridorZones.forEach(cz => {
      const carsInCorridor = counts[cz.id] ? counts[cz.id].length : 0;
      if (carsInCorridor >= 3) {
        isCorridorChoked = true;
      }
    });

    // 3. Process each zone according to heuristic safety rules
    return zones.map(zone => {
      const cars = counts[zone.id] || [];
      const count = cars.length;
      const capacity = zone.maxEstimatedCapacity || 15;

      let aiStatus = 'available_probable';
      let uncertaintyReason = null;
      let notes = '';

      if (zone.type === 'corridor') {
        if (count >= 3) {
          aiStatus = 'full';
          notes = `${count} veículos em manobra ou retendo o fluxo no corredor.`;
        } else if (count > 0) {
          aiStatus = 'moderate';
          notes = `${count} veículo(s) transitando no corredor de circulação.`;
        } else {
          aiStatus = 'clear';
          notes = 'Corredor de circulação desobstruído.';
        }
        return {
          id: zone.id,
          name: zone.name,
          type: zone.type,
          color: zone.color,
          detectedCarsCount: count,
          aiStatus,
          uncertaintyReason: null,
          notes
        };
      }

      if (zone.type === 'restricted') {
        if (count > 0) {
          aiStatus = 'full';
          notes = `${count} veículo(s) posicionado(s) na área restrita/embarque.`;
        } else {
          aiStatus = 'clear';
          notes = 'Área restrita desobstruída.';
        }
        return {
          id: zone.id,
          name: zone.name,
          type: zone.type,
          color: zone.color,
          detectedCarsCount: count,
          aiStatus,
          uncertaintyReason: null,
          notes
        };
      }

      // Parking Sector Analysis
      const fillRatio = count / Math.max(1, capacity);

      // Condition 1: Weather / Poor Lighting uncertainty
      if (videoState.visibilityQuality === 'poor' || videoState.visibilityQuality === 'rain' || videoState.visibilityQuality === 'night') {
        aiStatus = 'uncertain';
        uncertaintyReason = 'Visibilidade reduzida (condição climática ou baixa iluminação). Confirmação presencial recomendada.';
        notes = `${count} veículos detectados com margem de incerteza elevada.`;
      }
      // Condition 2: Corridor Choked (Cannot direct to sector if circulation is blocked)
      else if (isCorridorChoked) {
        aiStatus = 'uncertain';
        uncertaintyReason = 'Acesso ao setor comprometido por retenção no corredor principal.';
        notes = `${count} veículos no setor; trânsito retido no acesso.`;
      }
      // Condition 3: Full or near full
      else if (fillRatio >= 0.85) {
        aiStatus = 'full';
        notes = `${count} veículos detectados. Alta densidade; provável ausência de espaço viável.`;
      }
      // Condition 4: Moderate occupancy
      else if (fillRatio >= 0.55) {
        aiStatus = 'moderate';
        notes = `${count} veículos detectados. Espaço moderado; organização dinâmica no local.`;
      }
      // Condition 5: Low occupancy / Probable Space
      else {
        aiStatus = 'available_probable';
        notes = `${count} veículos detectados. Provável espaço disponível para manobra e organização.`;
      }

      return {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        color: zone.color,
        detectedCarsCount: count,
        aiStatus,
        uncertaintyReason,
        notes
      };
    });
  }

  isPointInPolygon(point, polygonPoints) {
    if (!polygonPoints || polygonPoints.length < 3) return false;
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
