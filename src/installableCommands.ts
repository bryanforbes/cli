import search = require('libnpmsearch');
import { join } from 'path';
const spawn: any = require('cross-spawn');
import { NpmPackageDetails, CommandWrapper, GroupMap, LoggingHelper, Helper } from './interfaces';
import * as Configstore from 'configstore';
import { isEjected } from './loadCommands';
import chalk from 'chalk';

const ONE_DAY = 1000 * 60 * 60 * 24;

export default async function(name: string, logging: LoggingHelper): Promise<NpmPackageDetails[]> {
	const conf = new Configstore(name);

	let commands: NpmPackageDetails[] = conf.get('commands') || [];
	if (commands.length) {
		const lastUpdated = conf.get('lastUpdated');
		if (Date.now() - lastUpdated >= ONE_DAY) {
			spawn(process.execPath, [join(__dirname, 'detachedCheckForNewCommands.js'), JSON.stringify({ name })], {
				detached: true,
				stdio: 'ignore'
			}).unref();
		}
	} else {
		commands = await getLatestCommands(name, logging);
	}

	return commands;
}

export async function getLatestCommands(name: string, logging: LoggingHelper): Promise<NpmPackageDetails[]> {
	const conf = new Configstore(name);
	const commands = await searchNpmForCommands(logging);
	if (commands && commands.length) {
		conf.set('commands', commands);
		conf.set('lastUpdated', Date.now());
	}
	return commands || [];
}

async function searchNpmForCommands(logging: LoggingHelper): Promise<NpmPackageDetails[] | undefined> {
	try {
		const results = await search('@dojo/cli-');
		return results
			.filter((result) => {
				return result.scope === 'dojo' && result.name !== '@dojo/cli';
			})
			.map(({ name, version, description }) => {
				return { name, version, description };
			});
	} catch (error) {
		logging.error('There was an error searching npm: ', error.message || error);
	}
}

export function mergeInstalledCommandsWithAvailableCommands(
	groupMap: GroupMap,
	availableCommands: NpmPackageDetails[],
	logging: LoggingHelper
): GroupMap {
	const regEx = /@dojo\/cli-([^-]+)-(.+)/;

	availableCommands.forEach((command) => {
		const [, group, name] = regEx.exec(command.name) as string[];
		const installCommand = `npm i ${command.name}`;

		const commandWrapper: CommandWrapper = {
			name,
			group,
			path: installCommand,
			description: command.description,
			global: false,
			installed: false,
			register: () => {},
			run: ({ logging }: Helper) => {
				logging.log(`\nTo install this command run ${chalk.green(installCommand)}\n`);
				return Promise.resolve();
			}
		};

		if (!isEjected(logging, group, name)) {
			if (!groupMap.has(group)) {
				commandWrapper.default = true;
				groupMap.set(group, new Map());
			}

			const subCommandsMap = groupMap.get(group)!;
			if (!subCommandsMap.has(name)) {
				subCommandsMap.set(name, commandWrapper);
			}
		}
	});

	return groupMap;
}
