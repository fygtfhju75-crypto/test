(function() {
    const MODULE_NAME = 'virtual-phone';
    let currentActiveWechatChar = null; 

    // 动态在运行时去抓取酒馆公开的全局变量（防止顶层 import 挂掉）
    function getSillyTavernCore() {
        return window.SillyTavern?.context || window;
    }

    function initStorage() {
        if (!window.ExtensionSettings) window.ExtensionSettings = {};
        if (!window.ExtensionSettings[MODULE_NAME]) {
            window.ExtensionSettings[MODULE_NAME] = {};
        }
        if (!window.ExtensionSettings[MODULE_NAME].wechat_history) {
            window.ExtensionSettings[MODULE_NAME].wechat_history = {}; 
        }
        if (!window.ExtensionSettings[MODULE_NAME].weibo_list) {
            window.ExtensionSettings[MODULE_NAME].weibo_list = [
                { author: "系统新闻公告", content: "今日市内秩序井然，请各位市民遭遇异变切勿惊慌，紧跟安全区指令。" },
                { author: "未知避难所", content: "有人在城西看到林欣了吗？她带走了最后的血清样本！" }
            ];
        }
    }

    function injectPhoneDOM() {
        if (jQuery('#st-phone-trigger-icon').length > 0) return;

        const iconHtml = `<div id="st-phone-trigger-icon" title="打开虚拟手机">📱</div>`;
        jQuery('body').append(iconHtml);

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
        jQuery('body').append(phoneHtml);
        updateClock();
        setInterval(updateClock, 30000);
    }

    function updateClock() {
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        jQuery('#st-phone-clock').text(timeStr);
    }

    function switchScreen(targetScreenName) {
        jQuery('.phone-app-window').hide();
        jQuery(`#phone-app-${targetScreenName}`).show();

        if (targetScreenName === 'wechat-list') renderWechatContacts();
        if (targetScreenName === 'weibo') renderWeiboTimeline();
    }

    function renderWechatContacts() {
        const container = jQuery('#wechat-contacts-container');
        container.empty();
        
        // 兼容性获取角色列表
        const chars = window.characters || [];
        if (chars.length === 0) {
            container.append('<div style="padding:15px; color:#888;">暂无联系人，请先在酒馆导入角色卡</div>');
            return;
        }

        chars.forEach((char) => {
            const history = window.ExtensionSettings[MODULE_NAME].wechat_history[char.name] || [];
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
        jQuery('#wechat-chat-title').text(charName);
        const wall = jQuery('#wechat-msg-wall');
        wall.empty();

        const history = window.ExtensionSettings[MODULE_NAME].wechat_history[charName] || [];
        history.forEach(msg => {
            const bubbleClass = msg.sender === 'user' ? 'user' : 'char';
            wall.append(`<div class="wechat-bubble ${bubbleClass}">${msg.text}</div>`);
        });
        
        wall.scrollTop(wall.prop("scrollHeight"));
    }

    function renderWeiboTimeline() {
        const wall = jQuery('#weibo-timeline-wall');
        wall.empty();
        const list = window.ExtensionSettings[MODULE_NAME].weibo_list;
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

            if (!window.ExtensionSettings[MODULE_NAME].wechat_history[charName]) {
                window.ExtensionSettings[MODULE_NAME].wechat_history[charName] = [];
            }
            window.ExtensionSettings[MODULE_NAME].wechat_history[charName].push({
                sender: 'char',
                text: msgContent
            });
            if (window.saveSettingsDebounced) window.saveSettingsDebounced();

            if (currentActiveWechatChar === charName && jQuery('#phone-app-wechat-chat').is(':visible')) {
                renderWechatChatroom(charName);
            }
        }

        if (textContainer.innerHTML.includes('[微信来信：')) {
            textContainer.innerHTML = textContainer.innerHTML.replace(/\[微信来信：.+?\|.+?\]/g, '<span style="color:#666; font-size:12px; font-style:italic;">（收到一条手机微信，请打开手机查看）</span>');
        }
    }

    async function sendWechatMessage() {
        const inputField = jQuery('#wechat-typed-input');
        const text = inputField.val().trim();
        if (!text || !currentActiveWechatChar) return;

        if (!window.ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar]) {
            window.ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar] = [];
        }

        window.ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar].push({
            sender: 'user',
            text: text
        });
        inputField.val('');
        renderWechatChatroom(currentActiveWechatChar);
        if (window.saveSettingsDebounced) window.saveSettingsDebounced();

        const chars = window.characters || [];
        const targetCharObj = chars.find(c => c.name === currentActiveWechatChar);
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
                
                window.ExtensionSettings[MODULE_NAME].wechat_history[currentActiveWechatChar].push({
                    sender: 'char',
                    text: replyText
                });
                renderWechatChatroom(currentActiveWechatChar);
                if (window.saveSettingsDebounced) window.saveSettingsDebounced();
            }
        } catch (err) {
            console.error("[Virtual Phone] 微信生成失败: ", err);
        }
    }

    // 传统 jQuery 加载逻辑
    jQuery(async () => {
        initStorage();
        injectPhoneDOM();

        const settingsHtml = `
            <div class="virtual_phone_settings_block">
                <h4>📱 虚拟智能手机</h4>
                <button id="st-phone-force-open-btn" class="menu_button">强制唤醒手机</button>
            </div>
        `;
        jQuery('#extensions_settings').append(settingsHtml);

        jQuery('#st-phone-force-open-btn').on('click', () => {
            jQuery('#st-phone-wrapper').toggle(200);
        });

        jQuery(document).on('click', '#st-phone-trigger-icon', () => {
            jQuery('#st-phone-wrapper').toggle(200);
        });

        jQuery('#st-phone-home-btn').on('click', () => {
            currentActiveWechatChar = null;
            switchScreen('desktop');
        });

        jQuery(document).on('click', '.desktop-app-item', function() {
            const dest = jQuery(this).data('target');
            switchScreen(dest);
        });

        jQuery(document).on('click', '.phone-back-nav', function() {
            const to = jQuery(this).data('to');
            switchScreen(to);
        });

        jQuery(document).on('click', '.wechat-contact-item', function() {
            const name = jQuery(this).data('name');
            switchScreen('wechat-chat');
            renderWechatChatroom(name);
        });

        jQuery('#wechat-send-btn').on('click', sendWechatMessage);
        jQuery('#wechat-typed-input').on('keypress', (e) => {
            if (e.which === 13) sendWechatMessage();
        });

        if (window.eventSource && window.event_types) {
            window.eventSource.on(window.event_types.CHARACTER_MESSAGE_RENDERED, handleMessageInterception);
        }

        console.log('==== [Virtual Phone System] 传统兼容模式加载成功 ====');
    });
})();
