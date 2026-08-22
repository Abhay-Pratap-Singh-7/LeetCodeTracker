const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

// Helper function to query LeetCode GraphQL API
async function fetchLeetCodeGraphQL(query, variables) {
  const response = await fetch(LEETCODE_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://leetcode.com'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`LeetCode API HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL Query Error');
  }
  return data.data;
}

// Endpoint to fetch complete user data in a single call
app.get('/api/user/:username', async (req, res) => {
  const username = req.params.username;

  const profileQuery = `
    query getUserProfile($username: String!) {
      allQuestionsCount {
        difficulty
        count
      }
      matchedUser(username: $username) {
        username
        githubUrl
        twitterUrl
        linkedinUrl
        contributions {
          points
        }
        profile {
          realName
          userAvatar
          birthday
          ranking
          reputation
          websites
          countryName
          company
          school
          skillTags
          aboutMe
          starRating
        }
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
            submissions
          }
          totalSubmissionNum {
            difficulty
            count
            submissions
          }
        }
        badges {
          id
          displayName
          icon
          creationDate
          category
        }
        activeBadge {
          id
          displayName
          icon
        }
        submissionCalendar
      }
    }
  `;

  const contestQuery = `
    query getUserContestRanking ($username: String!) {
      userContestRanking(username: $username) {
        attendedContestsCount
        rating
        globalRanking
        totalParticipants
        topPercentage
        badge {
          name
        }
      }
      userContestRankingHistory(username: $username) {
        attended
        trendDirection
        problemsSolved
        totalProblems
        finishTimeInSeconds
        rating
        ranking
        contest {
          title
          startTime
        }
      }
    }
  `;

  const recentQuery = `
    query getRecentAcSubmissions ($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        timestamp
        id
      }
    }
  `;

  const skillQuery = `
    query skillStats($username: String!) {
      matchedUser(username: $username) {
        tagProblemCounts {
          advanced {
            tagName
            tagSlug
            problemsSolved
          }
          intermediate {
            tagName
            tagSlug
            problemsSolved
          }
          fundamental {
            tagName
            tagSlug
            problemsSolved
          }
        }
      }
    }
  `;

  try {
    const [profileData, contestData, recentData, skillData] = await Promise.allSettled([
      fetchLeetCodeGraphQL(profileQuery, { username }),
      fetchLeetCodeGraphQL(contestQuery, { username }),
      fetchLeetCodeGraphQL(recentQuery, { username, limit: 15 }),
      fetchLeetCodeGraphQL(skillQuery, { username })
    ]);

    if (profileData.status === 'rejected' || !profileData.value?.matchedUser) {
      // Fallback to Alfa LeetCode API if main query fails or user not found directly
      return res.redirect(`/api/user-fallback/${username}`);
    }

    const matchedUser = profileData.value.matchedUser;
    const allQuestions = profileData.value.allQuestionsCount || [];

    const acStats = matchedUser.submitStatsGlobal?.acSubmissionNum || [];
    const totalStats = matchedUser.submitStatsGlobal?.totalSubmissionNum || [];

    const getStat = (arr, diff) => arr.find(x => x.difficulty === diff)?.count || 0;
    const getSubmissions = (arr, diff) => arr.find(x => x.difficulty === diff)?.submissions || 0;
    const getTotalQ = (diff) => allQuestions.find(x => x.difficulty === diff)?.count || 0;

    const totalSolved = getStat(acStats, 'All');
    const easySolved = getStat(acStats, 'Easy');
    const mediumSolved = getStat(acStats, 'Medium');
    const hardSolved = getStat(acStats, 'Hard');

    const totalQuestions = getTotalQ('All');
    const easyQuestions = getTotalQ('Easy');
    const mediumQuestions = getTotalQ('Medium');
    const hardQuestions = getTotalQ('Hard');

    const totalSubmissions = getSubmissions(totalStats, 'All');
    const totalAcSubmissions = getSubmissions(acStats, 'All');
    const acceptanceRate = totalSubmissions > 0 ? ((totalAcSubmissions / totalSubmissions) * 100).toFixed(1) : 0;

    const contest = contestData.status === 'fulfilled' ? contestData.value : {};
    const contestRanking = contest.userContestRanking || null;
    const contestHistory = (contest.userContestRankingHistory || []).filter(h => h.attended);

    const recentSubmissions = recentData.status === 'fulfilled' ? recentData.value.recentAcSubmissionList || [] : [];
    const skillTags = skillData.status === 'fulfilled' ? skillData.value.matchedUser?.tagProblemCounts || {} : {};

    let calendar = {};
    if (matchedUser.submissionCalendar) {
      try {
        calendar = typeof matchedUser.submissionCalendar === 'string'
          ? JSON.parse(matchedUser.submissionCalendar)
          : matchedUser.submissionCalendar;
      } catch (e) {
        calendar = {};
      }
    }

    const payload = {
      username: matchedUser.username,
      name: matchedUser.profile?.realName || matchedUser.username,
      avatar: matchedUser.profile?.userAvatar || 'https://assets.leetcode.com/users/default_avatar.jpg',
      ranking: matchedUser.profile?.ranking || 'N/A',
      reputation: matchedUser.profile?.reputation || 0,
      country: matchedUser.profile?.countryName || null,
      company: matchedUser.profile?.company || null,
      school: matchedUser.profile?.school || null,
      about: matchedUser.profile?.aboutMe || '',
      social: {
        github: matchedUser.githubUrl || null,
        twitter: matchedUser.twitterUrl || null,
        linkedin: matchedUser.linkedinUrl || null,
        website: matchedUser.profile?.websites?.[0] || null
      },
      stats: {
        totalSolved,
        totalQuestions,
        easySolved,
        easyQuestions,
        mediumSolved,
        mediumQuestions,
        hardSolved,
        hardQuestions,
        totalSubmissions,
        totalAcSubmissions,
        acceptanceRate: `${acceptanceRate}%`
      },
      contest: {
        attended: contestRanking?.attendedContestsCount || 0,
        rating: contestRanking?.rating ? Math.round(contestRanking.rating) : null,
        globalRanking: contestRanking?.globalRanking || null,
        totalParticipants: contestRanking?.totalParticipants || null,
        topPercentage: contestRanking?.topPercentage ? contestRanking.topPercentage.toFixed(1) : null,
        badge: contestRanking?.badge?.name || null,
        history: contestHistory.map(h => ({
          title: h.contest?.title,
          rating: Math.round(h.rating),
          ranking: h.ranking,
          problemsSolved: h.problemsSolved,
          totalProblems: h.totalProblems,
          date: new Date(h.contest?.startTime * 1000).toISOString().split('T')[0]
        }))
      },
      badges: matchedUser.badges || [],
      activeBadge: matchedUser.activeBadge || null,
      submissionCalendar: calendar,
      recentSubmissions: recentSubmissions.map(s => ({
        id: s.id,
        title: s.title,
        titleSlug: s.titleSlug,
        timestamp: s.timestamp,
        url: `https://leetcode.com/problems/${s.titleSlug}/`
      })),
      skills: skillTags
    };

    res.json(payload);
  } catch (err) {
    console.error(`Error fetching data for ${username}:`, err.message);
    res.redirect(`/api/user-fallback/${username}`);
  }
});

