import type { Octokit } from "octokit";

import type { RepositoryLocator } from "../types/data.js";
import type { EntityActor } from "./types.js";

import { CommentData, Entity, IssueLikeData } from "../types/entities.js";

export abstract class IssueLikeActorBase<
	Data extends CommentData | IssueLikeData,
> implements EntityActor<Data>
{
	abstract readonly metadata: Omit<Entity, "data">;

	protected entityNumber: number;
	protected locator: RepositoryLocator;
	protected octokit: Octokit;

	constructor(
		entityNumber: number,
		locator: RepositoryLocator,
		octokit: Octokit,
	) {
		this.entityNumber = entityNumber;
		this.locator = locator;
		this.octokit = octokit;
	}

	async createComment(body: string) {
		const response = await this.octokit.rest.issues.createComment({
			body,
			issue_number: this.entityNumber,
			owner: this.locator.owner,
			repo: this.locator.repository,
		});

		return response.data.html_url;
	}

	async findComment(id: number): Promise<CommentData | undefined> {
		const comments = await this.listComments((comment) => comment.id === id);
		return comments[0];
	}

	abstract getData(): Promise<Data>;

	async listComments(filter?: (comment: CommentData) => boolean) {
		if (filter) {
			const iterator = this.octokit.paginate.iterator(
				this.octokit.rest.issues.listComments,
				{
					issue_number: this.entityNumber,
					owner: this.locator.owner,
					repo: this.locator.repository,
				},
			);

			const comments: CommentData[] = [];
			for await (const response of iterator) {
				const batch = response.data;

				const matchingComments = batch.filter(filter);
				comments.push(...matchingComments);

				if (matchingComments.length > 0) {
					break;
				}
			}

			return comments;
		}

		const comments = await this.octokit.paginate(
			this.octokit.rest.issues.listComments,
			{
				issue_number: this.entityNumber,
				owner: this.locator.owner,
				repo: this.locator.repository,
			},
		);

		return comments;
	}

	async updateComment(number: number, newBody: string) {
		const comment = await this.findComment(number);
		if (!comment) {
			throw new Error(`Comment with ID ${number} not found`);
		}

		await this.octokit.rest.issues.updateComment({
			body: newBody,
			comment_id: number,
			owner: this.locator.owner,
			repo: this.locator.repository,
		});
	}
}
