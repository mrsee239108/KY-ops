// 全局主题管理器
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('systemTheme') || 'dark';
        this.init();
    }

    init() {
        // 应用保存的主题
        this.applyTheme(this.currentTheme);
        
        // 监听主题切换事件
        this.setupThemeListeners();
        
        // 监听存储变化，实现跨页面主题同步
        window.addEventListener('storage', (e) => {
            if (e.key === 'systemTheme') {
                this.currentTheme = e.newValue || 'dark';
                this.applyTheme(this.currentTheme);
                this.updateThemeSelectors();
            }
        });
    }

    setupThemeListeners() {
        // 监听所有主题选择器
        document.addEventListener('change', (e) => {
            if (e.target.id === 'theme-select' || e.target.classList.contains('theme-selector')) {
                this.changeTheme(e.target.value);
            }
        });
    }

    changeTheme(theme) {
        if (theme !== this.currentTheme) {
            this.currentTheme = theme;
            this.applyTheme(theme);
            this.saveTheme(theme);
            this.updateThemeSelectors();
            this.showThemeNotification(theme);
        }
    }

    applyTheme(theme) {
        const body = document.body;
        
        // 移除所有主题类
        body.classList.remove('theme-dark', 'theme-light');
        
        // 应用新主题
        if (theme === 'light') {
            body.classList.add('theme-light');
        } else {
            body.classList.add('theme-dark');
        }
        
        // 更新HTML根元素的data属性，便于CSS选择器使用
        document.documentElement.setAttribute('data-theme', theme);
    }

    saveTheme(theme) {
        localStorage.setItem('systemTheme', theme);
        
        // 触发自定义事件，通知其他组件主题已更改
        window.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: theme }
        }));
    }

    updateThemeSelectors() {
        // 更新所有主题选择器的值
        const selectors = document.querySelectorAll('#theme-select, .theme-selector');
        selectors.forEach(selector => {
            if (selector.value !== this.currentTheme) {
                selector.value = this.currentTheme;
            }
        });
    }

    showThemeNotification(theme) {
        const message = theme === 'light' ? '已切换到浅色主题' : '已切换到深色主题';
        
        // 如果页面有通知系统，使用它
        if (window.showNotification) {
            window.showNotification(message);
        } else if (window.SystemInfoManager && window.SystemInfoManager.showNotification) {
            window.SystemInfoManager.showNotification(message);
        } else {
            // 创建简单的通知
            this.createSimpleNotification(message);
        }
    }

    createSimpleNotification(message) {
        // 移除现有通知
        const existingNotification = document.querySelector('.theme-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // 创建新通知
        const notification = document.createElement('div');
        notification.className = 'theme-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: var(--shadow-primary);
            border: 1px solid var(--border-tertiary);
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            transform: translateX(100%);
        `;

        document.body.appendChild(notification);

        // 动画显示
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // 3秒后自动隐藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // 获取当前主题
    getCurrentTheme() {
        return this.currentTheme;
    }

    // 切换主题（在当前主题和另一个主题之间切换）
    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.changeTheme(newTheme);
    }
}

// 创建全局主题管理器实例
window.themeManager = new ThemeManager();

// 导出给其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}