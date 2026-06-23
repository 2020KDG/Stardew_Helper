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
  const navItems = document.querySelectorAll('.top-tab-btn');
  const tabContents = document.querySelectorAll('.dashboard-tab-content');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(nav => nav.classList.remove('active'));
      tabContents.forEach(tab => tab.classList.remove('active'));
      
      item.classList.add('active');
      const tabId = `tab-${item.dataset.tab}`;
      document.getElementById(tabId)?.classList.add('active');
    });
  });

  // --- Loading Messages ---
  const loadingMessages = [
    "게임이 실행되면 자동으로 연결됩니다.",
    "SMAPI 플러그인을 감지하는 중...",
    "저장 데이터를 분석하는 중...",
    "스듀 헬퍼 백그라운드 준비 중...",
    "잠시만 기다려주세요..."
  ];
  let loadingMessageIndex = 0;
  let loadingMessageInterval = null;

  function startLoadingMessages() {
    if (loadingMessageInterval) return;
    loadingMessageIndex = 0;
    if (loadingStatusText) {
      loadingStatusText.textContent = loadingMessages[loadingMessageIndex];
      loadingStatusText.classList.remove("fade-out");
    }

    loadingMessageInterval = setInterval(() => {
      if (!loadingStatusText) return;
      loadingStatusText.classList.add("fade-out");
      setTimeout(() => {
        loadingMessageIndex = (loadingMessageIndex + 1) % loadingMessages.length;
        loadingStatusText.textContent = loadingMessages[loadingMessageIndex];
        loadingStatusText.classList.remove("fade-out");
      }, 800);
    }, 4000);
  }

  function stopLoadingMessages() {
    if (loadingMessageInterval) {
      clearInterval(loadingMessageInterval);
      loadingMessageInterval = null;
    }
  }

  startLoadingMessages();

  // --- State Transition Logic ---
  const iconCircle = '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>';
  const iconCheck = '<path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>';

  function updateChecklist(mode) {
    const step1 = document.getElementById('status-step-1');
    const step2 = document.getElementById('status-step-2');
    const step3 = document.getElementById('status-step-3');

    if (mode === "None") {
      startLoadingMessages();
      if (step1) {
        step1.className = 'status-item active';
        step1.querySelector('svg').innerHTML = iconCircle;
        step1.querySelector('.status-text').innerText = "게임 프로세스 감지 대기 중";
      }
      if (step2) {
        step2.className = 'status-item pending';
        step2.querySelector('svg').innerHTML = iconCircle;
        step2.querySelector('.status-text').innerText = "플러그인 및 모드 확인";
      }
      if (step3) {
        step3.className = 'status-item pending';
        step3.querySelector('svg').innerHTML = iconCircle;
        step3.querySelector('.status-text').innerText = "오버레이 연결 준비";
      }
    } else {
      stopLoadingMessages();
      if (loadingStatusText) {
        loadingStatusText.textContent = "메인 런처를 실행합니다...";
        loadingStatusText.classList.remove("fade-out");
      }
      if (step1) {
        step1.className = 'status-item active';
        step1.querySelector('svg').innerHTML = iconCheck;
        step1.querySelector('.status-text').innerText = "게임 프로세스 감지 완료";
      }
      if (step2) {
        step2.className = 'status-item active';
        step2.querySelector('svg').innerHTML = iconCheck;
        step2.querySelector('.status-text').innerText = mode === "SMAPI" ? "SMAPI 플러그인 확인 완료" : "바닐라 게임 확인 완료";
      }
      if (step3) {
        step3.className = 'status-item active';
        step3.querySelector('svg').innerHTML = iconCheck;
        step3.querySelector('.status-text').innerText = "오버레이 연결 성공";
      }

      // 런처 모드 뱃지 업데이트
      const badge = document.getElementById("mode-badge");
      if (badge) {
        badge.innerText = mode === "SMAPI" ? "SMAPI MODE" : "VANILLA MODE";
        badge.className = mode === "SMAPI" ? "badge smapi" : "badge vanilla";
      }
    }
  }

  function switchToLauncher() {
    const statusCard = document.getElementById('startup-status-card');
    const dashboardGrid = document.getElementById('dashboard-grid');

    if (statusCard) statusCard.classList.add('collapse-status');
    if (dashboardGrid) dashboardGrid.classList.remove('pending-reveal');
  }

  function switchToLoading() {
    const statusCard = document.getElementById('startup-status-card');
    const dashboardGrid = document.getElementById('dashboard-grid');

    if (statusCard) statusCard.classList.remove('collapse-status');
    if (dashboardGrid) dashboardGrid.classList.add('pending-reveal');
    
    updateChecklist("None");
  }

  let currentMode = "None";

  listen("game-state-changed", (event) => {
    const mode = event.payload;
    if (mode === currentMode) return; // 중복 이벤트 방지
    currentMode = mode;

    if (mode === "None") {
      switchToLoading();
    } else {
      updateChecklist(mode);
      setTimeout(() => {
        switchToLauncher();
      }, 1000);
    }
  });

  // 초기 상태 가져오기
  invoke('get_initial_game_state').then((mode) => {
    currentMode = mode;
    if (mode !== "None") {
      // 이미 켜져있으면 바로 대시보드 표시
      switchToLauncher();
      updateChecklist(mode);
    }
  });
});