// Fallback proxy endpoint using public Alfa API
app.get('/api/user-fallback/:username', async (req, res) => {
  const username = req.params.username;
  try {
    const alfaRes = await fetch(`https://alfa-leetcode-api.onrender.com/${username}`);
    if (!alfaRes.ok) {
      return res.status(444).json({ error: 'User not found or LeetCode service unavailable' });
    }
    const data = await alfaRes.json();
    if (data.errors || data.message === "user does not exist") {
      return res.status(404).json({ error: 'LeetCode user not found' });
    }

    // Format response uniformly
    const payload = {
      username: data.username || username,
      name: data.name || username,
      avatar: data.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg',
      ranking: data.ranking || 'N/A',
      reputation: data.reputation || 0,
      country: data.country || null,
      company: data.company || null,
      school: data.school || null,
      about: data.about || '',
      social: {
        github: data.gitHub || null,
        twitter: data.twitter || null,
        linkedin: data.linkedIN || null,
        website: data.website || null
      },
      stats: {
        totalSolved: data.totalSolved || 0,
        totalQuestions: data.totalQuestions || 3300,
        easySolved: data.easySolved || 0,
        easyQuestions: data.totalEasy || 800,
        mediumSolved: data.mediumSolved || 0,
        mediumQuestions: data.totalMedium || 1700,
        hardSolved: data.hardSolved || 0,
        hardQuestions: data.totalHard || 800,
        totalSubmissions: data.totalSubmissions?.[0]?.submissions || 0,
        totalAcSubmissions: data.totalSolved || 0,
        acceptanceRate: data.acceptanceRate || 'N/A'
      },
      contest: {
        attended: data.contestAttend || 0,
        rating: data.contestRating ? Math.round(data.contestRating) : null,
        globalRanking: data.contestGlobalRanking || null,
        topPercentage: data.contestTopPercentage || null,
        badge: data.contestBadge || null,
        history: []
      },
      badges: data.badges || [],
      activeBadge: data.activeBadge || null,
      submissionCalendar: data.submissionCalendar || {},
      recentSubmissions: (data.recentSubmissions || []).slice(0, 15),
      skills: data.skillStats || {}
    };

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user data: ' + err.message });
  }
});

