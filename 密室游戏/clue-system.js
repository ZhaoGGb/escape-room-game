/**
 * 3D密室逃脱游戏 - 线索系统模块
 * 包含完整的道具、线索、背包和密码逻辑
 */

// ==================== 调试日志系统 ====================
class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000;
        this.enabled = true;
        this.logLevel = 'INFO'; // DEBUG, INFO, WARN, ERROR
    }

    log(level, message, data = null) {
        if (!this.enabled) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };

        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 控制台输出
        const consoleMessage = `[${timestamp.split('T')[1].split('.')[0]}] [${level}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
        switch (level) {
            case 'DEBUG':
                console.debug(consoleMessage);
                break;
            case 'INFO':
                console.info(consoleMessage);
                break;
            case 'WARN':
                console.warn(consoleMessage);
                break;
            case 'ERROR':
                console.error(consoleMessage);
                break;
        }

        // 更新UI日志显示
        this.updateLogDisplay();
    }

    debug(message, data = null) { this.log('DEBUG', message, data); }
    info(message, data = null) { this.log('INFO', message, data); }
    warn(message, data = null) { this.log('WARN', message, data); }
    error(message, data = null) { this.log('ERROR', message, data); }

    updateLogDisplay() {
        const logContainer = document.getElementById('debugLogs');
        if (logContainer) {
            const recentLogs = this.logs.slice(-50);
            logContainer.innerHTML = recentLogs.map(log =>
                `<div class="log-entry log-${log.level.toLowerCase()}">
                    <span class="log-time">${log.timestamp.split('T')[1].split('.')[0]}</span>
                    <span class="log-level">[${log.level}]</span>
                    <span class="log-message">${log.message}</span>
                </div>`
            ).join('');
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    getLogs() {
        return [...this.logs];
    }

    clearLogs() {
        this.logs = [];
        this.updateLogDisplay();
    }
}

// 全局调试日志实例
const debugLogger = new DebugLogger();

// ==================== 道具系统 ====================
class Item {
    constructor(id, name, description, icon, canCollect = true) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.canCollect = canCollect;
        this.collected = false;
        this.consumable = false;
        this.usesLeft = 1;
    }

    clone() {
        const item = new Item(this.id, this.name, this.description, this.icon, this.canCollect);
        item.collected = this.collected;
        item.consumable = this.consumable;
        item.usesLeft = this.usesLeft;
        return item;
    }

    use() {
        if (this.consumable && this.usesLeft > 0) {
            this.usesLeft--;
            return true;
        }
        return false;
    }
}

// ==================== 背包系统 ====================
class Inventory {
    constructor() {
        this.items = new Map();
        this.maxSlots = 20;
    }

    addItem(item) {
        if (this.items.size >= this.maxSlots) {
            debugLogger.warn('背包已满', { itemId: item.id });
            return false;
        }

        // 检查是否已存在可堆叠物品
        if (this.items.has(item.id)) {
            const existingItem = this.items.get(item.id);
            if (existingItem.canCollect && !existingItem.consumable) {
                debugLogger.warn('物品已存在', { itemId: item.id });
                return false;
            }
        }

        this.items.set(item.id, item);
        debugLogger.info('添加物品到背包', { itemId: item.id, itemName: item.name });
        return true;
    }

    removeItem(itemId) {
        if (this.items.has(itemId)) {
            this.items.delete(itemId);
            debugLogger.info('从背包移除物品', { itemId });
            return true;
        }
        return false;
    }

    hasItem(itemId) {
        return this.items.has(itemId);
    }

    getItem(itemId) {
        return this.items.get(itemId);
    }

    getAllItems() {
        return Array.from(this.items.values());
    }

    getItemCount() {
        return this.items.size;
    }

    clear() {
        this.items.clear();
        debugLogger.info('清空背包');
    }
}

// ==================== 触发条件系统 ====================
class TriggerCondition {
    constructor(type, targetItemId = null, requiredState = null) {
        this.type = type; // 'has_item', 'no_item', 'state_equals', 'always'
        this.targetItemId = targetItemId;
        this.requiredState = requiredState;
    }

    evaluate(inventory, gameState) {
        switch (this.type) {
            case 'has_item':
                return inventory.hasItem(this.targetItemId);
            case 'no_item':
                return !inventory.hasItem(this.targetItemId);
            case 'state_equals':
                return gameState.get(this.requiredState) === true;
            case 'always':
                return true;
            default:
                return false;
        }
    }
}

// ==================== 场景对象配置 ====================
class SceneObject {
    constructor(id, name, description, position) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.position = position;
        this.interactions = [];
        this.triggers = [];
        this.collected = false;
        this.consumed = false;
    }

    addInteraction(interaction) {
        this.interactions.push(interaction);
    }

    addTrigger(trigger) {
        this.triggers.push(trigger);
    }
}

// ==================== 交互动作 ====================
class InteractionAction {
    constructor(type, payload) {
        this.type = type; // 'show_message', 'give_item', 'require_item', 'consume_item', 'set_state', 'check_password'
        this.payload = payload;
    }
}

// ==================== 交互定义 ====================
class Interaction {
    constructor(id, name, description, conditions, actions) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.conditions = conditions; // 触发条件列表
        this.actions = actions; // 执行动作列表
        this.executed = false;
    }

    canExecute(inventory, gameState) {
        return this.conditions.every(condition => condition.evaluate(inventory, gameState));
    }
}

// ==================== 游戏状态管理 ====================
class GameState {
    constructor() {
        this.states = new Map();
        this.flags = new Map();
    }

    set(key, value) {
        this.states.set(key, value);
        debugLogger.debug('设置游戏状态', { key, value });
    }

    get(key) {
        return this.states.get(key) || false;
    }

    has(key) {
        return this.states.has(key);
    }

    setFlag(flag, value = true) {
        this.flags.set(flag, value);
        debugLogger.debug('设置游戏标记', { flag, value });
    }

    hasFlag(flag) {
        return this.flags.get(flag) || false;
    }

    getAllStates() {
        return Object.fromEntries(this.states);
    }

    getAllFlags() {
        return Object.fromEntries(this.flags);
    }
}

// ==================== 密码系统 ====================
class PasswordSystem {
    constructor(correctPassword) {
        this.correctPassword = correctPassword;
        this.enteredPassword = '';
        this.maxAttempts = 3;
        this.attemptsLeft = this.maxAttempts;
        this.locked = false;
    }

    enterDigit(digit) {
        if (this.locked) {
            return { success: false, message: '密码锁已锁定' };
        }

        if (this.enteredPassword.length < this.correctPassword.length) {
            this.enteredPassword += digit;
            debugLogger.debug('输入密码数字', { current: this.enteredPassword });
            return { success: true, progress: this.enteredPassword.length / this.correctPassword.length };
        }

        return { success: false, message: '密码已满' };
    }

    submitPassword() {
        if (this.locked) {
            return { success: false, message: '密码锁已锁定' };
        }

        if (this.enteredPassword === this.correctPassword) {
            debugLogger.info('密码正确', { password: this.enteredPassword });
            this.reset();
            return { success: true, message: '密码正确！锁已打开' };
        } else {
            this.attemptsLeft--;
            this.enteredPassword = '';

            if (this.attemptsLeft <= 0) {
                this.locked = true;
                debugLogger.warn('密码锁已锁定', { attempts: this.attemptsLeft });
                return { success: false, message: '密码错误，密码锁已锁定！', locked: true };
            }

            debugLogger.warn('密码错误', { attemptsLeft: this.attemptsLeft });
            return { success: false, message: `密码错误，剩余${this.attemptsLeft}次尝试机会` };
        }
    }

    reset() {
        this.enteredPassword = '';
        this.attemptsLeft = this.maxAttempts;
        this.locked = false;
    }

    getDisplay() {
        return '*'.repeat(this.enteredPassword.length);
    }
}

// ==================== 线索系统核心类 ====================
class ClueSystem {
    constructor() {
        this.inventory = new Inventory();
        this.gameState = new GameState();
        this.passwordSystem = new PasswordSystem('9427'); // 正确密码
        this.sceneObjects = new Map();
        this.interactions = new Map();
        this.initGameData();
    }

    initGameData() {
        // 初始化物品
        this.items = {
            'small_key': new Item('small_key', '🔑 小钥匙', '一把银色的小钥匙，可以打开抽屉', '🔑', true),
            'golden_key': new Item('golden_key', '🔑 金钥匙', '一把金色的钥匙，这是打开房门的钥匙！', '🔑', true),
            'crumpled_paper': new Item('crumpled_paper', '📄 皱纸团', '从垃圾桶里找到的纸团，上面写着：7-2-4-9', '📄', true),
            'diary': new Item('diary', '📔 日记本', '日记最后一页：记住，密码锁的顺序是反的', '📔', true)
        };

        // 设置消耗性物品
        this.items['small_key'].consumable = true;
        this.items['golden_key'].consumable = true;

        // 初始化场景对象
        this.sceneObjects = new Map([
            ['trash_bin', new SceneObject('trash_bin', '🗑️ 垃圾桶', '一个金属垃圾桶', { x: 1.5, y: 0, z: 0.5 })],
            ['plant', new SceneObject('plant', '🪴 盆栽', '一盆枯萎的绿植', { x: 2.5, y: 0, z: 1.5 })],
            ['desk_drawer', new SceneObject('desk_drawer', '🗝️ 书桌抽屉', '需要钥匙才能打开', { x: -2, y: 0.8, z: 1.5 })],
            ['safe', new SceneObject('safe', '🔒 保险箱', '需要输入4位密码', { x: 2.8, y: 1.8, z: -2 })],
            ['door', new SceneObject('door', '🚪 房门', '被密码锁锁住了', { x: 2.5, y: 1.15, z: 0 })]
        ]);

        // 初始化交互
        this.initInteractions();
    }

    initInteractions() {
        // 1. 垃圾桶 - 收集皱纸团
        const trashInteraction = new Interaction(
            'trash_search',
            '翻找垃圾桶',
            '在垃圾桶里翻找',
            [new TriggerCondition('always')],
            [
                new InteractionAction('give_item', 'crumpled_paper'),
                new InteractionAction('show_message', {
                    title: '📄 发现线索',
                    message: '你在垃圾桶里找到了一张皱巴巴的纸团，上面潦草地写着数字：7-2-4-9',
                    hint: '也许这是某个锁的密码？'
                })
            ]
        );
        this.sceneObjects.get('trash_bin').addInteraction(trashInteraction);

        // 2. 盆栽 - 收集小钥匙
        const plantInteraction = new Interaction(
            'plant_check',
            '检查盆栽',
            '检查盆栽土壤',
            [new TriggerCondition('no_item', 'small_key')],
            [
                new InteractionAction('give_item', 'small_key'),
                new InteractionAction('show_message', {
                    title: '🔑 发现钥匙',
                    message: '你在花盆的土壤里发现了一把银色的小钥匙！这把钥匙看起来可以打开什么东西...',
                    hint: '去书桌抽屉试试看？'
                })
            ]
        );
        this.sceneObjects.get('plant').addInteraction(plantInteraction);

        // 3. 书桌抽屉 - 需要钥匙，打开后获得日记
        const drawerInteraction = new Interaction(
            'drawer_open',
            '打开抽屉',
            '尝试打开书桌抽屉',
            [new TriggerCondition('always')],
            [
                new InteractionAction('require_item', {
                    itemId: 'small_key',
                    failMessage: '❌ 需要小钥匙',
                    failHint: '抽屉被锁住了，需要找到钥匙。试着在房间里搜索一下...'
                }),
                new InteractionAction('consume_item', 'small_key'),
                new InteractionAction('give_item', 'diary'),
                new InteractionAction('show_message', {
                    title: '📔 获得日记',
                    message: '抽屉打开了！你发现了一本日记。\n\n日记的最后一页写着："记住，密码锁的顺序是反的..."',
                    hint: '密码顺序是反的！7-2-4-9反过来就是9-4-2-7'
                })
            ]
        );
        this.sceneObjects.get('desk_drawer').addInteraction(drawerInteraction);

        // 4. 保险箱 - 需要密码，打开后获得金钥匙
        const safeInteraction = new Interaction(
            'safe_open',
            '打开保险箱',
            '尝试打开保险箱',
            [new TriggerCondition('always')],
            [
                new InteractionAction('check_password', {
                    correctPassword: '9427',
                    successActions: [
                        new InteractionAction('give_item', 'golden_key'),
                        new InteractionAction('show_message', {
                            title: '🎉 保险箱打开了！',
                            message: '咔哒！保险箱打开了！\n\n里面有一把金色的钥匙，这一定是打开房门的钥匙！',
                            hint: '带着这把钥匙去开门吧！'
                        })
                    ],
                    failMessage: '❌ 密码错误',
                    failHint: '再想想其他线索...'
                })
            ]
        );
        this.sceneObjects.get('safe').addInteraction(safeInteraction);

        // 5. 房门 - 需要金钥匙和密码（密码通过日记获得）
        const doorInteraction = new Interaction(
            'door_unlock',
            '开门',
            '尝试打开房门',
            [new TriggerCondition('always')],
            [
                new InteractionAction('require_item', {
                    itemId: 'golden_key',
                    failMessage: '❌ 需要金钥匙',
                    failHint: '门被牢牢锁住了，需要找到钥匙...'
                }),
                new InteractionAction('show_message', {
                    title: '🚪 成功逃脱！',
                    message: '你用金钥匙打开了房门！\n\nCongratulations! 你成功逃脱了密室！',
                    hint: '🎉 游戏通关！'
                }),
                new InteractionAction('set_state', { key: 'gameComplete', value: true })
            ]
        );
        this.sceneObjects.get('door').addInteraction(doorInteraction);
    }

    // 交互处理
    interact(objectId) {
        const object = this.sceneObjects.get(objectId);
        if (!object) {
            debugLogger.error('场景对象不存在', { objectId });
            return { success: false, message: '错误：对象不存在' };
        }

        if (object.interactions.length === 0) {
            debugLogger.warn('对象没有交互动作', { objectId });
            return { success: false, message: '这个物品没有什么特别的...' };
        }

        const interaction = object.interactions[0]; // 使用第一个交互

        debugLogger.info('执行交互', {
            objectId,
            interactionId: interaction.id,
            objectName: object.name
        });

        // 检查条件
        if (!interaction.canExecute(this.inventory, this.gameState)) {
            debugLogger.debug('交互条件不满足', { interactionId: interaction.id });
            return { success: false, message: '现在不能这样做...' };
        }

        // 执行动作
        const result = this.executeActions(interaction.actions);

        if (result.success) {
            interaction.executed = true;
            debugLogger.info('交互执行成功', { interactionId: interaction.id });
        }

        return result;
    }

    executeActions(actions) {
        for (const action of actions) {
            const result = this.executeAction(action);
            if (!result.success) {
                return result;
            }
        }
        return { success: true, message: '操作完成' };
    }

    executeAction(action) {
        switch (action.type) {
            case 'show_message':
                debugLogger.debug('显示消息', { title: action.payload.title });
                return {
                    success: true,
                    type: 'show_message',
                    ...action.payload
                };

            case 'give_item':
                const item = this.items[action.payload];
                if (!item) {
                    debugLogger.error('物品不存在', { itemId: action.payload });
                    return { success: false, message: '错误：物品不存在' };
                }

                if (this.inventory.hasItem(item.id)) {
                    debugLogger.warn('物品已拥有', { itemId: item.id });
                    return { success: true, type: 'item_owned', item: item };
                }

                if (this.inventory.addItem(item.clone())) {
                    debugLogger.info('获得物品', { itemId: item.id, itemName: item.name });
                    return {
                        success: true,
                        type: 'item_received',
                        item: item
                    };
                }
                return { success: false, message: '无法获得物品' };

            case 'require_item':
                if (this.inventory.hasItem(action.payload.itemId)) {
                    debugLogger.debug('持有必要物品', { itemId: action.payload.itemId });
                    return { success: true, type: 'requirement_met' };
                } else {
                    debugLogger.debug('缺少必要物品', { itemId: action.payload.itemId });
                    return {
                        success: false,
                        type: 'requirement_missing',
                        message: action.payload.failMessage,
                        hint: action.payload.failHint
                    };
                }

            case 'consume_item':
                if (this.inventory.removeItem(action.payload)) {
                    debugLogger.info('消耗物品', { itemId: action.payload });
                    return { success: true, type: 'item_consumed' };
                }
                return { success: false, message: '无法消耗物品' };

            case 'check_password':
                return {
                    success: true,
                    type: 'password_required',
                    payload: action.payload
                };

            case 'set_state':
                this.gameState.set(action.payload.key, action.payload.value);
                return { success: true, type: 'state_set' };

            default:
                debugLogger.warn('未知的动作类型', { actionType: action.type });
                return { success: false, message: '未知动作' };
        }
    }

    // 密码相关方法
    enterPasswordDigit(digit) {
        return this.passwordSystem.enterDigit(digit);
    }

    submitPassword() {
        const result = this.passwordSystem.submitPassword();
        if (result.success) {
            this.gameState.setFlag('safeOpened');
            this.gameState.set('safePasswordKnown', true);
        }
        return result;
    }

    getPasswordDisplay() {
        return this.passwordSystem.getDisplay();
    }

    // 背包相关方法
    getInventory() {
        return this.inventory.getAllItems();
    }

    hasItem(itemId) {
        return this.inventory.hasItem(itemId);
    }

    // 游戏状态
    isGameComplete() {
        return this.gameState.get('gameComplete');
    }

    // 调试信息
    getDebugInfo() {
        return {
            inventory: this.inventory.getAllItems().map(i => ({ id: i.id, name: i.name })),
            states: this.gameState.getAllStates(),
            flags: this.gameState.getAllFlags(),
            logs: debugLogger.getLogs()
        };
    }
}

// ==================== 单元测试 ====================
class ClueSystemTests {
    constructor() {
        this.results = [];
    }

    runAllTests() {
        console.clear();
        console.log('🧪 开始运行单元测试...\n');

        this.testNoKeyShowMessage();
        this.testWithKeySuccess();
        this.testCorrectPasswordOpenDoor();
        this.testWrongPassword();
        this.testInventoryManagement();
        this.testStateManagement();

        this.printResults();
        return this.results;
    }

    testNoKeyShowMessage() {
        console.log('📋 测试1: 未持有钥匙→提示失败');

        const system = new ClueSystem();

        // 确保没有钥匙
        system.inventory.clear();

        // 尝试打开抽屉
        const result = system.interact('desk_drawer');

        const passed = result.type === 'requirement_missing' &&
                      result.message === '❌ 需要小钥匙';

        this.results.push({
            name: '未持有钥匙时打开抽屉',
            passed,
            expected: '显示"需要小钥匙"提示',
            actual: result.message
        });

        console.log(passed ? '✅ 通过' : '❌ 失败', '- 未持有钥匙时打开抽屉');
        return passed;
    }

    testWithKeySuccess() {
        console.log('\n📋 测试2: 持有钥匙→成功开启');

        const system = new ClueSystem();

        // 假装已有钥匙（通过直接添加）
        system.inventory.addItem(system.items['small_key'].clone());

        // 打开抽屉
        const result = system.interact('desk_drawer');

        const passed = result.type === 'item_received' &&
                      result.item.id === 'diary' &&
                      !system.inventory.hasItem('small_key'); // 钥匙应该被消耗

        this.results.push({
            name: '持有钥匙时打开抽屉',
            passed,
            expected: '消耗钥匙并获得日记',
            actual: `${result.type}, 获得物品: ${result.item?.name}`
        });

        console.log(passed ? '✅ 通过' : '❌ 失败', '- 持有钥匙时打开抽屉');
        return passed;
    }

    testCorrectPasswordOpenDoor() {
        console.log('\n📋 测试3: 密码正确→开门');

        const system = new ClueSystem();

        // 假装已打开保险箱获得金钥匙
        system.gameState.setFlag('safeOpened');
        system.inventory.addItem(system.items['golden_key'].clone());

        // 开门
        const result = system.interact('door');

        const passed = result.type === 'show_message' &&
                      result.title === '🚪 成功逃脱！' &&
                      system.isGameComplete();

        this.results.push({
            name: '密码正确且有钥匙时开门',
            passed,
            expected: '显示逃脱成功提示',
            actual: `${result.title}`
        });

        console.log(passed ? '✅ 通过' : '❌ 失败', '- 密码正确且有钥匙时开门');
        return passed;
    }

    testWrongPassword() {
        console.log('\n📋 测试4: 密码错误处理');

        const system = new ClueSystem();

        // 输入错误密码
        system.enterPasswordDigit('1');
        system.enterPasswordDigit('2');
        system.enterPasswordDigit('3');
        system.enterPasswordDigit('4');

        const result = system.submitPassword();

        const passed = result.success === false &&
                      result.message.includes('密码错误');

        this.results.push({
            name: '密码错误处理',
            passed,
            expected: '显示密码错误提示',
            actual: result.message
        });

        console.log(passed ? '✅ 通过' : '❌ 失败', '- 密码错误处理');
        return passed;
    }

    testInventoryManagement() {
        console.log('\n📋 测试5: 背包管理功能');

        const system = new ClueSystem();

        // 添加物品
        system.inventory.addItem(system.items['small_key'].clone());
        system.inventory.addItem(system.items['crumpled_paper'].clone());

        const hasKey = system.hasItem('small_key');
        const hasPaper = system.hasItem('crumpled_paper');
        const count = system.inventory.getItemCount();

        const passed = hasKey && hasPaper && count === 2;

        this.results.push({
            name: '背包物品管理',
            passed,
            expected: '持有2个物品',
            actual: `持有${count}个物品`
        });

        console.log(passed ? '✅ 通过' : '❌ 失败', '- 背包物品管理');
        return passed;
    }

    testStateManagement() {
        console.log('\n📋 测试6: 游戏状态管理');

        const system = new ClueSystem();

        // 设置状态
        system.gameState.set('testState', true);
        system.gameState.setFlag('testFlag');

        const stateCorrect = system.gameState.get('testState') === true;
        const flagCorrect = system.gameState.hasFlag('testFlag');

        const passed = stateCorrect && flagCorrect;

        this.results.push({
            name: '游戏状态管理',
            passed,
            expected: '状态和标记都能正确设置和读取',
            actual: `状态: ${stateCorrect}, 标记: ${flagCorrect}`
        });

        console.log(passed ? '✅ 通过' : '❌ 失败', '- 游戏状态管理');
        return passed;
    }

    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 测试结果汇总');
        console.log('='.repeat(50));

        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;

        this.results.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${status} ${index + 1}. ${result.name}`);
            if (!result.passed) {
                console.log(`   期望: ${result.expected}`);
                console.log(`   实际: ${result.actual}`);
            }
        });

        console.log('='.repeat(50));
        console.log(`🎯 总计: ${passed}/${total} 测试通过`);

        if (passed === total) {
            console.log('🎉 所有测试通过！');
        } else {
            console.log(`⚠️ ${total - passed} 个测试失败`);
        }
    }
}

// 导出供全局使用
window.ClueSystem = ClueSystem;
window.Inventory = Inventory;
window.Item = Item;
window.GameState = GameState;
window.PasswordSystem = PasswordSystem;
window.DebugLogger = DebugLogger;
window.ClueSystemTests = ClueSystemTests;
window.debugLogger = debugLogger;

// 自动运行测试
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 线索系统模块已加载');

    // 添加测试按钮到UI
    setTimeout(() => {
        const controls = document.querySelector('.top-controls');
        if (controls) {
            const testBtn = document.createElement('button');
            testBtn.className = 'ctrl-btn';
            testBtn.id = 'testBtn';
            testBtn.title = '运行单元测试';
            testBtn.textContent = '🧪';
            controls.querySelector('.view-controls').appendChild(testBtn);

            testBtn.addEventListener('click', () => {
                const tests = new ClueSystemTests();
                tests.runAllTests();
            });
        }
    }, 1000);
});
