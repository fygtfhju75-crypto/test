import { eventSource, event_types, characters, getContext } from '../../../script.js';
import { ExtensionSettings, saveSettingsDebounced } from '../../extensions.js';

const MODULE_NAME = 'virtual-phone';
let currentActiveWechatChar = null; // 当前正在微信畅聊的角色名

// 1. 初始化本地持久化配置
function initStorage() {
    if (!ExtensionSettings[MODULE_NAME]) {
        ExtensionSettings[MODULE_NAME] = {};
    }
    if (!ExtensionSettings[MODULE_NAME].wechat_history) {
        ExtensionSettings[MODULE_NAME].wechat_history = {}; // 存储结构: { "角色名": [{sender: 'user'/'char', text: '内容'}] }
    }
    if (!ExtensionSettings[MODULE_NAME].weibo_list) {
        // 初始化一些世界观背景的朋友圈/微博动态
        ExtensionSettings[MODULE_NAME].weibo_list = [
            { author: "系统新闻公告", content: "今日市内秩序井然，请各位市民遭遇异变切勿惊慌，紧跟安全区指令。" },
            { author: "未知避难所", content: "有人在城西看到林欣了吗？她带走了最后的血清样本！" }
        ];
    }
}

// 2. 渲染主骨架 HTML 结构
function injectPhoneDOM() {
    // 注入快捷悬浮图标
    const iconHtml = `<div id="st-phone-trigger-icon" title="打开虚拟手机">📱</div>`;
    $('body').append(iconHtml);

    // 注入手机本体
    const phoneHtml = `
        <div id="st-phone-wrapper" style="display: none;">
            <div class="phone-top-bar">
                <span>中国移动 5G</span>
                <span id="st-phone-clock">12:00</span>
            </div>
            
            <div class="phone-screen-content">
                
                <div id="phone-app-desktop" class="phone-app-window">
                    <div class="phone-grid-desktop">
                        <div class="desktop-app-item" data-target="wechat-list">
                            <div class="app-icon" style="background:#07c160;">🟢</div>
                            <span>微信</span>
                        </div>
                        <div class="desktop-app-item" data-target="weibo">
                            <div class="app-icon" style="background:#ff8200;">🔴</div>
                            <span>微博</span>
                        </div>
                    </div>
                </div>

                <div id="phone-app-wechat-list" class="phone-app-window" style="display:none;">
                    <div class="wechat-header">
                        <span class="phone-back-nav" data-to="desktop">◀ 桌面</span>
                        <span>微信</span>
                    </div>
                    <div id="wechat-contacts-container" style="overflow-y:auto; flex:1;"></div>
                </div>

                <div id="phone-app-wechat-chat" class="phone-app-window" style="display:none;">
                    <div class="wechat-header">
                        <span class="phone-back-nav" data-to="wechat-list">◀ 返回</span>
                        <span id="wechat-chat-title">未定义</span>
                    </div>
                    <div class="wechat-msg-list" id="wechat-msg-wall"></div>
                    <div class="wechat-input-area">
                        <input type="text" id="wechat-typed-input" placeholder="发送新消息..." />
                        <button id="wechat-send-btn">发送</button>
                    </div>
                </div>

                <div id="phone-app-weibo" class="phone-app-window" style="display:none;">
                    <div class="weibo-header">
                        <span class="phone-back-nav" data-to="desktop">◀ 桌面</span>
                        <span>微博热搜动态</span>
                    </div>
                    <div class="weibo-timeline" id="weibo-timeline-wall"></div>
                </div>

            </div>

            <div class="phone-bottom-home" id="st-phone-home-btn">
                <div class="phone-bottom-home-bar"></div>
            </div>
        </div>
    `;
    $('body').append(phoneHtml);
    updateClock();
    setInterval(updateClock, 30000);
}

// 更新手机系统时间
function updateClock() {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    $('#st-phone-clock').text(timeStr);
}

