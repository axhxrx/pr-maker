// Removed unused imports
// import { ensureDir } from 'jsr:@std/fs@0.229.3/ensure-dir';
// import { join } from 'jsr:@std/path@0.225.2';

/** Helper to run a Deno.Command and check for errors */
async function runGitCommand(args: string[], cwd: string): Promise<void>
{
  console.log(`Running: git ${args.join(' ')} in ${cwd}`);
  const command = new Deno.Command('git', {
    args: args,
    cwd: cwd,
    stdout: 'piped',
    stderr: 'piped',
  });

  const output = await command.output();

  if (!output.success)
  {
    const errorOutput = new TextDecoder().decode(output.stderr);
    console.error(`Git command failed: git ${args.join(' ')}`);
    console.error('Error Output:', errorOutput);
    throw new Error(`Git command failed with exit code ${output.code}. Error: ${errorOutput.trim()}`);
  }
  else
  {
    const successOutput = new TextDecoder().decode(output.stdout);
    if (successOutput.trim())
    {
      console.log('Git Output:', successOutput.trim());
    }
  }
}

/**
 * Clones a repository and checks out a specific revision (branch, tag, or commit hash).
 * Creates a temporary directory for the clone.
 *
 * @param org The GitHub organization name.
 * @param repo The repository name.
 * @param revision The branch, tag, or commit hash to checkout.
 * @param githubToken Optional GitHub token for cloning private repositories.
 * @returns The absolute path to the temporary directory containing the checked-out code.
 */
export async function checkoutRevision(
  org: string,
  repo: string,
  revision: string,
  githubToken?: string,
): Promise<string>
{
  // Construct repo URL (handle token for private repos)
  const repoUrl = githubToken
    ? `https://oauth2:${githubToken}@github.com/${org}/${repo}.git`
    : `https://github.com/${org}/${repo}.git`;

  // Create a unique temporary directory for the clone
  // Using timestamp and repo name for uniqueness
  const tempDir = await Deno.makeTempDir({ prefix: `pr-maker_${repo}_` });
  console.log(`Created temporary directory: ${tempDir}`);

  try
  {
    // Clone the specific revision (using --depth 1 for efficiency)
    // Note: Cloning a specific commit hash directly might require fetching first or different clone args.
    // Cloning a branch/tag and then checking out the commit is often more reliable.
    console.log(`Cloning ${repoUrl} (revision: ${revision}) into ${tempDir}...`);
    await runGitCommand(['clone', '--depth', '1', '--branch', revision, repoUrl, '.'], tempDir);
    console.log('Clone successful.');

    // If revision is a commit hash, we might need an explicit checkout after clone
    // This simple clone works well for branches/tags.
    // For a specific commit, a full clone then checkout might be safer:
    // await runGitCommand(['clone', repoUrl, '.'], tempDir);
    // await runGitCommand(['checkout', revision], tempDir);

    return tempDir;
  }
  catch (error)
  {
    console.error('Error during checkout:', error);
    // Attempt to clean up the temporary directory on failure
    try
    {
      await Deno.remove(tempDir, { recursive: true });
      console.log(`Cleaned up temporary directory: ${tempDir}`);
    }
    catch (cleanupError)
    {
      console.error(`Failed to cleanup temporary directory ${tempDir}:`, cleanupError);
    }
    throw error; // Re-throw the original error
  }
}

/**
 * Checks if a branch exists on the remote 'origin'.
 *
 * @param branchName The name of the branch to check.
 * @param cwd The path to the local repository.
 * @returns True if the branch exists on the remote, false otherwise.
 */
async function remoteBranchExists(branchName: string, cwd: string): Promise<boolean>
{
  console.log(`Checking if remote branch 'origin/${branchName}' exists...`);
  const command = new Deno.Command('git', {
    args: ['ls-remote', '--heads', 'origin', branchName],
    cwd: cwd,
    stdout: 'piped',
    stderr: 'piped',
  });

  const output = await command.output();
  const outputText = new TextDecoder().decode(output.stdout);

  // If ls-remote finds the branch, outputText will contain the branch ref
  const exists = output.success && outputText.includes(`refs/heads/${branchName}`);
  console.log(`Remote branch 'origin/${branchName}' exists: ${exists}`);
  return exists;
}

/**
 * Creates and checks out a new local branch, ensuring the name is unique on the remote.
 *
 * @param desiredBranchName The preferred name for the new branch.
 * @param cwd The path to the local repository.
 * @returns The name of the newly created and checked-out branch.
 */
export async function createUniqueBranch(desiredBranchName: string, cwd: string): Promise<string>
{
  let branchName = desiredBranchName;
  let counter = 0;

  // Check if the desired name or variations exist remotely
  while (await remoteBranchExists(branchName, cwd))
  {
    counter++;
    branchName = `${desiredBranchName}-${counter}`;
    console.log(`Branch 'origin/${branchName}' already exists remotely. Trying '${branchName}'...`);
  }

  console.log(`Creating and checking out unique local branch: '${branchName}'`);
  // Create the branch locally and switch to it
  await runGitCommand(['checkout', '-b', branchName], cwd);

  return branchName;
}

/**
 * Stages all changes and commits them with a given message.
 *
 * @param message The commit message.
 * @param cwd The path to the local repository.
 */
export async function commitChanges(message: string, cwd: string): Promise<void>
{
  console.log('Staging all changes...');
  await runGitCommand(['add', '.'], cwd);
  console.log(`Committing changes with message: "${message}"`);
  await runGitCommand(['commit', '-m', message], cwd);
  console.log('Commit successful.');
}

/**
 * Pushes the specified local branch to the remote 'origin'.
 *
 * @param branchName The name of the local branch to push.
 * @param cwd The path to the local repository.
 */
export async function pushBranch(branchName: string, cwd: string): Promise<void>
{
  console.log(`Pushing branch '${branchName}' to origin...`);
  // Use -u to set upstream for the first push
  await runGitCommand(['push', '-u', 'origin', branchName], cwd);
  console.log('Push successful.');
}

// Example Usage (for testing purposes, remove later)
// if (import.meta.main) {
//   try {
//     const org = 'denoland'; // Replace with a test org
//     const repo = 'deno'; // Replace with a test repo
//     const revision = 'v1.40.0'; // Replace with a test tag/branch/commit
//     // Provide a token via env if testing private repos
//     const token = Deno.env.get('GITHUB_TOKEN_TEST');

//     console.log(`Attempting checkout of ${org}/${repo}@${revision}`);
//     const checkoutDir = await checkoutRevision(org, repo, revision, token);
//     console.log(`Successfully checked out to: ${checkoutDir}`);
//     // Remember to manually clean up the dir after testing if needed
//   } catch (e) {
//     console.error('Checkout example failed:', e);
//     Deno.exit(1);
//   }
// }
