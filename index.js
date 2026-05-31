// 【彻底去除了 import，使用全局变量解决 404 路径报错问题】

const MODULE_NAME = 'st-system-shop';
let allItems = [];
let currentPage = 1;
const pageSize = 5;
let currentPoints = 5000;

async function initShop() {
    console.log("[System Shop] 正在初始化商城插件...");
    
    // 1. 加载样式表
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = `/extensions/${MODULE_NAME}/style.css`;
    document.head.appendChild(cssLink);

    // 2. 加载 UI HTML 并注入页面
    try {
        const htmlResponse = await fetch(`/extensions/${MODULE_NAME}/shop.html`);
        const htmlText = await htmlResponse.text();
        $('body').append(htmlText);
    } catch (error) {
        console.error("[System Shop] 加载 HTML 失败:", error);
    }

    // 3. 获取商品数据
    try {
        const itemsResponse = await fetch(`/extensions/${MODULE_NAME}/items.json`);
        allItems = await itemsResponse.json();
    } catch (error) {
        console.error("[System Shop] 加载商品 JSON 失败:", error);
    }

    // 4. 将入口按钮注入到“魔法笔”菜单中
    const wandMenuItem = `
        <div id="sys-shop-toggle" class="list-group-item flex-container flexGapSm interactable" title="打开系统商城面板">
            <i class="fa-solid fa-store fa-fw"></i> <span>系统商城</span>
        </div>
    `;
    
    if ($('#extensions_wand_options').length) {
        $('#extensions_wand_options').append(wandMenuItem);
    } else {
        // 备用方案：如果找不到魔法笔菜单，强行塞到右上角扩展栏
        $('#extensions-menu').prepend(`<div id="sys-shop-toggle" class="drawer-icon fa-solid fa-store" title="系统商城"></div>`);
    }

    // 5. 注册斜杠命令 (使用酒馆的全局 SlashCommandParser)
    if (window.SlashCommandParser) {
        window.SlashCommandParser.addCommandObject(window.SlashCommandParser.registerArgumentCommand(
            () => {
                toggleShopWindow();
                return '';
            },
            { helpString: '打开专属系统商城面板' },
            'shop'
        ));
        console.log("[System Shop] /shop 命令注册成功！");
    } else {
        console.warn("[System Shop] 未检测到全局 SlashCommandParser。");
    }

    // 6. 绑定事件
    bindEvents();
}

function toggleShopWindow() {
    const windowEl = $('#system-shop-window');
    if (windowEl.is(':hidden')) {
        windowEl.show();
        if (currentPage === 1) loadMoreItems(); 
    } else {
        windowEl.hide();
    }
}

function bindEvents() {
    // 魔法笔菜单里的按钮
    $('#sys-shop-toggle').on('click', () => {
        toggleShopWindow();
        $('#wand_popup').hide(); // 点击后关闭魔法笔菜单
    });

    // 关闭按钮
    $('#close-shop-btn').on('click', () => {
        $('#system-shop-window').hide();
    });

    // 窗口拖拽
    $('#system-shop-window').draggable({
        handle: '.shop-header',
        containment: 'window'
    });

    // 绑定下拉加载
    const listContainer = $('#shop-item-list');
    listContainer.on('scroll', function() {
        if ($(this).scrollTop() + $(this).innerHeight() >= $(this)[0].scrollHeight - 10) {
            loadMoreItems();
        }
    });
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
                <button class="buy-btn" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">
                    ${item.price} 积分
                </button>
            </div>
        `;
        listContainer.append(itemHtml);
    });

    $('.buy-btn').off('click').on('click', handleBuyItem);
    currentPage++;
}

// 购买商品与后置环境响应
function handleBuyItem(e) {
    const btn = $(e.currentTarget);
    const itemName = btn.data('name');
    const itemPrice = parseInt(btn.data('price'));

    if (currentPoints >= itemPrice) {
        currentPoints -= itemPrice;
        $('#shop-points').text(currentPoints);
        
        // 发送环境提示，作为外部刺激驱动剧情，保持角色信息隔离
        const systemPromptText = `宿主 许安 消耗了 ${itemPrice} 积分，成功兑换【${itemName}】。物品已凭空出现在宿主手中。`;
        
        if (window.SlashCommandParser) {
            window.SlashCommandParser.executeSlash(`/sys ${systemPromptText}`);
        }
        
        toastr.success(`成功购买：${itemName}`, '系统商城');
    } else {
        toastr.warning('积分不足！', '系统商城');
    }
}

// 等待 DOM 加载完毕后启动
jQuery(document).ready(function () {
    initShop();
});
