import type { Octokit } from "octokit";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepositoryLocator } from "../types/data.js";

import { findPrTemplate, PR_TEMPLATE_PATHS } from "./findPrTemplate";

interface GetContentParams {
	owner: string;
	path: string;
	repo: string;
}

describe("findPrTemplate", () => {
	const mockLocator: RepositoryLocator = {
		owner: "test-owner",
		repository: "test-repo",
	};
	const mockTemplate = "# PR Template\n- [ ] Task 1\n- [ ] Task 2";
	const mockBase64Template = Buffer.from(mockTemplate).toString("base64");

	const getContentMock = vi.fn();
	const mockOctokit = {
		rest: {
			repos: {
				getContent: getContentMock,
			},
		},
	} as unknown as Octokit;

	beforeEach(() => {
		vi.resetAllMocks();
		getContentMock.mockRejectedValue(new Error("Not found"));
	});

	PR_TEMPLATE_PATHS.forEach((path) => {
		it(`should find template at ${path}`, async () => {
			getContentMock.mockImplementation((params: GetContentParams) => {
				if (params.path === path) {
					return Promise.resolve({
						data: {
							content: mockBase64Template,
							type: "file",
						},
					});
				}
				return Promise.reject(new Error("Not found"));
			});

			const result = await findPrTemplate(mockOctokit, mockLocator);

			expect(result).toBe(mockTemplate);
			expect(getContentMock).toHaveBeenCalledWith({
				owner: mockLocator.owner,
				path,
				repo: mockLocator.repository,
			});
		});
	});

	it("should find template in .github/PULL_REQUEST_TEMPLATE directory", async () => {
		getContentMock.mockImplementation((params: GetContentParams) => {
			if (params.path === ".github/PULL_REQUEST_TEMPLATE") {
				return Promise.resolve({
					data: [
						{
							name: "template.md",
							path: ".github/PULL_REQUEST_TEMPLATE/template.md",
							type: "file",
						},
						{
							name: "other.txt",
							path: ".github/PULL_REQUEST_TEMPLATE/other.txt",
							type: "file",
						},
					],
				});
			} else if (params.path === ".github/PULL_REQUEST_TEMPLATE/template.md") {
				return Promise.resolve({
					data: {
						content: mockBase64Template,
						type: "file",
					},
				});
			}
			return Promise.reject(new Error("Not found"));
		});

		const result = await findPrTemplate(mockOctokit, mockLocator);

		expect(result).toBe(mockTemplate);
		expect(getContentMock).toHaveBeenCalledWith({
			owner: mockLocator.owner,
			path: ".github/PULL_REQUEST_TEMPLATE",
			repo: mockLocator.repository,
		});
		expect(getContentMock).toHaveBeenCalledWith({
			owner: mockLocator.owner,
			path: ".github/PULL_REQUEST_TEMPLATE/template.md",
			repo: mockLocator.repository,
		});
	});

	it("should return null if no template is found", async () => {
		const result = await findPrTemplate(mockOctokit, mockLocator);

		expect(result).toBeNull();
		expect(getContentMock).toHaveBeenCalledTimes(PR_TEMPLATE_PATHS.length + 1);
	});

	it("should handle API errors gracefully", async () => {
		getContentMock.mockRejectedValue(new Error("API Error"));

		const result = await findPrTemplate(mockOctokit, mockLocator);

		expect(result).toBeNull();
	});
});