// ==========================================
// Global Chat Backend Storage & APIs
// ==========================================
function getChatFilePath() {
  const possibleDirs = [
    process.env.DATA_DIR,
    process.env.RENDER_DISK_PATH,
    '/var/data',
    __dirname
  ].filter(Boolean);

  for (const dir of possibleDirs) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const testFile = path.join(dir, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return path.join(dir, 'chat_storage.json');
    } catch (e) {
      continue;
    }
  }
  return path.join(__dirname, 'chat_storage.json');
}

const CHAT_FILE = getChatFilePath();
console.log(`[Chat System] Initialized storage at: ${CHAT_FILE}`);

let globalChatMessages = [];

try {
  if (fs.existsSync(CHAT_FILE)) {
    const rawData = fs.readFileSync(CHAT_FILE, 'utf8');
    globalChatMessages = JSON.parse(rawData);
  } else {
    const localBackup = path.join(__dirname, 'chat_storage.json');
    if (fs.existsSync(localBackup)) {
      const rawData = fs.readFileSync(localBackup, 'utf8');
      globalChatMessages = JSON.parse(rawData);
    }
  }
} catch (e) {
  console.error('Failed to load chat history from disk:', e.message);
  globalChatMessages = [];
}

function saveChatStorage() {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(globalChatMessages, null, 2), 'utf8');
    const localBackup = path.join(__dirname, 'chat_storage.json');
    if (CHAT_FILE !== localBackup) {
      try {
        fs.writeFileSync(localBackup, JSON.stringify(globalChatMessages, null, 2), 'utf8');
      } catch (e) {}
    }
  } catch (e) {
    console.error('Failed to save chat storage to disk:', e.message);
  }
}

// GET /api/chat - Fetch all global chat messages
app.get('/api/chat', (req, res) => {
  res.json({ messages: globalChatMessages });
});

// POST /api/chat - Save new message to global chat backend
app.post('/api/chat', (req, res) => {
  const { senderUsername, text } = req.body || {};
  if (!senderUsername || !text || !text.trim()) {
    return res.status(400).json({ error: 'senderUsername and text are required' });
  }

  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    senderUsername: senderUsername.trim(),
    text: text.trim(),
    timestamp: new Date().toISOString()
  };

  globalChatMessages.push(newMsg);
  if (globalChatMessages.length > 1000) {
    globalChatMessages = globalChatMessages.slice(-1000);
  }

  saveChatStorage();

  res.status(201).json({
    success: true,
    message: newMsg,
    messages: globalChatMessages
  });
});

app.listen(PORT, () => {
  console.log(`LeetCode Analytics Dashboard running on http://localhost:${PORT}`);
});
