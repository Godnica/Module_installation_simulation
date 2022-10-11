const solution = require('./solution');

// test data
const instances = [
    {
        name: 'instance0',
        installed: {}
    },
    {
        name: 'instance1',
        installed: {}
    },
    {
        name: 'instance2',
        installed: {}
    },
    {
        name: 'instance3',
        installed: {}
    },
    {
        name: 'instance4',
        installed: {}
    }
];

const modules = [
    {
        name: 'module1',
        requires: []
    },
    {
        name: 'module2',
        requires: ['module1']
    },
    {
        name: 'module3',
        requires: ['module1', 'module2']
    },
    {
        name: 'module4',
        requires: ['module3']
    },
    {
        name: 'module5',
        requires: ['module3', 'module1']
    },
    {
        name: 'module6',
        requires: ['module7', 'module1']
    },
    {
        name: 'module7',
        requires: ['module8']
    },
    {
        name: 'module8',
        requires: ['module6']
    }
];

// helpers
let loggedError = undefined;

const ASYNC_DELAY = 50;
const LOOP_ERROR = 'Found dependency loop';

let loop = null;
const asyncFn = (value, failMessage) =>
    new Promise((resolve, reject) => {
        if (loop && --loop === 0) {
            loggedError = LOOP_ERROR;
            throw LOOP_ERROR;
        }
        return setTimeout(() => resolve(value), ASYNC_DELAY);
    });

const namedGetter = (array, defaultValue) => query =>
    array.find(({ name }) => name === query) || defaultValue;
const getInstance = namedGetter(instances, {});
const getModule = namedGetter(modules);

// test helpers
const instanceHasModule = (index, name, message) => {
    if (!instances[index].installed[name]) {
        return Promise.reject(message);
    }
};
const instanceHasModules = (index, names, message) => {
    const installed = Object.keys(instances[index].installed);
    installed.sort();
    names.sort();
    if (
        installed.length !== names.length ||
        !installed.every((name, index) => (names[index] = name))
    ) {
        return Promise.reject(message);
    }
};

// test class to be proxied
const ALREADY_INSTALL_ERROR = 'A module was installed twice';
const MISSING_DEPENDENCY_ERROR = 'A module is installed without its dependencies';
class Instance {
    constructor(name) {
        this.name = name;
    }
    getInstalledModuleNames() {
        return asyncFn(
            Object.keys(getInstance(this.name).installed || {}),
            'Unhandled failing call to getInstalledModuleNames'
        );
    }
    simpleInstallModule(name) {
        const installed = getInstance(this.name).installed || {};
        const mod = getModule(name);
        if (!mod) return Promise.resolve();
        if (installed[name]) {
            loggedError = ALREADY_INSTALL_ERROR;
            throw ALREADY_INSTALL_ERROR;
        }
        (mod.requires || []).forEach(name => {
            if (!installed[name]) {
                loggedError = MISSING_DEPENDENCY_ERROR;
                throw MISSING_DEPENDENCY_ERROR;
            }
        });
        return asyncFn(
            null,
            'Unhandled failing call to installModule'
        ).then(() => {
            if (installed[name]) {
                loggedError = ALREADY_INSTALL_ERROR;
                throw ALREADY_INSTALL_ERROR;
            }
            installed[name] = true;
        });
    }
}
// the final test
class ProxiedInstance extends Instance {
    installModule(name) {
        return Promise.resolve(solution.installModule(name, {
            getInstalledModuleNames: this.getInstalledModuleNames.bind(this),
            simpleInstallModule: this.simpleInstallModule.bind(this),
            getModule
        }));
    }
}

const test0 = () => {
    const instance0 = new ProxiedInstance('instance0');
    if (instance0.name !== 'instance0') {
        return Promise.reject('Instance does not have the right name')
    }
    return instance0
        .installModule('module1')
        .then(() => instanceHasModule(0, 'module1', 'Missing installed module'))
        .then(() => instance0.installModule('module1'))
        .then(() =>
            instanceHasModule(0, 'module1', 'Missing already installed module')
        )
        .then(() => instance0.installModule('module2'))
        .then(() =>
            instanceHasModule(
                0,
                'module2',
                'Missing installed module with dependency'
            )
        )
        .then(() => instance0.installModule('module3'))
        .then(() =>
            instanceHasModules(
                0,
                ['module1', 'module2', 'module3'],
                'Missing installed module with mutiple dependencies'
            )
        )
        .then(() => console.log('Testing simple install: OK'));
};

const test1 = () => {
    const instance1 = new ProxiedInstance('instance1');
    return instance1
        .installModule('module3')
        .then(() =>
            instanceHasModules(
                1,
                ['module1', 'module2', 'module3'],
                'Missing module or its dependencies'
            )
        )
        .then(() => console.log('Testing dependencies install: OK'));
};

const test2 = () => {
    const instance2 = new ProxiedInstance('instance2');
    return instance2
        .installModule('module4')
        .then(() =>
            instanceHasModules(
                2,
                ['module1', 'module2', 'module3', 'module4'],
                'Missing module or its multiple dependencies'
            )
        )
        .then(() => console.log('Testing multiple dependencies install: OK'));
};

const test3 = () => {
    const instance3 = new ProxiedInstance('instance3');
    return instance3
        .installModule('module5')
        .then(() =>
            instanceHasModules(
                3,
                ['module1', 'module2', 'module3', 'module5'],
                'Missing module or its multiple dependencies'
            )
        )
        .then(() => console.log('Testing multiple crossed dependencies: OK'));
};

const test4 = () => {
    const instance4 = new ProxiedInstance('instance4');
    // need to keep a flag, otherwise chain of expected failures will catch the error messages
    let failed = false;
    return instance4
        .installModule('moduleX')
        .then(
            () => Promise.reject('Should reject on unknown module'),
            errorCode => {
                if (errorCode !== 'ERROR_MODULE_UNKNOWN') {
                    failed = true;
                    return Promise.reject('Should reject on unknown module with error code ERROR_UNKNOWN_MODULE');
                }
                return instanceHasModules(4, [], 'There should be no module on the instance after trying to install an unknown module');
            })
        .then(() => {
            loop = 100;
            return instance4.installModule('module6')
        })
        .then(
            () => Promise.reject('Should reject if dependency loop'),
            errorCode => {
                if (failed) {
                    return Promise.reject(errorCode);
                }
                failed = true;
                if (errorCode !== 'ERROR_MODULE_DEPENDENCIES') {
                    return Promise.reject('Should reject if dependency loop with error code ERROR_MODULE_DEPENDENCIES');
                }
                return instanceHasModules(4, [], 'There should be no module on the instance after trying to install module with invalid dependencies');
            })
        .then(() =>
            console.log('Testing reject cases: OK')
        );
};

test0()
    .then(test1)
    .then(test2)
    .then(test3)
    .then(test4)
    .then(() => {
        if (loggedError) {
            throw loggedError;
        }
        console.log('All works as expected.');
    })
    .catch(err =>
        console.error('Some of the tests are still failing.', err || '')
    );
