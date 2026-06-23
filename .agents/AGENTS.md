# GitHub Proactive Management Rule

<RULE[proactive-github-management]>
When starting a new feature, bug fix, or task for this project, the agent MUST proactively manage the GitHub workflow using the `github` MCP server. The agent must:
1. Automatically create an issue in the GitHub repository detailing the task, using the `create_issue` tool.
2. If necessary, create a feature or fix branch.
3. Automatically commit and push code as milestones are reached.
4. If applicable, create a Pull Request against the main branch using the `create_pull_request` tool for user review.
5. Close issues and manage labels/milestones automatically to maintain an organized repository.

Do not ask the user for permission to create issues or PRs. The user has explicitly granted full autonomy to manage the project's GitHub lifecycle.
</RULE[proactive-github-management]>

<RULE[auto-release-management]>
GitHub Actions handles automated builds and releases on push to `main` (overwriting `Test_version`) and on tags (creating new official releases).

When deciding how to release:
1. For continuous/minor updates, simply commit and push to `main`. GitHub Actions will automatically update the `Test_version` release.
2. For major/important updates, the agent MUST NOT use `Test_version`. Instead, create a new semantic version tag (e.g., `git tag v1.1.0` and `git push origin v1.1.0`). GitHub Actions will automatically create a brand new release page for this version.

If the agent performs a manual `tauri build` locally, it should still copy the binaries to the `release_files/` directory and commit them, but there is no need to manually run `gh release upload` anymore.
</RULE[auto-release-management]>
