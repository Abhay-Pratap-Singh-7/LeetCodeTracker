/* ==========================================================================
   LeetDash - Multi-View Engine & Universal Shimmer Loading Across All Tabs
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const DEFAULT_TEAM = [
    { username: 'aditya7417', name: 'Aditya', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' },
    { username: 'vuvcVjbwmU', name: 'Harshit', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' },
    { username: 'Aryanj_17', name: 'Aryan', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' },
    { username: 'kartik23-2', name: 'Kartik', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' },
    { username: '_palakdeep', name: 'Palakdeep', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' },
    { username: '18WAgXvMr1', name: 'Abhay', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' },
    { username: 'I2pULBxMMM', name: 'Akhilesh', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' }
  ];

  let savedMembers = DEFAULT_TEAM;
  let savedStorage = localStorage.getItem('leetdash_saved_members_v2');

  if (savedStorage) {
    try {
      const parsed = JSON.parse(savedStorage);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed
          .map(item => {
            if (typeof item === 'string') return { username: item, name: item, avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' };
            if (item && typeof item === 'object' && item.username) return item;
            return null;
          })
          .filter(Boolean);

        if (valid.length > 0) {
          savedMembers = valid;
        }
      }
    } catch (e) {
      savedMembers = DEFAULT_TEAM;
    }
  }

  localStorage.setItem('leetdash_saved_members_v2', JSON.stringify(savedMembers));

  let activeChatSender = localStorage.getItem('leetdash_chat_sender_v1') || '';

  let storedChat = localStorage.getItem('leetdash_global_chat_v1');
  let chatMessages = [];
  if (storedChat) {
    try {
      const parsedChat = JSON.parse(storedChat);
      if (Array.isArray(parsedChat)) chatMessages = parsedChat;
    } catch (e) {}
  }

  const state = {
    currentUser: null,
    savedMembers: savedMembers,
    teamData: {},
    activeChatSender: activeChatSender,
    chatMessages: chatMessages,
    activeView: 'daily',
    charts: {
      pieProgress: null
    }
  };

  // Mobile Drawer Controls
  const sidebarDrawer = document.getElementById('sidebar-drawer');
  const sidebarOverlayBackdrop = document.getElementById('sidebar-overlay-backdrop');
  const btnOpenSidebar = document.getElementById('btn-open-sidebar');
  const mobileCloseBtn = document.getElementById('mobile-close-btn');

  const searchForm = document.getElementById('search-form');
  const usernameInput = document.getElementById('username-input');
  const btnAddMember = document.getElementById('btn-add-member');
  const btnToggleView = document.getElementById('btn-toggle-view');
  const btnBackProfile = document.getElementById('btn-back-profile');
  const btnRefreshTeam = document.getElementById('btn-refresh-team');
  const btnRefreshDaily = document.getElementById('btn-refresh-daily');
  const btnRefreshWarnings = document.getElementById('btn-refresh-warnings');

  const menuViewProfile = document.getElementById('menu-view-profile');
  const menuViewTeam = document.getElementById('menu-view-team');
  const menuViewDaily = document.getElementById('menu-view-daily');
  const menuViewWarnings = document.getElementById('menu-view-warnings');
  const menuViewChat = document.getElementById('menu-view-chat');

  const dashboardView = document.getElementById('dashboard-view');
  const teamView = document.getElementById('team-view');
  const dailyTrackView = document.getElementById('daily-track-view');
  const warningsView = document.getElementById('warnings-view');
  const globalChatView = document.getElementById('global-chat-view');

  const chatIdentityModal = document.getElementById('chat-identity-modal');
  const modalSenderSelect = document.getElementById('modal-sender-select');
  const btnSaveChatIdentity = document.getElementById('btn-save-chat-identity');
  const btnSwitchIdentity = document.getElementById('btn-switch-identity');
  const chatActiveName = document.getElementById('chat-active-name');
  const chatActiveAvatar = document.getElementById('chat-active-avatar');

  const chatSendForm = document.getElementById('chat-send-form');
  const chatInputText = document.getElementById('chat-input-text');
  const chatMessagesBody = document.getElementById('chat-messages-body');

  const shimmerLoadingState = document.getElementById('shimmer-loading-state');
  const errorState = document.getElementById('error-state');
  const errorMsg = document.getElementById('error-msg');
  const btnRetry = document.getElementById('btn-retry');

  let tooltipEl = document.getElementById('heatmap-floating-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'heatmap-floating-tooltip';
    tooltipEl.className = 'heatmap-tooltip';
    document.body.appendChild(tooltipEl);
  }

  init();

  function init() {
    renderSidebarMembers();
    setupEventListeners();

    switchView('daily');

    const firstValidMember = state.savedMembers.find(m => m && m.username);
    const defaultUser = firstValidMember ? firstValidMember.username : '18WAgXvMr1';
    loadUserDataSilent(defaultUser);
  }

  function openMobileSidebar() {
    if (sidebarDrawer) sidebarDrawer.classList.add('open');
    if (sidebarOverlayBackdrop) sidebarOverlayBackdrop.classList.remove('hidden');
    document.body.classList.add('sidebar-open');
  }

  function closeMobileSidebar() {
    if (sidebarDrawer) sidebarDrawer.classList.remove('open');
    if (sidebarOverlayBackdrop) sidebarOverlayBackdrop.classList.add('hidden');
    document.body.classList.remove('sidebar-open');
  }

  function setupEventListeners() {
    if (btnOpenSidebar) {
      btnOpenSidebar.addEventListener('click', () => openMobileSidebar());
    }

    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', () => closeMobileSidebar());
    }

    if (sidebarOverlayBackdrop) {
      sidebarOverlayBackdrop.addEventListener('click', () => closeMobileSidebar());
    }

    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      if (username) {
        loadUserData(username);
        switchView('single');
      }
    });

    if (btnAddMember) {
      btnAddMember.addEventListener('click', () => {
        if (!state.currentUser) return;
        const user = state.currentUser;
        const exists = state.savedMembers.some(m => m.username === user.username);
        if (!exists) {
          state.savedMembers.push({
            username: user.username,
            name: user.name || user.username,
            avatar: user.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg'
          });
          saveMembersToStorage();
          renderSidebarMembers();
        }
      });
    }

    menuViewProfile.addEventListener('click', () => { switchView('single'); closeMobileSidebar(); });
    menuViewTeam.addEventListener('click', () => { switchView('team'); closeMobileSidebar(); });
    if (menuViewDaily) menuViewDaily.addEventListener('click', () => { switchView('daily'); closeMobileSidebar(); });
    if (menuViewWarnings) menuViewWarnings.addEventListener('click', () => { switchView('warnings'); closeMobileSidebar(); });
    if (menuViewChat) menuViewChat.addEventListener('click', () => { switchView('chat'); closeMobileSidebar(); });

    if (btnToggleView) btnToggleView.addEventListener('click', () => switchView('team'));
    if (btnBackProfile) btnBackProfile.addEventListener('click', () => switchView('single'));
    if (btnRefreshTeam) btnRefreshTeam.addEventListener('click', () => loadTeamData());
    if (btnRefreshDaily) btnRefreshDaily.addEventListener('click', () => loadDailyTrackData());
    if (btnRefreshWarnings) btnRefreshWarnings.addEventListener('click', () => loadWarningsData());

    if (btnSwitchIdentity) {
      btnSwitchIdentity.addEventListener('click', () => openIdentityModal());
    }

    if (btnSaveChatIdentity) {
      btnSaveChatIdentity.addEventListener('click', () => {
        const selected = modalSenderSelect.value;
        if (selected) {
          state.activeChatSender = selected;
          localStorage.setItem('leetdash_chat_sender_v1', selected);
          updateActiveIdentityUI();
          chatIdentityModal.classList.add('hidden');
          renderGlobalChat();
        }
      });
    }

    if (chatSendForm) {
      chatSendForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInputText.value.trim();

        if (!state.activeChatSender) {
          openIdentityModal();
          return;
        }

        if (!text) return;

        chatInputText.value = '';

        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senderUsername: state.activeChatSender,
              text: text
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.messages)) {
              state.chatMessages = data.messages;
              localStorage.setItem('leetdash_global_chat_v1', JSON.stringify(state.chatMessages));
              renderGlobalChat();
            }
          } else {
            const fallbackMsg = {
              id: 'msg_' + Date.now(),
              senderUsername: state.activeChatSender,
              text: text,
              timestamp: new Date().toISOString()
            };
            state.chatMessages.push(fallbackMsg);
            localStorage.setItem('leetdash_global_chat_v1', JSON.stringify(state.chatMessages));
            renderGlobalChat();
          }
        } catch (err) {
          const fallbackMsg = {
            id: 'msg_' + Date.now(),
            senderUsername: state.activeChatSender,
            text: text,
            timestamp: new Date().toISOString()
          };
          state.chatMessages.push(fallbackMsg);
          localStorage.setItem('leetdash_global_chat_v1', JSON.stringify(state.chatMessages));
          renderGlobalChat();
        }
      });
    }

    btnRetry.addEventListener('click', () => {
      const username = usernameInput.value.trim() || '18WAgXvMr1';
      loadUserData(username);
    });
  }

  function openIdentityModal() {
    if (!modalSenderSelect) return;
    modalSenderSelect.innerHTML = '';

    state.savedMembers.forEach(member => {
      if (!member || !member.username) return;
      const opt = document.createElement('option');
      opt.value = member.username;
      opt.textContent = `${member.name || member.username} (@${member.username})`;
      if (state.activeChatSender === member.username) opt.selected = true;
      modalSenderSelect.appendChild(opt);
    });

    chatIdentityModal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  function updateActiveIdentityUI() {
    const member = state.savedMembers.find(m => m.username === state.activeChatSender);
    if (member) {
      if (chatActiveName) chatActiveName.textContent = member.name || member.username;
      if (chatActiveAvatar) chatActiveAvatar.src = member.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';
    } else {
      if (chatActiveName) chatActiveName.textContent = 'Select Profile';
      if (chatActiveAvatar) chatActiveAvatar.src = 'https://assets.leetcode.com/users/default_avatar.jpg';
    }
  }

  function switchView(view) {
    state.activeView = view;
    menuViewProfile.classList.remove('active');
    menuViewTeam.classList.remove('active');
    if (menuViewDaily) menuViewDaily.classList.remove('active');
    if (menuViewWarnings) menuViewWarnings.classList.remove('active');
    if (menuViewChat) menuViewChat.classList.remove('active');

    dashboardView.classList.add('hidden');
    teamView.classList.add('hidden');
    if (dailyTrackView) dailyTrackView.classList.add('hidden');
    if (warningsView) warningsView.classList.add('hidden');
    if (globalChatView) globalChatView.classList.add('hidden');

    if (view === 'single') {
      menuViewProfile.classList.add('active');
      dashboardView.classList.remove('hidden');
      if (!state.currentUser) {
        const firstValidMember = state.savedMembers.find(m => m && m.username);
        if (firstValidMember) loadUserData(firstValidMember.username);
      }
    } else if (view === 'team') {
      menuViewTeam.classList.add('active');
      teamView.classList.remove('hidden');
      loadTeamData();
    } else if (view === 'daily') {
      if (menuViewDaily) menuViewDaily.classList.add('active');
      if (dailyTrackView) dailyTrackView.classList.remove('hidden');
      loadDailyTrackData();
    } else if (view === 'warnings') {
      if (menuViewWarnings) menuViewWarnings.classList.add('active');
      if (warningsView) warningsView.classList.remove('hidden');
      loadWarningsData();
    } else if (view === 'chat') {
      if (menuViewChat) menuViewChat.classList.add('active');
      if (globalChatView) globalChatView.classList.remove('hidden');

      if (!state.activeChatSender) {
        openIdentityModal();
      } else {
        updateActiveIdentityUI();
      }

      fetchGlobalChat();
      renderGlobalChat();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  function saveMembersToStorage() {
    localStorage.setItem('leetdash_saved_members_v2', JSON.stringify(state.savedMembers));
  }

  function renderSidebarMembers() {
    const list = document.getElementById('sidebar-members-list');
    if (!list) return;
    list.innerHTML = '';

    state.savedMembers.forEach(member => {
      if (!member || !member.username) return;
      const item = document.createElement('div');
      const isActive = state.currentUser && state.currentUser.username === member.username;
      item.className = `sidebar-member-item ${isActive ? 'active' : ''}`;

      const displayName = member.name || member.username;
      const avatarUrl = member.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';

      item.innerHTML = `
        <div class="member-item-left">
          <img src="${avatarUrl}" alt="${displayName}" class="sidebar-avatar" onerror="this.src='https://assets.leetcode.com/users/default_avatar.jpg'">
          <span title="@${member.username}">${displayName}</span>
        </div>
        ${isActive ? '<span class="active-dot"></span>' : ''}
      `;

      item.addEventListener('click', () => {
        usernameInput.value = member.username;
        loadUserData(member.username);
        if (state.activeView !== 'single') switchView('single');
        closeMobileSidebar();
      });

      list.appendChild(item);
    });
  }

  async function loadUserDataSilent(username) {
    if (!username) return;
    try {
      const response = await fetch(`/api/user/${encodeURIComponent(username)}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.username) {
          state.currentUser = data;
          state.teamData[username] = data;
          renderDashboard(data);
          renderSidebarMembers();
        }
      }
    } catch (e) {}
  }

  async function loadUserData(username) {
    if (!username) return;
    showShimmerLoading();

    try {
      const response = await fetch(`/api/user/${encodeURIComponent(username)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch GraphQL data for ${username}`);
      }

      const data = await response.json();
      if (!data || !data.username) {
        throw new Error(`User ${username} not found.`);
      }

      state.currentUser = data;
      state.teamData[username] = data;

      const memberIdx = state.savedMembers.findIndex(m => m && m.username === username);
      if (memberIdx !== -1) {
        state.savedMembers[memberIdx].name = data.name || username;
        state.savedMembers[memberIdx].avatar = data.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';
        saveMembersToStorage();
      }

      renderDashboard(data);
      renderSidebarMembers();
      showContent();

    } catch (err) {
      console.error(err);
      showError(err.message);
    }
  }

  function formatLocalDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatUTCToDateKey(ts) {
    const date = new Date(parseInt(ts, 10) * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseSubmissionCalendar(rawCalendarData) {
    if (!rawCalendarData) return {};
    
    let rawCalendar = rawCalendarData;
    if (typeof rawCalendarData === 'string') {
      try {
        rawCalendar = JSON.parse(rawCalendarData);
      } catch (e) {
        return {};
      }
    }

    const parsedData = {};
    for (const [timestamp, count] of Object.entries(rawCalendar)) {
      const dateString = formatUTCToDateKey(timestamp);
      parsedData[dateString] = (parsedData[dateString] || 0) + (parseInt(count, 10) || 0);
    }

    return parsedData;
  }

  function getColorLevel(count) {
    if (!count || count === 0) return '#e2e8f0';
    if (count <= 2) return '#bbf7d0';
    if (count <= 5) return '#86efac';
    if (count <= 9) return '#26a641';
    return '#15803d';
  }

  function getLevelClass(count) {
    if (!count || count === 0) return '0';
    if (count <= 2) return '1';
    if (count <= 5) return '2';
    if (count <= 9) return '3';
    return '4';
  }

  function renderDashboard(data) {
    document.getElementById('header-user-avatar').src = data.avatar;
    document.getElementById('header-user-name').textContent = data.name;
    document.getElementById('header-user-handle').textContent = `@${data.username}`;

    const stats = data.stats;
    document.getElementById('stat-total-solved').textContent = stats.totalSolved.toLocaleString();
    document.getElementById('stat-acceptance-pct').textContent = `${stats.acceptanceRate} Acceptance Rate`;

    document.getElementById('stat-easy-num').textContent = stats.easySolved.toLocaleString();
    document.getElementById('stat-easy-ratio').textContent = `${stats.easySolved.toLocaleString()} / ${stats.easyQuestions.toLocaleString()}`;

    document.getElementById('stat-medium-num').textContent = stats.mediumSolved.toLocaleString();
    document.getElementById('stat-medium-ratio').textContent = `${stats.mediumSolved.toLocaleString()} / ${stats.mediumQuestions.toLocaleString()}`;

    document.getElementById('stat-hard-num').textContent = stats.hardSolved.toLocaleString();
    document.getElementById('stat-hard-ratio').textContent = `${stats.hardSolved.toLocaleString()} / ${stats.hardQuestions.toLocaleString()}`;

    renderSeparatedMonthHeatmap(data.submissionCalendar);

    const contest = data.contest;
    document.getElementById('val-contest-rating').textContent = contest.rating || 'N/A';
    document.getElementById('val-contest-rank').textContent = contest.globalRanking ? `#${contest.globalRanking.toLocaleString()}` : '--';
    document.getElementById('val-contest-top').textContent = contest.topPercentage ? `${contest.topPercentage}%` : '--';
    document.getElementById('val-contest-attended').textContent = contest.attended || 0;
    document.getElementById('val-contest-badge').textContent = contest.badge || 'Active';

    document.getElementById('btn-profile-link').onclick = () => {
      window.open(`https://leetcode.com/u/${data.username}/`, '_blank');
    };

    renderProgressPieChart(stats);
    renderWeeklyAcceptedReportBarChart(data.recentSubmissions || []);
    renderRecentSubmissionsClean(data.recentSubmissions || []);

    if (window.lucide) window.lucide.createIcons();
  }

  function renderSeparatedMonthHeatmap(rawCalendarData) {
    const container = document.querySelector('.heatmap-month-container');
    if (!container) return;

    container.innerHTML = '';

    const parsedCalendar = parseSubmissionCalendar(rawCalendarData);
    let totalSubmissionsLastYear = 0;

    Object.values(parsedCalendar).forEach(cnt => {
      totalSubmissionsLastYear += (parseInt(cnt, 10) || 0);
    });

    document.getElementById('heatmap-summary').textContent = `${totalSubmissionsLastYear.toLocaleString()} submissions in past 365 days`;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    const currentYear = today.getFullYear();
    const todayDateKey = formatLocalDateKey(today);

    for (let m = 0; m < 12; m++) {
      const monthBlock = document.createElement('div');
      monthBlock.className = 'month-block';

      const monthGrid = document.createElement('div');
      monthGrid.className = 'month-grid';

      const firstDayOfMonth = new Date(currentYear, m, 1);
      const startDayOfWeek = firstDayOfMonth.getDay();

      for (let p = 0; p < startDayOfWeek; p++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'day-cell placeholder';
        monthGrid.appendChild(placeholder);
      }

      const daysInMonth = new Date(currentYear, m + 1, 0).getDate();
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const d = new Date(currentYear, m, dayNum);
        const dateKey = formatLocalDateKey(d);
        const formattedDateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const count = parsedCalendar[dateKey] || 0;
        const isFuture = dateKey > todayDateKey;

        const square = document.createElement('div');
        square.className = `day-cell ${isFuture ? 'future-day' : ''}`;
        square.dataset.count = getLevelClass(count);
        square.style.backgroundColor = getColorLevel(count);

        const tooltipText = isFuture ? `${formattedDateStr} (Future)` : `${count} submission${count === 1 ? '' : 's'} on ${formattedDateStr}`;
        square.title = tooltipText;

        square.addEventListener('mouseenter', (e) => {
          tooltipEl.textContent = tooltipText;
          tooltipEl.classList.add('visible');
          positionTooltip(e);
        });

        square.addEventListener('mousemove', (e) => {
          positionTooltip(e);
        });

        square.addEventListener('mouseleave', () => {
          tooltipEl.classList.remove('visible');
        });

        monthGrid.appendChild(square);
      }

      const monthLabel = document.createElement('span');
      monthLabel.className = 'month-block-label';
      monthLabel.textContent = months[m];

      monthBlock.appendChild(monthGrid);
      monthBlock.appendChild(monthLabel);
      container.appendChild(monthBlock);
    }
  }

  function positionTooltip(e) {
    if (!tooltipEl) return;
    tooltipEl.style.left = `${e.clientX}px`;
    tooltipEl.style.top = `${e.clientY - 10}px`;
  }

  function renderProgressPieChart(stats) {
    const ctx = document.getElementById('chart-pie-progress').getContext('2d');
    if (state.charts.pieProgress) {
      state.charts.pieProgress.destroy();
    }

    const unsolved = Math.max(0, stats.totalQuestions - stats.totalSolved);

    state.charts.pieProgress = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Easy', 'Medium', 'Hard', 'Unsolved'],
        datasets: [{
          data: [stats.easySolved, stats.mediumSolved, stats.hardSolved, unsolved],
          backgroundColor: [
            '#10b981',
            '#f59e0b',
            '#ef4444',
            '#e2e8f0'
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw.toLocaleString()} questions`
            }
          }
        }
      }
    });
  }

  function renderWeeklyAcceptedReportBarChart(recentSubmissions) {
    const grid = document.getElementById('weekly-bar-chart-grid');
    const badge = document.getElementById('weekly-total-badge');
    const subText = document.getElementById('weekly-report-sub');
    if (!grid) return;

    grid.innerHTML = '';

    const acceptedCountByDate = {};
    recentSubmissions.forEach(sub => {
      if (sub.timestamp) {
        const dateKey = formatLocalDateKey(new Date(parseInt(sub.timestamp, 10) * 1000));
        acceptedCountByDate[dateKey] = (acceptedCountByDate[dateKey] || 0) + 1;
      }
    });

    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const diffToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekData = [];
    let totalAcceptedThisWeek = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = formatLocalDateKey(d);
      const count = acceptedCountByDate[dateKey] || 0;
      totalAcceptedThisWeek += count;

      const isToday = dateKey === formatLocalDateKey(today);

      weekData.push({
        label: dayLabels[i],
        count: count,
        dateKey: dateKey,
        isToday: isToday
      });
    }

    if (badge) badge.textContent = `${totalAcceptedThisWeek} Accepted`;
    if (subText) subText.textContent = `Mon - Sun accepted AC`;

    const maxCount = Math.max(1, ...weekData.map(w => w.count));

    weekData.forEach(item => {
      const col = document.createElement('div');
      col.className = `weekly-bar-col ${item.isToday ? 'today' : ''}`;

      const pct = Math.max(4, Math.round((item.count / maxCount) * 100));

      col.innerHTML = `
        <span class="weekly-bar-count">${item.count}</span>
        <div class="weekly-bar-track" title="${item.label}: ${item.count} accepted solved">
          <div class="weekly-bar-fill" style="height: ${item.count > 0 ? pct + '%' : '4%'}; opacity: ${item.count > 0 ? 1 : 0.3}"></div>
        </div>
        <span class="weekly-bar-label">${item.label}</span>
      `;

      grid.appendChild(col);
    });
  }

  function renderRecentSubmissionsClean(submissions) {
    const tbody = document.getElementById('recent-submissions-full-body');
    const emptyMsg = document.getElementById('recent-empty');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!submissions || submissions.length === 0) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');

    submissions.forEach(s => {
      const tr = document.createElement('tr');
      const timestamp = s.timestamp ? new Date(parseInt(s.timestamp, 10) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';
      const url = s.url || `https://leetcode.com/problems/${s.titleSlug}/`;

      tr.innerHTML = `
        <td><strong>${s.title}</strong></td>
        <td>${timestamp}</td>
        <td>
          <a href="${url}" target="_blank" class="btn-pill-small" style="text-decoration: none;">View Problem</a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function loadDailyTrackData() {
    const container = document.getElementById('daily-track-cards-container');
    if (!container) return;

    container.innerHTML = `
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
    `;

    const fetchPromises = state.savedMembers.map(async (member) => {
      if (!member || !member.username) return;
      const username = member.username;
      try {
        const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          state.teamData[username] = data;
          member.name = data.name || username;
          member.avatar = data.avatar || member.avatar;
        }
      } catch (e) {}
    });

    await Promise.all(fetchPromises);
    saveMembersToStorage();

    container.innerHTML = '';

    const todayStr = formatLocalDateKey(new Date());

    state.savedMembers.forEach(member => {
      if (!member || !member.username) return;
      const data = state.teamData[member.username];
      const allSubmissions = data?.recentSubmissions || [];

      const todaySubmissions = allSubmissions.filter(sub => {
        if (!sub.timestamp) return false;
        const subDateStr = formatLocalDateKey(new Date(parseInt(sub.timestamp, 10) * 1000));
        return subDateStr === todayStr;
      });

      const card = document.createElement('div');
      card.className = 'daily-member-card';

      const displayName = member.name || member.username;
      const avatarUrl = member.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';

      let problemsHTML = '';
      if (todaySubmissions.length === 0) {
        problemsHTML = `<div style="font-size: 0.88rem; color: var(--text-light); font-weight: 600; text-align: center; padding: 18px 0; background: var(--bg-shell); border-radius: var(--radius-md);">no problem solved till now</div>`;
      } else {
        todaySubmissions.forEach(sub => {
          const timeStr = new Date(parseInt(sub.timestamp, 10) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const problemUrl = sub.url || `https://leetcode.com/problems/${sub.titleSlug}/`;

          problemsHTML += `
            <div class="daily-problem-item">
              <div class="daily-problem-title">
                <i data-lucide="check-circle-2" style="width: 16px; height: 16px; color: var(--primary-green);"></i>
                <a href="${problemUrl}" target="_blank" style="color: var(--text-dark); text-decoration: none;">${sub.title}</a>
              </div>
              <span class="daily-problem-time">${timeStr}</span>
            </div>
          `;
        });
      }

      card.innerHTML = `
        <div class="daily-card-header">
          <div class="daily-member-info">
            <img src="${avatarUrl}" alt="${displayName}" class="daily-member-avatar" onerror="this.src='https://assets.leetcode.com/users/default_avatar.jpg'">
            <div>
              <div class="daily-member-name">${displayName}</div>
              <div class="daily-member-handle">@${member.username}</div>
            </div>
          </div>
          <span class="daily-badge-count" style="${todaySubmissions.length === 0 ? 'background: #f1f5f9; color: var(--text-light);' : ''}">${todaySubmissions.length} Solved Today</span>
        </div>
        <div class="daily-problems-list">
          ${problemsHTML}
        </div>
      `;

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadWarningsData() {
    const container = document.getElementById('warnings-cards-container');
    if (!container) return;

    container.innerHTML = `
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
    `;

    const fetchPromises = state.savedMembers.map(async (member) => {
      if (!member || !member.username) return;
      const username = member.username;
      try {
        const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          state.teamData[username] = data;
          member.name = data.name || username;
          member.avatar = data.avatar || member.avatar;
        }
      } catch (e) {}
    });

    await Promise.all(fetchPromises);
    saveMembersToStorage();

    container.innerHTML = '';

    const startDate = new Date(2026, 7, 21); // Aug 21, 2026
    const endDate = new Date(); // Current date

    const targetDateList = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      targetDateList.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    state.savedMembers.forEach(member => {
      if (!member || !member.username) return;
      const data = state.teamData[member.username];
      const parsedCalendar = parseSubmissionCalendar(data?.submissionCalendar);
      const recentSubmissions = data?.recentSubmissions || [];

      const recentCountByDate = {};
      recentSubmissions.forEach(s => {
        if (s.timestamp) {
          const dKey = formatLocalDateKey(new Date(parseInt(s.timestamp, 10) * 1000));
          recentCountByDate[dKey] = (recentCountByDate[dKey] || 0) + 1;
        }
      });

      const missedDates = [];

      targetDateList.forEach(targetDate => {
        const dateKey = formatLocalDateKey(targetDate);
        const calendarCount = parsedCalendar[dateKey] || 0;
        const recentCount = recentCountByDate[dateKey] || 0;
        const totalCount = Math.max(calendarCount, recentCount);

        if (totalCount === 0) {
          const formattedStr = targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          missedDates.push(formattedStr);
        }
      });

      const card = document.createElement('div');
      card.className = 'daily-member-card';

      const displayName = member.name || member.username;
      const avatarUrl = member.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';
      const warningCount = missedDates.length;

      let warningsHTML = '';
      if (warningCount === 0) {
        warningsHTML = `<div style="font-size: 0.88rem; color: var(--primary-green); font-weight: 700; text-align: center; padding: 18px 0; background: var(--primary-green-light); border-radius: var(--radius-md); border: 1px solid var(--primary-green-border);">Clean Streak! 0 warnings recorded.</div>`;
      } else {
        missedDates.forEach(dateStr => {
          warningsHTML += `
            <div class="warning-date-item">
              <div class="warning-date-left">
                <i data-lucide="alert-triangle" style="width: 16px; height: 16px; color: #dc2626;"></i>
                <span>Failed to solve at least 1 problem</span>
              </div>
              <span style="font-family: var(--font-mono); font-size: 0.76rem;">${dateStr}</span>
            </div>
          `;
        });
      }

      card.innerHTML = `
        <div class="daily-card-header">
          <div class="daily-member-info">
            <img src="${avatarUrl}" alt="${displayName}" class="daily-member-avatar" onerror="this.src='https://assets.leetcode.com/users/default_avatar.jpg'">
            <div>
              <div class="daily-member-name">${displayName}</div>
              <div class="daily-member-handle">@${member.username}</div>
            </div>
          </div>
          <span class="warning-badge-count ${warningCount > 0 ? 'danger' : 'success'}">
            <i data-lucide="${warningCount > 0 ? 'alert-circle' : 'shield-check'}" style="width: 14px; height: 14px;"></i>
            ${warningCount} ${warningCount === 1 ? 'Warning' : 'Warnings'}
          </span>
        </div>
        <div class="daily-problems-list">
          ${warningsHTML}
        </div>
      `;

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadTeamData() {
    const tbody = document.getElementById('team-leaderboard-body');
    const dailyChartEl = document.getElementById('team-daily-bar-chart');
    const weeklyChartEl = document.getElementById('team-weekly-bar-chart');
    const monthlyChartEl = document.getElementById('team-monthly-bar-chart');

    if (tbody) {
      tbody.innerHTML = `
        <tr class="table-shimmer-row"><td colspan="9"></td></tr>
        <tr class="table-shimmer-row"><td colspan="9"></td></tr>
        <tr class="table-shimmer-row"><td colspan="9"></td></tr>
        <tr class="table-shimmer-row"><td colspan="9"></td></tr>
      `;
    }

    if (dailyChartEl) dailyChartEl.innerHTML = `<div class="daily-shimmer-card" style="height: 140px;"></div>`;
    if (weeklyChartEl) weeklyChartEl.innerHTML = `<div class="daily-shimmer-card" style="height: 140px;"></div>`;
    if (monthlyChartEl) monthlyChartEl.innerHTML = `<div class="daily-shimmer-card" style="height: 140px;"></div>`;

    const fetchPromises = state.savedMembers.map(async (member) => {
      if (!member || !member.username) return;
      const username = member.username;
      if (!state.teamData[username]) {
        try {
          const res = await fetch(`/api/user/${encodeURIComponent(username)}`);
          if (res.ok) {
            const data = await res.json();
            state.teamData[username] = data;
            member.name = data.name || username;
            member.avatar = data.avatar || member.avatar;
          }
        } catch (e) {}
      }
    });

    await Promise.all(fetchPromises);
    saveMembersToStorage();

    const teamList = state.savedMembers
      .map(m => m && state.teamData[m.username])
      .filter(Boolean)
      .sort((a, b) => b.stats.totalSolved - a.stats.totalSolved);

    if (tbody) {
      tbody.innerHTML = '';
      teamList.forEach((member, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="rank-badge rank-${index + 1}">${index + 1}</span></td>
          <td>
            <div class="user-cell">
              <img src="${member.avatar}" alt="${member.username}" onerror="this.src='https://assets.leetcode.com/users/default_avatar.jpg'">
              <div>
                <div><strong>${member.name}</strong></div>
                <div style="font-size: 0.72rem; color: var(--text-light);">@${member.username}</div>
              </div>
            </div>
          </td>
          <td><strong>${member.stats.totalSolved.toLocaleString()}</strong></td>
          <td><span style="color: var(--easy-color);">${member.stats.easySolved.toLocaleString()}</span></td>
          <td><span style="color: var(--medium-color);">${member.stats.mediumSolved.toLocaleString()}</span></td>
          <td><span style="color: var(--hard-color);">${member.stats.hardSolved.toLocaleString()}</span></td>
          <td><strong>${member.contest.rating || 'N/A'}</strong></td>
          <td>${member.stats.acceptanceRate}</td>
          <td>
            <button class="btn-pill-small btn-inspect" data-username="${member.username}">Inspect Profile</button>
          </td>
        `;

        tr.querySelector('.btn-inspect').addEventListener('click', () => {
          usernameInput.value = member.username;
          loadUserData(member.username);
          switchView('single');
        });

        tbody.appendChild(tr);
      });
    }

    renderTeamComparisonBarCharts(teamList);
  }

  function renderTeamComparisonBarCharts(teamList) {
    const dailyChartEl = document.getElementById('team-daily-bar-chart');
    const weeklyChartEl = document.getElementById('team-weekly-bar-chart');
    const monthlyChartEl = document.getElementById('team-monthly-bar-chart');

    const dailyBadge = document.getElementById('team-daily-total-badge');
    const weeklyBadge = document.getElementById('team-weekly-total-badge');
    const monthlyBadge = document.getElementById('team-monthly-total-badge');

    if (!dailyChartEl || !weeklyChartEl || !monthlyChartEl) return;

    const today = new Date();
    const todayStr = formatLocalDateKey(today);

    const diffToMon = today.getDay() === 0 ? -6 : 1 - today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMon);
    const mondayStr = formatLocalDateKey(monday);

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const dailyMetrics = [];
    const weeklyMetrics = [];
    const monthlyMetrics = [];

    let totalTeamDaily = 0;
    let totalTeamWeekly = 0;
    let totalTeamMonthly = 0;

    teamList.forEach(member => {
      const parsedCalendar = parseSubmissionCalendar(member.submissionCalendar);
      const recentSubmissions = member.recentSubmissions || [];

      // Calculate Daily Count
      const recentDaily = recentSubmissions.filter(s => s.timestamp && formatLocalDateKey(new Date(parseInt(s.timestamp, 10) * 1000)) === todayStr).length;
      const calDaily = parsedCalendar[todayStr] || 0;
      const dailyCount = Math.max(recentDaily, calDaily);
      totalTeamDaily += dailyCount;
      dailyMetrics.push({ name: member.name.split(' ')[0], count: dailyCount });

      // Calculate Weekly Count (Mon to Today)
      let weekCount = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dKey = formatLocalDateKey(d);
        if (dKey <= todayStr) {
          const recC = recentSubmissions.filter(s => s.timestamp && formatLocalDateKey(new Date(parseInt(s.timestamp, 10) * 1000)) === dKey).length;
          const calC = parsedCalendar[dKey] || 0;
          weekCount += Math.max(recC, calC);
        }
      }
      totalTeamWeekly += weekCount;
      weeklyMetrics.push({ name: member.name.split(' ')[0], count: weekCount });

      // Calculate Monthly Count
      let monthCount = 0;
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(currentYear, currentMonth, day);
        const dKey = formatLocalDateKey(d);
        if (dKey <= todayStr) {
          const recC = recentSubmissions.filter(s => s.timestamp && formatLocalDateKey(new Date(parseInt(s.timestamp, 10) * 1000)) === dKey).length;
          const calC = parsedCalendar[dKey] || 0;
          monthCount += Math.max(recC, calC);
        }
      }
      totalTeamMonthly += monthCount;
      monthlyMetrics.push({ name: member.name.split(' ')[0], count: monthCount });
    });

    if (dailyBadge) dailyBadge.textContent = `${totalTeamDaily} Solved`;
    if (weeklyBadge) weeklyBadge.textContent = `${totalTeamWeekly} Solved`;
    if (monthlyBadge) monthlyBadge.textContent = `${totalTeamMonthly} Solved`;

    // Sort in decreasing order (highest solver to lowest solver)
    dailyMetrics.sort((a, b) => b.count - a.count);
    weeklyMetrics.sort((a, b) => b.count - a.count);
    monthlyMetrics.sort((a, b) => b.count - a.count);

    renderMiniTeamChart(dailyChartEl, dailyMetrics);
    renderMiniTeamChart(weeklyChartEl, weeklyMetrics);
    renderMiniTeamChart(monthlyChartEl, monthlyMetrics);
  }

  function renderMiniTeamChart(container, metrics) {
    container.innerHTML = '';
    const maxVal = Math.max(1, ...metrics.map(m => m.count));

    metrics.forEach(m => {
      const col = document.createElement('div');
      col.className = 'team-bar-col';

      const pct = Math.max(4, Math.round((m.count / maxVal) * 100));

      col.innerHTML = `
        <span class="weekly-bar-count">${m.count}</span>
        <div class="weekly-bar-track" title="${m.name}: ${m.count} solved">
          <div class="weekly-bar-fill" style="height: ${m.count > 0 ? pct + '%' : '4%'}; opacity: ${m.count > 0 ? 1 : 0.3}"></div>
        </div>
        <span class="weekly-bar-label">${m.name}</span>
      `;

      container.appendChild(col);
    });
  }

  function extractLeetCodeSlug(text) {
    const regex = /https:\/\/leetcode\.com\/problems\/([a-zA-Z0-9-]+)/i;
    const match = text.match(regex);
    return match ? match[1].replace(/\/$/, '') : null;
  }

  function renderGlobalChat() {
    if (!chatMessagesBody) return;
    chatMessagesBody.innerHTML = '';

    if (!state.chatMessages || state.chatMessages.length === 0) {
      chatMessagesBody.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.88rem; padding: 60px 20px; font-weight: 600;">No messages yet. Start the conversation by typing a message or sharing a LeetCode problem link!</div>`;
      return;
    }

    let lastSenderUsername = null;
    let lastContentBox = null;

    state.chatMessages.forEach(msg => {
      const isMine = msg.senderUsername === state.activeChatSender;
      const sender = state.savedMembers.find(m => m.username === msg.senderUsername) || {
        username: msg.senderUsername,
        name: msg.senderUsername,
        avatar: 'https://assets.leetcode.com/users/default_avatar.jpg'
      };

      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const slug = extractLeetCodeSlug(msg.text);

      let richCardHTML = '';
      if (slug) {
        const problemTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const problemUrl = `https://leetcode.com/problems/${slug}/`;

        richCardHTML = `
          <div class="leetcode-rich-card">
            <div class="leetcode-card-left">
              <div class="leetcode-logo-badge">LC</div>
              <div class="leetcode-card-info">
                <a href="${problemUrl}" target="_blank" class="leetcode-card-title">${problemTitle}</a>
                <span class="leetcode-card-slug">leetcode.com/problems/${slug}</span>
              </div>
            </div>
            <a href="${problemUrl}" target="_blank" class="leetcode-card-link-btn">
              <span>Solve Problem</span>
              <i data-lucide="arrow-up-right" style="width: 15px; height: 15px;"></i>
            </a>
          </div>
        `;
      }

      const bubbleHTML = `
        <div class="chat-msg-bubble">
          ${msg.text}
          ${richCardHTML}
        </div>
      `;

      if (lastSenderUsername === msg.senderUsername && lastContentBox) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = bubbleHTML;
        lastContentBox.appendChild(tempDiv.firstElementChild);
      } else {
        lastSenderUsername = msg.senderUsername;
        const msgItem = document.createElement('div');
        msgItem.className = `chat-msg-item ${isMine ? 'mine' : 'other'}`;

        msgItem.innerHTML = `
          <img src="${sender.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg'}" class="chat-msg-avatar" onerror="this.src='https://assets.leetcode.com/users/default_avatar.jpg'">
          <div class="chat-msg-content-box">
            <div class="chat-msg-header">
              <span class="chat-msg-author">${sender.name || sender.username}</span>
              <span class="chat-msg-time">${timeStr}</span>
            </div>
            ${bubbleHTML}
          </div>
        `;

        chatMessagesBody.appendChild(msgItem);
        lastContentBox = msgItem.querySelector('.chat-msg-content-box');
      }
    });

    chatMessagesBody.scrollTop = chatMessagesBody.scrollHeight;
    if (window.lucide) window.lucide.createIcons();
  }

  function showShimmerLoading() {
    if (shimmerLoadingState) shimmerLoadingState.classList.remove('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
  }

  function showError(msg) {
    if (errorMsg) errorMsg.textContent = msg;
    if (shimmerLoadingState) shimmerLoadingState.classList.add('hidden');
    if (errorState) errorState.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
  }

  function showContent() {
    if (shimmerLoadingState) shimmerLoadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (state.activeView === 'single' && dashboardView) {
      dashboardView.classList.remove('hidden');
    }
  }

  // Sync and live-refresh global chat from backend
  async function fetchGlobalChat() {
    try {
      const res = await fetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.messages)) {
          const isDifferent = JSON.stringify(data.messages) !== JSON.stringify(state.chatMessages);
          state.chatMessages = data.messages;
          localStorage.setItem('leetdash_global_chat_v1', JSON.stringify(state.chatMessages));
          if (isDifferent) {
            renderGlobalChat();
          }
        }
      }
    } catch (err) {
      console.warn('Global chat sync error:', err);
    }
  }

  // Start initial sync and live background polling every 3s
  fetchGlobalChat();
  setInterval(fetchGlobalChat, 3000);

});
