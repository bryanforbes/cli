const { beforeEach, afterEach, describe, it } = intern.getInterface('bdd');
const { assert } = intern.getPlugin('chai');

import chalk from 'chalk';
import { join, resolve as pathResolve, sep } from 'path';
import * as sinon from 'sinon';

import { CommandMap, CommandWrapper } from '../../../src/interfaces';
import eject from '../../../src/commands/eject';
import MockModule from '../../support/MockModule';
import { getCommandWrapperWithConfiguration, getLoggingStub, LoggingStub } from '../../support/testHelper';

const { yellow, underline } = chalk;

describe('eject command', () => {
	const ejectPackagePath = join(pathResolve(__dirname), '../../support/eject');
	let moduleUnderTest: typeof eject;
	let mockModule: MockModule;
	let mockPkgDir: any;
	let mockFsExtra: any;
	let mockInquirer: any;
	let mockNpmInstall: any;
	let mockAllExternalCommands: any;
	let mockLoggingHelper: LoggingStub;
	let sandbox: sinon.SinonSandbox;

	function loadCommand(command: string): any {
		return require(`${ejectPackagePath}/${command}`);
	}

	function getHelper(config?: any) {
		const basicHelper = {
			command: 'eject',
			configuration: {
				get: sandbox.stub().returns({}),
				set: sandbox.stub()
			},
			logging: mockLoggingHelper
		};

		return Object.assign({}, basicHelper, config);
	}

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../../src/commands/eject', require);
		mockModule.dependencies([
			'inquirer',
			'fs',
			'fs-extra',
			'pkg-dir',
			'../allCommands',
			'../npmInstall',
			`${ejectPackagePath}/package.json`,
			'../configurationHelper'
		]);
		mockPkgDir = mockModule.getMock('pkg-dir');
		mockPkgDir.ctor.sync = sandbox.stub().returns(ejectPackagePath);
		mockFsExtra = mockModule.getMock('fs-extra');
		mockFsExtra.copySync = sandbox.stub();
		mockInquirer = mockModule.getMock('inquirer');
		mockInquirer.prompt = sandbox.stub().resolves({ eject: true });
		mockAllExternalCommands = mockModule.getMock('../allCommands');
		mockNpmInstall = mockModule.getMock('../npmInstall');
		mockLoggingHelper = getLoggingStub();
		moduleUnderTest = mockModule.getModuleUnderTest().default;
	});

	afterEach(() => {
		sandbox.restore();
		mockModule.destroy();
	});

	it(`should abort eject when 'N' selected`, () => {
		const abortOutput = 'Aborting eject';
		const commandMap: CommandMap = new Map<string, CommandWrapper>();

		const helper = getHelper();
		mockInquirer.prompt = sandbox.stub().resolves({ eject: false });
		mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves({ commandsMap: commandMap });
		return moduleUnderTest.run(helper, {} as any).then(
			() => {
				assert.fail('The promise should not have resolved');
			},
			(error: { message: string }) => {
				assert.equal(error.message, abortOutput);
			}
		);
	});

	it(`should warn if all commands are skipped`, () => {
		const runOutput = 'There are no commands that can be ejected';
		const installedCommandWrapper1 = getCommandWrapperWithConfiguration({
			group: 'command',
			name: ''
		});

		const installedCommandWrapper2 = getCommandWrapperWithConfiguration({
			group: 'version',
			name: ''
		});

		const commandMap: CommandMap = new Map<string, CommandWrapper>([
			['command', installedCommandWrapper1],
			['version', installedCommandWrapper2]
		]);
		const groupMap = new Map([['test', commandMap]]);
		const helper = getHelper();
		mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
		return moduleUnderTest.run(helper, {} as any).then(
			() => {
				assert.equal(mockLoggingHelper.log.args[0][0], runOutput);
			},
			() => {
				assert.fail(null, null, 'moduleUnderTest.run should not have rejected promise');
			}
		);
	});

	describe('save ejected config', () => {
		it('should save config', () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([
				['apple', loadCommand('command-with-full-eject')]
			]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);

			const configurationHelper = mockModule.getMock('../configurationHelper').default;

			const setStub = sinon.stub();
			configurationHelper.sandbox = sinon.stub().returns({
				set: setStub
			});

			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(setStub.calledOnce);
					assert.isTrue(setStub.firstCall.calledWith({ ejected: true }));
				},
				() => {
					assert.fail(null, null, 'moduleUnderTest.run should not have rejected promise');
				}
			);
		});
	});

	describe('eject npm config', () => {
		it('should run npm install', () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([
				['apple', loadCommand('command-with-full-eject')]
			]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(mockNpmInstall.installDependencies.calledOnce);
					assert.isTrue(mockNpmInstall.installDevDependencies.calledOnce);
				},
				() => {
					assert.fail(null, null, 'moduleUnderTest.run should not have rejected promise');
				}
			);
		});
	});

	describe('eject copy config', () => {
		it('should run copy files', () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([
				['apple', loadCommand('command-with-full-eject')]
			]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(
						mockLoggingHelper.log.secondCall.calledWith(
							` ${yellow('creating')} .${sep}config${sep}test-group-test-eject${sep}file1`
						)
					);
					assert.isTrue(
						mockLoggingHelper.log.thirdCall.calledWith(
							` ${yellow('creating')} .${sep}config${sep}test-group-test-eject${sep}file2`
						)
					);
					assert.isTrue(
						mockLoggingHelper.log
							.getCall(3)
							.calledWith(` ${yellow('creating')} .${sep}config${sep}test-group-test-eject${sep}file3`)
					);
					assert.isTrue(mockFsExtra.copySync.calledThrice);
				},
				() => {
					assert.fail(null, null, 'moduleUnderTest.run should not have rejected promise');
				}
			);
		});

		it('should not copy files if no files are specified', () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([
				['apple', loadCommand('command-with-nofile-eject')]
			]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(mockFsExtra.copySync.notCalled);
				},
				() => {
					assert.fail(null, null, 'moduleUnderTest.run should not have rejected promise');
				}
			);
		});
	});

	describe('eject hints', () => {
		it('should show hints when supplied', () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([
				['apple', loadCommand('command-with-hints')]
			]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					const logCallCount = mockLoggingHelper.log.callCount;
					assert.isTrue(mockLoggingHelper.log.callCount > 3, '1');
					const hintsCall = logCallCount - 3;
					assert.isTrue(
						mockLoggingHelper.log.getCall(hintsCall).calledWith(underline('\nhints')),
						'should underline hints'
					);
					assert.isTrue(
						mockLoggingHelper.log.getCall(hintsCall + 1).calledWith(' hint 1'),
						'should show hint1'
					);
					assert.isTrue(
						mockLoggingHelper.log.getCall(hintsCall + 2).calledWith(' hint 2'),
						'should show hint2'
					);
				},
				() => {
					assert.fail(null, null, 'moduleUnderTest.run should not have rejected promise');
				}
			);
		});
	});
});
