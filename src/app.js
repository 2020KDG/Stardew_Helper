const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

window.addEventListener("DOMContentLoaded", async () => {
  // --- Window Controls ---
  const minimizeBtn = document.getElementById('titlebar-minimize');
  const closeBtn = document.getElementById('titlebar-close');
  const dragRegion = document.querySelector('.custom-titlebar');

  minimizeBtn?.addEventListener('click', () => {
    invoke('minimize_window');
  });

  closeBtn?.addEventListener('click', () => {
    invoke('close_window');
  });

  dragRegion?.addEventListener('mousedown', (e) => {
    if (e.target.closest('.titlebar-button')) return;
    invoke('start_dragging');
  });

  // --- Auto Updater ---
  async function checkForUpdates() {
    try {
      console.log("Checking for updates...");
      const update = await invoke('plugin:updater|check');
      console.log("Update check result:", update);
      
      // In Tauri v2, update is either null or an object with version info.
      if (update && update.version) {
        if (confirm(`✨ 새로운 버전(${update.version})이 출시되었습니다!\n지금 바로 업데이트를 설치하고 다시 시작하시겠습니까?`)) {
          // Show updating UI
          const loadingStatusText = document.getElementById('loading-status-text');
          if (loadingStatusText) {
            loadingStatusText.textContent = "업데이트를 다운로드 중입니다...";
            document.getElementById('loading-overlay').classList.add('active');
          }
          await invoke('plugin:updater|download_and_install', { onEvent: null });
          await invoke('plugin:process|relaunch');
        }
      }
    } catch (e) {
      console.error("Auto-updater failed:", e);
    }
  }
  checkForUpdates();

  // --- Views & UI Elements ---
  const loadingStatusText = document.getElementById('loading-status-text');
  
  // Dashboard Tabs
  const navItems = document.querySelectorAll('.sidebar-nav-btn');
  const tabContents = document.querySelectorAll('.dashboard-tab-content');
  const rightPanel = document.querySelector('.launcher-right-panel');

  let tabTransitionTimeout;

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetTab = item.dataset.tab;
      const targetEl = document.getElementById(`tab-${targetTab}`);
      
      if (item.classList.contains('active')) return;

      if (tabTransitionTimeout) clearTimeout(tabTransitionTimeout);

      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      tabContents.forEach(tab => tab.classList.remove('active'));
      
      if (rightPanel && targetTab !== 'dashboard') {
        rightPanel.classList.add('collapsed');
      }
      
      tabTransitionTimeout = setTimeout(() => {
        if (targetEl) targetEl.classList.add('active');
        if (rightPanel && targetTab === 'dashboard') {
          rightPanel.classList.remove('collapsed');
        }
      }, 250);
    });
  });

  // --- System Status Updates ---
  const launchBtn = document.getElementById('btn-launch-game');

  function updateStatusItem(element, stateClass, text) {
    if (!element) return;
    element.className = `status-item ${stateClass}`;
    const valEl = element.querySelector('.status-text');
    if (valEl) {
      valEl.innerText = text;
    }
  }

  function updateStatusIndicators(mode) {
    const statusGame = document.getElementById('status-game');
    const statusSmapi = document.getElementById('status-smapi');
    const statusOverlay = document.getElementById('status-overlay');
    
    // Add logic for Save Time if it were a card, but it's in dashboard stats now!
    // So we don't have statusSave card anymore on the right side.
    
    if (mode === "None") {
      updateStatusItem(statusGame, 'waiting', '게임 연결 대기중');
      updateStatusItem(statusSmapi, 'waiting', 'SMAPI 대기중');
      updateStatusItem(statusOverlay, 'waiting', '오버레이 대기중');
      
      if (launchBtn) {
        launchBtn.className = 'launch-btn main-action';
        launchBtn.disabled = false;
        launchBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="currentColor" d="M8 5v14l11-7z"/></svg><span>게임 실행하기</span>';
      }
    } else {
      updateStatusItem(statusGame, 'good', '게임 연결됨');
      updateStatusItem(statusSmapi, mode === "SMAPI" ? 'good' : 'info', mode === "SMAPI" ? 'SMAPI 연결됨' : '바닐라 모드 실행중');
      updateStatusItem(statusOverlay, 'good', '오버레이 활성화');
      
      if (launchBtn) {
        launchBtn.className = 'launch-btn main-action connected';
        launchBtn.disabled = true;
        launchBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><span>Connected</span>';
      }
    }
  }

  // --- Launch Game Event ---
  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      // Prevent multiple clicks
      if (launchBtn.disabled) return;
      
      launchBtn.className = 'launch-btn main-action launching';
      launchBtn.disabled = true;
      launchBtn.innerHTML = '<span>⏳ Launching Game...</span>';
      
      // Call Rust backend to launch the game
      invoke('launch_game').catch((err) => {
        console.error("Failed to launch game:", err);
        // Reset button on failure
        updateStatusIndicators("None");
      });
    });
  }

  // --- Game State Listener ---
  let currentMode = "None";

  listen("game-state-changed", (event) => {
    const mode = event.payload;
    if (mode === currentMode) return; // 중복 이벤트 방지
    currentMode = mode;
    updateStatusIndicators(mode);
  });

  listen("recommend-mod-install", () => {
    const toast = document.createElement("div");
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = "rgba(255, 243, 205, 0.95)";
    toast.style.color = "#856404";
    toast.style.padding = "16px 24px";
    toast.style.borderRadius = "12px";
    toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
    toast.style.zIndex = "9999";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "500";
    toast.style.maxWidth = "400px";
    toast.style.lineHeight = "1.5";
    toast.style.border = "1px solid #ffeeba";
    toast.style.transition = "opacity 0.4s ease, bottom 0.4s ease";
    toast.style.backdropFilter = "blur(10px)";
    
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <strong style="font-size:15px;">모드 설치 권장</strong>
      </div>
      스타듀밸리가 실행 중이지만 <b>스타듀헬퍼 모드</b>가 없습니다.<br>실시간 연동을 위해 우측 하단의 [모드 설치] 버튼을 눌러주세요!
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.bottom = "10px";
      setTimeout(() => toast.remove(), 400);
    }, 8000);
  });

  // --- Save Data Listener ---
  const displayFarmName = document.getElementById('display-farm-name');
  const displayFarmMeta = document.getElementById('display-farm-meta');
  const displayFarmGold = document.getElementById('display-farm-gold');
  const displayPlayTime = document.getElementById('display-play-time');
  const displaySaveDate = document.getElementById('display-save-date');
  const displaySeason = document.getElementById('display-season');

  listen("save-updated", (event) => {
    const data = event.payload;
    if (!data) return;

    if (displayFarmName) displayFarmName.textContent = `${data.farm_name} Farm`;
    if (displayFarmMeta) {
      displayFarmMeta.innerHTML = `Player: ${data.player_name} | <strong>Year ${data.year} · ${data.current_season} ${data.day_of_month}</strong>`;
    }
    if (displayFarmGold) displayFarmGold.textContent = `${data.money.toLocaleString()} G`;
    
    if (displayPlayTime) {
      if (data.time_played && data.time_played !== "") {
        displayPlayTime.textContent = data.time_played;
      } else if (data.days_played > 0) {
        displayPlayTime.textContent = `${data.days_played} Days in-game`;
      } else {
        displayPlayTime.textContent = "Unknown";
      }
    }
    
    if (displaySaveDate) {
      const now = new Date();
      displaySaveDate.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (displaySeason) {
      const seasonEmojiMap = {
        "spring": "🌸 봄",
        "summer": "☀️ 여름",
        "fall": "🍂 가을",
        "winter": "❄️ 겨울"
      };
      displaySeason.textContent = seasonEmojiMap[data.current_season.toLowerCase()] || data.current_season;
    }
  });

  // --- Config & Settings Logic ---
  const hotkeyBtn = document.getElementById('btn-hotkey-change');
  const hotkeyLabel = document.getElementById('current-hotkey-label');
  const inputGamePath = document.getElementById('input-game-path');
  const btnBrowsePath = document.getElementById('btn-browse-path');
  
  let appConfig = { hotkey: "Insert", game_path: "" };
  let isListeningForKey = false;

  async function loadConfig() {
    try {
      appConfig = await invoke('get_config');
      if (hotkeyLabel) hotkeyLabel.textContent = appConfig.hotkey || "Insert";
      if (inputGamePath) inputGamePath.value = appConfig.game_path || "";
      updateLaunchModeUI(appConfig.launch_mode || "Vanilla");
      await checkModInstalled();
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  }

  async function saveConfig() {
    try {
      await invoke('save_config', { newConfig: appConfig });
    } catch (err) {
      console.error("Failed to save config:", err);
      throw err;
    }
  }

  loadConfig();

  // --- Launch Mode Toggle ---
  const modeToggle = document.getElementById("launch-mode-toggle");
  const modeThumb = document.getElementById("launch-mode-thumb");
  const labelVanilla = document.getElementById("label-mode-vanilla");
  const labelSmapi = document.getElementById("label-mode-smapi");

  function updateLaunchModeUI(mode) {
    if (mode === "SMAPI") {
      if (modeThumb) modeThumb.style.transform = "translateX(18px)";
      if (modeToggle) modeToggle.style.background = "#2ecc71";
      if (labelVanilla) { labelVanilla.style.fontWeight = "500"; labelVanilla.style.opacity = "0.5"; }
      if (labelSmapi) { labelSmapi.style.fontWeight = "600"; labelSmapi.style.opacity = "1"; }
    } else {
      if (modeThumb) modeThumb.style.transform = "translateX(0)";
      if (modeToggle) modeToggle.style.background = "rgba(0,0,0,0.1)";
      if (labelVanilla) { labelVanilla.style.fontWeight = "600"; labelVanilla.style.opacity = "1"; }
      if (labelSmapi) { labelSmapi.style.fontWeight = "500"; labelSmapi.style.opacity = "0.5"; }
    }
  }

  if (modeToggle) {
    modeToggle.addEventListener("click", async () => {
      appConfig.launch_mode = (appConfig.launch_mode === "SMAPI") ? "Vanilla" : "SMAPI";
      updateLaunchModeUI(appConfig.launch_mode);
      await saveConfig();
    });
  }

  if (hotkeyBtn && hotkeyLabel) {
    hotkeyBtn.addEventListener('click', () => {
      if (isListeningForKey) return;
      isListeningForKey = true;
      hotkeyBtn.classList.add('listening');
      hotkeyLabel.textContent = "입력 대기중..";
    });

    window.addEventListener('keydown', async (e) => {
      if (!isListeningForKey) return;
      e.preventDefault(); 
      
      const keyCode = e.code;
      hotkeyBtn.classList.remove('listening');
      hotkeyLabel.textContent = keyCode;
      isListeningForKey = false;

      appConfig.hotkey = keyCode;
      await saveConfig().then(() => {
        hotkeyBtn.classList.add('saved');
        setTimeout(() => hotkeyBtn.classList.remove('saved'), 1000);
      }).catch(err => {
        hotkeyLabel.textContent = "Error";
      });
    });
  }

  if (btnBrowsePath) {
    btnBrowsePath.addEventListener('click', async () => {
      try {
        const { open } = window.__TAURI__.dialog;
        const selected = await open({
          directory: true,
          multiple: false,
          title: "스타듀밸리 설치 폴더 선택"
        });
        if (selected) {
          appConfig.game_path = selected;
          inputGamePath.value = selected;
          await saveConfig();
          await checkModInstalled();
        }
      } catch(err) {
        console.error(err);
      }
    });
  }

  async function checkModInstalled() {
    if (!btnInstallHelperMod) return;
    try {
      const isInstalled = await invoke('check_mod_installed');
      if (isInstalled) {
        btnInstallHelperMod.disabled = true;
        btnInstallHelperMod.innerHTML = `<span>✅ 이미 모드가 설치되어 있습니다</span>`;
        btnInstallHelperMod.style.background = 'rgba(46, 204, 113, 0.15)';
        btnInstallHelperMod.style.borderColor = 'rgba(46, 204, 113, 0.3)';
        btnInstallHelperMod.style.color = '#2e7d32';
        btnInstallHelperMod.style.cursor = 'default';
      } else {
        btnInstallHelperMod.disabled = false;
        btnInstallHelperMod.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          <span id="btn-install-helper-mod-text">스타듀헬퍼 모드 설치</span>
        `;
        btnInstallHelperMod.style.background = 'rgba(0,0,0,0.04)';
        btnInstallHelperMod.style.borderColor = 'rgba(0,0,0,0.08)';
        btnInstallHelperMod.style.color = '#6d4c41';
        btnInstallHelperMod.style.cursor = 'pointer';
      }
    } catch(err) {
      console.error(err);
    }
  }

  // --- Install Mod Logic ---
  const btnInstallHelperMod = document.getElementById('btn-install-helper-mod');
  if (btnInstallHelperMod) {
    btnInstallHelperMod.addEventListener('click', async () => {
      btnInstallHelperMod.disabled = true;
      const originalHtml = btnInstallHelperMod.innerHTML;
      btnInstallHelperMod.innerHTML = '<span>⏳ 설치 중...</span>';
      
      try {
        const msg = await invoke('install_smapi_mod');
        btnInstallHelperMod.innerHTML = `<span>✅ 설치 완료!</span>`;
        btnInstallHelperMod.style.background = 'rgba(46, 204, 113, 0.3)';
        setTimeout(() => {
          checkModInstalled();
        }, 2000);
      } catch (err) {
        btnInstallHelperMod.innerHTML = `<span style="font-size: 12px;">❌ ${err}</span>`;
        btnInstallHelperMod.style.background = 'rgba(231, 76, 60, 0.2)';
        btnInstallHelperMod.style.color = '#e74c3c';
        btnInstallHelperMod.style.borderColor = '#e74c3c';
        setTimeout(() => {
          checkModInstalled();
        }, 4000);
      }
    });
  }

  // --- Mod Download Buttons (Visual Mockup) ---
  const modBtns = document.querySelectorAll('.mod-action-btn');
  modBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('downloading')) return;
      btn.classList.add('downloading');
      btn.textContent = "다운로드 중...";
      setTimeout(() => {
        btn.textContent = "설치 완료";
        btn.style.background = "#388E3C";
        btn.style.color = "white";
        btn.style.borderColor = "#1B5E20";
      }, 2000);
    });
  });

  // 초기 상태 가져오기
  invoke('get_initial_game_state').then((mode) => {
    currentMode = mode;
    updateStatusIndicators(mode);
  });
});
