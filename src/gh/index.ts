import { Octokit } from '@octokit/core';

import { CustomError } from '../common/error';
import { error } from '../common/logger';

let github: Octokit | null = null;
let owner: string | null = null;

const GitHubError = (msg: string) => new CustomError(msg, { name: 'GitHubError' });

const initializationError = () => {
  throw GitHubError('GitHub SDK is possibly uninitialized!');
};

/**
 * Initialize GitHub SDK
 * @param authToken GitHub auth token for the user account [GITHUB_TOKEN]
 * @param account account id for the GitHub user account [GITHUB_ACCOUNT]
 */
export const init = (authToken: string, account: string) => {
  if (!authToken || !account) {
    error(`GitHub initialization error! authToken: ${!!authToken}, account: ${!!account}`);
    return;
  }
  github = new Octokit({ auth: authToken });
  owner = account;
};

/**
 * Get contents of a particular file in a repo
 * @param repo name of the repo
 * @param path path of a file in the repo
 * @returns an object {response,headers} containing response and response headers, null in case of error
 */
export const getContent = async (repo: string, path: string) => {
  if (!github || !owner) return initializationError();

  try {
    const ghResp = await github.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path,
    });
    const response = ghResp.data as GitHubContent;
    const { headers } = ghResp;
    return { response, headers };
  } catch (e) {
    error(`[ERROR:gh.getContent]`, e);
  }

  return null;
};

// --------------

export interface GitHubContent {
  path: string;
  content: string;
  sha: string;
}
