# pr-maker

A server that provides an API to make GitHub pull requests to existing repositories.

# Instructions to LLMs
- Do your work in small increments. Try to edit only a 1-2 files at once, then describe your work and ask for a quick review, and propose what to do next.
- Use dprint for code formatting (you can run command `dprint fmt`)
- Use deno for running commands (you can run command `deno run mod.ts` to run the program)
- Use Deno for testing (you can run command `deno test -A`)
- Review `deno.jsonc` for the libs we already use. When needed, you can propose adding other libs from jsr.io

# Tech stack:
- Deno
- JSR.io — all dependencies should be configured like `deno add jsr:@hono/hono` (already done, in that case, see deno.jsonc)
- dprint for [beautiful Allman-style braces](https://jsr.io/@axhxrx/dprint-config/0.0.6/dprint.jsonc)
- GitHub API or CLI or some lib (TBD)

## Configuration

`pr-maker` uses a hierarchical approach to configuration, allowing settings to be specified through a configuration file, environment variables, or command-line arguments. Missing required values will trigger interactive prompts.

1.  **Configuration File:**
    *   Settings are persisted in a JSON file located at `~/Library/Application Support/com.axhxrx.pr-maker/config.json` (on macOS).
    *   The tool automatically creates this file and prompts for initial values if it doesn't exist.

2.  **Environment Variables:**
    *   Certain configuration values can be overridden by setting environment variables:
        *   `GITHUB_TOKEN`: Overrides the stored GitHub token.
        *   `GITHUB_ORG`: Overrides the default GitHub organization.
        *   `REPO_NAME`: Overrides the default repository name.
        *   `PR_LABELS`: Overrides the default comma-separated labels.

3.  **Command-Line Arguments:**
    *   Specific commands (like the planned `modify` command) can accept arguments to directly set or override configuration values for that specific run.

4.  **Interactive Prompts:**
    *   If a required configuration value (like `githubToken`, `githubOrg`, or `repoName`) is not found in the config file, environment variables, or provided via CLI arguments, the tool will interactively prompt the user for input.

## Outline

Assume that the server can be configured to have GitHub tokens for authentication and pull/push etc. This server might run on a Linux VM (initially, that is how it will be developed) but the later versions might eliminate the need for a server and instead use HTTPS POST to trigger a GitHub Actions workflow — and that workflow will use Deno and run the same program we develop in this project, minus the HTTPS server.

We'll provide an API later, but for now CLI commands will be used. The process we will implement is:

- [x] checkout a specific revision of the project from GitHub
- [x] create a new branch with a unique name
  - the user may specify a base branch name; we will use it or append a suffix to it to make it unique
- [ ] apply a change set to the branch
  - this part may be ignored for now; a human will write this code
- [x] commit the changes with an informational message about the automated nature of the change
- [x] push the branch to GitHub
- [x] create a pull request from the branch to the base branch
- [x] optionally apply labels to the pull request
- [x] get the URL to the created pull request
- [x] return the URL to the user (initially just console.log)

## variables we will need to be able to use
- github organization name
- repository name
- base branch name
- pull request title
- pull request body
- pull request labels

## initial tests
- E2E tests that does the whole process (just appending text to README.md (creating it if needed)) as the changes


🤖 2025-04-19: repo initialized by Bottie McBotface bot@axhxrx.com