import { ACHIEVEMENTS } from './achievements_data.js';
import { BUNDLES_DATA } from './bundles_data.js';

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// UI Elements
let playerNameEl, farmNameEl, moneyEl, dateEl, refreshIconBtn;
let achievementsListEl, achievementsHeaderTitleEl;
let searchInputEl;
let filterBtns;
let navBtns, viewSections;
let bundlesListEl;
let jojaListEl;

let currentSaveData = null;
let currentSearchTerm = '';
let currentFilter = 'all';

let cropsData = null;
let fishData = null;

async function loadStaticData() {
  try {
    const cropsRes = await fetch('data/crops.json');
    if (cropsRes.ok) cropsData = await cropsRes.json();
    
    const fishRes = await fetch('data/fish.json');
    if (fishRes.ok) fishData = await fishRes.json();
  } catch (err) {
    console.error("Failed to load static data:", err);
  }
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US').format(amount) + 'G';
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateMainUI(saveData) {
  if (playerNameEl) playerNameEl.textContent = saveData.player_name || 'Unknown';
  if (farmNameEl) farmNameEl.textContent = (saveData.farm_name || 'Unknown') + ' Farm';
  if (moneyEl) moneyEl.textContent = formatMoney(saveData.money || 0);
  
  if (dateEl) {
    const season = capitalize(saveData.current_season);
    const day = saveData.day_of_month || 1;
    const year = saveData.year || 1;
    dateEl.textContent = `Year ${year}, ${season} ${day}`;
  }
}

function renderAchievements() {
  if (!achievementsListEl) return;
  
  const unlockedIds = currentSaveData ? currentSaveData.achievements : [];
  const idsSet = new Set(unlockedIds || []);
  const totalMoney = currentSaveData ? (currentSaveData.total_money_earned || 0) : 0;
  const houseUpgradeLevel = currentSaveData ? (currentSaveData.house_upgrade_level || 0) : 0;
  
  // New Fallback Audit Variables
  const museumPieces = currentSaveData ? (currentSaveData.museum_pieces || 0) : 0;
  const questsCompleted = currentSaveData ? (currentSaveData.quests_completed || 0) : 0;
  const fishCaught = currentSaveData ? (currentSaveData.fish_caught || 0) : 0;
  const recipesCooked = currentSaveData ? (currentSaveData.recipes_cooked || 0) : 0;
  const craftingRecipes = currentSaveData ? (currentSaveData.crafting_recipes || 0) : 0;
  const friendshipFiveHearts = currentSaveData ? (currentSaveData.friendship_five_hearts || 0) : 0;
  const friendshipTenHearts = currentSaveData ? (currentSaveData.friendship_ten_hearts || 0) : 0;
  const mailReceived = currentSaveData ? (currentSaveData.mail_received || []) : [];
  const specificMonstersKilled = currentSaveData ? (currentSaveData.specific_monsters_killed || {}) : {};
  
  const hasSkullKey = currentSaveData ? !!currentSaveData.has_skull_key : false;
  const maxStamina = currentSaveData ? (currentSaveData.max_stamina || 273) : 273;
  const spouse = currentSaveData ? (currentSaveData.spouse || "") : "";
  const childrenCount = currentSaveData ? (currentSaveData.children_count || 0) : 0;
  const farmingLevel = currentSaveData ? (currentSaveData.farming_level || 0) : 0;
  const miningLevel = currentSaveData ? (currentSaveData.mining_level || 0) : 0;
  const combatLevel = currentSaveData ? (currentSaveData.combat_level || 0) : 0;
  const foragingLevel = currentSaveData ? (currentSaveData.foraging_level || 0) : 0;
  const fishingLevel = currentSaveData ? (currentSaveData.fishing_level || 0) : 0;

  const totalCount = ACHIEVEMENTS.length;
  let clearedCount = 0;
  
  let list = ACHIEVEMENTS.map(ach => {
    let isCleared = idsSet.has(ach.id);
    
    if (!isCleared) {
      if (ach.id === 0 && totalMoney >= 15000) isCleared = true; 
      if (ach.id === 1 && totalMoney >= 50000) isCleared = true; 
      if (ach.id === 2 && totalMoney >= 250000) isCleared = true; 
      if (ach.id === 3 && totalMoney >= 1000000) isCleared = true; 
      if (ach.id === 4 && totalMoney >= 10000000) isCleared = true; 
      
      if (ach.id === 18 && houseUpgradeLevel >= 1) isCleared = true; 
      if (ach.id === 19 && houseUpgradeLevel >= 2) isCleared = true; 

      if (ach.id === 28 && museumPieces >= 40) isCleared = true; 
      if (ach.id === 5 && museumPieces >= 95) isCleared = true; 

      if (ach.id === 29 && questsCompleted >= 10) isCleared = true; 
      if (ach.id === 30 && questsCompleted >= 40) isCleared = true; 

      if (ach.id === 27 && fishCaught >= 100) isCleared = true; 

      if (ach.id === 15 && recipesCooked >= 10) isCleared = true; 
      if (ach.id === 16 && recipesCooked >= 25) isCleared = true; 
      if (ach.id === 17 && recipesCooked >= 80) isCleared = true; 

      if (ach.id === 20 && craftingRecipes >= 15) isCleared = true; 
      if (ach.id === 21 && craftingRecipes >= 30) isCleared = true; 

      if (ach.id === 6 && friendshipFiveHearts >= 1) isCleared = true; 
      if (ach.id === 11 && friendshipFiveHearts >= 4) isCleared = true; 
      if (ach.id === 12 && friendshipFiveHearts >= 10) isCleared = true; 
      if (ach.id === 13 && friendshipFiveHearts >= 20) isCleared = true; 

      if (ach.id === 7 && friendshipTenHearts >= 1) isCleared = true; 
      if (ach.id === 9 && friendshipTenHearts >= 8) isCleared = true; 

      if (ach.id === 101 && mailReceived.includes("ccIsComplete")) isCleared = true; 
      if (ach.id === 102 && 
          mailReceived.includes("jojaBoilerRoom") && 
          mailReceived.includes("jojaFishTank") && 
          mailReceived.includes("jojaCraftsRoom") && 
          mailReceived.includes("jojaPantry") && 
          mailReceived.includes("jojaVault")) {
        isCleared = true; 
      }
      if (ach.id === 103 && maxStamina >= 508) isCleared = true; 
      if (ach.id === 104 && spouse !== "" && childrenCount >= 2) isCleared = true; 
      if (ach.id === 105 && (farmingLevel >= 10 || miningLevel >= 10 || combatLevel >= 10 || foragingLevel >= 10 || fishingLevel >= 10)) isCleared = true; 
      if (ach.id === 106 && farmingLevel >= 10 && miningLevel >= 10 && combatLevel >= 10 && foragingLevel >= 10 && fishingLevel >= 10) isCleared = true; 
      if (ach.id === 107 && checkMonsterEradicationGoals(specificMonstersKilled)) isCleared = true; 
      if (ach.id === 23 && currentSaveData && currentSaveData.has_skull_key) isCleared = true; 
    }
    
    if (isCleared) clearedCount++;
    return { ...ach, isCleared };
  });
  
  if (achievementsHeaderTitleEl) {
    achievementsHeaderTitleEl.textContent = `도전과제 진행상황: ${clearedCount} / ${totalCount} 완료`;
  }
  
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    list = list.filter(ach => ach.title.toLowerCase().includes(term));
  }

  if (currentFilter === 'progress') {
    list = list.filter(ach => !ach.isCleared);
  } else if (currentFilter === 'completed') {
    list = list.filter(ach => ach.isCleared);
  }
  
  list.sort((a, b) => {
    if (a.isCleared === b.isCleared) return a.id - b.id;
    return a.isCleared ? 1 : -1;
  });

  achievementsListEl.innerHTML = '';
  
  if (list.length === 0) {
    achievementsListEl.innerHTML = `<div style="padding: 20px; font-size: 1.1rem; color: #5d3d19;">해당 조건의 도전과제가 없습니다.</div>`;
    return;
  }
  
  const grouped = {};
  list.forEach(ach => {
    const cat = ach.category || "기타";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ach);
  });

  const categoryOrder = ["재력", "우정", "요리", "제작 및 업그레이드", "낚시", "수집", "모험", "심부름", "스킬", "기타"];

  categoryOrder.forEach(catName => {
    if (!grouped[catName] || grouped[catName].length === 0) return;

    const groupItems = grouped[catName];
    const catIcon = groupItems[0].icon || "⭐";

    const totalCount = groupItems.length;
    const clearedCount = groupItems.filter(a => a.isCleared).length;

    const sidebarNavBtn = document.querySelector(`.sub-nav-btn[data-achieve-cat="${catName}"] .nav-count`);
    if (sidebarNavBtn) {
      sidebarNavBtn.textContent = `${clearedCount} / ${totalCount}`;
    }

    const catId = catName.replace(/ /g, '-');

    const sectionWrapper = document.createElement('div');
    sectionWrapper.className = 'achieve-category-section';
    sectionWrapper.id = `achieve-cat-${catId}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'achieve-category-header';
    headerEl.innerHTML = `
      <div class="header-title-wrap"><span class="cat-icon">${catIcon}</span> ${catName}</div>
      <div class="achieve-category-progress">${totalCount}개 중 ${clearedCount}개 완료</div>
    `;
    sectionWrapper.appendChild(headerEl);

    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'achieve-category-group';

    groupItems.forEach(ach => {
      const item = document.createElement('div');
      item.className = `achieve-item ${ach.isCleared ? 'completed' : ''}`;
      
      let statusClass = 'status-progress';
      let statusText = '🟡 진행중';
      if (ach.isCleared) {
        statusClass = 'status-completed';
        statusText = '🟢 완료';
      }

      item.innerHTML = `
        <div class="achieve-content">
          <div class="achieve-top-row">
            <div class="achieve-title"><span class="achieve-icon">${ach.icon}</span> ${ach.title}</div>
            <div class="achieve-desc">${ach.desc}</div>
          </div>
          <div class="achieve-guide">⭐ ${ach.guide}</div>
        </div>
        <div class="achieve-badge-container">
          <div class="achieve-status ${statusClass}">${statusText}</div>
        </div>
      `;
      groupWrapper.appendChild(item);
    });

    sectionWrapper.appendChild(groupWrapper);
    achievementsListEl.appendChild(sectionWrapper);
  });
}

let currentBundleFilter = 'all';

function renderBundles() {
  if (!bundlesListEl) return;
  
  const bundlesMap = currentSaveData ? currentSaveData.bundles : {};
  const rooms = {};
  
  BUNDLES_DATA.forEach(bundle => {
    if (bundle.room === "조자 지역 개발 서식") return;
    
    const savedStatus = bundlesMap[bundle.id] || [];
    const totalItems = bundle.items.length;
    let completedItems = 0;
    
    bundle.items.forEach((_, idx) => {
      if (savedStatus[idx] === true) completedItems++;
    });

    const targetCount = bundle.reqCount || totalItems;
    let status = 'not-started';
    if (completedItems >= targetCount) status = 'completed';
    else if (completedItems > 0) status = 'progress';

    if (currentBundleFilter === 'progress' && status !== 'progress') return;
    if (currentBundleFilter === 'completed' && status !== 'completed') return;

    if (!rooms[bundle.room]) rooms[bundle.room] = { bundles: [], totalCompleted: 0, totalBundles: 0 };
    rooms[bundle.room].bundles.push({ ...bundle, savedStatus, completedItems, targetCount, status });
  });

  BUNDLES_DATA.forEach(bundle => {
    if (rooms[bundle.room]) {
      rooms[bundle.room].totalBundles++;
      const savedStatus = bundlesMap[bundle.id] || [];
      const targetCount = bundle.reqCount || bundle.items.length;
      let c = 0;
      bundle.items.forEach((_, idx) => { if (savedStatus[idx] === true) c++; });
      if (c >= targetCount) rooms[bundle.room].totalCompleted++;
    }
  });

  bundlesListEl.innerHTML = '';

  if (Object.keys(rooms).length === 0) {
    bundlesListEl.innerHTML = `<div style="padding: 20px; color: #5d3d19;">해당 조건의 꾸러미가 없습니다.</div>`;
    return;
  }

  for (const [roomName, roomData] of Object.entries(rooms)) {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'bundle-room';
    roomDiv.id = `room-${roomName}`;
    
    let roomIcon = '📦';
    if (roomName.includes('식료품')) roomIcon = '🌱';
    else if (roomName.includes('공예실')) roomIcon = '🧶';
    else if (roomName.includes('보일러실')) roomIcon = '⚒️';
    else if (roomName.includes('금고')) roomIcon = '💰';
    else if (roomName.includes('어항')) roomIcon = '🐠';
    else if (roomName.includes('게시판')) roomIcon = '📌';
    else if (roomName.includes('조자마트')) roomIcon = '🛒';

    const headerEl = document.createElement('div');
    headerEl.className = 'achieve-category-header bundle-room-header';
    headerEl.innerHTML = `
      <div class="header-title-wrap"><span class="cat-icon">${roomIcon}</span> ${roomName}</div>
      <div class="achieve-category-progress">${roomData.totalBundles}개 중 ${roomData.totalCompleted}개 완료</div>
    `;
    roomDiv.appendChild(headerEl);

    const grid = document.createElement('div');
    grid.className = 'bundle-cards-grid';

    roomData.bundles.forEach(b => {
      const card = document.createElement('div');
      card.className = `bundle-card ${b.status === 'completed' ? 'completed' : ''}`;
      
      let badgeClass = 'badge-not-started';
      let badgeText = '⚪ 미시작';
      if (b.status === 'completed') { badgeClass = 'badge-completed'; badgeText = '🟢 완료'; }
      else if (b.status === 'progress') { badgeClass = 'badge-progress'; badgeText = '🟡 진행중'; }

      const header = document.createElement('div');
      header.className = 'bundle-card-header';
      header.innerHTML = `
        <div class="bundle-title-row">
          <span class="bundle-title">${b.name}</span>
          <span class="bundle-badge ${badgeClass}">${badgeText}</span>
        </div>
        ${b.desc ? `<div class="bundle-desc" style="font-size: 0.85em; color: #6e4e2a; margin-top: 5px; margin-bottom: 5px;">${b.desc}</div>` : ''}
        <div class="bundle-count">${b.completedItems} / ${b.targetCount} 완료</div>
      `;
      card.appendChild(header);

      const itemList = document.createElement('div');
      itemList.className = 'bundle-item-list';

      b.items.forEach((itemText, index) => {
        const isChecked = b.savedStatus[index] === true;
        const itemDiv = document.createElement('div');
        itemDiv.className = `bundle-req-item ${isChecked ? 'checked' : ''}`;
        const icon = isChecked ? '☑' : '☐';
        itemDiv.innerHTML = `<span class="check-icon">${icon}</span> <span>${itemText}</span>`;
        itemList.appendChild(itemDiv);
      });

      card.appendChild(itemList);
      grid.appendChild(card);
    });

    roomDiv.appendChild(grid);
    bundlesListEl.appendChild(roomDiv);
  }
}

function updateUI(saveData) {
  if (!saveData) return;
  currentSaveData = saveData;
  updateMainUI(saveData);
  renderAchievements();
  renderBundles();
  renderJojaBundles();
}

function renderJojaBundles() {
  if (!jojaListEl) return;
  
  const bundlesMap = currentSaveData ? currentSaveData.bundles : {};
  const mailReceived = currentSaveData ? (currentSaveData.mail_received || []) : [];
  const rooms = {};
  
  BUNDLES_DATA.forEach(bundle => {
    if (bundle.room !== "조자 지역 개발 서식") return;
    
    let isJojaCompleted = false;
    if (bundle.id === 40 && mailReceived.includes("jojaBoilerRoom")) isJojaCompleted = true; // 광산 수레
    if (bundle.id === 41 && mailReceived.includes("jojaFishTank")) isJojaCompleted = true; // 패닝
    if (bundle.id === 42 && mailReceived.includes("jojaCraftsRoom")) isJojaCompleted = true; // 다리 수리
    if (bundle.id === 43 && mailReceived.includes("jojaPantry")) isJojaCompleted = true; // 온실
    if (bundle.id === 44 && mailReceived.includes("jojaVault")) isJojaCompleted = true; // 버스

    const totalItems = bundle.items.length;
    let completedItems = isJojaCompleted ? totalItems : 0;
    
    const savedStatus = bundle.items.map(() => isJojaCompleted);

    const targetCount = bundle.reqCount || totalItems;
    let status = 'not-started';
    if (completedItems >= targetCount) status = 'completed';
    else if (completedItems > 0) status = 'progress';

    if (!rooms[bundle.room]) rooms[bundle.room] = { bundles: [], totalCompleted: 0, totalBundles: 0 };
    rooms[bundle.room].bundles.push({ ...bundle, savedStatus, completedItems, targetCount, status });
    rooms[bundle.room].totalBundles++;
    if (status === 'completed') rooms[bundle.room].totalCompleted++;
  });

  jojaListEl.innerHTML = '';

  if (Object.keys(rooms).length === 0) {
    jojaListEl.innerHTML = `<div style="padding: 20px; color: #5d3d19;">해당 조건의 꾸러미가 없습니다.</div>`;
    return;
  }

  for (const [roomName, roomData] of Object.entries(rooms)) {
    const roomDiv = document.createElement('div');
    roomDiv.className = 'bundle-room';
    roomDiv.id = `room-${roomName.replace(/ /g, '-')}`; 
    
    const headerEl = document.createElement('div');
    headerEl.className = 'achieve-category-header bundle-room-header';
    headerEl.innerHTML = `
      <div class="header-title-wrap"><span class="cat-icon">🏗️</span> ${roomName}</div>
      <div class="achieve-category-progress">${roomData.totalBundles}개 중 ${roomData.totalCompleted}개 완료</div>
    `;
    roomDiv.appendChild(headerEl);

    const grid = document.createElement('div');
    grid.className = 'bundles-grid';

    roomData.bundles.forEach(bundle => {
      const isCompleted = bundle.status === 'completed';
      const bundleDiv = document.createElement('div');
      bundleDiv.className = `bundle-card joja-card ${isCompleted ? 'completed' : ''}`;
      
      let badgeHtml = '';
      if (isCompleted) {
        badgeHtml = `<div class="achieve-status status-completed">완료</div>`;
      } else {
        badgeHtml = `<div class="achieve-status status-progress">구매 가능</div>`;
      }

      bundleDiv.innerHTML = `
        <div class="joja-card-header">
          <div class="joja-name">${bundle.name}</div>
          <div class="achieve-badge-container">${badgeHtml}</div>
        </div>
        ${bundle.desc ? `<div class="joja-desc">${bundle.desc}</div>` : ''}
        <div class="joja-cost">
          <span class="joja-cost-icon">💰</span>
          <span class="joja-cost-text">${bundle.items[0]}</span>
        </div>
      `;
      grid.appendChild(bundleDiv);
    });

    roomDiv.appendChild(grid);
    jojaListEl.appendChild(roomDiv);
  }
}

function renderCrops(season) {
  const cropsListEl = document.getElementById("crops-list");
  const titleEl = document.getElementById("crops-header-title");
  if (!cropsListEl || !cropsData) return;

  titleEl.textContent = `작물 정보 (${season})`;
  cropsListEl.innerHTML = '';

  const seasonData = cropsData[season] || [];
  if (seasonData.length === 0) {
    cropsListEl.innerHTML = `<div style="padding: 20px; color: #5d3d19;">데이터가 없습니다.</div>`;
    return;
  }

  const tableContainer = document.createElement('div');
  tableContainer.className = 'data-table-container';
  
  let rowsHtml = '';
  seasonData.forEach(crop => {
    rowsHtml += `
      <tr>
        <td class="col-name"><span style="font-size:1.2rem;">${crop.icon}</span> ${crop.name}</td>
        <td>${crop.type || '-'}</td>
        <td>${crop.isMulti || '-'}</td>
        <td>${crop.growth || '-'}</td>
        <td>${crop.seedPrice || '-'}</td>
        <td>${crop.sellPrice || '-'}</td>
      </tr>
    `;
  });

  tableContainer.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align:left;">작물</th>
          <th>종류</th>
          <th>다수확</th>
          <th>성장 기간</th>
          <th>씨앗 가격</th>
          <th>판매가</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  cropsListEl.appendChild(tableContainer);
}

function renderFish(season, loc) {
  const fishListEl = document.getElementById("fish-list");
  const titleEl = document.getElementById("fish-header-title");
  if (!fishListEl || !fishData) return;

  titleEl.textContent = `물고기 정보 (${season} - ${loc})`;
  fishListEl.innerHTML = '';

  const seasonData = fishData[season] || {};
  const locData = seasonData[loc] || [];

  if (locData.length === 0) {
    fishListEl.innerHTML = `<div style="padding: 20px; color: #5d3d19;">데이터가 없습니다.</div>`;
    return;
  }

  const tableContainer = document.createElement('div');
  tableContainer.className = 'data-table-container';
  
  let rowsHtml = '';
  locData.forEach(fish => {
    // Process bundle note
    let formattedNote = fish.note || '-';
    if (formattedNote.includes('[B]')) {
      formattedNote = formattedNote.replace(/\[B\]/g, '<span class="bundle-highlight">[번들]</span>');
    }

    rowsHtml += `
      <tr>
        <td class="col-name"><span style="font-size:1.2rem;">${fish.icon}</span> ${fish.name}</td>
        <td>${fish.time || '-'}</td>
        <td>${fish.sellPrice || '-'}</td>
        <td style="text-align:left; max-width: 300px; word-wrap: break-word;">${formattedNote}</td>
      </tr>
    `;
  });

  tableContainer.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align:left;">물고기</th>
          <th>출현 시간</th>
          <th>기본 판매가</th>
          <th style="text-align:left;">특이사항</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  fishListEl.appendChild(tableContainer);
}

async function triggerManualRefresh() {
  try {
    const data = await invoke("trigger_manual_refresh");
    console.log("Manual refresh returned data:", data);
    updateUI(data);
  } catch (err) {
    console.error("Failed to trigger refresh:", err);
  }
}

function setupFiltersAndSearch() {
  if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => {
      currentSearchTerm = e.target.value;
      renderAchievements();
    });
  }

  if (filterBtns) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        const targetBtn = e.target;
        targetBtn.classList.add('active');
        currentFilter = targetBtn.getAttribute('data-filter');
        renderAchievements();
      });
    });
  }

  const bundleFilterBtns = document.querySelectorAll(".bundle-filter-btn");
  if (bundleFilterBtns) {
    bundleFilterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        bundleFilterBtns.forEach(b => b.classList.remove('active'));
        const targetBtn = e.target;
        targetBtn.classList.add('active');
        currentBundleFilter = targetBtn.getAttribute('data-filter');
        renderBundles();
      });
    });
  }
}

function setupNavigation() {
  if (!navBtns) return;
  const subNavBtns = document.querySelectorAll('.sub-nav-btn');
  const mainScrollArea = document.querySelector('.dashboard-main');
  const allSubNavs = document.querySelectorAll('.nav-accordion-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('data-target');
      const parentGroup = btn.closest('.nav-accordion-group');
      const targetSubNav = parentGroup ? parentGroup.querySelector('.nav-accordion-content') : null;

      allSubNavs.forEach(nav => nav.classList.remove('expanded'));

      if (targetSubNav) {
        targetSubNav.classList.add('expanded');
      }

      navBtns.forEach(b => b.classList.remove('active'));
      viewSections.forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
      
      btn.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) {
        targetView.style.display = 'flex';
        targetView.classList.add('active');
      }
    });
  });

  const subSubNavBtns = document.querySelectorAll('.sub-sub-nav-btn');
  const nestedNavBtns = document.querySelectorAll('.nested-nav-btn');

  if (nestedNavBtns) {
    nestedNavBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const parent = btn.closest('.nested-accordion-group');
        if (parent) {
          const subNav = parent.querySelector('.nested-sub-nav');
          if (subNav) {
            subNav.classList.toggle('expanded');
          }
        }
      });
    });
  }

  if (subSubNavBtns) {
    subSubNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const fishSeason = btn.getAttribute('data-fish-season');
        const fishLoc = btn.getAttribute('data-fish-loc');
        if (fishSeason && fishLoc) {
          renderFish(fishSeason, fishLoc);
          subNavBtns.forEach(b => b.classList.remove('active'));
          subSubNavBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });
  }

  if (subNavBtns && mainScrollArea) {
    subNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Crop Season Logic
        const cropSeason = btn.getAttribute('data-crop-season');
        if (cropSeason) {
          renderCrops(cropSeason);
          subNavBtns.forEach(b => b.classList.remove('active'));
          if (subSubNavBtns) subSubNavBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          return;
        }

        let targetSection = null;
        let titleSelector = null;

        const roomName = btn.getAttribute('data-room');
        const achieveCat = btn.getAttribute('data-achieve-cat');

        if (roomName) {
          targetSection = document.getElementById(`room-${roomName}`);
          titleSelector = '.bundle-room-title';
        } else if (achieveCat) {
          const catId = achieveCat.replace(/ /g, '-');
          targetSection = document.getElementById(`achieve-cat-${catId}`);
          titleSelector = '.achieve-category-header';
        }

        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          setTimeout(() => {
            const titleEl = targetSection.querySelector(titleSelector);
            if (titleEl) {
              titleEl.classList.remove('flash-highlight');
              void titleEl.offsetWidth; 
              titleEl.classList.add('flash-highlight');
              setTimeout(() => titleEl.classList.remove('flash-highlight'), 1000);
            }
          }, 400);
        }
      });
    });

    let scrollTimeout;
    mainScrollArea.addEventListener('scroll', () => {
      if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
      scrollTimeout = requestAnimationFrame(() => {
        
        const sections = document.querySelectorAll('.bundle-room, .achieve-category-section');
        let currentTargetId = null;
        let minDistance = Infinity;

        sections.forEach(div => {
          const rect = div.getBoundingClientRect();
          const distance = Math.abs(rect.top - 120); 
          if (distance < minDistance) {
            minDistance = distance;
            currentTargetId = div.getAttribute('id');
          }
        });

        if (currentTargetId) {
          subNavBtns.forEach(b => {
            const roomName = b.getAttribute('data-room');
            const achieveCat = b.getAttribute('data-achieve-cat');
            
            if (!roomName && !achieveCat) return; // Skip buttons that don't use scroll spy

            let isMatch = false;
            if (roomName && currentTargetId === `room-${roomName}`) isMatch = true;
            if (achieveCat && currentTargetId === `achieve-cat-${achieveCat.replace(/ /g, '-')}`) isMatch = true;

            if (isMatch) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });
        }
      });
    });
  }
}

function checkMonsterEradicationGoals(monsters) {
  const getCount = (...names) => names.reduce((sum, name) => sum + (monsters[name] || 0), 0);

  const slimes = getCount("Green Slime", "Slime", "Frost Jelly", "Sludge", "Tiger Slime");
  const voidSpirits = getCount("Shadow Brute", "Shadow Shaman", "Shadow Sniper");
  const bats = getCount("Bat", "Frost Bat", "Lava Bat", "Iridium Bat");
  const skeletons = getCount("Skeleton", "Skeleton Mage");
  const caveInsects = getCount("Bug", "Fly", "Grub", "Mutant Bug", "Mutant Fly", "Armored Bug");
  const duggies = getCount("Duggy", "Magma Duggy");
  const dustSprites = getCount("Dust Spirit");
  const rockCrabs = getCount("Rock Crab", "Lava Crab", "Iridium Crab");
  const mummies = getCount("Mummy");
  const pepperRex = getCount("Pepper Rex");
  const serpents = getCount("Serpent", "Royal Serpent");
  const magmaSprites = getCount("Magma Sprite", "Magma Sparker");

  return slimes >= 1000 &&
         voidSpirits >= 150 &&
         bats >= 200 &&
         skeletons >= 50 &&
         caveInsects >= 125 &&
         duggies >= 30 &&
         dustSprites >= 500 &&
         rockCrabs >= 60 &&
         mummies >= 100 &&
         pepperRex >= 50 &&
         serpents >= 250 &&
         magmaSprites >= 150;
}

window.addEventListener("DOMContentLoaded", () => {
  playerNameEl = document.getElementById("player-name");
  farmNameEl = document.getElementById("farm-name");
  moneyEl = document.getElementById("money");
  dateEl = document.getElementById("date");
  refreshIconBtn = document.getElementById("refresh-icon-btn");
  
  achievementsListEl = document.getElementById("achievements-list");
  achievementsHeaderTitleEl = document.getElementById("achievements-header-title");
  bundlesListEl = document.getElementById("bundles-list");
  jojaListEl = document.getElementById("joja-list");
  
  searchInputEl = document.getElementById("search-input");
  filterBtns = document.querySelectorAll(".filter-btn");

  navBtns = document.querySelectorAll(".nav-btn");
  viewSections = document.querySelectorAll(".view-section");

  setupFiltersAndSearch();
  setupNavigation();
  loadStaticData();

  if (refreshIconBtn) {
    refreshIconBtn.addEventListener("click", () => {
      triggerManualRefresh();
      refreshIconBtn.style.transform = "rotate(180deg)";
      setTimeout(() => { refreshIconBtn.style.transform = "none"; }, 500);
    });
  }



  listen("game-state-changed", (event) => {
    const mode = event.payload;
    const modeBadge = document.getElementById("mode-badge");

    if (mode === "SMAPI") {
      modeBadge.className = "badge smapi";
      modeBadge.innerText = "⚡ SMAPI 실시간 연동 중";
      if (refreshIconBtn) refreshIconBtn.style.display = "none";
    } else if (mode === "Vanilla") {
      modeBadge.className = "badge vanilla";
      modeBadge.innerText = "📁 세이브 파일 감지 모드";
      if (refreshIconBtn) refreshIconBtn.style.display = "flex";
    }
  });

  listen("save-updated", (event) => {
    console.log("Received save data:", event.payload);
    updateUI(event.payload);
  });

  triggerManualRefresh();
});
