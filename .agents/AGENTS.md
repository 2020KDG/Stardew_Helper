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
