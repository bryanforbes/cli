const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

import { stub, SinonStub } from 'sinon';
import { getYargsStub, getLoggingStub, GroupDef, getGroupMap, LoggingStub } from '../support/testHelper';
import MockModule from '../support/MockModule';
import sinon = require('sinon');
const groupDef: GroupDef = [
	{
		groupName: 'group1',
		commands: [{ commandName: 'command1' }]
	},
	{
		groupName: 'group2',
		commands: [{ commandName: 'command1' }, { commandName: 'command2' }]
	}
];

let sandbox: any;
let mockModule: MockModule;
let groupMap: any;
let yargsStub: {
	[index: string]: SinonStub;
};
let mockLoggingHelper: LoggingStub;
let processExitStub: SinonStub;
const errorMessage = 'test error message';
let registerCommands: any;

registerSuite('registerCommands', {
	beforeEach() {
		mockLoggingHelper = getLoggingStub();

		sandbox = sinon.sandbox.create();
		mockModule = new MockModule('../../src/registerCommands', require);
		mockModule.dependencies(['./configurationHelper']);
		mockModule.dependencies(['./help']);
		mockModule.dependencies(['./commands/validate']);

		registerCommands = mockModule.getModuleUnderTest().default;
		yargsStub = getYargsStub();
		groupMap = getGroupMap(groupDef);
		processExitStub = stub(process, 'exit');
	},

	afterEach() {
		sandbox.restore();
		processExitStub.restore();
		process.argv = [];
		mockModule.destroy();
	},

	tests: {
		'Should setup correct yargs arguments'() {
			const yargsArgs = ['demand', 'help', 'strict', 'check', 'command'];
			registerCommands(yargsStub, mockLoggingHelper, new Map());
			yargsArgs.forEach((arg) => {
				assert.isTrue(yargsStub[arg].calledOnce);
			});
		},
		'Should call strict for all commands'() {
			registerCommands(yargsStub, mockLoggingHelper, groupMap);
			assert.equal(yargsStub.strict.callCount, 6);
		},
		'Should call yargs.command once for each yargsCommandName passed and once for the default command'() {
			const { group } = groupMap.get('group1').get('command1');
			registerCommands(yargsStub, mockLoggingHelper, groupMap);
			assert.strictEqual(yargsStub.command.callCount, 6);
			assert.isTrue(yargsStub.command.getCall(0).calledWith(group, false), 'First call is for parent');
			assert.isTrue(yargsStub.command.getCall(1).calledWith('command1', false), 'Second call is sub-command');
		},
		'Should run the passed command when yargs called with group name and command'() {
			const { run } = groupMap.get('group1').get('command1');
			registerCommands(yargsStub, mockLoggingHelper, groupMap);
			yargsStub.command.secondCall.args[3]({});
			assert.isTrue(run.calledOnce);
		},
		'Should call into register method'() {
			registerCommands(yargsStub, mockLoggingHelper, groupMap);
			assert.isTrue(yargsStub.option.called);
		},
		help: {
			beforeEach() {
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
			},

			tests: {
				'main help called'() {
					const help = mockModule.getMock('./help').formatHelp;
					help.reset();
					yargsStub.command.lastCall.args[3]({ _: [], h: true });
					assert.isTrue(help.calledOnce);
				},
				'group help called'() {
					const help = mockModule.getMock('./help').formatHelp;
					help.reset();
					yargsStub.command.firstCall.args[3]({ _: ['group'], h: true });
					assert.isTrue(help.calledOnce);
				},
				'command help called'() {
					const help = mockModule.getMock('./help').formatHelp;
					help.reset();
					yargsStub.command.secondCall.args[3]({ _: ['group', 'command'], h: true });
					assert.isTrue(help.calledOnce);
				}
			}
		},
		'command arguments': {
			'pass dojo rc config as run arguments and expand to all aliases'() {
				groupMap = getGroupMap(groupDef, (compositeKey: string) => {
					return (func: Function) => {
						func('foo', { alias: ['f', 'fo'] });
						return compositeKey;
					};
				});
				const { run } = groupMap.get('group1').get('command1');
				const registerCommands = mockModule.getModuleUnderTest().default;
				const configurationHelper = mockModule.getMock('./configurationHelper');
				configurationHelper.default = {
					sandbox() {
						return {
							get() {
								return { f: 'bar' };
							}
						};
					}
				};
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
				yargsStub.command.secondCall.args[3]({ f: undefined });
				assert.isTrue(run.calledOnce);
				assert.deepEqual(run.firstCall.args[1], { foo: 'bar', f: 'bar', fo: 'bar' });
			},
			'command line args should override dojo rc config'() {
				process.argv = ['-foo'];
				const { run } = groupMap.get('group1').get('command1');
				const registerCommands = mockModule.getModuleUnderTest().default;
				const configurationHelper = mockModule.getMock('./configurationHelper');
				configurationHelper.default = {
					sandbox() {
						return {
							get() {
								return { foo: 'bar' };
							}
						};
					}
				};
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
				yargsStub.command.secondCall.args[3]({ foo: 'foo' });
				assert.isTrue(run.calledOnce);
				assert.deepEqual(run.firstCall.args[1], { foo: 'foo' });
			},
			'default command line args should not override dojo rc config'() {
				groupMap = getGroupMap(groupDef, (compositeKey: string) => {
					return (func: Function) => {
						func('foo', { alias: ['f', 'fo'] });
						return compositeKey;
					};
				});
				const { run } = groupMap.get('group1').get('command1');
				const registerCommands = mockModule.getModuleUnderTest().default;
				const configurationHelper = mockModule.getMock('./configurationHelper');
				configurationHelper.default = {
					sandbox() {
						return {
							get() {
								return { foo: 'bar' };
							}
						};
					}
				};
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
				yargsStub.command.secondCall.args[3]({ foo: 'foo', fo: 'foo', f: 'foo' });
				assert.isTrue(run.calledOnce);
				assert.deepEqual(run.firstCall.args[1], { foo: 'bar', fo: 'bar', f: 'bar' });
			},
			'command line options aliases should override dojo rc config'() {
				process.argv = ['-f'];
				yargsStub = getYargsStub();
				groupMap = getGroupMap(groupDef, (compositeKey: string) => {
					return (func: Function) => {
						func('foo', { alias: ['f'] });
						return compositeKey;
					};
				});
				const { run } = groupMap.get('group1').get('command1');
				const registerCommands = mockModule.getModuleUnderTest().default;
				const configurationHelper = mockModule.getMock('./configurationHelper');
				configurationHelper.default = {
					sandbox() {
						return {
							get() {
								return { foo: 'bar' };
							}
						};
					}
				};
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
				yargsStub.command.secondCall.args[3]({ f: 'foo', foo: 'foo' });
				assert.isTrue(run.calledOnce);
				assert.deepEqual(run.firstCall.args[1], { foo: 'foo', f: 'foo' });
			},
			'should use rc config value for option aliases'() {
				yargsStub = getYargsStub({ foo: ['f'], f: ['foo'] });
				groupMap = getGroupMap(groupDef, (compositeKey: string) => {
					return (func: Function) => {
						func('foo', { alias: 'f' });
						return compositeKey;
					};
				});
				const { run } = groupMap.get('group1').get('command1');
				const registerCommands = mockModule.getModuleUnderTest().default;
				const configurationHelper = mockModule.getMock('./configurationHelper');
				configurationHelper.default = {
					sandbox() {
						return {
							get() {
								return { foo: 'bar' };
							}
						};
					}
				};
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
				yargsStub.command.secondCall.args[3]({ f: 'foo', foo: 'foo' });
				assert.isTrue(run.calledOnce);
				assert.deepEqual(run.firstCall.args[1], { foo: 'bar', f: 'bar' });
			},
			'should use default command line arguments when not provided in config'() {
				yargsStub = getYargsStub({ foo: ['f'], f: ['foo'] });
				const { run } = groupMap.get('group1').get('command1');
				const registerCommands = mockModule.getModuleUnderTest().default;
				const configurationHelper = mockModule.getMock('./configurationHelper');
				configurationHelper.default = {
					sandbox() {
						return {
							get() {
								return {};
							}
						};
					}
				};
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
				yargsStub.command.secondCall.args[3]({ f: 'foo', foo: 'foo' });
				assert.isTrue(run.calledOnce);
				assert.deepEqual(run.firstCall.args[1], { foo: 'foo', f: 'foo' });
			}
		},
		'default command': {
			beforeEach() {
				groupMap = getGroupMap(groupDef);
				registerCommands(yargsStub, mockLoggingHelper, groupMap);
			},

			tests: {
				'Should register the default command'() {
					const { register } = groupMap.get('group1').get('command1');
					assert.isTrue(register.calledTwice);
				},
				'Should run default command when yargs called with only group name'() {
					const { run } = groupMap.get('group1').get('command1');
					yargsStub.command.firstCall.args[3]({ _: ['group'] });
					assert.isTrue(run.calledOnce);
				},
				'Should not run default command when yargs called with group name and command'() {
					const { run } = groupMap.get('group1').get('command1');
					yargsStub.command.firstCall.args[3]({ _: ['group', 'command'] });
					assert.isFalse(run.calledOnce);
				},
				'Should run validateable command when yargs called'() {
					const command = groupMap.get('group1').get('command1');
					command.validate = sinon.stub().returns(true);
					yargsStub.command.firstCall.args[3]({ _: ['group'] });
					assert.isTrue(command.validate.calledOnce);
					assert.isTrue(command.run.calledOnce);
				},
				'Should not run validateable command when yargs called with failing command'() {
					const command = groupMap.get('group1').get('command1');
					command.validate = sinon.stub().returns(false);
					yargsStub.command.firstCall.args[3]({ _: ['group'] });
					assert.isTrue(command.validate.calledOnce);
					assert.isFalse(command.run.called);
				}
			}
		},
		'validating command': {
			beforeEach() {
				groupMap = getGroupMap(groupDef);
			},

			tests: {
				'Should run validateCommand and continue if valid'() {
					groupMap = getGroupMap(groupDef, () => () => {}, true);
					const command = groupMap.get('group1').get('command1');
					command.validate = sinon.stub().returns(true);
					const registerCommands = mockModule.getModuleUnderTest().default;
					registerCommands(yargsStub, mockLoggingHelper, groupMap);
					yargsStub.command.secondCall.args[3]({});
					assert.isTrue(command.validate.called);
					assert.isTrue(command.validate.returned(true));
					assert.isTrue(command.run.calledOnce);
				},
				'Should run validateCommand stop if invalid'() {
					groupMap = getGroupMap(groupDef, () => () => {}, true);
					const command = groupMap.get('group1').get('command1');
					command.validate = sinon.stub().returns(false);
					const registerCommands = mockModule.getModuleUnderTest().default;
					registerCommands(yargsStub, mockLoggingHelper, groupMap);
					yargsStub.command.secondCall.args[3]({});
					assert.isTrue(command.validate.called);
					assert.isTrue(command.validate.returned(false));
					assert.isFalse(command.run.calledOnce);
				}
			}
		},
		'handling errors': {
			tests: {
				async 'Should show error message if the run command rejects'() {
					groupMap = getGroupMap([
						{
							groupName: 'group1',
							commands: [{ commandName: 'command1', fails: true }]
						}
					]);
					registerCommands(yargsStub, mockLoggingHelper, groupMap);
					await yargsStub.command.firstCall.args[3]({ _: ['group'] });
					assert.isTrue(mockLoggingHelper.error.calledOnce);
					assert.isTrue(mockLoggingHelper.error.firstCall.calledWithMatch(errorMessage));
					assert.isTrue(processExitStub.called);
				},
				async 'Should exit process with exitCode of 1 when no exitCode is returned'() {
					groupMap = getGroupMap([
						{
							groupName: 'group1',
							commands: [{ commandName: 'command1', fails: true }]
						}
					]);
					registerCommands(yargsStub, mockLoggingHelper, groupMap);
					await yargsStub.command.firstCall.args[3]({ _: ['group'] });
					assert.isTrue(processExitStub.calledOnce);
					assert.isTrue(processExitStub.calledWith(1));
				},
				async 'Should exit process with passed exit code'() {
					groupMap = getGroupMap([
						{
							groupName: 'group1',
							commands: [{ commandName: 'command1', fails: true, exitCode: 100 }]
						}
					]);
					registerCommands(yargsStub, mockLoggingHelper, groupMap);
					await yargsStub.command.firstCall.args[3]({ _: ['group'] });
					assert.isTrue(processExitStub.calledOnce);
					assert.isTrue(processExitStub.calledWith(100));
				}
			}
		}
	}
});
