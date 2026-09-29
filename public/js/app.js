/**
 * Controlador Principal da Aplicação - Lagoinha Parking
 * Padrão Apple HIG com suporte a Tema Claro/Escuro, SVG Icons e Validação de Estado.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const videoCanvas = document.getElementById('videoCanvas');
  const staleBanner = document.getElementById('staleWarningBanner');
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Inject Icons into UI
  injectStaticIcons();

  // Instantiate Core Modules
  const simulator = new ParkingSimulator(videoCanvas);
  const analyzer = new SectorAnalyzer();
  const polygonEditor = new PolygonEditor(videoCanvas, (updatedZones, activeId) => {
    renderEditorZoneControls(updatedZones, activeId);
  });

  // Safe Storage & Icon Fallbacks
  const safeStorage = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {} };
  const Icons = (typeof AppleIcons !== 'undefined' ? AppleIcons : (typeof window !== 'undefined' && window.AppleIcons ? window.AppleIcons : {})) || {};

  // Todo texto vindo da API ou do voluntário passa por aqui antes de entrar em innerHTML.
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  // Theme Management — Dark Mode Only (permanent)
  const btnToggleTheme = document.getElementById('btnToggleTheme');
  const themeIconWrapper = document.getElementById('themeIconWrapper');
  
  // Always force dark mode — no toggle
  document.documentElement.setAttribute('data-theme', 'dark');
  safeStorage.setItem('lagoinha_theme', 'dark');

  function applyTheme(theme) {
    // Always dark — kept for compatibility
    document.documentElement.setAttribute('data-theme', 'dark');
    safeStorage.setItem('lagoinha_theme', 'dark');
  }

  // Theme button disabled (removed from UI)
  btnToggleTheme?.addEventListener('click', () => {
    // no-op — dark mode only
  });

  // Sound Toggle Management
  const btnToggleSound = document.getElementById('btnToggleSound');
  const soundIconWrapper = document.getElementById('soundIconWrapper');
  updateSoundIcon(false);

  function updateSoundIcon(enabled) {
    if (soundIconWrapper) {
      soundIconWrapper.innerHTML = enabled ? (Icons.volume2 || '') : (Icons.volumeX || '');
    }
  }

  btnToggleSound?.addEventListener('click', () => {
    const isNowOn = window.appleAudio?.toggle();
    updateSoundIcon(isNowOn);
  });

  // State
  let systemState = {
    zones: [],
    sectors: {},
    overrides: {},
    videoSource: {
      active: true,
      visibilityQuality: 'good',
      fps: 10
    }
  };

  let lastTelemetrySent = 0;
  const producerId = crypto.randomUUID();
  let detectorConnected = false;
  let lastServerContact = 0;
  let serverStaleRendered = false;
  let fetching = false;
  let zonesLoaded = false;

  // Initialize Data from Backend
  async function fetchServerState() {
    if (fetching) return;
    fetching = true;
    try {
      const res = await fetch('/api/state', { signal: AbortSignal.timeout(4000), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        lastServerContact = Date.now();
        detectorConnected = data.detectorConnected;
        systemState.videoSource = data.videoSource;
        systemState.zones = data.zones || [];
        systemState.sectors = data.sectors || {};
        systemState.overrides = data.overrides || {};
        
        if (!zonesLoaded || !polygonEditor.editModeEnabled) {
          const changed = JSON.stringify(polygonEditor.getZones()) !== JSON.stringify(systemState.zones);
          polygonEditor.setZones(systemState.zones);
          if (changed) renderEditorZoneControls(systemState.zones, polygonEditor.selectedZoneId);
          zonesLoaded = true;
        }

        updateHeaderStatusBadge();
        updateOperationalKpiBar();
        renderSectorsOverview();
        renderEntranceView();
        renderVolunteerView();
      }
    } catch (err) {
      console.warn('Sincronização com servidor local pendente:', err);
    } finally {
      fetching = false;
    }
  }

  fetchServerState();
  setInterval(fetchServerState, 1000);

  // Tab Navigation Handling
  function switchTab(targetTab) {
    tabButtons.forEach(btn => btn.classList && btn.classList.toggle && btn.classList.toggle('active', btn.dataset?.tab === targetTab));
    tabPanes.forEach(pane => pane.classList && pane.classList.toggle && pane.classList.toggle('active', pane.id === targetTab));

    const videoWrapper = document.getElementById('videoWrapper');
    const overviewContainer = document.getElementById('overviewCanvasContainer');
    const editorContainer = document.getElementById('editorCanvasContainer');

    if (targetTab === 'tab-editor') {
      polygonEditor.setEditMode(true);
      if (videoWrapper && editorContainer && typeof editorContainer.contains === 'function' && !editorContainer.contains(videoWrapper)) {
        if (typeof editorContainer.appendChild === 'function') editorContainer.appendChild(videoWrapper);
      }
      renderEditorZoneControls(polygonEditor.getZones(), polygonEditor.selectedZoneId);
    } else {
      polygonEditor.setEditMode(false);
      if (videoWrapper && overviewContainer && typeof overviewContainer.contains === 'function' && !overviewContainer.contains(videoWrapper)) {
        if (typeof overviewContainer.appendChild === 'function') overviewContainer.appendChild(videoWrapper);
      }
    }
    window.appleAudio?.playTap();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Experience Switcher (Portal vs Parking System)
  const viewPortal = document.getElementById('viewPortal');
  const viewParking = document.getElementById('viewParking');
  const btnNavPortal = document.getElementById('btnNavPortal');
  const btnNavParking = document.getElementById('btnNavParking');
  const btnToggleOperationalMode = document.getElementById('btnToggleOperationalMode');
  const btnReturnToPortal = document.getElementById('btnReturnToPortal');
  const brandLogoBtn = document.getElementById('brandLogoBtn');
  const portalQuickLinks = document.getElementById('portalQuickLinks');
  const btnHeaderPlanVisit = document.getElementById('btnHeaderPlanVisit');

  function setExperience(exp) {
    const isParking = exp === 'parking';
    simulator.visible = isParking;
    if (viewPortal && viewPortal.classList && viewPortal.classList.toggle) viewPortal.classList.toggle('active', !isParking);
    if (viewParking && viewParking.classList && viewParking.classList.toggle) viewParking.classList.toggle('active', isParking);
    if (btnNavPortal && btnNavPortal.classList && btnNavPortal.classList.toggle) btnNavPortal.classList.toggle('active', !isParking);
    if (btnNavParking && btnNavParking.classList && btnNavParking.classList.toggle) btnNavParking.classList.toggle('active', isParking);
    if (portalQuickLinks && portalQuickLinks.style) portalQuickLinks.style.display = isParking ? 'none' : '';
    if (btnHeaderPlanVisit && btnHeaderPlanVisit.style) btnHeaderPlanVisit.style.display = isParking ? 'none' : '';
    if (btnToggleOperationalMode && btnToggleOperationalMode.style) btnToggleOperationalMode.style.display = isParking ? 'none' : '';
    window.appleAudio?.playTap();
  }

  btnNavPortal?.addEventListener('click', () => setExperience('portal'));
  btnNavParking?.addEventListener('click', () => setExperience('parking'));
  btnToggleOperationalMode?.addEventListener('click', () => {
    setExperience('parking');
    switchTab('tab-overview');
  });
  btnReturnToPortal?.addEventListener('click', () => {
    setExperience('portal');
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  brandLogoBtn?.addEventListener('click', () => {
    setExperience('portal');
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.activateParkingApp = () => {
    setExperience('parking');
    switchTab('tab-overview');
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  window.activateParkingTab = (tabId) => {
    setExperience('parking');
    switchTab(tabId);
    if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Check URL query param for direct view link (e.g. ?view=entrance or ?view=volunteer or ?app=parking)
  const urlParams = new URLSearchParams(window.location?.search || '');
  const viewParam = urlParams.get('view');
  const appParam = urlParams.get('app');
  const currentHash = window.location?.hash || '';

  if (['entrance', 'volunteer', 'editor'].includes(viewParam) || appParam === 'parking') {
    setExperience('parking');
    if (viewParam === 'entrance') switchTab('tab-entrance');
    else if (viewParam === 'volunteer') switchTab('tab-volunteer');
    else if (viewParam === 'editor') switchTab('tab-editor');
  } else {
    setExperience('portal');
    if (currentHash && currentHash.length > 1) {
      setTimeout(() => {
        const targetEl = document.querySelector ? document.querySelector(currentHash) : document.getElementById(currentHash.substring(1));
        if (targetEl && typeof targetEl.scrollIntoView === 'function') {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }

  // Handle hash changes (e.g. user navigating back or clicking anchors)
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', () => {
      const hash = window.location?.hash || '';
      if (['#portal', '#visita', '#cultos', '#comunidade', '#participe', '#estacionamento', '#contato'].includes(hash)) {
        setExperience('portal');
        const el = document.querySelector ? document.querySelector(hash) : document.getElementById(hash.substring(1));
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  // Main Processing & Rendering Loop (Runs at 60 FPS for smooth visual overlay)
  function processTick() {
    const detections = simulator.getCurrentDetections();
    const zones = polygonEditor.getZones();
    const videoState = {
      active: !simulator.isSignalLost,
      visibilityQuality: simulator.isSignalLost ? 'offline' : simulator.weatherCondition,
      fps: simulator.fps
    };

    // 1. Render Polygons and bounding boxes overlay on canvas
    if (simulator.visible) polygonEditor.render(detections);

    // 2. Run Spatial Analysis
    const analyzedSectors = simulator.activeSource === 'local_video'
      ? zones.map(z => ({ id: z.id, detectedCarsCount: null, aiStatus: 'uncertain', notes: 'Vídeo para visualização. Análise indisponível.', uncertaintyReason: 'Detector desconectado para este vídeo.' }))
      : analyzer.analyze(zones, detections, videoState);

    // If server contact lost > 5s, invalidate states
    // (renderiza só na transição para "sem contato", não a cada quadro)
    const serverStale = Date.now() - lastServerContact > 5000;
    if (serverStale && !serverStaleRendered) {
      Object.values(systemState.sectors).forEach(state => {
        state.aiStatus = 'offline';
        state.humanOverride = null;
      });
      renderEntranceView();
      renderSectorsOverview();
      renderVolunteerView();
    }
    serverStaleRendered = serverStale;

    // 3. Stale Frame & Watchdog Banner Check (o banner é montado uma vez por perda de sinal)
    if (simulator.isSignalLost && !staleBanner.classList.contains('active')) {
      staleBanner.classList.add('active');
      staleBanner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.65rem;">
          <span style="display:flex; align-items:center;">${AppleIcons.alertTriangle}</span>
          <div>
            <strong>Alerta do Watchdog: Sinal de câmera interrompido ou telemetria estagnada.</strong><br>
            <span style="font-size:0.8rem; opacity:0.85;">A análise automática foi invalidada para evitar direcionamento a locais incorretos.</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" id="btnBannerRestore">Restaurar Câmera</button>
      `;
      const btnRest = document.getElementById('btnBannerRestore');
      if (btnRest) {
        btnRest.onclick = () => {
          simulator.toggleSignalLoss();
          staleBanner.classList.remove('active');
          window.appleAudio?.playSuccess();
        };
      }
    } else if (!simulator.isSignalLost) {
      staleBanner.classList.remove('active');
    }

    // 4. Update HUD Stats Overlay
    const overlayFps = simulator.visible && document.getElementById('overlayFps');
    const overlayCars = simulator.visible && document.getElementById('overlayCars');
    const overlaySource = simulator.visible && document.getElementById('overlaySource');
    if (overlayFps) overlayFps.textContent = `Taxa de atualização: ${simulator.fps} fps`;
    if (overlayCars) {
      overlayCars.textContent = simulator.activeSource === 'local_video' 
        ? 'Detecção indisponível neste vídeo' 
        : `Veículos detectados/simulados: ${detections.length}`;
    }
    if (overlaySource) {
      overlaySource.textContent = simulator.activeSource === 'local_video' 
        ? 'VÍDEO LOCAL: Apenas visualização' 
        : (simulator.activeSource === 'cctv_real' ? 'FOTO ILUSTRATIVA CCTV: Lagoinha Alphaville' : (simulator.activeSource === 'satellite_real' ? 'ORTOFOTO SATÉLITE: Alphaville' : 'SIMULAÇÃO VETORIAL 2D'));
    }

    // 5. Send Telemetry to Local Node API every 1.5s
    const now = Date.now();
    if (zonesLoaded && !detectorConnected && !['entrance', 'volunteer', 'editor'].includes(viewParam) && now - lastTelemetrySent > 1500) {
      lastTelemetrySent = now;
      sendTelemetryPayload(analyzedSectors, videoState);
    }

    requestAnimationFrame(processTick);
  }

  requestAnimationFrame(processTick);

  // Send Telemetry to Server
  async function sendTelemetryPayload(analyzedSectors, videoState) {
    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producer: 'simulation',
          producerId,
          fps: videoState.fps,
          visibilityQuality: videoState.visibilityQuality,
          videoSource: {
            type: simulator.activeSource,
            name: simulator.activeSource === 'local_video' ? 'Vídeo Local MP4' : 'Simulação de Demonstração'
          },
          sectors: analyzedSectors
        })
      });
    } catch (e) {
      // Backend sync
    }
  }

  // Update Header Status Badge
  function updateHeaderStatusBadge() {
    const badge = document.getElementById('sourceBadgeHeader');
    const label = document.getElementById('sourceBadgeLabel');
    if (!badge || !label) return;

    if (detectorConnected) {
      badge.className = 'source-status-badge live';
      label.textContent = 'Detector Conectado (IA Ativa)';
    } else if (simulator.activeSource === 'local_video') {
      badge.className = 'source-status-badge';
      label.textContent = 'Vídeo Local (Sem Detector)';
    } else {
      badge.className = 'source-status-badge';
      label.textContent = 'Modo Demonstração (Simulado)';
    }
  }

  // Update Operational KPI Bar
  function updateOperationalKpiBar() {
    const kpiCars = document.getElementById('kpiCarsCount');
    const kpiCarsSubtext = document.getElementById('kpiCarsSubtext');
    const kpiAttention = document.getElementById('kpiAttentionCount');
    const kpiConn = document.getElementById('kpiConnectionStatus');
    const kpiLastUpdate = document.getElementById('kpiLastUpdateTime');

    const zones = polygonEditor.getZones();
    let totalCars = 0;
    let attentionCount = 0;
    let hasCarsCount = false;

    zones.forEach(z => {
      const s = systemState.sectors[z.id];
      if (s) {
        if (s.detectedCarsCount !== null && s.detectedCarsCount !== undefined) {
          totalCars += s.detectedCarsCount;
          hasCarsCount = true;
        }
        if (s.aiStatus === 'moderate' || s.aiStatus === 'full' || s.aiStatus === 'uncertain' || (s.humanOverride && s.humanOverride.status === 'full')) {
          attentionCount++;
        }
      }
    });

    if (kpiCars) {
      if (simulator.activeSource === 'local_video') {
        kpiCars.textContent = '—';
        if (kpiCarsSubtext) kpiCarsSubtext.textContent = 'Sem detector acoplado';
      } else {
        kpiCars.textContent = hasCarsCount ? totalCars : '—';
        if (kpiCarsSubtext) kpiCarsSubtext.textContent = detectorConnected ? 'Detectados em tempo real' : 'Simulados na cena';
      }
    }

    if (kpiAttention) {
      kpiAttention.textContent = attentionCount;
    }

    if (kpiConn) {
      if (simulator.isSignalLost || Date.now() - lastServerContact > 5000) {
        kpiConn.textContent = 'Sem Sinal';
        if (kpiConn.style) kpiConn.style.color = 'var(--status-red)';
      } else if (detectorConnected) {
        kpiConn.textContent = 'Detector Ativo';
        if (kpiConn.style) kpiConn.style.color = 'var(--status-green)';
      } else {
        kpiConn.textContent = 'Simulação Ativa';
        if (kpiConn.style) kpiConn.style.color = 'var(--status-orange)';
      }
    }

    if (kpiLastUpdate) {
      kpiLastUpdate.textContent = formatTimeAgo(lastServerContact || Date.now());
    }
  }

  // Render: Overview Tab (Sector Cards answering the 5 core questions)
  function renderSectorsOverview() {
    const container = document.getElementById('sectorsListOverview');
    if (!container) return;

    const zones = polygonEditor.getZones();
    if (zones.length === 0) {
      container.innerHTML = `<p style="color:var(--text-tertiary); text-align:center; padding:1.5rem 0;">Nenhum setor configurado.</p>`;
      return;
    }

    container.innerHTML = zones.map(zone => {
      const state = systemState.sectors[zone.id] || {};
      const override = state.humanOverride;
      
      // Question 1: Qual é o setor? (zone.name + type tag)
      let typeLabel = zone.type === 'parking' ? 'Vagas' : (zone.type === 'corridor' ? 'Corredor' : 'Área Restrita');

      // Question 2: Qual é seu estado?
      let effectiveStatus = state.aiStatus || 'evaluating';
      let statusLabel = 'Provável Espaço';
      let badgeClass = 'badge-green';
      let stateIcon = Icons.checkCircle || '';
      let guidanceAction = 'Direcionar veículos para este setor.';

      if (effectiveStatus === 'clear') {
        statusLabel = 'Desobstruído';
        badgeClass = 'badge-green';
        stateIcon = Icons.checkCircle || '';
        guidanceAction = zone.type === 'corridor' ? 'Manter corredor livre para manobras.' : 'Área livre e desimpedida.';
      } else if (effectiveStatus === 'moderate') {
        statusLabel = zone.type === 'corridor' ? 'Tráfego Moderado' : 'Espaço Moderado';
        badgeClass = 'badge-orange';
        stateIcon = Icons.alertCircle || '';
        guidanceAction = 'Acompanhar manobras com cautela.';
      } else if (effectiveStatus === 'full') {
        statusLabel = zone.type === 'corridor' ? 'Tráfego Retido' : 'Pouco Espaço';
        badgeClass = 'badge-red';
        stateIcon = Icons.slashCircle || '';
        guidanceAction = 'Não direcionar veículos. Priorizar liberação.';
      } else if (effectiveStatus === 'uncertain') {
        statusLabel = 'Incerteza / Baixa Visibilidade';
        badgeClass = 'badge-purple';
        stateIcon = Icons.alertTriangle || '';
        guidanceAction = 'Verificar espaço presencialmente no local.';
      } else if (effectiveStatus === 'offline') {
        statusLabel = 'Análise Indisponível';
        badgeClass = 'badge-gray';
        stateIcon = Icons.alertTriangle || '';
        guidanceAction = 'Sinal offline. Não confiar na indicação automática.';
      }

      // Question 4: Origem da informação (Humana ou Automática)
      let sourceLabel = detectorConnected ? 'IA em Tempo Real' : 'Simulação Automática';
      let sourceIcon = Icons.cpu || '';

      if (override) {
        sourceLabel = `Confirmado por ${esc(override.volunteerName)}`;
        sourceIcon = Icons.user || '';
        if (override.status === 'available') {
          statusLabel = 'Confirmado Vazio';
          badgeClass = 'badge-green';
          guidanceAction = 'Direcionar veículos conforme confirmação humana.';
        } else if (override.status === 'full') {
          statusLabel = 'Confirmado Lotado';
          badgeClass = 'badge-red';
          guidanceAction = 'Setor lotado no local. Não direcionar.';
        } else if (override.status === 'blocked') {
          statusLabel = 'Interditado no Pátio';
          badgeClass = 'badge-red';
          guidanceAction = 'Setor temporariamente bloqueado para manobras.';
        }
      }

      // Question 5: Quando foi atualizada?
      const timeAgo = formatTimeAgo(state.lastUpdate || Date.now());

      return `
        <div class="sector-card">
          <div class="sector-top">
            <div class="sector-name-group">
              <span class="sector-name">${esc(zone.name)}</span>
              <span class="sector-type-tag">${typeLabel}</span>
            </div>
            <span class="sector-state-badge ${badgeClass}">
              ${stateIcon}
              <span>${statusLabel}</span>
            </span>
          </div>

          <!-- Question 3: O que o voluntário deve fazer? -->
          <div class="sector-action-guidance">
            <span style="color:var(--accent-blue); display:flex;">${Icons.directionArrow || ''}</span>
            <div><strong>Orientação:</strong> ${guidanceAction}</div>
          </div>

          <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">
            ${esc(state.notes || 'Monitoramento ativo.')}
          </div>

          ${state.uncertaintyReason ? `
            <div style="background:var(--status-purple-bg); border:1px solid rgba(175,82,222,0.25); border-radius:var(--radius-sm); padding:0.4rem 0.65rem; font-size:0.75rem; color:var(--status-purple-text); display:flex; align-items:center; gap:0.4rem;">
              <span>${Icons.alertTriangle || ''}</span>
              <div>${esc(state.uncertaintyReason)}</div>
            </div>
          ` : ''}

          <!-- Metadata Footer -->
          <div class="sector-meta-footer">
            <span class="sector-source-label">
              ${sourceIcon}
              <span>${sourceLabel}</span>
            </span>
            <span>Atualizado ${timeAgo}</span>
          </div>

          ${override ? `
            <div style="display:flex; justify-content:flex-end; margin-top:0.25rem;">
              <button class="btn btn-sm btn-danger" onclick="window.clearOverride('${esc(zone.id)}')">Restaurar Análise Automática</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // Render: Entrance Orientation Cards (Large Tablet & Gate Display)
  function renderEntranceView() {
    const container = document.getElementById('entranceCardsContainer');
    if (!container) return;

    const zones = polygonEditor.getZones().filter(z => z.type === 'parking');
    if (zones.length === 0) {
      container.innerHTML = `<p style="color:var(--text-tertiary); text-align:center;">Nenhum setor de estacionamento cadastrado.</p>`;
      return;
    }

    container.innerHTML = zones.map(zone => {
      const state = systemState.sectors[zone.id] || {};
      const override = state.humanOverride;
      
      let pillClass = 'pill-green';
      let actionText = 'DIRECIONAR VEÍCULOS AQUI';
      let cardBorder = 'direct';
      let explanation = 'Setor com boa fluidez e provável espaço para manobra.';
      let actionIcon = Icons.directionArrow || '';

      if (simulator.isSignalLost || state.aiStatus === 'offline') {
        pillClass = 'pill-purple';
        actionText = 'INFORMAÇÃO INDISPONÍVEL';
        cardBorder = 'uncertain';
        actionIcon = Icons.alertTriangle || '';
        explanation = 'SINAL OFFLINE ou câmera indisponível. Verificar presencialmente.';
      } else if (override) {
        if (override.status === 'available') {
          pillClass = 'pill-green';
          actionText = 'CONFIRMADO PELO VOLUNTÁRIO';
          cardBorder = 'direct';
          explanation = `Validação presencial por ${esc(override.volunteerName)}.`;
        } else if (override.status === 'full') {
          pillClass = 'pill-red';
          actionText = 'SETOR LOTADO (NÃO ENVIAR)';
          cardBorder = 'blocked';
          actionIcon = Icons.slashCircle || '';
          explanation = `Voluntário ${esc(override.volunteerName)} confirmou lotação no local.`;
        } else if (override.status === 'blocked') {
          pillClass = 'pill-red';
          actionText = 'SETOR INTERDITADO';
          cardBorder = 'blocked';
          actionIcon = Icons.slashCircle || '';
          explanation = `Bloqueado temporariamente por ${esc(override.volunteerName)}.`;
        }
      } else if (state.aiStatus === 'full') {
        pillClass = 'pill-red';
        actionText = 'SETOR COM POUCO ESPAÇO';
        cardBorder = 'blocked';
        actionIcon = Icons.slashCircle || '';
        explanation = 'Alta densidade de veículos. Evitar retenção no corredor.';
      } else if (state.aiStatus === 'moderate') {
        pillClass = 'pill-orange';
        actionText = 'DIRECIONAR COM CAUTELA';
        cardBorder = 'caution';
        actionIcon = Icons.alertCircle || '';
        explanation = 'Espaço moderado. Necessário apoio de voluntário no pátio.';
      } else if (state.aiStatus === 'uncertain') {
        pillClass = 'pill-purple';
        actionText = 'VERIFICAR ESPAÇO NO LOCAL';
        cardBorder = 'uncertain';
        actionIcon = Icons.alertTriangle || '';
        explanation = esc(state.uncertaintyReason || 'Visibilidade reduzida') + ' — VERIFICAR ANTES de direcionar.';
      }

      return `
        <div class="entrance-decision-card ${cardBorder}">
          <div>
            <div style="font-size:1.25rem; font-weight:700; letter-spacing:-0.02em;">${esc(zone.name)}</div>
            <div class="entrance-action-pill ${pillClass}">
              <span>${actionIcon}</span>
              <span>${actionText}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem; line-height:1.4;">
              ${explanation}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; background:var(--bg-surface-secondary); border:1px solid var(--border-subtle); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.75rem; color:var(--text-secondary);">
            <span>Veículos na cena: <strong>${esc(state.detectedCarsCount ?? '—')}</strong></span>
            <span>Atualizado: <strong>${formatTimeAgo(state.lastUpdate || Date.now())}</strong></span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render: Volunteer Mobile View (Ergonomic Thumb Targets)
  function renderVolunteerView() {
    const container = document.getElementById('volunteerSectorsList');
    if (!container) return;

    const zones = polygonEditor.getZones();
    container.innerHTML = zones.map(zone => {
      const state = systemState.sectors[zone.id] || {};
      const override = state.humanOverride;

      return `
        <div class="volunteer-action-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:1.05rem; font-weight:700;">${esc(zone.name)}</div>
            <span class="sector-type-tag">${zone.type === 'parking' ? 'Vagas' : (zone.type === 'corridor' ? 'Corredor' : 'Área Restrita')}</span>
          </div>

          <div style="margin:0.5rem 0; font-size:0.82rem; color:var(--text-secondary);">
            Estado Automático: <strong style="color:var(--text-primary);">${esc(state.aiStatus || 'Normal')}</strong>
          </div>

          ${override ? `
            <div style="background:var(--accent-blue-subtle); border:1px solid rgba(0,122,255,0.25); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.78rem; color:var(--accent-blue); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
              <span>${Icons.user || ''}</span>
              <div>Seu registro: <strong>${esc(String(override.status).toUpperCase())}</strong> (${formatTimeAgo(override.timestamp)})</div>
            </div>
          ` : ''}

          <div style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--text-tertiary); margin-bottom:0.4rem;">
            Toque para confirmar ou corrigir presencialmente:
          </div>

          <div class="volunteer-buttons-matrix">
            <button class="vol-btn vol-btn-green" onclick="window.sendHumanOverride('${esc(zone.id)}', 'available')">
              <span>${Icons.checkCircle || ''}</span>
              <span>Tem Espaço</span>
            </button>
            <button class="vol-btn vol-btn-red" onclick="window.sendHumanOverride('${esc(zone.id)}', 'full')">
              <span>${Icons.slashCircle || ''}</span>
              <span>Está Lotado</span>
            </button>
            <button class="vol-btn vol-btn-orange" onclick="window.sendHumanOverride('${esc(zone.id)}', 'blocked')">
              <span>${Icons.alertTriangle || ''}</span>
              <span>Interditar / Manobra</span>
            </button>
            <button class="vol-btn vol-btn-clear" onclick="window.clearOverride('${esc(zone.id)}')">
              <span>${Icons.cpu || ''}</span>
              <span>Restaurar IA</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render: Polygon Editor Zone List & Form
  function renderEditorZoneControls(zones, activeId) {
    const listContainer = document.getElementById('editorZonesList');
    if (!listContainer) return;

    listContainer.innerHTML = zones.map(z => `
      <button class="btn btn-sm ${z.id === activeId ? 'btn-primary' : ''}" onclick="window.selectEditorZone('${esc(z.id)}')">
        ${esc(z.name)}
      </button>
    `).join('');

    const activeZone = zones.find(z => z.id === activeId);
    const formContainer = document.getElementById('activeZoneForm');
    if (!formContainer) return;

    if (!activeZone) {
      formContainer.innerHTML = `<p style="color:var(--text-tertiary); font-size:0.82rem;">Selecione ou adicione um setor acima.</p>`;
      return;
    }

    formContainer.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
        <div>
          <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Nome do Setor:</label>
          <input type="text" id="editZoneName" value="${esc(activeZone.name)}" style="width:100%; padding:0.45rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary); font-size:0.82rem;">
        </div>
        <div>
          <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Tipo de Zona:</label>
          <select id="editZoneType" style="width:100%; padding:0.45rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary); font-size:0.82rem;">
            <option value="parking" ${activeZone.type === 'parking' ? 'selected' : ''}>Vagas de Estacionamento</option>
            <option value="corridor" ${activeZone.type === 'corridor' ? 'selected' : ''}>Corredor de Manobra / Circulação</option>
            <option value="restricted" ${activeZone.type === 'restricted' ? 'selected' : ''}>Área Proibida / Embarque</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
        <div>
          <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Capacidade Estimada (Referência):</label>
          <input type="number" id="editZoneCapacity" value="${esc(activeZone.maxEstimatedCapacity || 15)}" style="width:100%; padding:0.45rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-primary); font-size:0.82rem;">
        </div>
        <div>
          <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Cor do Polígono:</label>
          <input type="color" id="editZoneColor" value="${esc(activeZone.color || '#007AFF')}" style="width:100%; height:34px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); background:transparent; cursor:pointer;">
        </div>
      </div>

      <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
        <button class="btn btn-sm btn-danger" onclick="window.deleteActiveZone()">Excluir Setor</button>
        <button class="btn btn-sm btn-primary" onclick="window.applyZoneChanges()">Salvar no Servidor</button>
      </div>
    `;

    const nameInput = document.getElementById('editZoneName');
    const typeSelect = document.getElementById('editZoneType');
    const capInput = document.getElementById('editZoneCapacity');
    const colorInput = document.getElementById('editZoneColor');

    if (nameInput) nameInput.oninput = (e) => { activeZone.name = e.target.value; };
    if (typeSelect) typeSelect.onchange = (e) => { activeZone.type = e.target.value; };
    if (capInput) capInput.oninput = (e) => { activeZone.maxEstimatedCapacity = parseInt(e.target.value) || 0; };
    if (colorInput) colorInput.oninput = (e) => { activeZone.color = e.target.value; };
  }

  // Global Helpers for User Actions
  window.selectEditorZone = (zoneId) => {
    polygonEditor.selectedZoneId = zoneId;
    renderEditorZoneControls(polygonEditor.getZones(), zoneId);
    window.appleAudio?.playTap();
  };

  window.addNewZonePrompt = () => {
    const name = prompt('Nome do novo setor:', 'Setor C');
    if (name) {
      const created = polygonEditor.addNewZone(name);
      renderEditorZoneControls(polygonEditor.getZones(), created.id);
      window.appleAudio?.playSuccess();
    }
  };

  window.deleteActiveZone = () => {
    if (confirm('Tem certeza que deseja excluir este setor?')) {
      polygonEditor.deleteSelectedZone();
      renderEditorZoneControls(polygonEditor.getZones(), polygonEditor.selectedZoneId);
      window.appleAudio?.playTap();
    }
  };

  // Código de acesso da equipe (VOLUNTEER_TOKEN no servidor), pedido uma vez por aparelho.
  function teamHeaders() {
    let token = safeStorage.getItem('volunteer_token');
    if (!token && typeof prompt !== 'undefined') {
      token = (prompt('Código de acesso da equipe de voluntários:') || '').trim();
      if (token) safeStorage.setItem('volunteer_token', token);
    }
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function forgetTeamTokenIfRejected(response) {
    if (response.status === 401) safeStorage.removeItem?.('volunteer_token');
  }

  window.applyZoneChanges = async () => {
    const zones = polygonEditor.getZones();
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: teamHeaders(),
        body: JSON.stringify(zones)
      });
      forgetTeamTokenIfRejected(res);
      if (res.ok) {
        window.appleAudio?.playSuccess();
        alert('Configuração de polígonos salva no servidor com sucesso.');
      } else {
        const result = await res.json().catch(() => ({}));
        alert(res.status === 401 ? 'Código de acesso inválido. Tente salvar novamente.' : `Não foi possível salvar: ${result.error || 'erro desconhecido'}.`);
      }
    } catch (e) {
      alert('Erro ao salvar polígonos.');
    }
  };

  const pendingOverrides = new Set();
  async function submitOverride(sectorId, status, volunteerName) {
    if (pendingOverrides.has(sectorId)) return;
    pendingOverrides.add(sectorId);
    const notify = (message, type) => window.LagoinhaParkingPolish?.showToast(message, type);
    notify('Enviando atualização…', 'sync');
    try {
      const response = await fetch('/api/override', {
        method: 'POST', headers: teamHeaders(),
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ sectorId, status, volunteerName })
      });
      forgetTeamTokenIfRejected(response);
      if (response.status === 401) {
        notify('Código de acesso da equipe inválido. Toque novamente para informar o código correto.', 'error');
        return;
      }
      if (!response.ok) throw new Error('Resposta inválida do servidor');
      const result = await response.json();
      if (result.success !== true) throw new Error('Atualização não confirmada');
      window.appleAudio?.playSuccess();
      notify(status === 'clear_override' ? 'Confirmação humana removida. Consulte o estado da análise.' : 'Atualização confirmada pelo servidor.', 'success');
      await fetchServerState();
    } catch (error) {
      notify('Não foi possível confirmar o envio. Confira a conexão e o estado do setor antes de tentar novamente.', 'error');
    } finally {
      pendingOverrides.delete(sectorId);
    }
  }

  window.sendHumanOverride = async (sectorId, status) => {
    let volunteerName = safeStorage.getItem('volunteer_name');
    if (!volunteerName) {
      volunteerName = typeof prompt !== 'undefined' ? prompt('Seu nome (voluntário):', 'Voluntário') : 'Voluntário';
      if (volunteerName === null) return;
      volunteerName = volunteerName.trim() || 'Voluntário';
      safeStorage.setItem('volunteer_name', volunteerName);
    }
    return submitOverride(sectorId, status, volunteerName);
  };
  window.clearOverride = async (sectorId) => submitOverride(sectorId, 'clear_override');

  // Video Source Selection
  const btnCctv = document.getElementById('btnSourceCctv');
  const btnSat = document.getElementById('btnSourceSat');
  const btnSynth = document.getElementById('btnSourceSynthetic');

  function updateSourceButtons(activeBtn) {
    [btnCctv, btnSat, btnSynth].forEach(b => {
      if (b) {
        b.classList.remove('btn-primary');
        b.classList.add('btn');
      }
    });
    if (activeBtn) {
      activeBtn.classList.add('btn-primary');
      activeBtn.classList.remove('btn');
    }
    updateHeaderStatusBadge();
  }

  btnCctv?.addEventListener('click', () => {
    window.appleAudio?.playTap();
    simulator.setSource('cctv_real');
    updateSourceButtons(btnCctv);
  });

  btnSat?.addEventListener('click', () => {
    window.appleAudio?.playTap();
    simulator.setSource('satellite_real');
    updateSourceButtons(btnSat);
  });

  btnSynth?.addEventListener('click', () => {
    window.appleAudio?.playTap();
    simulator.setSource('synthetic');
    updateSourceButtons(btnSynth);
  });

  document.getElementById('selectVisionFilter')?.addEventListener('change', (e) => {
    window.appleAudio?.playTap();
    simulator.setVisionFilter(e.target.value);
  });

  // Camera Toolstrip Controls
  const btnZoom1x = document.getElementById('btnZoom1x');
  const btnZoom15x = document.getElementById('btnZoom15x');
  const btnZoom2x = document.getElementById('btnZoom2x');

  function updateZoomButtons(activeBtn, level) {
    [btnZoom1x, btnZoom15x, btnZoom2x].forEach(b => {
      if (b) { b.classList.remove('btn-primary'); b.classList.add('btn'); }
    });
    if (activeBtn) { activeBtn.classList.add('btn-primary'); activeBtn.classList.remove('btn'); }
    simulator.setZoom(level);
    window.appleAudio?.playTap();
  }

  btnZoom1x?.addEventListener('click', () => updateZoomButtons(btnZoom1x, 1.0));
  btnZoom15x?.addEventListener('click', () => updateZoomButtons(btnZoom15x, 1.5));
  btnZoom2x?.addEventListener('click', () => updateZoomButtons(btnZoom2x, 2.0));

  const btnToggleHeatmap = document.getElementById('btnToggleHeatmap');
  btnToggleHeatmap?.addEventListener('click', () => {
    const isOn = simulator.toggleHeatmap();
    btnToggleHeatmap.classList.toggle('btn-primary', isOn);
    window.appleAudio?.playTap();
  });

  document.getElementById('btnExportSnapshot')?.addEventListener('click', () => {
    window.appleAudio?.playSuccess();
    simulator.exportSnapshot();
  });

  const btnFullscreen = document.getElementById('btnFullscreen');
  btnFullscreen?.addEventListener('click', () => {
    const wrapper = document.getElementById('videoWrapper');
    if (wrapper) {
      if (!document.fullscreenElement) {
        wrapper.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  });

  // Demo Controls
  document.getElementById('btnSimAddCars')?.addEventListener('click', () => {
    window.appleAudio?.playTap();
    simulator.addCarBurst(5);
  });

  document.getElementById('btnSimClearCars')?.addEventListener('click', () => {
    window.appleAudio?.playTap();
    simulator.clearSomeCars(4);
  });

  document.getElementById('btnSimSignalCut')?.addEventListener('click', () => {
    const isLost = simulator.toggleSignalLoss();
    if (isLost) window.appleAudio?.playAlert();
    else window.appleAudio?.playSuccess();
    document.getElementById('btnSimSignalCut').textContent = isLost ? 'Restaurar Câmera' : 'Simular Queda de Câmera';
  });

  document.getElementById('selectWeather')?.addEventListener('change', (e) => {
    window.appleAudio?.playTap();
    simulator.setWeather(e.target.value);
  });

  document.getElementById('localVideoFileInput')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      window.appleAudio?.playSuccess();
      simulator.loadLocalVideo(e.target.files[0]);
      updateHeaderStatusBadge();
    }
  });

  // Helpers
  function formatTimeAgo(timestamp) {
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 2) return 'agora mesmo';
    if (sec < 60) return `há ${sec}s`;
    const min = Math.floor(sec / 60);
    return `há ${min}m`;
  }

  function injectStaticIcons() {
    if (typeof AppleIcons === 'undefined') return;
    const navPortal = document.getElementById('navIconPortal');
    const navParking = document.getElementById('navIconParkingApp');
    const navOverview = document.getElementById('navIconOverview');
    const navEntrance = document.getElementById('navIconEntrance');
    const navVolunteer = document.getElementById('navIconVolunteer');
    const navEditor = document.getElementById('navIconEditor');
    const navAbout = document.getElementById('navIconAbout');

    if (navPortal) navPortal.innerHTML = AppleIcons.church || AppleIcons.home;
    if (navParking) navParking.innerHTML = AppleIcons.car;
    if (navOverview) navOverview.innerHTML = AppleIcons.video;
    if (navEntrance) navEntrance.innerHTML = AppleIcons.traffic;
    if (navVolunteer) navVolunteer.innerHTML = AppleIcons.mobile;
    if (navEditor) navEditor.innerHTML = AppleIcons.polygon;
    if (navAbout) navAbout.innerHTML = AppleIcons.info;

    const kpiCars = document.getElementById('kpiIconCars');
    const kpiAtt = document.getElementById('kpiIconAttention');
    const kpiConn = document.getElementById('kpiIconConnection');
    const kpiClock = document.getElementById('kpiIconClock');

    if (kpiCars) kpiCars.innerHTML = AppleIcons.car;
    if (kpiAtt) kpiAtt.innerHTML = AppleIcons.alertTriangle;
    if (kpiConn) kpiConn.innerHTML = AppleIcons.cpu;
    if (kpiClock) kpiClock.innerHTML = AppleIcons.clock;

    const iconHeatmap = document.getElementById('iconHeatmap');
    const iconSnap = document.getElementById('iconSnapshot');
    const iconFull = document.getElementById('iconFullscreen');
    const iconSliders = document.getElementById('iconSliders');

    if (iconHeatmap) iconHeatmap.innerHTML = AppleIcons.flame;
    if (iconSnap) iconSnap.innerHTML = AppleIcons.camera;
    if (iconFull) iconFull.innerHTML = AppleIcons.maximize;
    if (iconSliders) iconSliders.innerHTML = AppleIcons.sliders;

    const cardIconVideo = document.getElementById('cardIconVideo');
    const cardIconSectors = document.getElementById('cardIconSectors');
    const cardIconEntrance = document.getElementById('cardIconEntrance');
    const cardIconEditor = document.getElementById('cardIconEditor');
    const cardIconAbout = document.getElementById('cardIconAboutTab');

    if (cardIconVideo) cardIconVideo.innerHTML = AppleIcons.video;
    if (cardIconSectors) cardIconSectors.innerHTML = AppleIcons.traffic;
    if (cardIconEntrance) cardIconEntrance.innerHTML = AppleIcons.traffic;
    if (cardIconEditor) cardIconEditor.innerHTML = AppleIcons.polygon;
    if (cardIconAbout) cardIconAbout.innerHTML = AppleIcons.info;

    const iconCheckAbout = document.getElementById('iconCheckAbout');
    const iconSlidersAbout = document.getElementById('iconSlidersAbout');
    const iconAlertAbout = document.getElementById('iconAlertAbout');

    if (iconCheckAbout) iconCheckAbout.innerHTML = AppleIcons.checkCircle;
    if (iconSlidersAbout) iconSlidersAbout.innerHTML = AppleIcons.sliders;
    if (iconAlertAbout) iconAlertAbout.innerHTML = AppleIcons.alertTriangle;
  }
});
