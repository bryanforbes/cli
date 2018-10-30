const { beforeEach, afterEach, describe, it } = intern.getInterface('bdd');
const { assert, expect } = intern.getPlugin('chai');

import chalk from 'chalk';
import * as sinon from 'sinon';
import validate, { getValidationErrors, builtInCommandValidation } from '../../../src/commands/validate';

import MockModule from '../../support/MockModule';
import { ValidationWrapper, CommandMap, CommandWrapper } from '../../../src/interfaces';
import { getLoggingStub, getCommandWrapperWithConfiguration, LoggingStub } from '../../support/testHelper';

const { green } = chalk;

describe('validate', () => {
	let moduleUnderTest: typeof validate;
	let mockModule: MockModule;
	let mockAllExternalCommands: any;
	let sandbox: sinon.SinonSandbox;
	let mockConfigurationHelper: any;
	let mockLoggingHelper: LoggingStub;

	const validateableCommandWrapper: ValidationWrapper = {
		commandGroup: 'testGroup',
		commandName: 'testCommand',
		commandSchema: {},
		commandConfig: {},
		silentSuccess: false
	};

	const detailedSchema = {
		type: 'object',
		properties: {
			foo: {
				type: 'object',
				required: ['bar'],
				properties: {
					bar: {
						enum: ['foobar'],
						type: 'string'
					}
				}
			}
		},
		required: ['foo']
	};

	const mismatchedConfig = {
		foo: { bar: 'foo' }
	};

	const matchedConfig = {
		foo: { bar: 'foobar' }
	};

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		mockLoggingHelper = getLoggingStub();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('function', () => {
		describe('getValidationErrors', () => {
			it(`should return no errors if all object criteria are met`, () => {
				assert(getValidationErrors !== undefined);
				expect(getValidationErrors).to.not.be.undefined;
				const mockSchema = {
					type: 'object',
					properties: {
						command: {
							type: 'string'
						}
					},
					required: ['command']
				};
				const errors = getValidationErrors('create-app', { command: 'foo' }, mockSchema);
				expect(errors).to.be.lengthOf(0);
			});

			it(`errenous nested properties in configs behave as expected`, () => {
				assert(getValidationErrors !== undefined);
				expect(getValidationErrors).to.not.be.undefined;
				const mockSchema = {
					type: 'object',
					properties: {
						foo: {
							enum: ['baz', 'bar'],
							type: 'object',
							required: ['bar'],
							properties: {
								bar: {
									enum: ['baz', 'bar'],
									type: 'string'
								}
							}
						}
					},
					required: ['foo']
				};
				const config = { ...mismatchedConfig };
				const errors = getValidationErrors('create-app', config, mockSchema);
				expect(errors).to.be.lengthOf(2);
			});
		});

		describe('builtInCommandValidation', () => {
			it(`should fail on validating a command with empty config and a valid schema`, async () => {
				expect(builtInCommandValidation).to.not.be.undefined;
				validateableCommandWrapper.commandConfig = {};
				validateableCommandWrapper.commandSchema = { ...detailedSchema };
				const valid = await builtInCommandValidation(validateableCommandWrapper, mockLoggingHelper);
				expect(valid).to.be.false;
				expect(mockLoggingHelper.error.callCount).to.equal(2);
				expect(mockLoggingHelper.error.getCall(0).args[0]).to.equal(
					'Config is invalid! The following issues were found: '
				);
			});
			it(`should fail on validating a command with mismatching config and schema`, async () => {
				expect(builtInCommandValidation).to.not.be.undefined;
				validateableCommandWrapper.commandConfig = { ...mismatchedConfig };
				validateableCommandWrapper.commandSchema = { ...detailedSchema };
				const valid = await builtInCommandValidation(validateableCommandWrapper, mockLoggingHelper);
				expect(valid).to.be.false;
				expect(mockLoggingHelper.error.callCount).to.equal(2);
				expect(mockLoggingHelper.error.getCall(0).args[0]).to.equal(
					'Config is invalid! The following issues were found: '
				);
				expect(mockLoggingHelper.error.getCall(1).args[0]).to.equal(
					'testGroup-testCommand config.foo.bar is not one of expected values: foobar'
				);
			});
			it(`should fail on validating a command with undefined config`, async () => {
				expect(builtInCommandValidation).to.not.be.undefined;
				validateableCommandWrapper.commandConfig = undefined;
				validateableCommandWrapper.commandSchema = { ...detailedSchema };
				const valid = await builtInCommandValidation(validateableCommandWrapper, mockLoggingHelper);
				expect(mockLoggingHelper.error.callCount).to.equal(1);
				expect(mockLoggingHelper.error.getCall(0).args[0]).to.equal(
					".dojorc config does not have the top level command property 'testGroup-testCommand'"
				);
				expect(valid).to.be.false;
			});
			it(`should pass on validating a valid command logging success`, async () => {
				expect(builtInCommandValidation).to.not.be.undefined;
				validateableCommandWrapper.commandConfig = { ...matchedConfig };
				validateableCommandWrapper.commandSchema = { ...detailedSchema };
				const valid = await builtInCommandValidation(validateableCommandWrapper, mockLoggingHelper);
				expect(mockLoggingHelper.log.getCall(0).args[0]).to.equal(
					green('testGroup-testCommand config validation was successful!')
				);
				expect(mockLoggingHelper.log.callCount).to.equal(1);
				expect(valid).to.be.true;
			});
			it(`should pass on validating a valid command silently`, async () => {
				expect(builtInCommandValidation).to.not.be.undefined;
				validateableCommandWrapper.silentSuccess = true;
				validateableCommandWrapper.commandConfig = { ...matchedConfig };
				validateableCommandWrapper.commandSchema = { ...detailedSchema };
				const valid = await builtInCommandValidation(validateableCommandWrapper, mockLoggingHelper);
				expect(mockLoggingHelper.log.callCount).to.equal(0);
				expect(valid).to.be.true;
			});
		});
	});

	describe('default export', () => {
		const getHelper = function(config?: any) {
			const basicHelper = {
				command: 'validate',
				configuration: {
					get: sandbox.stub().returns({}),
					set: sandbox.stub()
				},
				logging: mockLoggingHelper
			};

			return Object.assign({}, basicHelper, config);
		};

		beforeEach(() => {
			mockModule = new MockModule('../../../src/commands/validate', require);
			mockModule.dependencies(['../allCommands', '../configurationHelper']);
			mockAllExternalCommands = mockModule.getMock('../allCommands');
			mockConfigurationHelper = mockModule.getMock('../configurationHelper');
			moduleUnderTest = mockModule.getModuleUnderTest().default;
		});

		afterEach(() => {
			mockModule.destroy();
		});

		it('should call register which has no supported arguments', () => {
			const options = sandbox.stub();
			moduleUnderTest.register(options);
			assert.isFalse(options.called);
		});

		it(`should never call validation logic with no config`, () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([]);
			const groupMap = new Map([['test', commandMap]]);

			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			mockConfigurationHelper.getConfig = sandbox.stub().returns(undefined);

			const helper = getHelper();
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(mockLoggingHelper.warn.called);
					assert.equal(mockLoggingHelper.warn.getCall(0).args[0], `No config has been detected`);
				},
				(error: { message: string }) => {
					assert.fail(null, null, 'no config route should be taken which should be error free');
				}
			);
		});

		it(`should never call validation logic with empty config`, () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([]);
			const groupMap = new Map([['test', commandMap]]);

			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			mockConfigurationHelper.getConfig = sandbox.stub().returns({});

			const helper = getHelper();
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(mockLoggingHelper.warn.called);
					assert.equal(
						mockLoggingHelper.warn.getCall(0).args[0],
						`A config was found, but it has no properties`
					);
				},
				(error: { message: string }) => {
					assert.fail(null, null, 'no config route should be taken which should be error free');
				}
			);
		});

		it(`should return no validatable commands with no commands`, () => {
			const commandMap: CommandMap = new Map<string, CommandWrapper>([]);
			const groupMap = new Map([['test', commandMap]]);

			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			mockConfigurationHelper.getConfig = sandbox.stub().returns({ ...matchedConfig });

			const helper = getHelper();
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue(mockConfigurationHelper.getConfig.called);
					assert.isTrue(mockLoggingHelper.log.called);
					assert.equal(
						mockLoggingHelper.log.getCall(0).args[0],
						green(`There were no commands to validate against`)
					);
				},
				(error: { message: string }) => {
					assert.fail(null, null, 'no config route should be taken which should be error free');
				}
			);
		});

		it(`should return no validatable commands with no validatable commands`, () => {
			mockConfigurationHelper.getConfig = sandbox.stub().returns({ foo: 'bar' });
			const installedCommandWrapper = getCommandWrapperWithConfiguration({
				group: 'command',
				name: 'test'
			});
			const commandMap: CommandMap = new Map<string, CommandWrapper>([['command', installedCommandWrapper]]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.equal(
						mockLoggingHelper.log.getCall(0).args[0],
						green(`There were no commands to validate against`)
					);
				},
				(error: { message: string }) => {
					assert.fail(null, null, 'no config route should be taken which should be error free');
				}
			);
		});

		it(`should handle errors in the validate function gracefully`, () => {
			const installedCommandWrapper = getCommandWrapperWithConfiguration({
				group: 'command',
				name: 'test',
				validate: sinon.stub().throws('A test error')
			});
			mockConfigurationHelper.getConfig = sandbox.stub().returns({
				foo: 'bar'
			});
			const commandMap: CommandMap = new Map<string, CommandWrapper>([['command', installedCommandWrapper]]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.isTrue((installedCommandWrapper.validate as sinon.SinonStub).called);
					assert.isTrue((installedCommandWrapper.validate as sinon.SinonStub).threw());
					assert.equal(
						mockLoggingHelper.error.getCall(0).args[0],
						`The validation function for this command threw an error: A test error`
					);
				},
				(error: { message: string }) => {
					assert.fail(null, null, 'validate should handle error throws gracefully');
				}
			);
		});

		it(`should log out that there were no issues if all commands are valid`, () => {
			mockConfigurationHelper.getConfig = sandbox.stub().returns({ foo: 'bar' });
			const commandMap: CommandMap = new Map<string, CommandWrapper>([
				[
					'command',
					getCommandWrapperWithConfiguration({
						group: 'command',
						name: 'test',
						validate: sinon.stub().returns(true)
					})
				],
				[
					'command1',
					getCommandWrapperWithConfiguration({
						group: 'command1',
						name: 'test1',
						validate: sinon.stub().returns(true)
					})
				]
			]);
			const groupMap = new Map([['test', commandMap]]);
			const helper = getHelper();
			mockAllExternalCommands.loadExternalCommands = sandbox.stub().resolves(groupMap);
			return moduleUnderTest.run(helper, {} as any).then(
				() => {
					assert.equal(
						mockLoggingHelper.log.getCall(0).args[0],
						green(`There were no issues with your config!`)
					);
				},
				(error: { message: string }) => {
					assert.fail(null, null, 'no config route should be taken which should be error free');
				}
			);
		});
	});
});
