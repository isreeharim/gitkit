import type { IGitHubClient } from '@/lib/github/client';
import type {
  PullRequestSummary,
  PullRequestDetail,
  PullRequestImpactReport,
} from '@/types/pull-request';
import type { DependencyGraph } from '@/types/dependency';
import {
  normalizePullRequestSummary,
  normalizePullRequestDetail,
  type RawPullRequestItem,
  type RawPullRequestFileItem,
} from './normalizer';
import { analyzePullRequestImpact } from './impact-analyzer';

export interface PullRequestServiceOptions {
  client: IGitHubClient;
}

export class PullRequestService {
  private readonly client: IGitHubClient;

  constructor(options: PullRequestServiceOptions) {
    this.client = options.client;
  }

  /**
   * Retrieves a list of public pull requests for a repository.
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all',
    limit = 30
  ): Promise<PullRequestSummary[]> {
    if (!this.client.fetchPullRequests) {
      return [];
    }

    try {
      const rawList = (await this.client.fetchPullRequests(
        owner,
        repo,
        state,
        limit
      )) as RawPullRequestItem[];

      if (!Array.isArray(rawList)) {
        return [];
      }

      return rawList.map(normalizePullRequestSummary);
    } catch {
      return [];
    }
  }

  /**
   * Retrieves details and changed files for a specific pull request.
   */
  async getPullRequestDetail(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<PullRequestDetail | null> {
    if (!this.client.fetchPullRequest || !this.client.fetchPullRequestFiles) {
      return null;
    }

    try {
      const [rawPr, rawFiles] = await Promise.all([
        this.client.fetchPullRequest(owner, repo, pullNumber) as Promise<RawPullRequestItem | null>,
        this.client.fetchPullRequestFiles(owner, repo, pullNumber) as Promise<
          RawPullRequestFileItem[]
        >,
      ]);

      if (!rawPr) {
        return null;
      }

      return normalizePullRequestDetail(rawPr, Array.isArray(rawFiles) ? rawFiles : []);
    } catch {
      return null;
    }
  }

  /**
   * Performs complete deterministic impact analysis for a pull request.
   */
  async analyzePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    graph?: DependencyGraph
  ): Promise<PullRequestImpactReport | null> {
    const detail = await this.getPullRequestDetail(owner, repo, pullNumber);
    if (!detail) {
      return null;
    }

    return analyzePullRequestImpact(`${owner}/${repo}`, detail, graph);
  }
}
