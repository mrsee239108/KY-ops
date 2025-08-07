const alertNotificationContainer = document.getElementById('alertNotification-container');

// 显示通知函数
function showAlertNotification(options) {
    // 创建通知元素
    const alertNotification = document.createElement('div');
    alertNotification.className = 'alertNotification';

    // 设置类型对应的颜色
    const colors = {
                info: '#0078d7',
        success: '#107c10',
        warning: '#d83b01',
        error: '#e81123'
    };
    const color = colors[options.type] || '#0078d7';

    // 设置图标
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    const icon = icons[options.type] || 'ℹ️';

    // 创建通知内容
    alertNotification.innerHTML = `
        <div class="alertNotification-icon">${icon}</div>
        <div class="alertNotification-content">
            <div class="alertNotification-title">${options.title}</div>
            <div class="alertNotification-message">${options.message}</div>
        </div>
        <button class="alertNotification-close">×</button>
        <div class="alertNotification-progress"></div>
    `;

    // 设置边框颜色
    alertNotification.style.borderLeftColor = color;

    // 添加到容器
    alertNotificationContainer.appendChild(alertNotification);

    // 显示通知
    setTimeout(() => {
        alertNotification.classList.add('show');

        // 设置进度条动画
        const progressBar = alertNotification.querySelector('.alertNotification-progress');
        if (progressBar) {
            progressBar.style.transition = `transform ${options.duration}s linear`;
            progressBar.style.transform = 'scaleX(0)';
        }
    }, 10);

    // 设置关闭事件
    const closeBtn = alertNotification.querySelector('.alertNotification-close');
    closeBtn.addEventListener('click', () => {
        closeAlertNotification(alertNotification);
    });

    // 自动关闭
    if (options.duration > 0) {
        setTimeout(() => {
            closeAlertNotification(alertNotification);
            }, options.duration * 1000);
    }

    // 返回通知元素，以便外部控制
    return alertNotification;
}

        // 关闭通知
function closeAlertNotification(alertNotification) {
    alertNotification.classList.remove('show');
    alertNotification.classList.add('hide');

    // 动画结束后移除元素
    setTimeout(() => {
        if (alertNotification.parentNode) {
            alertNotification.parentNode.removeChild(alertNotification);
        }
    }, 400);
}

class Windows10Desktop {
    constructor() {
        this.startMenuOpen = false;
        this.selectedIcons = [];
        this.updateInterval = null;
        this.currentAlerts = new Map(); // 存储当前活动的告警
        this.alertTypeMap = {
            'cpu-overload': { type: 'warning', title: 'CPU 过载' },
            'memory-overload': { type: 'error', title: '内存不足' },
            'disk-space-overload': { type: 'error', title: '磁盘空间不足' },
            'disk-io-overload': { type: 'warning', title: '磁盘IO过载' },
            'network-overload': { type: 'warning', title: '网络过载' },
            'high-process-load': { type: 'info', title: '高进程负载' }
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDateTime();
        this.loadSystemStatus();

        this.loadAlertNotification();
        console.log('首次状态加载成功');
        this.startAutoUpdate();

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

    async loadAlertNotification() {
        try {
            const xhr2 = new XMLHttpRequest();
            xhr2.open('GET', 'api/check-alert', true);
            xhr2.setRequestHeader('Accept', 'application/json');
            xhr2.setRequestHeader('Content-Type', 'application/json')

            xhr2.onreadystatechange = () => {
                if (xhr2.readyState === 4) {
                    if (xhr2.status === 200) {
                        try {
                            const alerts = JSON.parse(xhr2.responseText);
                            this.updateAlert(alerts);
                        } catch (parseError) {
                            console.error('解析JSON失败:', parseError);
                        }
                    } else{
                        console.error('HTTP错误:', xhr2.status, xhr2.statusText);
                    }
                }
            };
            xhr2.onerror = () => {
                console.error('网络错误');
            }
            xhr2.send();
        } catch (error) {
            console.error('加载性能数据失败:', error);
        }
    }

    updateAlert(alerts) {
        // 1. 创建新告警的临时集合
        const newAlertSet = new Set(alerts.map(a => a.alert_code));

        // 2. 移除已消失的告警
        this.currentAlerts.forEach((_, alertCode) => {
            if (!newAlertSet.has(alertCode)) {
                const notification = this.currentAlerts.get(alertCode).notification;
                if (document.body.contains(notification)) {
                    closeAlertNotification(notification);
                }
                this.currentAlerts.delete(alertCode);
            }
        });

        // 3. 处理新告警
        alerts.forEach(alert => {
            const {alert_code, description, timestamp, solution} = alert;

            if (this.currentAlerts.has(alert_code)) {
                // 更新现有告警
                const existing = this.currentAlerts.get(alert_code);
                const notification = existing.notification;

                if (document.body.contains(notification)) {
                    // 追加解决方案（如果存在）
                    let newMessage = description;
                    if (solution) {
                        newMessage += `<br><br><strong>解决方案:</strong> ${solution}`;
                    }

                    // 更新通知内容
                    const content = notification.querySelector('.alertNotification-content');
                    if (content) {
                        content.querySelector('.alertNotification-message').innerHTML = newMessage;
                    }

                    // 更新存储的数据
                    existing.description = description;
                    existing.solution = solution;
                }
            } else {
                // 创建新告警
                const alertType = this.alertTypeMap[alert_code] || {type: 'warning', title: '系统告警'};

                // 创建通知
                const notification = showAlertNotification({
                    title: `${alertType.title} [${new Date(timestamp).toLocaleTimeString()}]`,
                    message: description,
                    type: alertType.type,
                    duration: -1 // 常驻通知
                });

                // 存储告警信息
                this.currentAlerts.set(alert_code, {
                    notification,
                    description,
                    timestamp,
                    solution
                });
            }
        });
    }

    startAutoUpdate() {
        // 每2秒自动更新一次，提高刷新频率
        this.updateInterval = setInterval(() => {
            this.loadAlertNotification();
        }, 1000);
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