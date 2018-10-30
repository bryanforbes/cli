const { registerSuite } = intern.getInterface('object');
const { assert } = intern.getPlugin('chai');

import { resolve as pathResolve } from 'path';
import * as sinon from 'sinon';
import MockModule from '../support/MockModule';
import chalk from 'chalk';
import { ConfigurationHelperFactory, checkForMultiConfig } from '../../src/configurationHelper';
import { getLoggingStub, LoggingStub } from '../support/testHelper';

let sandbox: any;
let mockModule: MockModule;
let mockPkgDir: any;
let mockFs: any;
let mockPath: any;
let mockReadlineSync: any;
let configurationHelper: ConfigurationHelperFactory;
let mockLoggingHelper: LoggingStub;
let configToIndent: any;
let mockcheckForMultiConfig: typeof checkForMultiConfig;

const packagePath = pathResolve(__dirname, '../support');
const dojoRcPath = `${packagePath}/.dojorc`;
const packageJsonPath = `${packagePath}/package.json`;

registerSuite('Configuration Helper', {
	'package dir exists': {
		beforeEach() {
			sandbox = sinon.sandbox.create();
			mockModule = new MockModule('../../src/configurationHelper', require);
			mockModule.dependencies(['pkg-dir', 'fs', 'path', 'readline-sync', dojoRcPath, packageJsonPath]);
			mockPkgDir = mockModule.getMock('pkg-dir');
			mockPkgDir.ctor.sync = sandbox.stub().returns(packagePath);
			mockFs = mockModule.getMock('fs');
			mockFs.existsSync = sinon.stub().returns(true);
			mockFs.readFileSync = sinon.stub().returns('{}');
			mockFs.writeFileSync = sinon.stub();
			mockPath = mockModule.getMock('path');
			mockPath.join = sinon.stub().returns(dojoRcPath);
			mockReadlineSync = mockModule.getMock('readline-sync');
			mockReadlineSync.isInKeyYN = sinon.stub().returns(true);
			configurationHelper = mockModule.getModuleUnderTest().default;
			mockLoggingHelper = getLoggingStub();
		},
		afterEach() {
			sandbox.restore();
			mockModule.destroy();
		},

		tests: {
			'Should write new config to file when save called'() {
				const newConfig = { foo: 'bar' };
				mockFs.readFileSync = sinon.stub().returns(JSON.stringify({ 'testGroupName-testCommandName': {} }));
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set(newConfig);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockFs.writeFileSync.calledOnce);
				assert.equal(mockFs.writeFileSync.firstCall.args[0], dojoRcPath);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify({ 'testGroupName-testCommandName': newConfig }, null, 2)
				);
			},
			'Should write new config to file when save called without commandName'() {
				const newConfig = { foo: 'bar' };
				mockFs.readFileSync = sinon.stub().returns(JSON.stringify({ testGroupName: {} }));
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName').set(newConfig);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockFs.writeFileSync.calledOnce);
				assert.equal(mockFs.writeFileSync.firstCall.args[0], dojoRcPath);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify({ testGroupName: newConfig }, null, 2)
				);
			},
			'Should merge new config with old when save called'() {
				const newConfig = { foo: 'bar' };
				const existingConfig = { existing: 'config' };
				const mergedConfigs = Object.assign(existingConfig, newConfig);

				mockFs.readFileSync.returns(JSON.stringify({ 'testGroupName-testCommandName': existingConfig }));
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set(newConfig);
				assert.isTrue(mockLoggingHelper.error.notCalled);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockFs.writeFileSync.calledOnce);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify({ 'testGroupName-testCommandName': mergedConfigs }, null, 2)
				);
			},
			'Should write new config to .dojorc path when one does not exist'() {
				mockFs.existsSync.returns(false);
				assert.isTrue(mockFs.readFileSync.notCalled);

				const newConfig = { foo: 'bar' };
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set(newConfig);
				assert.isTrue(mockLoggingHelper.error.notCalled);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockFs.writeFileSync.calledOnce);
				assert.equal(mockFs.writeFileSync.firstCall.args[0], dojoRcPath);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify({ 'testGroupName-testCommandName': newConfig }, null, 2)
				);
			},
			'Should merge new commandNames with existing command config to .dojorc when set called'() {
				const newConfig = { foo: 'bar' };
				const existingConfig = { existing: 'config' };
				mockFs.readFileSync.returns(JSON.stringify({ existingCommandName: existingConfig }));
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set(newConfig);
				assert.isTrue(mockLoggingHelper.error.notCalled);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockFs.writeFileSync.calledOnce);
				assert.equal(mockFs.writeFileSync.firstCall.args[0], dojoRcPath);
				assert.deepEqual(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify(
						{
							existingCommandName: existingConfig,
							'testGroupName-testCommandName': newConfig
						},
						null,
						'  '
					)
				);
			},
			'Should write .dojorc with current .dojorc identation of 4 spaces'() {
				const newConfig = { foo: 'bar' };
				const existingConfig = { existing: 'config' };
				mockFs.readFileSync
					.onCall(0)
					.returns(JSON.stringify({ existingCommandName: existingConfig }, null, '    '));
				mockFs.readFileSync.onCall(1).returns('{}');
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set(newConfig);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockLoggingHelper.error.notCalled);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify(
						{
							existingCommandName: existingConfig,
							'testGroupName-testCommandName': newConfig
						},
						null,
						'    '
					)
				);
			},
			'Should write .dojorc with current .dojorc identation of 2 spaces'() {
				const newConfig = { foo: 'bar' };
				const existingConfig = { existing: 'config' };
				mockFs.readFileSync
					.onCall(0)
					.returns(JSON.stringify({ existingCommandName: existingConfig }, null, '  '));
				mockFs.readFileSync.onCall(1).returns('{}');
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set(newConfig);
				assert.isTrue(mockLoggingHelper.warn.notCalled);
				assert.isTrue(mockLoggingHelper.error.notCalled);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify(
						{
							existingCommandName: existingConfig,
							'testGroupName-testCommandName': newConfig
						},
						null,
						'  '
					)
				);
			},
			'Should return undefined command config when no dojorc config for command exists'() {
				mockFs.existsSync.returns(false);
				const config = configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').get();
				assert.isTrue(mockFs.readFileSync.notCalled);
				assert.equal(config, undefined);
			},
			'Should return existing config when a dojorc entry exists'() {
				const existingConfig = { existing: 'config' };
				mockFs.existsSync.onCall(0).returns(true);
				mockFs.existsSync.onCall(1).returns(false);
				mockFs.readFileSync.returns(JSON.stringify({ 'testGroupName-testCommandName': existingConfig }));
				const config = configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').get();
				assert.isTrue(mockFs.readFileSync.calledOnce);
				assert.equal(mockFs.readFileSync.firstCall.args[0], dojoRcPath);
				assert.deepEqual(config, existingConfig);
			},
			'Should accept and ignore commandName parameter'() {
				const newConfig = { foo: 'bar' };
				mockFs.readFileSync = sinon.stub().returns(JSON.stringify({ 'testGroupName-testCommandName': {} }));
				configurationHelper
					.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName')
					.set(newConfig, 'invalid name');

				assert.isTrue(mockFs.writeFileSync.calledOnce);
				assert.equal(mockFs.writeFileSync.firstCall.args[0], dojoRcPath);
				assert.equal(
					mockFs.writeFileSync.firstCall.args[1],
					JSON.stringify({ 'testGroupName-testCommandName': newConfig }, null, 2)
				);
			},
			'Should throw an error when the config is not valid JSON'() {
				mockFs.existsSync.returns(true);
				mockFs.readFileSync = sinon.stub();
				mockFs.readFileSync.onCall(0).returns('{}');
				mockFs.readFileSync.onCall(1).returns('{]');
				const test = () =>
					configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').get();

				assert.throws(
					test,
					Error,
					chalk.red(
						`Could not parse the package.json file to get config: SyntaxError: Unexpected token ] in JSON at position 1`
					)
				);
				assert.equal(mockFs.readFileSync.callCount, 2, 'both package.json and .dojorc should be read');
			}
		}
	},
	'package dir does not exist': {
		beforeEach() {
			sandbox = sinon.sandbox.create();
			mockModule = new MockModule('../../src/configurationHelper', require);
			mockModule.dependencies(['pkg-dir', 'fs', 'path']);
			mockPkgDir = mockModule.getMock('pkg-dir');
			mockPkgDir.ctor.sync = sandbox.stub().returns(null);
			mockFs = mockModule.getMock('fs');
			mockFs.readFileSync = sandbox.stub();
			mockFs.writeFileSync = sandbox.stub();
			mockPath = mockModule.getMock('path');
			mockPath.join = sandbox.stub();
			mockLoggingHelper = getLoggingStub();
			configurationHelper = mockModule.getModuleUnderTest().default;
		},
		afterEach() {
			sandbox.restore();
			mockModule.destroy();
		},

		tests: {
			'Should return undefined config when pkgdir returns null'() {
				mockFs.readFileSync = sinon.stub();
				mockFs.readFileSync.onCall(0).returns('{}');
				const config = configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').get();
				assert.isFalse(mockPath.join.called);
				assert.equal(config, undefined);
			},
			'Should warn user when config save called outside of a pkgdir'() {
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set({});
				assert.isFalse(mockFs.writeFileSync.called);
				assert.isTrue(mockLoggingHelper.error.calledOnce);
			}
		}
	},

	'package json': {
		beforeEach() {
			configToIndent = {
				dojo: {
					test: {
						hello: 'world'
					},
					'testGroupName-testCommandName': {
						one: 'two',
						hello: 'world'
					}
				}
			};
			sandbox = sinon.sandbox.create();
			mockModule = new MockModule('../../src/configurationHelper', require);
			mockModule.dependencies(['pkg-dir', 'fs', 'path', 'readline-sync', dojoRcPath]);
			mockPkgDir = mockModule.getMock('pkg-dir');
			mockPkgDir.ctor.sync = sandbox.stub().returns(packagePath);
			mockFs = mockModule.getMock('fs');
			mockFs.existsSync = sinon.stub().callsFake((filename) => filename === packageJsonPath);
			mockFs.readFileSync = sinon.stub().returns(
				JSON.stringify(
					{
						dojo: {
							test: {
								hello: 'world'
							},
							'testGroupName-testCommandName': {
								one: 'two'
							}
						}
					},
					null,
					'    '
				)
			);
			mockFs.writeFileSync = sinon.stub();
			mockPath = mockModule.getMock('path');
			mockPath.join = sinon
				.stub()
				.callsFake((...args) => (args.some((a) => a === 'package.json') ? packageJsonPath : dojoRcPath));
			mockReadlineSync = mockModule.getMock('readline-sync');
			mockReadlineSync.keyInYN = sinon.stub().returns(true);
			mockLoggingHelper = getLoggingStub();
			configurationHelper = mockModule.getModuleUnderTest().default;
		},
		afterEach() {
			sandbox.restore();
			mockModule.destroy();
		},
		tests: {
			'reads config from package.json if available'() {
				assert.deepEqual(
					configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').get(),
					{
						one: 'two'
					}
				);

				assert.deepEqual(
					configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').get('test'),
					{
						hello: 'world'
					}
				);
			},

			'confirms writing config to package.json'() {
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set({
					hello: 'world'
				});

				assert.isTrue(mockReadlineSync.keyInYN.called, 'yes/no is called');

				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set({
					hello: 'world'
				});

				assert.isTrue(mockReadlineSync.keyInYN.calledOnce, 'yes/no is only called once');

				assert.isTrue(mockFs.writeFileSync.calledTwice, 'the file is written twice');
			},

			'writes package.json with current package.json identation of 4 spaces'() {
				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set({
					hello: 'world'
				});
				const indentFour = '    ';
				const indentedConfig = JSON.stringify(configToIndent, null, indentFour);

				assert.equal(mockFs.writeFileSync.firstCall.args[1], indentedConfig);
			},

			'writes package.json with current package.json identation of 2 spaces'() {
				const indentTwo = '  ';
				const indentedConfig = JSON.stringify(configToIndent, null, indentTwo);
				mockFs.readFileSync = sinon.stub().returns(indentedConfig);

				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set({
					hello: 'world'
				});

				assert.equal(mockFs.writeFileSync.firstCall.args[1], indentedConfig);
			},

			'does not write to package.json if no answered'() {
				mockReadlineSync.keyInYN = sinon.stub().returns(false);

				configurationHelper.sandbox(mockLoggingHelper, 'testGroupName', 'testCommandName').set({
					hello: 'world'
				});

				assert.isFalse(mockFs.writeFileSync.called);
			}
		}
	},

	checkForMultiConfig: {
		beforeEach() {
			sandbox = sinon.sandbox.create();
			mockModule = new MockModule('../../src/configurationHelper', require);
			mockModule.dependencies(['pkg-dir', 'fs', 'path']);
			mockPkgDir = mockModule.getMock('pkg-dir');
			mockPkgDir.ctor.sync = sandbox.stub().returns(null);
			mockFs = mockModule.getMock('fs');
			mockFs.existsSync = sandbox.stub().returns(true);
			mockFs.readFileSync = sandbox.stub();
			mockFs.readFileSync.onFirstCall().returns('{}');
			mockFs.readFileSync.onSecondCall(1).returns('{ "dojo": {} }');
			mockPath = mockModule.getMock('path');
			mockPath.join = sandbox.stub();
			mockLoggingHelper = getLoggingStub();
			mockcheckForMultiConfig = mockModule.getModuleUnderTest().checkForMultiConfig;
		},
		afterEach() {
			sandbox.restore();
			mockModule.destroy();
		},

		tests: {
			'should warn about having multi configs'() {
				mockcheckForMultiConfig(mockLoggingHelper);
				assert.isTrue(mockFs.existsSync.calledTwice);
				assert.isTrue(mockFs.readFileSync.calledTwice);
				assert.equal(mockLoggingHelper.warn.callCount, 1);
				assert.equal(
					mockLoggingHelper.warn.firstCall.args[0],
					`Warning: Both a .dojorc configuration and a dojo configuration in your package.json were found. The .dojorc file will take precedent. It is recommended you stick to one configuration option.`
				);
			}
		}
	}
});
