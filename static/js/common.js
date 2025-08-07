// 通用工具类 - 统一的Windows 10风格交互
class CommonUtils {
    constructor() {
        this.notifications = [];
        this.modals = [];
        this.init();
    }

    init() {
        this.setupGlobalEventListeners();
        this.initializeTooltips();
        this.setupKeyboardShortcuts();
    }

    setupGlobalEventListeners() {
        // 全局点击事件处理
        document.addEventListener('click', (e) => {
            this.handleGlobalClick(e);
        });

        // 全局键盘事件处理
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });

        // 窗口大小改变事件
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
    }

    handleGlobalClick(e) {
        // 关闭所有下拉菜单和上下文菜单
        const dropdowns = document.querySelectorAll('.dropdown-menu.show');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        const contextMenus = document.querySelectorAll('.context-menu');
        contextMenus.forEach(menu => {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }

    handleGlobalKeydown(e) {
        // ESC键关闭模态框
        if (e.key === 'Escape') {
            this.closeTopModal();
        }

        // Ctrl+R 刷新页面
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            this.refreshCurrentView();
        }
    }

    handleWindowResize() {
        // 重新计算模态框位置
        this.repositionModals();
        
        // 触发自定义事件
        window.dispatchEvent(new CustomEvent('windowResized'));
    }

    // 通知系统
    showNotification(message, type = 'info', duration = 3000) {
        const notification = this.createNotificationElement(message, type);
        document.body.appendChild(notification);
        
        // 添加到通知列表
        this.notifications.push(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // 自动关闭
        setTimeout(() => {
            this.closeNotification(notification);
        }, duration);

        return notification;
    }

    createNotificationElement(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${icon}"></i>
                <span class="notification-message">${message}</span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // 关闭按钮事件
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.closeNotification(notification);
        });

        return notification;
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-triangle',
            warning: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    closeNotification(notification) {
        notification.classList.add('closing');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications = this.notifications.filter(n => n !== notification);
        }, 300);
    }

    // 模态框系统
    showModal(content, options = {}) {
        const modal = this.createModalElement(content, options);
        document.body.appendChild(modal);
        
        // 添加到模态框列表
        this.modals.push(modal);
        
        // 显示动画
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // 焦点管理
        this.trapFocus(modal);

        return modal;
    }

    createModalElement(content, options) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        const modalDialog = document.createElement('div');
        modalDialog.className = `modal ${options.size || ''}`;
        
        modalDialog.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${options.title || '对话框'}</h3>
                <button class="modal-close" type="button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
        `;

        modal.appendChild(modalDialog);

        // 关闭事件
        const closeBtn = modalDialog.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => {
            this.closeModal(modal);
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        return modal;
    }

    closeModal(modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            this.modals = this.modals.filter(m => m !== modal);
        }, 300);
    }

    closeTopModal() {
        if (this.modals.length > 0) {
            const topModal = this.modals[this.modals.length - 1];
            this.closeModal(topModal);
        }
    }

    repositionModals() {
        this.modals.forEach(modal => {
            // 重新计算模态框位置逻辑
            const dialog = modal.querySelector('.modal');
            if (dialog) {
                // 确保模态框在视口内
                const rect = dialog.getBoundingClientRect();
                if (rect.bottom > window.innerHeight) {
                    dialog.style.marginTop = '20px';
                }
            }
        });
    }

    trapFocus(element) {
        const focusableElements = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        element.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });

        firstElement.focus();
    }

    // 工具提示系统
    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            this.setupTooltip(element);
        });
    }

    setupTooltip(element) {
        let tooltip = null;

        element.addEventListener('mouseenter', () => {
            const text = element.getAttribute('data-tooltip');
            if (!text) return;

            tooltip = this.createTooltipElement(text);
            document.body.appendChild(tooltip);
            this.positionTooltip(tooltip, element);
        });

        element.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        });
    }

    createTooltipElement(text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        return tooltip;
    }

    positionTooltip(tooltip, element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let top = rect.bottom + 8;
        let left = rect.left + (rect.width - tooltipRect.width) / 2;

        // 确保工具提示在视口内
        if (left < 8) left = 8;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        if (top + tooltipRect.height > window.innerHeight - 8) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    }

    // 键盘快捷键系统
    setupKeyboardShortcuts() {
        this.shortcuts = new Map();
        
        // 默认快捷键
        this.registerShortcut('ctrl+shift+i', () => {
            console.log('开发者工具快捷键被按下');
        });
    }

    registerShortcut(combination, callback) {
        this.shortcuts.set(combination, callback);
    }

    // 加载状态管理
    showLoading(element, text = null) {
        // 如果没有提供文本，使用翻译系统
        if (!text) {
            text = window.languageManager ? window.languageManager.t('loading') : '加载中...';
        }
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${text}</div>
            </div>
        `;

        if (element) {
            element.style.position = 'relative';
            element.appendChild(loading);
        } else {
            document.body.appendChild(loading);
        }

        return loading;
    }

    hideLoading(loading) {
        if (loading && loading.parentNode) {
            loading.parentNode.removeChild(loading);
        }
    }

    // 数据格式化工具
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    formatPercentage(value, total) {
        if (total === 0) return '0%';
        return ((value / total) * 100).toFixed(1) + '%';
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // 动画工具
    animateValue(element, start, end, duration = 1000) {
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = start + (end - start) * this.easeOutCubic(progress);
            element.textContent = Math.round(current);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    // 防抖和节流
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 刷新当前视图
    refreshCurrentView() {
        const event = new CustomEvent('refreshView');
        window.dispatchEvent(event);
        this.showNotification('页面已刷新', 'success', 1500);
    }

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('已复制到剪贴板', 'success', 1500);
            return true;
        } catch (err) {
            console.error('复制失败:', err);
            this.showNotification('复制失败', 'error', 2000);
            return false;
        }
    }

    // 下载文件
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // 获取系统主题
    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // 设置主题
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    // 初始化主题
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = this.getSystemTheme();
        const theme = savedTheme || systemTheme;
        this.setTheme(theme);
    }
}

// 创建全局实例
window.commonUtils = new CommonUtils();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.commonUtils.initializeTheme();
    
    // 添加全局样式
    if (!document.getElementById('common-styles')) {
        const style = document.createElement('style');
        style.id = 'common-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 3000;
                transform: translateX(100%);
                transition: transform 0.3s ease-out;
                max-width: 350px;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification.closing {
                transform: translateX(100%);
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .notification-message {
                flex: 1;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                opacity: 0.7;
                transition: opacity 0.2s ease;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
            
            .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                opacity: 0;
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                transition: opacity 0.3s ease-out;
            }
            
            .modal-overlay.show {
                opacity: 1;
            }
            
            .modal-overlay.closing {
                opacity: 0;
            }
            
            .tooltip {
                position: absolute;
                background-color: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 4000;
                pointer-events: none;
            }
            
            .tooltip::before {
                content: '';
                position: absolute;
                top: -4px;
                left: 50%;
                transform: translateX(-50%);
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-bottom: 4px solid rgba(0, 0, 0, 0.9);
            }
        `;
        document.head.appendChild(style);
    }
});