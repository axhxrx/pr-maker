/**
 * Represents the expected successful response structure from the GitHub API
 * when creating a pull request. We only care about the html_url for now.
 */
interface GitHubPrResponse {
  html_url: string;
  // Add other fields here if needed later
}

/**
 * Represents the structure for an error response from the GitHub API.
 */
interface GitHubErrorResponse {
  message: string;
  errors?: { resource: string; field: string; code: string }[];
  documentation_url: string;
}

/**
 * Creates a GitHub Pull Request using the REST API.
 *
 * @param org The GitHub organization or user name.
 * @param repo The repository name.
 * @param title The title of the pull request.
 * @param body The body/description of the pull request.
 * @param headBranch The name of the branch containing the changes (the source branch).
 * @param baseBranch The name of the branch to merge the changes into (the target branch).
 * @param githubToken The GitHub personal access token for authentication.
 * @param labels Optional array of label names to apply to the PR.
 * @returns The URL of the created pull request.
 */
export async function createPullRequest(
  org: string,
  repo: string,
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string,
  githubToken: string,
  labels?: string[],
): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${org}/${repo}/pulls`;

  console.log(`Creating Pull Request: '${headBranch}' -> '${baseBranch}' in ${org}/${repo}`);

  const requestBody = {
    title: title,
    body: body,
    head: headBranch,
    base: baseBranch,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28', // Recommended practice
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData: GitHubErrorResponse = await response.json();
      console.error('GitHub API Error Response:', JSON.stringify(errorData, null, 2));
      throw new Error(
        `GitHub API request failed with status ${response.status}: ${errorData.message}${errorData.errors ? ' (' + errorData.errors.map(e => `${e.resource}.${e.field}: ${e.code}`).join(', ') + ')' : ''}`,
      );
    }

    const prData: GitHubPrResponse = await response.json();
    console.log(`Successfully created Pull Request: ${prData.html_url}`);

    // Apply labels if provided
    if (labels && labels.length > 0 && prData.html_url) {
        // Extract PR number from the URL (assuming standard GitHub URL format)
        const prNumber = prData.html_url.split('/').pop(); 
        if (prNumber) {
            await applyLabels(org, repo, prNumber, labels, githubToken);
        } else {
            console.warn('Could not extract PR number to apply labels.');
        }
    }

    return prData.html_url;

  } catch (error) {
    console.error('Error creating pull request:', error);
    throw error; // Re-throw the error for the caller to handle
  }
}

/**
 * Applies labels to an existing GitHub Pull Request.
 * 
 * @param org The GitHub organization or user name.
 * @param repo The repository name.
 * @param prNumber The number of the pull request.
 * @param labels Array of label names to apply.
 * @param githubToken The GitHub personal access token for authentication.
 */
async function applyLabels(
    org: string,
    repo: string,
    prNumber: string,
    labels: string[],
    githubToken: string
): Promise<void> {
    const apiUrl = `https://api.github.com/repos/${org}/${repo}/issues/${prNumber}/labels`;
    console.log(`Applying labels ${JSON.stringify(labels)} to PR #${prNumber}...`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST', // Using POST adds labels without replacing existing ones
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({ labels }),
        });

        if (!response.ok) {
            const errorData: GitHubErrorResponse = await response.json();
            console.error('GitHub API Error Response (applying labels):', JSON.stringify(errorData, null, 2));
            // Log warning instead of throwing error, as PR creation was successful
            console.warn(
                `Failed to apply labels to PR #${prNumber}. Status ${response.status}: ${errorData.message}`
            );
        } else {
            console.log(`Successfully applied labels to PR #${prNumber}.`);
        }
    } catch (error) {
        console.warn(`Error applying labels to PR #${prNumber}:`, error);
    }
}
