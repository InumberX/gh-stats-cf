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

type CountsResponse = {
  user: {
    name: string | null
    login: string
    contributionsCollection: {
      totalCommitContributions: number
    }
    repositoriesContributedTo: { totalCount: number }
    followers: { totalCount: number }
  } | null
  publicPRs: { issueCount: number }
  publicIssues: { issueCount: number }
  publicReviews: { issueCount: number }
}

type StarsResponse = {
  user: {
    repositories: {
      nodes: { stargazerCount: number }[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  } | null
}

// Counts query — fetched once per request. PR / issue / review counts all go
// through the Search API with `is:public` so private repo activity does not
// leak into the public stats card. `repositoriesContributedTo` accepts
// `privacy: PUBLIC` directly.
//
// `totalCommitContributions` does NOT have a server-side public-only filter,
// and when the configured PAT belongs to the user being displayed (the
// expected setup for this single-user worker) it includes that user's own
// private commits within the contribution window. This is documented in the
// README; we surface the field as-is to keep the commits-in-the-last-year
// figure useful for the worker's owner.
const COUNTS_QUERY = `
  query userCounts(
    $login: String!
    $publicPrQuery: String!
    $publicIssueQuery: String!
    $publicReviewQuery: String!
  ) {
    user(login: $login) {
      name
      login
      contributionsCollection {
        totalCommitContributions
      }
      repositoriesContributedTo(
        first: 1
        privacy: PUBLIC
        includeUserRepositories: true
        contributionTypes: [COMMIT, PULL_REQUEST, ISSUE, REPOSITORY]
      ) { totalCount }
      followers { totalCount }
    }
    publicPRs: search(query: $publicPrQuery, type: ISSUE, first: 1) { issueCount }
    publicIssues: search(query: $publicIssueQuery, type: ISSUE, first: 1) { issueCount }
    publicReviews: search(query: $publicReviewQuery, type: ISSUE, first: 1) { issueCount }
  }
`

// Stars query — paginated. `privacy: PUBLIC` keeps private repo stars out of
// the public-facing totals even when the PAT could see them. `isFork: false`
// excludes forked repos so stars earned upstream do not inflate the total
// (top-langs already filters forks for the same reason).
const STARS_QUERY = `
  query userStars($login: String!, $after: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
        orderBy: { direction: DESC, field: STARGAZERS }
      ) {
        nodes { stargazerCount }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`

// Safety cap for repository pagination: 100 pages * 100 repos = 10,000 repos.
// Covers virtually every real GitHub account. If hit, the result is partial
// and a warning is logged.
const MAX_REPO_PAGES = 100

const exponentialCdf = (x: number): number => 1 - 2 ** -x

const calculateRank = (input: {
  commits: number
  prs: number
  issues: number
  reviews: number
  stars: number
  followers: number
}): { level: string; percentile: number } => {
  const COMMITS_MEDIAN = 250
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

  // All contributions use exponentialCdf so each metric grows smoothly toward
  // its weight ceiling as it approaches and exceeds the median.
  const rank =
    1 -
    (COMMITS_WEIGHT * exponentialCdf(input.commits / COMMITS_MEDIAN) +
      PRS_WEIGHT * exponentialCdf(input.prs / PRS_MEDIAN) +
      ISSUES_WEIGHT * exponentialCdf(input.issues / ISSUES_MEDIAN) +
      REVIEWS_WEIGHT * exponentialCdf(input.reviews / REVIEWS_MEDIAN) +
      STARS_WEIGHT * exponentialCdf(input.stars / STARS_MEDIAN) +
      FOLLOWERS_WEIGHT * exponentialCdf(input.followers / FOLLOWERS_MEDIAN)) /
      TOTAL_WEIGHT

  const percentile = rank * 100
  const levelIndex = THRESHOLDS.findIndex((t) => percentile <= t)
  const level = LEVELS[levelIndex >= 0 ? levelIndex : LEVELS.length - 1] ?? 'C'

  return { level, percentile }
}

export const fetchStats = async (username: string, options: { pats: string[] }): Promise<Stats> => {
  // 1. Counts (one-shot). Username is validated upstream to be alphanumeric +
  //    hyphen only (see isValidUsername), so embedding it into a search query
  //    string is safe.
  const counts: CountsResponse = await graphqlRequest<CountsResponse>(
    COUNTS_QUERY,
    {
      login: username,
      publicPrQuery: `is:pr author:${username} is:public`,
      publicIssueQuery: `is:issue author:${username} is:public`,
      publicReviewQuery: `is:pr reviewed-by:${username} is:public`,
    },
    options.pats
  )
  if (!counts.user) {
    throw new Error(`User not found: ${username}`)
  }

  // 2. Stars (paginated).
  let totalStars = 0
  let after: string | null = null
  let truncated = false
  for (let page = 0; page < MAX_REPO_PAGES; page++) {
    const data: StarsResponse = await graphqlRequest<StarsResponse>(
      STARS_QUERY,
      { login: username, after },
      options.pats
    )
    if (!data.user) {
      throw new Error(`User not found: ${username}`)
    }
    for (const node of data.user.repositories.nodes) {
      totalStars += node.stargazerCount
    }
    if (!data.user.repositories.pageInfo.hasNextPage) break
    after = data.user.repositories.pageInfo.endCursor
    if (page === MAX_REPO_PAGES - 1) truncated = true
  }
  if (truncated) {
    console.warn(`Star aggregation truncated at ${MAX_REPO_PAGES * 100} repos for user ${username}`)
  }

  const totalCommits = counts.user.contributionsCollection.totalCommitContributions
  const totalPRs = counts.publicPRs.issueCount
  const totalIssues = counts.publicIssues.issueCount
  const reviews = counts.publicReviews.issueCount
  const contributedTo = counts.user.repositoriesContributedTo.totalCount
  const followers = counts.user.followers.totalCount

  const rank = calculateRank({
    commits: totalCommits,
    prs: totalPRs,
    issues: totalIssues,
    reviews,
    stars: totalStars,
    followers,
  })

  return {
    name: counts.user.name ?? counts.user.login,
    login: counts.user.login,
    totalStars,
    totalCommits,
    totalPRs,
    totalIssues,
    contributedTo,
    rank,
  }
}

export const __test = { calculateRank, exponentialCdf }
