import type { Octokit } from "octokit";

import type { RepositoryLocator } from "../types/data.js";

import { wrapSafe } from "../types/utils.js";

/**
 * Paths where GitHub PR templates might be located according to GitHub documentation
 * @see https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository
 */
export const PR_TEMPLATE_PATHS = [
	".github/PULL_REQUEST_TEMPLATE.md",
	".github/pull_request_template.md",
	"docs/PULL_REQUEST_TEMPLATE.md",
	"docs/pull_request_template.md",
];

export async function findPrTemplate(
	octokit: Octokit,
	locator: RepositoryLocator,
): Promise<null | string> {
	for (const path of PR_TEMPLATE_PATHS) {
		const response = await wrapSafe(
			octokit.rest.repos.getContent({
				owner: locator.owner,
				path,
				repo: locator.repository,
			}),
		);

		if (
			response &&
			!Array.isArray(response.data) &&
			response.data.type === "file"
		) {
			return Buffer.from(response.data.content, "base64").toString("utf-8");
		}
	}

	const templateDirPath = ".github/PULL_REQUEST_TEMPLATE";
	const dirResponse = await wrapSafe(
		octokit.rest.repos.getContent({
			owner: locator.owner,
			path: templateDirPath,
			repo: locator.repository,
		}),
	);

	if (dirResponse && Array.isArray(dirResponse.data)) {
		const templateFile = dirResponse.data.find(
			(file) => file.type === "file" && file.name.endsWith(".md"),
		);

		if (templateFile?.path) {
			const fileResponse = await wrapSafe(
				octokit.rest.repos.getContent({
					owner: locator.owner,
					path: templateFile.path,
					repo: locator.repository,
				}),
			);

			if (
				fileResponse &&
				!Array.isArray(fileResponse.data) &&
				fileResponse.data.type === "file"
			) {
				return Buffer.from(fileResponse.data.content, "base64").toString(
					"utf-8",
				);
			}
		}
	}

	return null;
}
