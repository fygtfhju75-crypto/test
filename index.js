import { extension_settings } from '../../../extensions.js';
import { getRequestHeaders } from '../../../../script.js';
import { SlashCommandParser } from '../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../slash-commands/SlashCommand.js';

const MODULE_NAME = 'st-system-shop';
let allItems = [];
let currentPage = 1;
const pageSize = 5;
let currentPoints = 5000;

async function initShop() {
    // 1. 加载样式表
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = `/extensions/${MODULE_NAME}/style.css`;
    document.head.appendChild(cssLink);

    // 2. 加载 UI HTML 并注入页面
    const htmlResponse = await fetch(`/extensions/${MODULE_NAME}/shop.html`);
    const htmlText = await htmlResponse.text();
    $('body').append(htmlText);

    // 3. 获取商品数据
    const itemsResponse = await fetch(`/extensions/${MODULE_NAME}/items.json`);
    allItems = await itemsResponse.json();

    // 4. 将入口按钮注入到“魔法笔”菜单中
    // 酒馆的魔法笔菜单通常是 #extensions_wand_options 或 #slash_commands_options
    const wandMenuItem = `
        <div id="sys-shop-toggle" class="list-group-item flex-container flexGapSm interactable" title="打开系统商城面板">
            <i class="fa-solid fa-store fa-fw"></i> <span>系统商城</span>
        </div>
    `;
    
    // 兼容不同版本的酒馆魔法笔菜单
    if ($('#extensions_wand_options').length) {
        $('#extensions_wand_options').append(wandMenuItem);
    } else if ($('#slash_commands_options').length) {
        $('#slash_commands_options').append(wandMenuItem);
    } else {
        // 如果实在找不到，作为一个独立小按钮放在发送按钮旁边
        $('#send_form').append(`<div id="sys-shop-toggle" class="fa-solid fa-store interactable" style="font-size:1.5em; padding: 10px; cursor: pointer;"></div>`);
    }

    // 5. 注册斜杠命令 (输入 /shop 也能打开商城)
    SlashCommandParser.addCommandObject(SlashCommandParser.registerArgumentCommand(
        () => {
            toggleShopWindow();
            return '';
        },
        {
            helpString: '打开专属系统商城面板',
        },
        'shop'
    ));

    // 6. 绑定事件
    bindEvents();
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

function bindEvents() {
    // 开启/关闭面板 (魔法笔菜单里的按钮)
    $('#sys-shop-toggle').on('click', () => {
        toggleShopWindow();
        // 点击后自动关闭魔法笔菜单
        $('#wand_popup').hide();
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
async function handleBuyItem(e) {
    const btn = $(e.currentTarget);
    const itemName = btn.data('name');
    const itemPrice = parseInt(btn.data('price'));

    if (currentPoints >= itemPrice) {
        currentPoints -= itemPrice;
        $('#shop-points').text(currentPoints);
        
        // 发送环境提示到对话中，不操纵角色主观视角
        const systemPromptText = `[系统提示：宿主 许安 消耗了 ${itemPrice} 积分，成功兑换【${itemName}】。物品已凭空出现在宿主手中。]`;
        
        await fetch('/api/chat/send', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: systemPromptText,
                name: 'System',
                is_system: true
            })
        });

        toastr.success(`成功购买：${itemName}`, '系统商城');
    } else {
        toastr.warning('积分不足！', '系统商城');
    }
}

jQuery(document).ready(function () {
    initShop();
});
