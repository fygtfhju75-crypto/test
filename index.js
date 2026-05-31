import { extension_settings } from '../../../extensions.js';
import { getRequestHeaders } from '../../../../script.js';

const MODULE_NAME = 'st-system-shop';
let allItems = [];
let currentPage = 1;
const pageSize = 5; // 每次加载5个以便测试下拉效果
let currentPoints = 5000; // 初始测试积分

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

    // 3. 在右侧顶部工具栏添加商城入口按钮
    const btnHtml = `
        <div id="sys-shop-toggle" class="drawer-icon fa-solid fa-store" title="系统商城" style="cursor: pointer;"></div>
    `;
    $('#extensions-menu').prepend(btnHtml);

    // 4. 获取商品数据
    const itemsResponse = await fetch(`/extensions/${MODULE_NAME}/items.json`);
    allItems = await itemsResponse.json();

    // 5. 绑定事件
    bindEvents();
}

function bindEvents() {
    // 开启/关闭面板
    $('#sys-shop-toggle').on('click', () => {
        const windowEl = $('#system-shop-window');
        if (windowEl.is(':hidden')) {
            windowEl.show();
            if (currentPage === 1) loadMoreItems(); // 首次打开加载数据
        } else {
            windowEl.hide();
        }
    });

    // 关闭按钮
    $('#close-shop-btn').on('click', () => {
        $('#system-shop-window').hide();
    });

    // 窗口拖拽 (利用 ST 内置的 jQuery UI)
    $('#system-shop-window').draggable({
        handle: '.shop-header',
        containment: 'window'
    });

    // 绑定下拉加载
    const listContainer = $('#shop-item-list');
    listContainer.on('scroll', function() {
        // 触底检测
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

    // 绑定购买按钮点击事件（防止重复绑定，用 off 再 on）
    $('.buy-btn').off('click').on('click', handleBuyItem);

    currentPage++;
}

// 购买商品与后置环境响应
async function handleBuyItem(e) {
    const btn = $(e.currentTarget);
    const itemName = btn.data('name');
    const itemPrice = parseInt(btn.data('price'));

    if (currentPoints >= itemPrice) {
        // 1. 扣除积分并更新 UI
        currentPoints -= itemPrice;
        $('#shop-points').text(currentPoints);
        
        // 2. 发送环境提示到对话中 (信息隔离：通过系统发送客观事件，让环境驱动发展)
        const systemPromptText = `[系统提示：宿主 许安 消耗了 ${itemPrice} 积分，成功兑换【${itemName}】。物品已凭空出现在宿主手中。]`;
        
        // 调用 ST 内置方法发送静默系统消息到当前对话
        await fetch('/api/chat/send', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: systemPromptText,
                name: 'System',
                is_system: true // 标记为系统消息
            })
        });

        toastr.success(`成功购买：${itemName}`, '系统商城');
    } else {
        toastr.warning('积分不足！', '系统商城');
    }
}

// 启动插件
jQuery(document).ready(function () {
    initShop();
});
