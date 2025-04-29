import type { CommentData, DiscussionData } from "../types/entities.js";

import { EntityActorBase } from "./EntityActorBase.js";

export interface DiscussionCommentData extends CommentData {
	parent_id?: number;
}

interface CreateCommentResponse {
	addDiscussionComment: {
		comment: {
			body: string;
			url: string;
		};
	};
}

interface GetDiscussionResponse {
	repository: {
		discussion: {
			id: string;
		};
	};
}

export abstract class DiscussionActorBase<
	Data extends CommentData | DiscussionData,
> extends EntityActorBase<Data> {
	async findComment(id: number): Promise<DiscussionCommentData | undefined> {
		const comments = await this.listComments((comment) => comment.id === id);
		return comments[0];
	}

	async listComments(filter?: (comment: DiscussionCommentData) => boolean) {
		const iterator = this.octokit.paginate.iterator(
			"GET /repos/{owner}/{repo}/discussions/{discussion_number}/comments",
			{
				discussion_number: this.entityNumber,
				owner: this.locator.owner,
				repo: this.locator.repository,
			},
		);

		const comments: DiscussionCommentData[] = [];
		for await (const response of iterator) {
			const batch = response.data as DiscussionCommentData[];

			if (filter) {
				const matchingComments = batch.filter(filter);
				comments.push(...matchingComments);

				if (matchingComments.length > 0) {
					break;
				}
			} else {
				comments.push(...batch);
			}
		}

		return comments;
	}

	async updateComment(number: number, newBody: string) {
		const comment = await this.findComment(number);
		if (!comment?.node_id) {
			throw new Error(`Comment with ID ${number} not found`);
		}

		await this.octokit.graphql(
			`
				mutation($body: String!, $commentId: ID!) {
					updateDiscussionComment(input: {
						body: $body,
						commentId: $commentId
					}) {
						comment {
							id
							body
							updatedAt
						}
					}
				}
			`,
			{
				body: newBody,
				commentId: comment.node_id,
			},
		);
	}

	protected async createCommentResponse(body: string, replyToId?: string) {
		const { repository } = await this.octokit.graphql<GetDiscussionResponse>(
			`
				query($owner: String!, $repo: String!, $number: Int!) {
					repository(owner: $owner, name: $repo) {
						discussion(number: $number) {
							id
						}
					}
				}
			`,
			{
				number: this.entityNumber,
				owner: this.locator.owner,
				repo: this.locator.repository,
			},
		);

		const discussionId = repository.discussion.id;

		const commentResponse = await this.octokit.graphql<CreateCommentResponse>(
			`
				mutation($body: String!, $discussionId: ID!, $replyToId: ID) {
					addDiscussionComment(input: {
						discussionId: $discussionId,
						replyToId: $replyToId,
						body: $body
					}) {
						comment {
							body
							url
						}
					}
				}
			`,
			{ body, discussionId, replyToId },
		);

		return commentResponse.addDiscussionComment.comment.url;
	}
}
