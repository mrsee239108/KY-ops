class Windows10Desktop {
    constructor() {
        this.startMenuOpen = false;
        this.selectedIcons = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDateTime();
        this.loadSystemStatus();
        
        // 定期更新时间和系统状态
        setInterval(() => this.updateDateTime(), 1000);
        setInterval(() => this.loadSystemStatus(), 30000);
        
        // 初始化主题图标
        setTimeout(() => this.updateThemeIcon(), 100);
    }

    setupEventListeners() {
        // 开始按钮点击事件
        document.getElementById('start-button').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStartMenu();
        });

        // 点击其他地方关闭开始菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.start-menu') && !e.target.closest('.start-button')) {
                this.closeStartMenu();
            }
        });

        // 桌面图标双击事件
        document.querySelectorAll('.desktop-icon').forEach(icon => {
            icon.addEventListener('dblclick', (e) => {
                this.openApplication(e.currentTarget.dataset.app);
            });

            icon.addEventListener('click', (e) => {
                this.selectIcon(e.currentTarget, e.ctrlKey);
            });
        });

        // 磁贴点击事件
        document.querySelectorAll('.tile[data-app]').forEach(tile => {
            tile.addEventListener('click', (e) => {
                this.openApplication(e.currentTarget.dataset.app);
                this.closeStartMenu();
            });
        });

        // 应用项点击事件
        document.querySelectorAll('.app-item[data-app]').forEach(item => {
            item.addEventListener('click', (e) => {
                this.openApplication(e.currentTarget.dataset.app);
                this.closeStartMenu();
            });
        });

        // 任务栏图标点击事件
        document.querySelectorAll('.taskbar-icon').forEach((icon, index) => {
            icon.addEventListener('click', (e) => {
                this.handleTaskbarIconClick(e.currentTarget, index);
            });
        });

        // 右键菜单事件
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.desktop-background') && !e.target.closest('.desktop-icon')) {
                e.preventDefault();
                this.showContextMenu(e);
            }
        });

        // 隐藏右键菜单
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // 搜索框事件
        const searchInput = document.querySelector('.search-box input');
        searchInput.addEventListener('focus', () => {
            searchInput.parentElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        });

        searchInput.addEventListener('blur', () => {
            searchInput.parentElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(e.target.value);
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeStartMenu();
                this.hideContextMenu();
                this.clearSelection();
            }
            
            if (e.ctrlKey && e.key === 'a') {
                e.preventDefault();
                this.selectAllIcons();
            }
        });

        // 电源按钮事件
        document.querySelector('.power-button').addEventListener('click', () => {
            this.showPowerOptions();
        });

        // 主题切换按钮事件
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }

    updateDateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('zh-CN', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
        const dateString = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        document.getElementById('current-time').textContent = timeString;
        document.getElementById('current-date').textContent = dateString;
    }

    async loadSystemStatus() {
        try {
            const response = await fetch('/api/system-status');
            const data = await response.json();
            
            // 这里可以更新系统状态显示
            console.log('系统状态:', data);
        } catch (error) {
            console.error('获取系统状态失败:', error);
        }
    }

    toggleStartMenu() {
        const startMenu = document.getElementById('start-menu');
        const startButton = document.getElementById('start-button');
        
        if (this.startMenuOpen) {
            this.closeStartMenu();
        } else {
            this.openStartMenu();
        }
    }

    openStartMenu() {
        const startMenu = document.getElementById('start-menu');
        const startButton = document.getElementById('start-button');
        
        startMenu.classList.add('show');
        startButton.classList.add('active');
        this.startMenuOpen = true;
    }

    closeStartMenu() {
        const startMenu = document.getElementById('start-menu');
        const startButton = document.getElementById('start-button');
        
        startMenu.classList.remove('show');
        startButton.classList.remove('active');
        this.startMenuOpen = false;
    }

    openApplication(appName) {
        console.log(`打开应用: ${appName}`);
        
        // 获取应用URL
        const appUrl = this.getAppUrl(appName);
        if (!appUrl) {
            this.showNotification('应用', `${appName} 功能开发中...`);
            return;
        }
        
        // 直接在当前页面跳转到应用页面
        window.location.href = appUrl;
    }
    
    getAppUrl(appName) {
        const appUrls = {
            'system-info': '/system-info',
            'file-manager': '/file-manager',
            'task-manager': '/task-manager',
            'performance-monitor': '/performance-monitor',
            'network-monitor': '/network-monitor',
            'security-center': '/security-center',
            'terminal': '/terminal',
            'ai-chat': '/ai-chat',
            'settings': '/settings'
        };
        
        if (appName === 'recycle') {
            this.showNotification('回收站', '回收站为空');
            return null;
        }
        
        return appUrls[appName] || null;
    }
    
    // 添加关闭所有窗口的方法（现在为空实现，因为不再使用多窗口）
    closeAllWindows() {
        // 不再需要关闭窗口，因为我们使用单页面导航
        console.log('单页面模式下无需关闭窗口');
    }
    
    selectIcon(icon, multiSelect = false) {
        if (!multiSelect) {
            this.clearSelection();
        }
        
        icon.classList.add('selected');
        if (!this.selectedIcons.includes(icon)) {
            this.selectedIcons.push(icon);
        }
    }

    clearSelection() {
        this.selectedIcons.forEach(icon => {
            icon.classList.remove('selected');
        });
        this.selectedIcons = [];
    }

    selectAllIcons() {
        const icons = document.querySelectorAll('.desktop-icon');
        icons.forEach(icon => {
            icon.classList.add('selected');
            if (!this.selectedIcons.includes(icon)) {
                this.selectedIcons.push(icon);
            }
        });
    }

    handleTaskbarIconClick(icon, index) {
        // 切换任务栏图标的活动状态
        document.querySelectorAll('.taskbar-icon').forEach(i => {
            i.classList.remove('active');
        });
        icon.classList.add('active');
        
        // 根据图标索引执行相应操作
        switch(index) {
            case 0: // 文件资源管理器
                this.openApplication('file-manager');
                break;
            case 1: // 设置
                this.openApplication('settings');
                break;
            default:
                console.log('未知的任务栏图标:', index);
        }
    }

    showContextMenu(event) {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;

        // 确保菜单不会超出屏幕
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = `${event.pageX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = `${event.pageY - rect.height}px`;
        }

        // 添加菜单项点击事件
        contextMenu.querySelectorAll('.menu-item').forEach(item => {
            item.onclick = () => {
                this.handleContextMenuAction(item.textContent.trim());
                this.hideContextMenu();
            };
        });
    }

    hideContextMenu() {
        document.getElementById('context-menu').style.display = 'none';
    }

    handleContextMenuAction(action) {
        switch(action) {
            case '刷新':
                location.reload();
                break;
            case '个性化':
                this.showNotification('个性化', '个性化设置功能开发中...');
                break;
            case '窗口管理':
                this.showWindowManager();
                break;
            case '关闭所有窗口':
                this.showNotification('窗口管理', '当前使用单页面模式，无需关闭窗口');
                break;
            default:
                console.log(`执行操作: ${action}`);
        }
    }
    
    showWindowManager() {
        this.showNotification('窗口管理', '当前使用单页面模式，无需管理多个窗口');
    }

    performSearch(query) {
        if (query.trim()) {
            this.showNotification('搜索', `搜索: ${query}`);
            // 这里可以实现实际的搜索功能
        }
    }

    showPowerOptions() {
        const choice = prompt('电源选项:\n1. 睡眠\n2. 重新启动\n3. 关机\n4. 取消\n\n请输入数字:');
        
        switch(choice) {
            case '1':
                this.showNotification('系统', '进入睡眠模式...');
                break;
            case '2':
                this.showNotification('系统', '正在重新启动...');
                break;
            case '3':
                this.showNotification('系统', '正在关机...');
                break;
            default:
                break;
        }
    }

    showNotification(title, message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div class="notification-header">
                <strong>${title}</strong>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-body">${message}</div>
        `;

        // 添加通知样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: rgba(40, 40, 40, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 16px;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 3000;
            animation: slideInRight 0.3s ease-out;
        `;

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            .notification-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                width: 20px;
                height: 20px;
            }
            .notification-body {
                font-size: 14px;
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // 关闭按钮事件
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // 3秒后自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // 主题切换方法
    toggleTheme() {
        if (window.themeManager) {
            window.themeManager.toggleTheme();
            this.updateThemeIcon();
        }
    }

    // 更新主题图标
    updateThemeIcon() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn && window.themeManager) {
            const icon = themeToggleBtn.querySelector('i');
            const isDark = window.themeManager.getCurrentTheme() === 'dark';
            
            if (isDark) {
                icon.className = 'fas fa-moon';
                themeToggleBtn.title = '切换到浅色模式';
            } else {
                icon.className = 'fas fa-sun';
                themeToggleBtn.title = '切换到深色模式';
            }
        }
    }
}

// 初始化桌面
document.addEventListener('DOMContentLoaded', () => {
    new Windows10Desktop();
});