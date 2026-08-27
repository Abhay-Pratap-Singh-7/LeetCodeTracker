require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const supabase = require('./supabase');

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

const problemDifficultyCache = new Map();

async function getDifficultyForSlug(titleSlug) {
  if (!titleSlug) return 'Medium';
  if (problemDifficultyCache.has(titleSlug)) {
    return problemDifficultyCache.get(titleSlug);
  }
  try {
    const qData = await fetchLeetCodeGraphQL(`
      query getDiff($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          difficulty
        }
      }
    `, { titleSlug });
    const diff = qData?.question?.difficulty || 'Medium';
    problemDifficultyCache.set(titleSlug, diff);
    return diff;
  } catch (e) {
    return 'Medium';
  }
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

    const formattedRecentSubmissions = await Promise.all(
      recentSubmissions.map(async s => ({
        id: s.id,
        title: s.title,
        titleSlug: s.titleSlug,
        timestamp: s.timestamp,
        difficulty: await getDifficultyForSlug(s.titleSlug),
        url: `https://leetcode.com/problems/${s.titleSlug}/`
      }))
    );

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
      recentSubmissions: formattedRecentSubmissions,
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

// Endpoint to fetch Today's LeetCode Daily Question
app.get('/api/daily-question', async (req, res) => {
  const dailyQuery = `
    query questionOfToday {
      activeDailyCodingChallengeQuestion {
        date
        userStatus
        link
        question {
          questionFrontendId
          title
          titleSlug
          difficulty
          acRate
          topicTags {
            name
            slug
          }
        }
      }
    }
  `;

  try {
    const data = await fetchLeetCodeGraphQL(dailyQuery, {});
    const daily = data?.activeDailyCodingChallengeQuestion;
    if (!daily || !daily.question) {
      return res.json({
        title: 'LeetCode Daily Challenge',
        url: 'https://leetcode.com/problemset/all/',
        difficulty: 'Medium',
        acRate: '50.0%',
        topicTags: ['Algorithms']
      });
    }

    const q = daily.question;
    const qNum = q.questionFrontendId ? `${q.questionFrontendId}. ` : '';
    res.json({
      date: daily.date,
      title: `${qNum}${q.title}`,
      rawTitle: q.title,
      titleSlug: q.titleSlug,
      difficulty: q.difficulty || 'Medium',
      acRate: q.acRate ? `${q.acRate.toFixed(1)}%` : 'N/A',
      topicTags: (q.topicTags || []).map(t => t.name),
      url: `https://leetcode.com${daily.link || `/problems/${q.titleSlug}/`}`
    });
  } catch (err) {
    console.error('Error fetching daily question:', err.message);
    res.json({
      title: 'LeetCode Daily Challenge',
      url: 'https://leetcode.com/problemset/all/',
      difficulty: 'Medium',
      acRate: '50.0%',
      topicTags: ['Algorithms']
    });
  }
});

// Supabase & App Configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('your-project-id') ? process.env.SUPABASE_URL : null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY !== 'your-supabase-anon-key' ? process.env.SUPABASE_ANON_KEY : null,
    hasSupabase: !!supabase
  });
});

// Profile Sync Endpoint
app.post('/api/profile/sync', async (req, res) => {
  if (!supabase) {
    return res.status(530).json({ error: 'Supabase is not configured.' });
  }

  const { id, email, name, avatar, leetcodeUsername } = req.body;
  if (!id || !leetcodeUsername) {
    return res.status(400).json({ error: 'User ID and LeetCode username are required.' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id,
        email: email || '',
        name: name || email || 'User',
        avatar: avatar || 'https://assets.leetcode.com/users/default_avatar.jpg',
        leetcode_username: leetcodeUsername.trim(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Group API Endpoints
app.post('/api/groups', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase is not configured yet. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env file.' });
  }

  const { name, createdBy, leetcodeUsername, email, fullName, avatarUrl } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    if (createdBy && leetcodeUsername) {
      await supabase.from('profiles').upsert({
        id: createdBy,
        email: email || '',
        name: fullName || email || 'User',
        avatar: avatarUrl || 'https://assets.leetcode.com/users/default_avatar.jpg',
        leetcode_username: leetcodeUsername.trim(),
        updated_at: new Date()
      });
    }

    const { data: group, error } = await supabase
      .from('groups')
      .insert([{ name: name.trim(), invite_code: inviteCode, created_by: createdBy || null }])
      .select()
      .single();

    if (error) throw error;

    if (createdBy) {
      await supabase.from('group_members').insert([{ group_id: group.id, user_id: createdBy, role: 'admin' }]);
    }

    res.json({ success: true, group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups/join', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase is not configured yet.' });
  }

  const { inviteCode, userId, leetcodeUsername, email, fullName, avatarUrl } = req.body;
  if (!inviteCode || !userId) {
    return res.status(400).json({ error: 'Invite code and user ID are required.' });
  }

  try {
    if (leetcodeUsername) {
      await supabase.from('profiles').upsert({
        id: userId,
        email: email || '',
        name: fullName || email || 'User',
        avatar: avatarUrl || 'https://assets.leetcode.com/users/default_avatar.jpg',
        leetcode_username: leetcodeUsername.trim(),
        updated_at: new Date()
      });
    }

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('id, name, invite_code')
      .eq('invite_code', inviteCode.trim().toUpperCase())
      .single();

    if (groupErr || !group) {
      return res.status(404).json({ error: 'Invalid invite code.' });
    }

    const { error: joinErr } = await supabase
      .from('group_members')
      .insert([{ group_id: group.id, user_id: userId, role: 'member' }]);

    if (joinErr && !joinErr.message.includes('duplicate')) {
      throw joinErr;
    }

    res.json({ success: true, group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups/user/:userId', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase is not configured yet.' });
  }

  try {
    const { data: userGroups, error } = await supabase
      .from('group_members')
      .select('group_id, role, groups(id, name, invite_code)')
      .eq('user_id', req.params.userId);

    if (error) throw error;
    res.json({ groups: (userGroups || []).map(g => g.groups) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups/:groupId', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase is not configured yet.' });
  }

  try {
    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('*')
      .eq('id', req.params.groupId)
      .single();

    if (groupErr) throw groupErr;

    const { data: members, error: memErr } = await supabase
      .from('group_members')
      .select('user_id, role, profiles(id, email, name, avatar, leetcode_username)')
      .eq('group_id', req.params.groupId);

    if (memErr) throw memErr;

    const formattedMembers = (members || []).map(m => ({
      username: m.profiles?.leetcode_username || m.profiles?.email?.split('@')[0] || 'unknown',
      name: m.profiles?.name || m.profiles?.leetcode_username || 'Member',
      avatar: m.profiles?.avatar || 'https://assets.leetcode.com/users/default_avatar.jpg',
      role: m.role
    }));

    res.json({ group, members: formattedMembers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`LeetCode Analytics Dashboard running on http://localhost:${PORT}`);
});
