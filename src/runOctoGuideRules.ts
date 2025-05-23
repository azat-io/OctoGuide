import * as core from "@actions/core";
import { octokitFromAuth } from "octokit-from-auth";

import type { EntityActor } from "./actors/types.js";
import type { ConfigName } from "./types/core.js";
import type { Entity } from "./types/entities.js";
import type { RuleReport } from "./types/reports.js";
import type { RuleContext } from "./types/rules.js";

import { createActor } from "./actors/createActor.js";
import { runRuleOnEntity } from "./execution/runRuleOnEntity.js";
import { configs } from "./rules/configs.js";

/**
 * Settings for running {@link runOctoGuideRules}.
 */
export interface RunOctoGuideRulesOptions {
	/**
	 * GitHub authentication token, to override process.env.GH_TOKEN.
	 */
	auth?: string;

	/**
	 * Preset configuration to run rules from.
	 * @default "recommended"
	 */
	config?: ConfigName | undefined;

	/**
	 * URL of the GitHub entity to scan.
	 * @todo Support passing in the entity itself:
	 * https://github.com/JoshuaKGoldberg/OctoGuide/issues/85
	 */
	entity: string;
}

/**
 * Result from running {@link runOctoGuideRules}.
 */
export interface RunOctoGuideRulesResult {
	/**
	 * @internal
	 */
	actor: EntityActor;

	/**
	 * The resolved entity that was scanned.
	 */
	entity: Entity;

	/**
	 * Any reports generated by rules for the entity.
	 */
	reports: RuleReport[];
}

/**
 * Runs OctoGuide's rules to generate a list of reports for a GitHub entity.
 */
export async function runOctoGuideRules({
	auth,
	config = "recommended",
	entity: url,
}: RunOctoGuideRulesOptions): Promise<RunOctoGuideRulesResult> {
	// TODO: There's no need to create a full *writing* actor here;
	// runOctoGuide only reads entities and runs rules on them.
	// This area of authentication and actor resolution should split into:
	// 1. Entity data & type resolution: read-only allowed
	// 2. Using that to create the equivalent actor: requires writing
	// ...where only 1. is needed for runOctoGuide.
	// https://github.com/JoshuaKGoldberg/OctoGuide/issues/56
	const octokit = await octokitFromAuth({ auth });
	const { actor, locator } = createActor(octokit, url);
	if (!actor) {
		throw new Error("Could not resolve GitHub entity actor.");
	}

	const entity = {
		data: await actor.getData(),
		...actor.metadata,
	} as Entity;

	if (core.isDebug()) {
		core.debug(`Full entity: ${JSON.stringify(entity, null, 2)}`);
	}

	const reports: RuleReport[] = [];

	await Promise.all(
		Object.values(configs[config]).map(async (rule) => {
			const context: RuleContext = {
				locator,
				octokit,
				report(data) {
					reports.push({
						about: rule.about,
						data,
					});
				},
			};

			await runRuleOnEntity(context, rule, entity);
		}),
	);

	return { actor, entity, reports };
}