// 3. UI 导航与渲染引擎逻辑
function switchScreen(targetScreenName) {
    $('.phone-app-window').hide();
    $(`#phone-app-${targetScreenName}`).show();

    if (targetScreenName === 'wechat-list') renderWechatContacts();
    if (targetScreenName === 'weibo') renderWeiboTimeline();
}

// 渲染微信联系人
function renderWechatContacts() {
    const container = $('#wechat-contacts-container');
    container.empty();
    
    // 获取酒馆中所有已导入的角色卡作为联系人
    characters.forEach((char, index) => {
        const history = ExtensionSettings[MODULE_NAME].wechat_history[char.name] || [];
        const lastMsg = history.length > 0 ? history[history.length - 1].text : '[暂无新聊天动态]';
        
        const itemHtml = `
            <div class="wechat-contact-item" data-name="${char.name}" style="display:flex; align-items:center; padding:12px 15px; border-bottom:1px solid #222; cursor:pointer;">
                <div style="width:40px; height:40px; border-radius:6px; background:#444; margin-right:12px; display:flex; justify-content:center; align-items:center; font-size:20px;">👤</div>
                <div style="flex:1; overflow:hidden;">
                    <div style="font-size:14px; font-weight:bold; color:#fff;">${char.name}</div>
                    <div style="font-size:12px; color:#888; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; margin-top:3px;">${lastMsg}</div>
                </div>
            </div>
        `;
        container.append(itemHtml);
    });
}

// 渲染特定角色的微信会话气泡
function renderWechatChatroom(charName) {
    currentActiveWechatChar = charName;
    $('#wechat-chat-title').text(charName);
    const wall = $('#wechat-msg-wall');
    wall.empty();

    const history = ExtensionSettings[MODULE_NAME].wechat_history[charName] || [];
    history.forEach(msg => {
        const bubbleClass = msg.sender === 'user' ? 'user' : 'char';
        wall.append(`<div class="wechat-bubble ${bubbleClass}">${msg.text}</div>`);
    });
    
    // 滚动到底部
    wall.scrollTop(wall.prop("scrollHeight"));
}

// 渲染微博信息流
function renderWeiboTimeline() {
    const wall = $('#weibo-timeline-wall');
    wall.empty();
    const list = ExtensionSettings[MODULE_NAME].weibo_list;
    list.forEach(item => {
        wall.append(`
            <div class="weibo-card">
                <div class="weibo-author">@${item.author}</div>
                <div class="weibo-body">${item.content}</div>
            </div>
        `);
    });
}

// 4. 后置响应核心：拦截酒馆大模型主轨，捕获“暗桩控制指令”
// 规则：当大模型输出 `[微信来信: 名字|消息]` 时，剥离此内容并推送到手机内
function handleMessageInterception(messageId) {
    // 获取刚刚渲染完的最新一条 DOM
    const element = document.querySelector(`[data-id="${messageId}"]`);
    if (!element) return;
    const textContainer = element.querySelector('.mes_text');
    if (!textContainer) return;

    let rawText = textContainer.innerHTML;
    // 匹配标签格式：[微信来信: 角色名|具体消息内容]
    const commandRegex = /\[微信来信：(.+?)\|(.+?)\]/g;
    let match;

    while ((match = commandRegex.exec(rawText)) !== null) {
        const charName = match[1].trim();
        const msgContent = match[2].trim();

        // 1. 将数据塞入插件沙盒存储
        if (!ExtensionSettings[MODULE_NAME].wechat_history[charName]) {
            ExtensionSettings[MODULE_NAME].wechat_history[charName] = [];
        }
        ExtensionSettings[MODULE_NAME].wechat_history[charName].push({
            sender: 'char',
            text: msgContent
        });
        saveSettingsDebounced();

        // 2. 如果此时玩家正开着该角色的手机微信聊天内页，实时为他刷新视图
        if (currentActiveWechatChar === charName && $('#phone-app-wechat-chat').is(':visible')) {
            renderWechatChatroom(charName);
        }
    }

    // 3. 后置清洁：将这类控制信令从主聊天的公用屏幕上悄悄擦除，对用户保持剧情隐蔽
    if (commandRegex.test(textContainer.innerHTML)) {
        textContainer.innerHTML = textContainer.innerHTML.replace(/\[微信来信：.+?\|.+?\]/g, '<span style="color:#666; font-size:12px; font-style:italic;">（收到一条手机微信，请打开手机查看）</span>');
    }
}

