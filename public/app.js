/* ==========================================================================
   LeetDash - Today's Solved Problems Daily Track Engine
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
    { username: '18WAgXvMr1', name: 'Abhay', avatar: 'https://assets.leetcode.com/users/default_avatar.jpg' }
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

  const state = {
    currentUser: null,
    savedMembers: savedMembers,
    teamData: {},
    activeView: 'single',
    charts: {
      pieProgress: null
    }
  };

  const searchForm = document.getElementById('search-form');
  const usernameInput = document.getElementById('username-input');
  const btnAddMember = document.getElementById('btn-add-member');
  const btnToggleView = document.getElementById('btn-toggle-view');
  const btnBackProfile = document.getElementById('btn-back-profile');
  const btnRefreshTeam = document.getElementById('btn-refresh-team');
  const btnRefreshDaily = document.getElementById('btn-refresh-daily');

  const menuViewProfile = document.getElementById('menu-view-profile');
  const menuViewTeam = document.getElementById('menu-view-team');
  const menuViewDaily = document.getElementById('menu-view-daily');
  const sidebarAddBtn = document.getElementById('sidebar-add-btn');

  const dashboardView = document.getElementById('dashboard-view');
  const teamView = document.getElementById('team-view');
  const dailyTrackView = document.getElementById('daily-track-view');

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

    const firstValidMember = state.savedMembers.find(m => m && m.username);
    const defaultUser = firstValidMember ? firstValidMember.username : 'aditya7417';
    loadUserData(defaultUser);
  }

  function setupEventListeners() {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = usernameInput.value.trim();
      if (username) {
        loadUserData(username);
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

    if (sidebarAddBtn) sidebarAddBtn.addEventListener('click', () => usernameInput.focus());

    menuViewProfile.addEventListener('click', () => switchView('single'));
    menuViewTeam.addEventListener('click', () => switchView('team'));
    if (menuViewDaily) menuViewDaily.addEventListener('click', () => switchView('daily'));

    if (btnToggleView) btnToggleView.addEventListener('click', () => switchView('team'));
    if (btnBackProfile) btnBackProfile.addEventListener('click', () => switchView('single'));
    if (btnRefreshTeam) btnRefreshTeam.addEventListener('click', () => loadTeamData());
    if (btnRefreshDaily) btnRefreshDaily.addEventListener('click', () => loadDailyTrackData());

    btnRetry.addEventListener('click', () => {
      const username = usernameInput.value.trim() || 'aditya7417';
      loadUserData(username);
    });
  }

  function switchView(view) {
    state.activeView = view;
    menuViewProfile.classList.remove('active');
    menuViewTeam.classList.remove('active');
    if (menuViewDaily) menuViewDaily.classList.remove('active');

    dashboardView.classList.add('hidden');
    teamView.classList.add('hidden');
    if (dailyTrackView) dailyTrackView.classList.add('hidden');

    if (view === 'single') {
      menuViewProfile.classList.add('active');
      dashboardView.classList.remove('hidden');
    } else if (view === 'team') {
      menuViewTeam.classList.add('active');
      teamView.classList.remove('hidden');
      loadTeamData();
    } else if (view === 'daily') {
      if (menuViewDaily) menuViewDaily.classList.add('active');
      if (dailyTrackView) dailyTrackView.classList.remove('hidden');
      loadDailyTrackData();
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
      });

      list.appendChild(item);
    });
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
    renderStreakWidget(data.submissionCalendar);
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

  function renderStreakWidget(rawCalendarData) {
    const parsedCalendar = parseSubmissionCalendar(rawCalendarData);
    let currentStreak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = formatLocalDateKey(d);
      const count = parsedCalendar[dateKey] || 0;

      if (count > 0) {
        currentStreak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    document.getElementById('val-streak-count').textContent = `${currentStreak.toString().padStart(2, '0')} Days`;
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

  // Load & Render Daily Track Data (Strictly Filters for Current Day Solved Problems)
  async function loadDailyTrackData() {
    const container = document.getElementById('daily-track-cards-container');
    if (!container) return;

    container.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px; font-weight: 700; color: var(--text-muted);">Fetching live daily track data for all team members...</div>`;

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

      // Filter submissions for problems solved ON THE CURRENT DAY
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

  async function loadTeamData() {
    const tbody = document.getElementById('team-leaderboard-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px;">Loading team stats...</td></tr>`;

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

});
