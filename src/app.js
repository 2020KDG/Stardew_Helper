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

  // --- Hotkey Logic ---
  const hotkeyBtn = document.getElementById('btn-hotkey-change');
  const hotkeyLabel = document.getElementById('current-hotkey-label');
  let isListeningForKey = false;

  if (hotkeyBtn && hotkeyLabel) {
    invoke('get_hotkey').then((currentKey) => {
      hotkeyLabel.textContent = currentKey || "Insert";
    });

    hotkeyBtn.addEventListener('click', () => {
      if (isListeningForKey) return;
      isListeningForKey = true;
      hotkeyBtn.classList.add('listening');
      hotkeyLabel.textContent = "입력 대기중..";
    });

    window.addEventListener('keydown', (e) => {
      if (!isListeningForKey) return;
      e.preventDefault(); 
      
      const keyCode = e.code; // e.g. "F4", "KeyA"
      hotkeyBtn.classList.remove('listening');
      hotkeyLabel.textContent = keyCode;
      isListeningForKey = false;

      invoke('set_hotkey', { newKey: keyCode }).then(() => {
        hotkeyBtn.classList.add('saved');
        setTimeout(() => hotkeyBtn.classList.remove('saved'), 1000);
      }).catch(err => {
        console.error("Failed to set hotkey", err);
        hotkeyLabel.textContent = "Error";
      });
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
