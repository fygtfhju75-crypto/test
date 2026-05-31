import { eventSource, event_types, characters, getContext } from '../../../script.js';
import { ExtensionSettings, saveSettingsDebounced } from '../../extensions.js';

const MODULE_NAME = 'virtual-phone';
let currentActiveWechatChar = null; 

function initStorage() {
    if (!ExtensionSettings[MODULE_NAME]) {
        ExtensionSettings[MODULE_NAME] = {};
    }
    if (!ExtensionSettings[MODULE_NAME].wechat_history) {
        ExtensionSettings[MODULE_NAME].wechat_history = {}; 
    }
    if (!ExtensionSettings[MODULE_NAME].weibo_list) {
        ExtensionSettings[MODULE_NAME].weibo_list = [
            { author: "系统新闻公告", content: "今日市内秩序井然，请各位市民遭遇异变切勿惊慌，紧跟安全区指令。" },
            { author: "未知避难所", content: "有人在城西看到林欣了吗？她带走了最后的血清样本！" }
        ];
    }
}

function injectPhoneDOM() {
    // 防止重复注入
    if ($('#st-phone-trigger-icon').length > 0) return;

    const iconHtml = `<div id="st-phone-trigger-icon" title="打开虚拟手机">📱</div>`;
    $('body').append(iconHtml);

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

function updateClock() {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    $('#st-phone-clock').text(timeStr);
}

function switchScreen(targetScreenName) {
    $('.phone-app-window').hide();
    $(`#phone-app-${targetScreenName}`).show();

    if (targetScreenName === 'wechat-list') renderWechatContacts();
    if (targetScreenName === 'weibo') renderWeiboTimeline();
}

function renderWechatContacts() {
    const container = $('#wechat-contacts-container');
    container.empty();
    
    if (!characters || characters.length === 0) {
        container.append('<div style="padding:15px; color:#888;">暂无联系人，请先在酒馆导入角色卡</div>');
        return;
    }

    characters.forEach((char) => {
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
    
    wall.scrollTop(wall.prop("scrollHeight"));
}

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

function handleMessageInterception(messageId) {
    const element = document.querySelector(`[data-id="${messageId}"]`);
    if (!element) return;
    const textContainer = element.querySelector('.mes_text');
    if (!textContainer) return;

    const commandRegex = /\[微信来信：(.+?)\|(.+?)\]/g;
    let match;

    while ((match = commandRegex.exec(textContainer.innerHTML)) !== null) {
        const charName = match[1].trim();
        const msgContent = match[2].trim();

        if (!ExtensionSettings[MODULE_NAME].wechat_history[charName]) {
            ExtensionSettings[MODULE_NAME].wechat_history[charName] = [];
        }
        ExtensionSettings[MODULE_NAME].wechat_history[charName].push({
            sender: 'char',
            text: msgContent
        });
        saveSettingsDebounced();

        if (currentActiveWechatChar === charName && $('#phone-app-wechat-chat').is(':visible')) {
            renderWechatChatroom(charName);
        }
    }

    if (textContainer.innerHTML.includes('[微信来信：')) {
        textContainer.innerHTML = textContainer.innerHTML.replace(/\[微信来信：.+?\|.+?\]/g, '<span style="color:#666; font-size:12px; font-style:italic;">（收到一条手机微信，请打开手机查看）</span>');
    }
}

async function sendWechatMessage() {
    const inputField = $('#wechat-typed-input');
    const text = inputField.val().trim();
    if (!text || !currentActiveWechatChar) return;

    if (!ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar]) {
        ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar] = [];
    }

    ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar].push({
        sender: 'user',
        text: text
    });
    inputField.val('');
    renderWechatChatroom(currentActiveWechatChar);
    saveSettingsDebounced();

    const targetCharObj = characters.find(c => c.name === currentActiveWechatChar);
    if (!targetCharObj) return;

    const silentPrompt = `【系统通知：当前处于虚拟手机微信聊天沙盒环境，请你完全站在你的人设、记忆和立场上，针对玩家发来的微信进行一行字的短回复。微信内容如下："${text}"】`;
    
    try {
        const response = await fetch('/api/character/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                character: targetCharObj.name,
                prompt: silentPrompt,
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
        console.error("[Virtual Phone] 微信生成失败: ", err);
    }
}

// 核心初始化入口
jQuery(async () => {
    initStorage();
    injectPhoneDOM();

    // 这一步是将你的插件注册到右侧的 Extensions 下拉菜单中
    const settingsHtml = `
        <div class="virtual_phone_settings_block">
            <h4>📱 虚拟智能手机</h4>
            <p style="font-size:12px; color:#aaa;">插件已在右下角挂载。如果找不到手机图标，可以点击下方按钮强制呼出：</p>
            <button id="st-phone-force-open-btn" class="menu_button menu_button_icon">强制唤醒手机</button>
        </div>
    `;
    $('#extensions_settings').append(settingsHtml);

    // 绑定强制唤醒按钮
    $('#st-phone-force-open-btn').on('click', () => {
        $('#st-phone-wrapper').toggle(200);
    });

    // 悬浮图标点击
    $(document).on('click', '#st-phone-trigger-icon', () => {
        $('#st-phone-wrapper').toggle(200);
    });

    $('#st-phone-home-btn').on('click', () => {
        currentActiveWechatChar = null;
        switchScreen('desktop');
    });

    $(document).on('click', '.desktop-app-item', function() {
        const dest = $(this).data('target');
        switchScreen(dest);
    });

    $(document).on('click', '.phone-back-nav', function() {
        const to = $(this).data('to');
        switchScreen(to);
    });

    $(document).on('click', '.wechat-contact-item', function() {
        const name = $(this).data('name');
        switchScreen('wechat-chat');
        renderWechatChatroom(name);
    });

    $('#wechat-send-btn').on('click', sendWechatMessage);
    $('#wechat-typed-input').on('keypress', (e) => {
        if (e.which === 13) sendWechatMessage();
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleMessageInterception);

    console.log('==== [Virtual Phone System] 全功能拟真手机系统加载成功 ====');
});