// 5. 手机端独立主动给 AI 发微信的事件处理
async function sendWechatMessage() {
    const inputField = $('#wechat-typed-input');
    const text = inputField.val().trim();
    if (!text || !currentActiveWechatChar) return;

    // A. 塞入用户气泡并上屏
    ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar].push({
        sender: 'user',
        text: text
    });
    inputField.val('');
    renderWechatChatroom(currentActiveWechatChar);
    saveSettingsDebounced();

    // B. 【沙盒独立思考调用】借助酒馆上下文向对应角色发起暗度陈仓的静默 Prompt
    const context = getContext();
    const targetCharObj = characters.find(c => c.name === currentActiveWechatChar);
    
    if (!targetCharObj) {
        setTimeout(() => {
            ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar].push({ sender: 'char', text: '[系统提示: 该联系人已不在服务区]' });
            renderWechatChatroom(currentActiveWechatChar);
        }, 1000);
        return;
    }

    // 构造一个不打扰主线剧情的临时 OOC 指令，强制其在微信沙盒内用角色卡人设进行回复
    const silentPrompt = `【系统通知：当前处于虚拟手机微信聊天沙盒环境，请你完全站在你的人设、记忆和立场上，针对玩家发来的微信进行一行字的短回复。微信内容如下："${text}"】`;
    
    try {
        // 调用 SillyTavern 原生底层 API 发起单次会话请求
        const response = await fetch('/api/character/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character: targetCharObj.name,
                prompt: silentPrompt,
                // 复用用户当前的 API endpoints 与设定
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            const replyText = data.reply || "（对方暂未回复）";
            
            ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar].push({
                sender: 'char',
                text: replyText
            });
            renderWechatChatroom(currentActiveWechatChar);
            saveSettingsDebounced();
        }
    } catch (err) {
        console.error("[Virtual Phone] 跨域调用独立微信生成失败: ", err);
    }
}

// 6. 绑定 UI 与全局生命周期钩子
jQuery(async () => {
    initStorage();
    injectPhoneDOM();

    // 开关手机主面板
    $('#st-phone-trigger-icon').on('click', () => {
        $('#st-phone-wrapper').toggle(200);
    });

    // 虚拟底座 Home 键返回桌面
    $('#st-phone-home-btn').on('click', () => {
        currentActiveWechatChar = null;
        switchScreen('desktop');
    });

    // 导航项点击
    $(document).on('click', '.desktop-app-item', function() {
        const dest = $(this).data('target');
        switchScreen(dest);
    });

    $(document).on('click', '.phone-back-nav', function() {
        const to = $(this).data('to');
        switchScreen(to);
    });

    // 点击微信列表里的某个人，进入专属聊天室
    $(document).on('click', '.wechat-contact-item', function() {
        const name = $(this).data('name');
        switchScreen('wechat-chat');
        renderWechatChatroom(name);
    });

    // 微信发送事件绑定
    $('#wechat-send-btn').on('click', sendWechatMessage);
    $('#wechat-typed-input').on('keypress', (e) => {
        if (e.which === 13) sendWechatMessage();
    });

    // 核心事件：监听 AI 在大本营主线输出的消息渲染，捕捉微信短信
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleMessageInterception);

    console.log('==== [Virtual Phone System] 全功能拟真手机系统加载成功 ====');
});
