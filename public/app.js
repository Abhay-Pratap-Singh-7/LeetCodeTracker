/* ==========================================================================
   LeetDash - Multi-View Engine & Universal Shimmer Loading Across All Tabs
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }

  const state = {
    currentUser: null,
    authUser: null,
    userGroups: [],
    activeGroup: null,
    groupMembers: [],
    teamData: {},
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

  const dashboardView = document.getElementById('dashboard-view');
  const teamView = document.getElementById('team-view');
  const dailyTrackView = document.getElementById('daily-track-view');
  const warningsView = document.getElementById('warnings-view');

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

  let supabaseClient = null;

  init();

  async function init() {
    renderSidebarGroups();
    setupEventListeners();
    await initSupabase();

    switchView('daily');

    // If user entered search or default
    const defaultUser = '18WAgXvMr1';
    loadUserDataSilent(defaultUser);
  }

  async function initSupabase() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();

      if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
        supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

        const { data: { session } } = await supabaseClient.auth.getSession();
        await updateAuthUI(session?.user || null);

        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
          await updateAuthUI(session?.user || null);
        });
      }
    } catch (e) {
      console.log('Supabase frontend init skipped:', e.message);
    }
  }

  function showCustomModal({ title = 'Link LeetCode Account', icon = 'link', description = '', placeholder = '', value = '', submitText = 'Save', cancelText = '', hideInput = false }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('app-modal-overlay');
      const titleEl = document.getElementById('modal-title');
      const iconEl = document.getElementById('modal-icon');
      const descEl = document.getElementById('modal-description');
      const inputEl = document.getElementById('modal-input');
      const inputContainer = document.getElementById('modal-input-container');
      const submitTextEl = document.getElementById('modal-submit-text');
      const submitBtn = document.getElementById('modal-submit-btn');
      const cancelBtn = document.getElementById('modal-cancel-btn');
      const closeBtn = document.getElementById('modal-close-btn');

      if (!overlay) {
        if (hideInput) { alert(`${title}\n\n${description}`); return resolve(true); }
        return resolve(prompt(`${title}\n${description}`, value));
      }

      if (titleEl) titleEl.textContent = title;
      if (iconEl) { iconEl.setAttribute('data-lucide', icon); }
      if (descEl) {
        descEl.textContent = description || '';
        descEl.style.display = description ? 'block' : 'none';
      }
      if (submitTextEl) submitTextEl.textContent = submitText;
      if (cancelBtn) {
        cancelBtn.textContent = cancelText || 'Cancel';
        cancelBtn.style.display = cancelText ? 'flex' : 'none';
      }
      if (inputEl) { inputEl.value = value; inputEl.placeholder = placeholder || 'Enter value...'; }
      if (inputContainer) inputContainer.style.display = hideInput ? 'none' : 'block';

      overlay.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
      if (!hideInput && inputEl) setTimeout(() => inputEl.focus(), 50);

      function cleanup(result) {
        overlay.classList.add('hidden');
        if (submitBtn) submitBtn.removeEventListener('click', onConfirm);
        if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
        if (closeBtn) closeBtn.removeEventListener('click', onCancel);
        if (inputEl) inputEl.removeEventListener('keydown', onKeyDown);
        resolve(result);
      }
      function onConfirm() {
        const val = hideInput ? true : inputEl.value.trim();
        if (!hideInput && !val) return;
        cleanup(val);
      }
      function onCancel() { cleanup(null); }
      function onKeyDown(e) { if (e.key === 'Enter') { e.preventDefault(); onConfirm(); } }

      if (submitBtn) submitBtn.addEventListener('click', onConfirm);
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
      if (closeBtn) closeBtn.addEventListener('click', onCancel);
      if (inputEl) inputEl.addEventListener('keydown', onKeyDown);
    });
  }

  function extractLeetCodeUsername(input) {
    if (!input) return null;
    const trimmed = input.trim();
    const match = trimmed.match(/(?:leetcode\.com\/(?:u\/)?|@)?([a-zA-Z0-9_-]+)/);
    return match && match[1] ? match[1] : trimmed;
  }

  async function updateAuthUI(user) {
    state.authUser = user;
    const unauthEl = document.getElementById('auth-unauthenticated-state');
    const authEl = document.getElementById('auth-authenticated-state');
    const userNameEl = document.getElementById('auth-user-name');
    const userAvatarEl = document.getElementById('auth-user-avatar');

    if (user) {
      if (unauthEl) unauthEl.classList.add('hidden');
      if (authEl) authEl.classList.remove('hidden');

      const fullName = user.user_metadata?.full_name || user.email || 'Authenticated User';
      const avatarUrl = user.user_metadata?.avatar_url || 'https://assets.leetcode.com/users/default_avatar.jpg';

      let lcUsername = user.user_metadata?.leetcode_username || localStorage.getItem(`lc_user_${user.id}`);
      if (!lcUsername) {
        const input = await showCustomModal({
          title: 'Link LeetCode Account',
          description: '',
          placeholder: 'Enter LeetCode username or profile link...',
          submitText: 'Save',
          cancelText: ''
        });

        if (input) {
          lcUsername = extractLeetCodeUsername(input);
          if (lcUsername) {
            localStorage.setItem(`lc_user_${user.id}`, lcUsername);
            if (supabaseClient) {
              try {
                await supabaseClient.auth.updateUser({ data: { leetcode_username: lcUsername } });
              } catch (e) {}
            }
          }
        }
      }

      const handle = lcUsername ? `@${lcUsername}` : (user.email ? `@${user.email.split('@')[0]}` : '@google_user');

      if (userNameEl) userNameEl.textContent = fullName;
      if (userAvatarEl) userAvatarEl.src = avatarUrl;

      // Sync Profile to Server Database
      if (lcUsername && user.id) {
        try {
          await fetch('/api/profile/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.id,
              email: user.email,
              name: fullName,
              avatar: avatarUrl,
              leetcodeUsername: lcUsername
            })
          });
        } catch (e) {}
      }

      // Update Top Right Header Profile
      const headerAvatar = document.getElementById('header-user-avatar');
      const headerName = document.getElementById('header-user-name');
      const headerHandle = document.getElementById('header-user-handle');
      const headerLink = document.getElementById('header-user-link');

      if (headerAvatar) headerAvatar.src = avatarUrl;
      if (headerName) headerName.textContent = fullName;
      if (headerHandle) headerHandle.textContent = handle;
      if (headerLink) {
        headerLink.onclick = null;
        if (lcUsername) {
          headerLink.href = `https://leetcode.com/u/${lcUsername}/`;
          headerLink.target = '_blank';
          headerLink.title = `Open LeetCode Profile (@${lcUsername})`;
        } else {
          headerLink.href = 'javascript:void(0)';
          headerLink.title = 'Click to link your LeetCode Profile';
          headerLink.onclick = async (e) => {
            e.preventDefault();
            const input = await showCustomModal({
              title: 'Link LeetCode Profile',
              description: 'Enter your LeetCode username or profile link:',
              placeholder: 'Username or Profile URL...'
            });
            if (input) {
              const u = extractLeetCodeUsername(input);
              if (u) {
                localStorage.setItem(`lc_user_${user.id}`, u);
                if (supabaseClient) {
                  try {
                    await supabaseClient.auth.updateUser({ data: { leetcode_username: u } });
                  } catch (err) {}
                }
                window.open(`https://leetcode.com/u/${u}/`, '_blank');
                updateAuthUI(user);
              }
            }
          };
        }
      }

      // Load user groups from database
      await loadUserGroups(user.id);

    } else {
      if (unauthEl) unauthEl.classList.remove('hidden');
      if (authEl) authEl.classList.add('hidden');

      state.userGroups = [];
      state.activeGroup = null;
      state.groupMembers = [];
      renderSidebarGroups();
      updateActiveGroupBadges();

      if (state.currentUser) {
        renderHeaderUserProfile(state.currentUser);
      }

      if (state.activeView === 'daily') loadDailyTrackData();
      else if (state.activeView === 'team') loadTeamData();
      else if (state.activeView === 'warnings') loadWarningsData();
    }
  }

  function renderSidebarGroups() {
    const list = document.getElementById('sidebar-groups-list');
    const countBadge = document.getElementById('sidebar-groups-count');
    if (!list) return;
    list.innerHTML = '';

    if (countBadge) {
      countBadge.textContent = state.userGroups.length;
    }

    if (!state.authUser) {
      list.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-light); padding: 8px 4px; text-align: center;">Sign in to view & join groups</div>`;
      return;
    }

    if (state.userGroups.length === 0) {
      list.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-light); padding: 8px 4px; text-align: center;">No groups joined yet.<br>Create or join one below!</div>`;
      return;
    }

    state.userGroups.forEach(group => {
      if (!group || !group.id) return;
      const item = document.createElement('div');
      const isActive = state.activeGroup && state.activeGroup.id === group.id;
      item.className = `sidebar-group-item ${isActive ? 'active' : ''}`;

      item.innerHTML = `
        <div class="group-item-left">
          <i data-lucide="users" style="width: 16px; height: 16px; flex-shrink: 0; color: ${isActive ? 'var(--primary-green)' : 'var(--text-light)'}"></i>
          <span class="group-item-name" title="${group.name}">${group.name}</span>
        </div>
        <div class="group-item-right">
          ${group.invite_code ? `<span class="group-code-pill" title="Click to copy invite code: ${group.invite_code}">${group.invite_code}</span>` : ''}
          ${isActive ? '<span class="active-dot"></span>' : ''}
        </div>
      `;

      const codePill = item.querySelector('.group-code-pill');
      if (codePill) {
        codePill.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(group.invite_code);
          codePill.textContent = 'COPIED!';
          setTimeout(() => { codePill.textContent = group.invite_code; }, 1500);
        });
      }

      item.addEventListener('click', () => {
        selectGroup(group.id);
        closeMobileSidebar();
      });

      list.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function updateActiveGroupBadges() {
    const group = state.activeGroup;
    const dailyBadge = document.getElementById('daily-active-group-badge');
    const dailyName = document.getElementById('daily-active-group-name');
    const dailySub = document.getElementById('daily-track-subtitle');

    const teamBadge = document.getElementById('team-active-group-badge');
    const teamName = document.getElementById('team-active-group-name');
    const teamSub = document.getElementById('team-leaderboard-subtitle');

    const warnBadge = document.getElementById('warnings-active-group-badge');
    const warnName = document.getElementById('warnings-active-group-name');
    const warnSub = document.getElementById('warnings-subtitle');

    if (group) {
      const gName = group.name;
      if (dailyBadge) dailyBadge.style.display = 'inline-flex';
      if (dailyName) dailyName.textContent = gName;
      if (dailySub) dailySub.textContent = `Real-time daily problem solving log for group "${gName}" (${state.groupMembers.length} members).`;

      if (teamBadge) teamBadge.style.display = 'inline-flex';
      if (teamName) teamName.textContent = gName;
      if (teamSub) teamSub.textContent = `Leaderboard & statistics for group "${gName}".`;

      if (warnBadge) warnBadge.style.display = 'inline-flex';
      if (warnName) warnName.textContent = gName;
      if (warnSub) warnSub.textContent = `Tracking member compliance for group "${gName}".`;
    } else {
      if (dailyBadge) dailyBadge.style.display = 'none';
      if (dailySub) dailySub.textContent = 'Real-time daily problem solving log across group members.';

      if (teamBadge) teamBadge.style.display = 'none';
      if (teamSub) teamSub.textContent = 'Comprehensive statistics comparison across group members.';

      if (warnBadge) warnBadge.style.display = 'none';
      if (warnSub) warnSub.textContent = 'Tracking member compliance (at least 1 problem/day required).';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadUserGroups(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/groups/user/${userId}`);
      const data = await res.json();
      state.userGroups = (data.groups || []).filter(Boolean);
      renderSidebarGroups();

      if (state.userGroups.length > 0) {
        const savedGroupId = localStorage.getItem('active_group_id');
        const defaultGroup = state.userGroups.find(g => g.id === savedGroupId) || state.userGroups[0];
        await selectGroup(defaultGroup.id);
      } else {
        state.activeGroup = null;
        state.groupMembers = [];
        updateActiveGroupBadges();
        if (state.activeView === 'daily') loadDailyTrackData();
        else if (state.activeView === 'team') loadTeamData();
        else if (state.activeView === 'warnings') loadWarningsData();
      }
    } catch (e) {
      console.error('Error fetching user groups:', e);
    }
  }

  async function selectGroup(groupId) {
    if (!groupId) return;
    const group = state.userGroups.find(g => g.id === groupId) || state.activeGroup;
    if (group) {
      state.activeGroup = group;
      localStorage.setItem('active_group_id', groupId);
      renderSidebarGroups();
      await loadGroupMembers(groupId);
    }
  }

  async function loadGroupMembers(groupId) {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      const data = await res.json();
      if (data && data.group) {
        state.activeGroup = data.group;
        state.groupMembers = (data.members || []).map(m => ({
          username: m.username,
          name: m.name || m.username,
          avatar: m.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg',
          role: m.role
        }));
        updateActiveGroupBadges();
        renderSidebarGroups();
        if (state.activeView === 'team') loadTeamData();
        else if (state.activeView === 'daily') loadDailyTrackData();
        else if (state.activeView === 'warnings') loadWarningsData();
      }
    } catch (e) {
      console.error('Error loading group members:', e);
    }
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
        switchView('single');
        loadUserData(username);
      }
    });

    const searchIc = searchForm ? searchForm.querySelector('.search-ic') : null;
    if (searchIc) {
      searchIc.style.cursor = 'pointer';
      searchIc.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        if (username) {
          switchView('single');
          loadUserData(username);
        }
      });
    }

    menuViewProfile.addEventListener('click', () => { switchView('single'); closeMobileSidebar(); });
    menuViewTeam.addEventListener('click', () => { switchView('team'); closeMobileSidebar(); });
    if (menuViewDaily) menuViewDaily.addEventListener('click', () => { switchView('daily'); closeMobileSidebar(); });
    if (menuViewWarnings) menuViewWarnings.addEventListener('click', () => { switchView('warnings'); closeMobileSidebar(); });

    if (btnToggleView) btnToggleView.addEventListener('click', () => switchView('team'));
    if (btnBackProfile) btnBackProfile.addEventListener('click', () => switchView('single'));
    if (btnRefreshTeam) btnRefreshTeam.addEventListener('click', () => loadTeamData());
    if (btnRefreshDaily) btnRefreshDaily.addEventListener('click', () => loadDailyTrackData());
    if (btnRefreshWarnings) btnRefreshWarnings.addEventListener('click', () => loadWarningsData());

    btnRetry.addEventListener('click', () => {
      const username = usernameInput.value.trim() || '18WAgXvMr1';
      switchView('single');
      loadUserData(username);
    });

    const btnLoginGoogle = document.getElementById('btn-login-google');
    if (btnLoginGoogle) {
      btnLoginGoogle.addEventListener('click', async () => {
        if (!supabaseClient) {
          alert('Supabase credentials are not configured in your .env file yet. Please set SUPABASE_URL and SUPABASE_ANON_KEY to enable Google Authentication.');
          return;
        }
        const { error } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin }
        });
        if (error) alert('Login failed: ' + error.message);
      });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (supabaseClient) {
          await supabaseClient.auth.signOut();
          updateAuthUI(null);
        }
      });
    }

    const btnLogoutMenu = document.getElementById('btn-logout-menu');
    if (btnLogoutMenu) {
      btnLogoutMenu.addEventListener('click', async () => {
        if (supabaseClient) {
          await supabaseClient.auth.signOut();
          updateAuthUI(null);
        }
      });
    }

    const btnUpdateUsername = document.getElementById('btn-update-username');
    if (btnUpdateUsername) {
      btnUpdateUsername.addEventListener('click', async () => {
        const user = state.authUser;
        if (!user) return;
        const currentLc = user.user_metadata?.leetcode_username || localStorage.getItem(`lc_user_${user.id}`) || '';
        const input = await showCustomModal({
          title: 'Update LeetCode ID',
          icon: 'user-pen',
          description: 'Enter your new LeetCode username or profile link:',
          placeholder: 'Username or Profile URL...',
          value: currentLc,
          submitText: 'Update'
        });

        if (input) {
          const newUsername = extractLeetCodeUsername(input);
          if (newUsername) {
            localStorage.setItem(`lc_user_${user.id}`, newUsername);
            if (supabaseClient) {
              try {
                await supabaseClient.auth.updateUser({ data: { leetcode_username: newUsername } });
              } catch (e) {}
            }
            try {
              await fetch('/api/profile/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: user.id,
                  email: user.email,
                  name: user.user_metadata?.full_name || user.email,
                  avatar: user.user_metadata?.avatar_url || 'https://assets.leetcode.com/users/default_avatar.jpg',
                  leetcodeUsername: newUsername
                })
              });
            } catch (e) {}

            await showCustomModal({
              title: 'Username Updated',
              icon: 'check-circle',
              description: `LeetCode ID successfully updated to @${newUsername}`,
              submitText: 'Done',
              cancelText: '',
              hideInput: true
            });

            await updateAuthUI(user);
            if (state.activeGroup) {
              await loadGroupMembers(state.activeGroup.id);
            }
          }
        }
      });
    }

    const btnCreateGroup = document.getElementById('btn-create-group');
    if (btnCreateGroup) {
      btnCreateGroup.addEventListener('click', async () => {
        const user = state.authUser;
        let lcUsername = user?.user_metadata?.leetcode_username || (user ? localStorage.getItem(`lc_user_${user.id}`) : null);
        if (!lcUsername) {
          const input = await showCustomModal({
            title: 'LeetCode Username Required',
            icon: 'user',
            description: 'Please enter your LeetCode username or profile link before creating a group:',
            placeholder: 'Username or Profile URL...'
          });
          if (input) lcUsername = extractLeetCodeUsername(input);
          if (!lcUsername) return;
        }

        const groupName = await showCustomModal({
          title: 'Create New Group',
          icon: 'users',
          description: 'Enter a name for your group:',
          placeholder: 'Group Name (e.g. Algo Knights)...',
          submitText: 'Create Group'
        });
        if (!groupName) return;

        try {
          const res = await fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: groupName,
              createdBy: user?.id,
              leetcodeUsername: lcUsername,
              email: user?.email,
              fullName: user?.user_metadata?.full_name || user?.email,
              avatarUrl: user?.user_metadata?.avatar_url
            })
          });
          const result = await res.json();
          if (result.success) {
            await showCustomModal({
              title: 'Group Created!',
              description: `Group "${result.group.name}" created successfully!\n\nInvite Code: ${result.group.invite_code}`,
              submitText: 'Done',
              cancelText: '',
              hideInput: true
            });
            if (user?.id) await loadUserGroups(user.id);
            await selectGroup(result.group.id);
          } else {
            await showCustomModal({
              title: 'Error Creating Group',
              description: result.error || 'Failed to create group.',
              submitText: 'OK',
              cancelText: '',
              hideInput: true
            });
          }
        } catch (e) {
          await showCustomModal({
            title: 'Error',
            description: e.message,
            submitText: 'OK',
            cancelText: '',
            hideInput: true
          });
        }
      });
    }

    const btnJoinGroup = document.getElementById('btn-join-group');
    if (btnJoinGroup) {
      btnJoinGroup.addEventListener('click', async () => {
        const user = state.authUser;
        if (!user) {
          await showCustomModal({
            title: 'Sign In Required',
            description: 'Please sign in first with Google to join a group.',
            submitText: 'OK',
            cancelText: '',
            hideInput: true
          });
          return;
        }

        let lcUsername = user?.user_metadata?.leetcode_username || localStorage.getItem(`lc_user_${user.id}`);
        if (!lcUsername) {
          const input = await showCustomModal({
            title: 'LeetCode Username Required',
            description: 'Please enter your LeetCode username or profile link before joining a group:',
            placeholder: 'Username or Profile URL...'
          });
          if (input) lcUsername = extractLeetCodeUsername(input);
          if (!lcUsername) return;
        }

        const inviteCode = await showCustomModal({
          title: 'Join Existing Group',
          description: 'Enter 6-character group invite code:',
          placeholder: 'Invite Code (e.g. X8K2P9)...',
          submitText: 'Join Group'
        });
        if (!inviteCode) return;

        try {
          const res = await fetch('/api/groups/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              inviteCode: inviteCode.trim(),
              userId: user.id,
              leetcodeUsername: lcUsername,
              email: user.email,
              fullName: user.user_metadata?.full_name || user.email,
              avatarUrl: user.user_metadata?.avatar_url
            })
          });
          const result = await res.json();
          if (result.success) {
            await showCustomModal({
              title: 'Joined Group!',
              description: `Joined group "${result.group.name}" successfully!`,
              submitText: 'Done',
              cancelText: '',
              hideInput: true
            });
            if (user?.id) await loadUserGroups(user.id);
            await selectGroup(result.group.id);
          } else {
            await showCustomModal({
              title: 'Error Joining Group',
              description: result.error || 'Failed to join group.',
              submitText: 'OK',
              cancelText: '',
              hideInput: true
            });
          }
        } catch (e) {
          await showCustomModal({
            title: 'Error',
            description: e.message,
            submitText: 'OK',
            cancelText: '',
            hideInput: true
          });
        }
      });
    }
  }

  function showShimmerLoading() {
    if (shimmerLoadingState) shimmerLoadingState.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
  }

  function showContent() {
    if (shimmerLoadingState) shimmerLoadingState.classList.add('hidden');
    if (errorState) errorState.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');
  }

  function showError(msg) {
    if (shimmerLoadingState) shimmerLoadingState.classList.add('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    if (errorState) {
      errorState.classList.remove('hidden');
      if (errorMsg) errorMsg.textContent = msg || 'Could not fetch details for this username.';
    }
  }

  function switchView(view) {
    state.activeView = view;
    menuViewProfile.classList.remove('active');
    menuViewTeam.classList.remove('active');
    if (menuViewDaily) menuViewDaily.classList.remove('active');
    if (menuViewWarnings) menuViewWarnings.classList.remove('active');

    dashboardView.classList.add('hidden');
    teamView.classList.add('hidden');
    if (dailyTrackView) dailyTrackView.classList.add('hidden');
    if (warningsView) warningsView.classList.add('hidden');

    if (view === 'single') {
      menuViewProfile.classList.add('active');
      dashboardView.classList.remove('hidden');
      if (!state.currentUser) {
        const firstValidMember = state.groupMembers.find(m => m && m.username);
        const u = firstValidMember ? firstValidMember.username : '18WAgXvMr1';
        loadUserData(u);
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
    }
    if (window.lucide) window.lucide.createIcons();
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

      const memberIdx = state.groupMembers.findIndex(m => m && m.username.toLowerCase() === username.toLowerCase());
      if (memberIdx !== -1) {
        state.groupMembers[memberIdx].name = data.name || username;
        state.groupMembers[memberIdx].avatar = data.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';
      }

      renderDashboard(data);
      showContent();

    } catch (err) {
      console.error(err);
      showError(err.message);
    }
  }

  function formatLocalDateKey(d) {
    const dateObj = typeof d === 'number' ? new Date(d) : (d || new Date());
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatUTCToDateKey(ts) {
    const date = new Date(parseInt(ts, 10) * 1000);
    return formatLocalDateKey(date);
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

  async function fetchDailyQuestion() {
    const qTitleEl = document.getElementById('daily-q-title');
    const popoverTitleEl = document.getElementById('daily-popover-title');
    const popoverDiffEl = document.getElementById('daily-popover-diff');
    const popoverDateEl = document.getElementById('daily-popover-date');
    const popoverAcEl = document.getElementById('daily-popover-ac');
    const popoverTagsEl = document.getElementById('daily-popover-tags');
    const popoverLinkEl = document.getElementById('daily-popover-link');

    try {
      const res = await fetch('/api/daily-question');
      if (res.ok) {
        const data = await res.json();
        if (data && data.title && data.url) {
          if (qTitleEl) qTitleEl.textContent = data.title;
          if (popoverTitleEl) popoverTitleEl.textContent = data.title;

          if (popoverDiffEl && data.difficulty) {
            const diffClass = data.difficulty.toLowerCase();
            popoverDiffEl.textContent = data.difficulty;
            popoverDiffEl.className = `daily-popover-diff diff-${diffClass}`;
            if (qTitleEl) qTitleEl.className = `daily-q-title diff-${diffClass}`;
          }

          if (popoverDateEl) {
            popoverDateEl.innerHTML = `<i data-lucide="calendar" style="width: 13px; height: 13px;"></i> ${data.date || 'Today'}`;
          }

          if (popoverAcEl) {
            popoverAcEl.innerHTML = `<i data-lucide="check-circle-2" style="width: 13px; height: 13px;"></i> AC Rate: ${data.acRate || 'N/A'}`;
          }

          if (popoverTagsEl && Array.isArray(data.topicTags) && data.topicTags.length > 0) {
            popoverTagsEl.innerHTML = data.topicTags.map(t => `<span class="tag-pill">${t}</span>`).join('');
          }

          if (popoverLinkEl) {
            popoverLinkEl.href = data.url;
            popoverLinkEl.target = '_blank';
          }
          if (window.lucide) window.lucide.createIcons();
        }
      }
    } catch (e) {
      console.warn('Daily question fetch error:', e);
    }
  }

  fetchDailyQuestion();

  function renderHeaderUserProfile(data) {
    if (!data) return;
    const headerAvatar = document.getElementById('header-user-avatar');
    const headerName = document.getElementById('header-user-name');
    const headerHandle = document.getElementById('header-user-handle');
    const headerUserLink = document.getElementById('header-user-link');

    if (headerAvatar) headerAvatar.src = data.avatar;
    if (headerName) headerName.textContent = data.name;
    if (headerHandle) headerHandle.textContent = `@${data.username}`;
    if (headerUserLink) {
      headerUserLink.href = `https://leetcode.com/u/${data.username}/`;
      headerUserLink.target = '_blank';
      headerUserLink.title = 'Open LeetCode Profile in New Tab';
    }
  }

  function renderDashboard(data) {
    if (!state.authUser) {
      renderHeaderUserProfile(data);
    }

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
    const currentYear = today.getUTCFullYear();
    const todayDateKey = formatLocalDateKey(today);

    for (let m = 0; m < 12; m++) {
      const monthBlock = document.createElement('div');
      monthBlock.className = 'month-block';

      const monthGrid = document.createElement('div');
      monthGrid.className = 'month-grid';

      const firstDayOfMonth = new Date(Date.UTC(currentYear, m, 1));
      const startDayOfWeek = firstDayOfMonth.getUTCDay();

      for (let p = 0; p < startDayOfWeek; p++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'day-cell placeholder';
        monthGrid.appendChild(placeholder);
      }

      const daysInMonth = new Date(Date.UTC(currentYear, m + 1, 0)).getUTCDate();
      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const d = new Date(Date.UTC(currentYear, m, dayNum));
        const dateKey = formatLocalDateKey(d);
        const formattedDateStr = d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
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
    const currentDayOfWeek = today.getUTCDay();
    const diffToMon = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

    const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + diffToMon));

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekData = [];
    let totalAcceptedThisWeek = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
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

  function populateDailyTrackDateOptions() {
    const selectEl = document.getElementById('daily-track-date-select');
    if (!selectEl) return;

    if (selectEl.options.length === 0) {
      const today = new Date();
      const optionsHTML = [];

      for (let i = 0; i < 8; i++) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
        const dateKey = formatLocalDateKey(d);
        const formattedStr = d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' });
        
        let label = formattedStr;
        if (i === 0) label = `Today (${formattedStr})`;
        else if (i === 1) label = `Yesterday (${formattedStr})`;
        else label = `${i} Days Ago (${formattedStr})`;

        optionsHTML.push(`<option value="${dateKey}">${label}</option>`);
      }

      selectEl.innerHTML = optionsHTML.join('');
      selectEl.addEventListener('change', () => {
        loadDailyTrackData(selectEl.value);
      });
    }
  }

  async function loadDailyTrackData(targetDateKey) {
    populateDailyTrackDateOptions();

    const container = document.getElementById('daily-track-cards-container');
    if (!container) return;

    if (!state.activeGroup || state.groupMembers.length === 0) {
      const isAuth = !!state.authUser;
      container.innerHTML = `
        <div class="empty-group-box">
          <i data-lucide="users" style="width: 48px; height: 48px; color: var(--primary-green);"></i>
          <h3>${isAuth ? 'No Group Members' : 'Sign in to View Group Daily Track'}</h3>
          <p>${isAuth ? 'Create a group or join with an invite code to start tracking daily solved problems with your teammates.' : 'Sign in with Google to create or join a group and track daily LeetCode progress group-wise.'}</p>
          <div style="display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; justify-content: center;">
            ${isAuth ? `
              <button class="btn-primary-green" onclick="document.getElementById('btn-create-group')?.click()"><i data-lucide="users-round"></i> Create Group</button>
              <button class="btn-secondary-outline" onclick="document.getElementById('btn-join-group')?.click()"><i data-lucide="user-plus"></i> Join Group</button>
            ` : `
              <button class="btn-primary-green" onclick="document.getElementById('btn-login-google')?.click()"><i data-lucide="log-in"></i> Sign in with Google</button>
            `}
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const selectEl = document.getElementById('daily-track-date-select');
    const chosenDateKey = targetDateKey || (selectEl ? selectEl.value : null) || formatLocalDateKey(new Date());

    if (selectEl && targetDateKey && selectEl.value !== targetDateKey) {
      selectEl.value = targetDateKey;
    }

    const todayStr = formatLocalDateKey(new Date());
    const isToday = chosenDateKey === todayStr;

    container.innerHTML = `
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
    `;

    const fetchPromises = state.groupMembers.map(async (member) => {
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

    container.innerHTML = '';

    state.groupMembers.forEach(member => {
      if (!member || !member.username) return;
      const data = state.teamData[member.username];
      const allSubmissions = data?.recentSubmissions || [];

      const filteredSubmissions = allSubmissions.filter(sub => {
        if (!sub.timestamp) return false;
        const subDateStr = formatLocalDateKey(new Date(parseInt(sub.timestamp, 10) * 1000));
        return subDateStr === chosenDateKey;
      });

      const card = document.createElement('div');
      card.className = 'daily-member-card';

      const displayName = member.name || member.username;
      const avatarUrl = member.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg';

      let problemsHTML = '';
      if (filteredSubmissions.length === 0) {
        const emptyMsg = isToday ? 'no problem solved till now' : 'no problem solved on this day';
        problemsHTML = `<div style="font-size: 0.88rem; color: var(--text-light); font-weight: 600; text-align: center; padding: 18px 0; background: var(--bg-shell); border-radius: var(--radius-md);">${emptyMsg}</div>`;
      } else {
        filteredSubmissions.forEach(sub => {
          const timeStr = new Date(parseInt(sub.timestamp, 10) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const problemUrl = sub.url || `https://leetcode.com/problems/${sub.titleSlug}/`;
          const diffClass = sub.difficulty ? sub.difficulty.toLowerCase() : 'easy';
          const diffLabel = sub.difficulty || 'Easy';

          problemsHTML += `
            <div class="daily-problem-item">
              <div class="daily-problem-left">
                <i data-lucide="check-circle-2" style="width: 16px; height: 16px; color: var(--primary-green); flex-shrink: 0;"></i>
                <a href="${problemUrl}" target="_blank" class="daily-problem-link">${sub.title}</a>
              </div>
              <div class="daily-problem-right">
                <span class="problem-diff-pill diff-${diffClass}">${diffLabel}</span>
                <span class="daily-problem-time">${timeStr}</span>
              </div>
            </div>
          `;
        });
      }

      card.innerHTML = `
        <div class="daily-card-header" style="cursor: pointer;">
          <div class="daily-member-info">
            <img src="${avatarUrl}" alt="${displayName}" class="daily-member-avatar" onerror="this.src='https://assets.leetcode.com/users/default_avatar.jpg'">
            <div>
              <div class="daily-member-name">${displayName}</div>
              <div class="daily-member-handle">@${member.username}</div>
            </div>
          </div>
          <span class="daily-badge-count" style="${filteredSubmissions.length === 0 ? 'background: #f1f5f9; color: var(--text-light);' : ''}">${filteredSubmissions.length} Solved</span>
        </div>
        <div class="daily-problems-list">
          ${problemsHTML}
        </div>
      `;

      card.querySelector('.daily-card-header').addEventListener('click', () => {
        usernameInput.value = member.username;
        loadUserData(member.username);
        switchView('single');
      });

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadWarningsData() {
    const container = document.getElementById('warnings-cards-container');
    if (!container) return;

    if (!state.activeGroup || state.groupMembers.length === 0) {
      const isAuth = !!state.authUser;
      container.innerHTML = `
        <div class="empty-group-box">
          <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: #f59e0b;"></i>
          <h3>${isAuth ? 'No Group Warnings' : 'Sign in to View Group Warnings'}</h3>
          <p>${isAuth ? 'Create or join a group to track daily problem solving compliance across group members.' : 'Sign in with Google to monitor inactivity warnings across group members.'}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
      <div class="daily-shimmer-card"></div>
    `;

    const fetchPromises = state.groupMembers.map(async (member) => {
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

    container.innerHTML = '';

    const startDate = new Date(Date.UTC(2026, 7, 21)); // Aug 21, 2026 UTC
    const todayStr = formatLocalDateKey(new Date());

    const targetDateList = [];
    let cur = new Date(startDate);
    while (formatLocalDateKey(cur) <= todayStr) {
      targetDateList.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    state.groupMembers.forEach(member => {
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
          const formattedStr = targetDate.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
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
        <div class="daily-card-header" style="cursor: pointer;">
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

      card.querySelector('.daily-card-header').addEventListener('click', () => {
        usernameInput.value = member.username;
        loadUserData(member.username);
        switchView('single');
      });

      container.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async function loadTeamData() {
    const tbody = document.getElementById('team-leaderboard-body');
    const dailyChartEl = document.getElementById('team-daily-bar-chart');
    const weeklyChartEl = document.getElementById('team-weekly-bar-chart');
    const monthlyChartEl = document.getElementById('team-monthly-bar-chart');

    if (!state.activeGroup || state.groupMembers.length === 0) {
      const isAuth = !!state.authUser;
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 48px 20px;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <i data-lucide="trophy" style="width: 40px; height: 40px; color: var(--text-light);"></i>
                <div style="font-weight: 700; color: var(--text-dark);">${isAuth ? 'No Group Selected' : 'Sign in to View Group Leaderboard'}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); max-width: 380px;">${isAuth ? 'Select, create, or join a group to compare rankings.' : 'Sign in to view comprehensive group leaderboard rankings.'}</div>
              </div>
            </td>
          </tr>
        `;
      }
      if (dailyChartEl) dailyChartEl.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-light); font-size: 0.85rem;">No group data</div>`;
      if (weeklyChartEl) weeklyChartEl.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-light); font-size: 0.85rem;">No group data</div>`;
      if (monthlyChartEl) monthlyChartEl.innerHTML = `<div style="text-align: center; padding: 40px 0; color: var(--text-light); font-size: 0.85rem;">No group data</div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

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

    const fetchPromises = state.groupMembers.map(async (member) => {
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

    const teamList = state.groupMembers
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
            <div class="user-cell" style="cursor: pointer;">
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

        tr.querySelector('.user-cell').addEventListener('click', () => {
          usernameInput.value = member.username;
          loadUserData(member.username);
          switchView('single');
        });

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

    const diffToMon = today.getUTCDay() === 0 ? -6 : 1 - today.getUTCDay();
    const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + diffToMon));
    const mondayStr = formatLocalDateKey(monday);

    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();

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
        const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
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
      const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(Date.UTC(currentYear, currentMonth, day));
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



  // Monitor 05:30 AM IST (00:00 UTC) LeetCode day rollover and refresh automatically
  let currentLeetCodeDayKey = formatLocalDateKey(new Date());
  setInterval(() => {
    const newDayKey = formatLocalDateKey(new Date());
    if (newDayKey !== currentLeetCodeDayKey) {
      currentLeetCodeDayKey = newDayKey;
      if (state.activeView === 'daily') {
        loadDailyTrackData();
      } else if (state.activeView === 'warnings') {
        loadWarningsData();
      } else if (state.activeView === 'team') {
        loadTeamData();
      }
    }
  }, 10000);

});
