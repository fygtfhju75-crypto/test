const MODULE_NAME = 'st-system-shop';
let allItems = [];
let currentPage = 1;
const pageSize = 5;
let currentPoints = 5000;

function initShop() {
    console.log("[System Shop] 正在启动暴力注入模式...");
    
    // 1. 加载样式表
    if (!$(`#${MODULE_NAME}-css`).length) {
        const cssLink = document.createElement('link');
        cssLink.id = `${MODULE_NAME}-css`;
        cssLink.rel = 'stylesheet';
        cssLink.href = `/extensions/${MODULE_NAME}/style.css`;
        document.head.appendChild(cssLink);
    }

    // 2. 加载 HTML 界面
    if (!$('#system-shop-window').length) {
        $.get(`/extensions/${MODULE_NAME}/shop.html`)
            .done(html => {
                $('body').append(html);
                bindWindowEvents();
            })
            .fail(err => console.error("[System Shop] HTML 加载失败", err));
    }

    // 3. 加载商品 JSON 数据
    $.getJSON(`/extensions/${MODULE_NAME}/items.json`)
        .done(data => {
            allItems = data;
        })
        .fail(err => console.error("[System Shop] JSON 加载失败", err));

    // 4. UI 轮询注入 (保证 100% 出现入口)
    let retryCount = 0;
    const injectTimer = setInterval(() => {
        retryCount++;
        if (retryCount > 50) clearInterval(injectTimer); // 尝试50次后停止

        // 尝试方案 A: 注入到魔法笔菜单内部
        const wandMenu = $('#extensions_wand_options, #slash_commands_options');
        if (wandMenu.length && !$('#sys-shop-toggle-wand').length) {
            wandMenu.append(`
                <div id="sys-shop-toggle-wand" class="list-group-item flex-container flexGapSm interactable" title="打开系统商城面板">
                    <i class="fa-solid fa-store fa-fw"></i> <span>系统商城</span>
                </div>
            `);
        }

        // 尝试方案 B: 强行在聊天输入框的魔法笔图标旁边加一个快捷图标
        const chatForm = $('#send_form');
        if (chatForm.length && !$('#sys-shop-toggle-chat').length) {
            $('#wand_popup_trigger').after(`
                <div id="sys-shop-toggle-chat" class="fa-solid fa-store interactable" title="系统商城" style="font-size: 1.2em; padding: 10px; cursor: pointer; color: var(--SmartThemeBodyColor); opacity: 0.8;"></div>
            `);
            clearInterval(injectTimer); // 注入成功，停止轮询
            console.log("[System Shop] 成功注入入口按钮！");
        }
    }, 500);

    // 5. 绑定全局点击事件 (代理模式，处理动态生成的按钮)
    $(document).on('click', '#sys-shop-toggle-wand, #sys-shop-toggle-chat', function() {
        toggleShopWindow();
        $('#wand_popup').hide(); // 收起魔法笔菜单
    });
}

function toggleShopWindow() {
    const windowEl = $('#system-shop-window');
    if (windowEl.is(':hidden')) {
        windowEl.show();
        if (currentPage === 1) loadMoreItems(); // 首次打开加载数据
    } else {
        windowEl.hide();
    }
}

function bindWindowEvents() {
    // 关闭按钮
    $('#close-shop-btn').on('click', () => {
        $('#system-shop-window').hide();
    });

    // 窗口拖拽 (SillyTavern 自带 jQuery UI)
    $('#system-shop-window').draggable({
        handle: '.shop-header',
        containment: 'window'
    });

    // 绑定下拉加载
    const listContainer = $('#shop-item-list');
    listContainer.on('scroll', function() {
        // 触底检测
        if ($(this).scrollTop() + $(this).innerHeight() >= $(this)[0].scrollHeight - 15) {
            loadMoreItems();
        }
    });

    // 事件委托：绑定购买按钮 (避免多次绑定)
    $('#shop-item-list').on('click', '.buy-btn', handleBuyItem);
}

function loadMoreItems() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    if (startIndex >= allItems.length) {
        $('#shop-loading-text').text("— 已显示全部商品 —");
        return;
    }

    const nextItems = allItems.slice(startIndex, endIndex);
    const listContainer = $('#shop-item-list');

    nextItems.forEach(item => {
        const itemHtml = `
            <div class="shop-item">
                <div class="item-icon">${item.icon}</div>
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-desc">${item.desc}</div>
                </div>
                <button class="buy-btn" data-name="${item.name}" data-price="${item.price}">
                    ${item.price} 积分
                </button>
            </div>
        `;
        listContainer.append(itemHtml);
    });

    currentPage++;
}

// 购买逻辑与环境响应
function handleBuyItem(e) {
    const btn = $(e.currentTarget);
    const itemName = btn.data('name');
    const itemPrice = parseInt(btn.data('price'));

    if (currentPoints >= itemPrice) {
        currentPoints -= itemPrice;
        $('#shop-points').text(currentPoints);
        
        // 生成客观环境提示，保持主角信息隔离
        const systemPromptText = `宿主 许安 消耗了 ${itemPrice} 积分，成功兑换【${itemName}】。物品已凭空出现在宿主手中。`;
        
        // 绝招：借用聊天输入框发送命令
        const textarea = $('#send_textarea');
        if (textarea.length) {
            const userOldText = textarea.val(); // 记住玩家当前正在输入的话
            
            // 写入系统命令并强制触发发送
            textarea.val(`/sys ${systemPromptText}`);
            $('#send_but').trigger('click');
            
            // 毫秒级恢复玩家原本的输入，做到无感发送
            setTimeout(() => {
                textarea.val(userOldText);
            }, 100);
        }

        toastr.success(`成功购买：${itemName}`, '系统商城');
    } else {
        toastr.warning('积分不足！', '系统商城');
    }
}

// 插件代码加载后立即执行
initShop();
