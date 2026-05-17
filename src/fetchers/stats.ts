import { graphqlRequest } from '~/fetchers/github'

export type Stats = {
  name: string
  login: string
  totalStars: number
  totalCommits: number
  totalPRs: number
  totalIssues: number
  contributedTo: number
  rank: { level: string; percentile: number }
}

type StatsResponse = {
  user: {
    name: string | null
    login: string
    contributionsCollection: {
      totalCommitContributions: number
      totalPullRequestReviewContributions: number
      restrictedContributionsCount: number
    }
    repositoriesContributedTo: { totalCount: number }
    pullRequests: { totalCount: number }
    openIssues: { totalCount: number }
    closedIssues: { totalCount: number }
    followers: { totalCount: number }
    repositories: {
      totalCount: number
      nodes: { stargazerCount: number }[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  } | null
}

const STATS_QUERY = `
  query userInfo($login: String!, $after: String) {
    user(login: $login) {
      name
      login
      contributionsCollection {
        totalCommitContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
      }
      repositoriesContributedTo(
        first: 1
        contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]
      ) { totalCount }
      pullRequests(first: 1) { totalCount }
      openIssues: issues(states: OPEN) { totalCount }
      closedIssues: issues(states: CLOSED) { totalCount }
      followers { totalCount }
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        orderBy: { direction: DESC, field: STARGAZERS }
      ) {
        totalCount
        nodes { stargazerCount }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

const exponentialCdf = (x: number): number => 1 - 2 ** -x

const logNormalCdf = (x: number): number => {
  if (x <= 0) return 0
  return Math.log(1 + x) / Math.log(1 + Math.max(x, 1))
}

const calculateRank = (input: {
  commits: number
  prs: number
  issues: number
  reviews: number
  stars: number
  followers: number
  includeAllCommits: boolean
}): { level: string; percentile: number } => {
  const COMMITS_MEDIAN = input.includeAllCommits ? 1000 : 250
  const COMMITS_WEIGHT = 2
  const PRS_MEDIAN = 50
  const PRS_WEIGHT = 3
  const ISSUES_MEDIAN = 25
  const ISSUES_WEIGHT = 1
  const REVIEWS_MEDIAN = 2
  const REVIEWS_WEIGHT = 1
  const STARS_MEDIAN = 50
  const STARS_WEIGHT = 4
  const FOLLOWERS_MEDIAN = 10
  const FOLLOWERS_WEIGHT = 1
  const TOTAL_WEIGHT = COMMITS_WEIGHT + PRS_WEIGHT + ISSUES_WEIGHT + REVIEWS_WEIGHT + STARS_WEIGHT + FOLLOWERS_WEIGHT

  const THRESHOLDS = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100]
  const LEVELS = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C']

  const rank =
    1 -
    (COMMITS_WEIGHT * exponentialCdf(input.commits / COMMITS_MEDIAN) +
      PRS_WEIGHT * exponentialCdf(input.prs / PRS_MEDIAN) +
      ISSUES_WEIGHT * exponentialCdf(input.issues / ISSUES_MEDIAN) +
      REVIEWS_WEIGHT * exponentialCdf(input.reviews / REVIEWS_MEDIAN) +
      STARS_WEIGHT * logNormalCdf(input.stars / STARS_MEDIAN) +
      FOLLOWERS_WEIGHT * logNormalCdf(input.followers / FOLLOWERS_MEDIAN)) /
      TOTAL_WEIGHT

  const percentile = rank * 100
  const levelIndex = THRESHOLDS.findIndex((t) => percentile <= t)
  const level = LEVELS[levelIndex >= 0 ? levelIndex : LEVELS.length - 1] ?? 'C'

  return { level, percentile }
}

export const fetchStats = async (
  username: string,
  options: { pats: string[]; countPrivate: boolean }
): Promise<Stats> => {
  let totalStars = 0
  let after: string | null = null
  let user: StatsResponse['user'] | null = null

  for (let page = 0; page < 10; page++) {
    const data: StatsResponse = await graphqlRequest<StatsResponse>(
      STATS_QUERY,
      { login: username, after },
      options.pats
    )
    if (!data.user) {
      throw new Error(`User not found: ${username}`)
    }
    user = data.user
    for (const node of data.user.repositories.nodes) {
      totalStars += node.stargazerCount
    }
    if (!data.user.repositories.pageInfo.hasNextPage) break
    after = data.user.repositories.pageInfo.endCursor
  }

  if (!user) {
    throw new Error(`User not found: ${username}`)
  }

  const totalCommits =
    user.contributionsCollection.totalCommitContributions +
    (options.countPrivate ? user.contributionsCollection.restrictedContributionsCount : 0)
  const totalPRs = user.pullRequests.totalCount
  const totalIssues = user.openIssues.totalCount + user.closedIssues.totalCount
  const reviews = user.contributionsCollection.totalPullRequestReviewContributions
  const contributedTo = user.repositoriesContributedTo.totalCount
  const followers = user.followers.totalCount

  const rank = calculateRank({
    commits: totalCommits,
    prs: totalPRs,
    issues: totalIssues,
    reviews,
    stars: totalStars,
    followers,
    includeAllCommits: options.countPrivate,
  })

  return {
    name: user.name ?? user.login,
    login: user.login,
    totalStars,
    totalCommits,
    totalPRs,
    totalIssues,
    contributedTo,
    rank,
  }
}

export const __test = { calculateRank, exponentialCdf, logNormalCdf }
