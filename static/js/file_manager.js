// 通用函数：刷新页面
function refreshPage() {
    location.reload();
}

// 通用函数：返回上一页
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        // 如果没有历史记录，返回桌面
        window.location.href = '/';
    }
}

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

class FileManager {
    constructor() {
        this.currentPath = '/';
        this.history = ['/'];
        this.historyIndex = 0;
        this.selectedItems = [];
        this.viewMode = 'grid';
        this.clipboard = null;
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
        this.loadDirectory(this.currentPath);
        this.updateNavigationState();
        this.initPreviewPanel();
        this.loadAlertNotification();

        this.startAutoUpdate();
        
        // 初始化语言管理器
        if (!window.languageManager && window.LanguageManager) {
            window.languageManager = new LanguageManager();
            window.languageManager.init();
        }
        
        // 初始化主题图标
        setTimeout(() => {
            this.updateThemeIcon();
        }, 100);
    }

    setupEventListeners() {
        // 导航按钮事件
        document.getElementById('back-btn').addEventListener('click', () => this.goBack());
        document.getElementById('forward-btn').addEventListener('click', () => this.goForward());
        document.getElementById('up-btn').addEventListener('click', () => this.goUp());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('diagnosisBtn').addEventListener('click', () => this.showDiagnosis());
        
        // 主题切换按钮事件
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // 地址栏事件
        document.getElementById('path-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigateToPath(e.target.value);
            }
        });

        // 搜索事件
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchFiles(e.target.value);
        });

        // 视图切换事件
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.currentTarget.dataset.view);
            });
        });

        // 侧边栏事件
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const path = e.currentTarget.dataset.path;
                if (path) {
                    this.navigateToPath(path);
                }
            });
        });

        // 可展开项事件
        document.querySelectorAll('.sidebar-item.expandable').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSidebarItem(item);
            });
        });

        // 右键菜单事件
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.file-area')) {
                e.preventDefault();
                this.showContextMenu(e);
            }
        });

        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 模态框关闭事件
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('properties-modal').addEventListener('click', (e) => {
            if (e.target.id === 'properties-modal') {
                this.hideModal();
            }
        });
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
        // 每1秒自动更新一次，提高刷新频率
        this.updateInterval = setInterval(() => {
            this.loadAlertNotification();
        }, 1000);
    }

    async loadDirectory(path) {
        try {
            this.showLoading();
            
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            
            if (!response.ok) {
                // 处理不同类型的HTTP错误
                let errorMessage = '加载目录失败';
                
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // 如果无法解析错误响应，使用默认错误信息
                    if (response.status === 403) {
                        errorMessage = '权限不足，无法访问该目录';
                    } else if (response.status === 404) {
                        errorMessage = '目录不存在';
                    } else if (response.status === 500) {
                        errorMessage = '服务器内部错误';
                    } else {
                        errorMessage = `HTTP错误: ${response.status}`;
                    }
                }
                
                this.showError(errorMessage);
                
                // 尝试加载根目录作为后备
                console.warn(`加载目录失败: ${path}，尝试加载根目录`);
                const rootResponse = await fetch('/api/files?path=%2F');
                if (rootResponse.ok) {
                    const rootData = await rootResponse.json();
                    this.renderFiles(rootData.items);
                    this.updateStatusBar(rootData.items);
                    this.currentPath = rootData.current_path;
                    this.updateAddressBar();
                    this.showWarning(`无法访问 "${path}"，已切换到根目录`);
                    return;
                } else {
                    // 如果连根目录都无法访问，尝试其他目录
                    const fallbackPaths = ['/tmp', '/var/tmp', '/usr', '/etc'];
                    for (const fallbackPath of fallbackPaths) {
                        try {
                            const fallbackResponse = await fetch(`/api/files?path=${encodeURIComponent(fallbackPath)}`);
                            if (fallbackResponse.ok) {
                                const fallbackData = await fallbackResponse.json();
                                this.renderFiles(fallbackData.items);
                                this.updateStatusBar(fallbackData.items);
                                this.currentPath = fallbackData.current_path;
                                this.updateAddressBar();
                                this.showWarning(`已切换到可访问目录: ${fallbackPath}`);
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    
                    // 如果所有后备目录都失败
                    this.showError('无法访问文件系统 - 所有目录都不可访问');
                    this.renderFiles([]);
                    this.updateStatusBar([]);
                    return;
                }
            }
            
            const data = await response.json();
            
            // 检查是否有警告信息
            if (data.warning) {
                this.showWarning(data.warning);
            }
            
            this.renderFiles(data.items || []);
            this.updateStatusBar(data.items || []);
            this.currentPath = data.current_path || path;
            this.updateAddressBar();
            
        } catch (error) {
            console.error('加载目录失败:', error);
            
            // 根据错误类型显示不同的错误信息
            let errorMessage = '加载目录失败';
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = '网络连接失败，请检查服务器状态';
            } else if (error.name === 'SyntaxError') {
                errorMessage = '服务器响应格式错误';
            } else {
                errorMessage = `加载目录失败: ${error.message}`;
            }
            
            this.showError(errorMessage);
            
            // 尝试加载根目录作为后备
            try {
                const rootResponse = await fetch('/api/files?path=%2F');
                if (rootResponse.ok) {
                    const rootData = await rootResponse.json();
                    this.renderFiles(rootData.items);
                    this.updateStatusBar(rootData.items);
                    this.currentPath = rootData.current_path;
                    this.updateAddressBar();
                    this.showWarning('已切换到根目录');
                } else {
                    // 尝试其他可能的目录
                    const fallbackPaths = ['/tmp', '/var/tmp', '/usr', '/etc'];
                    let fallbackSuccess = false;
                    
                    for (const fallbackPath of fallbackPaths) {
                        try {
                            const fallbackResponse = await fetch(`/api/files?path=${encodeURIComponent(fallbackPath)}`);
                            if (fallbackResponse.ok) {
                                const fallbackData = await fallbackResponse.json();
                                this.renderFiles(fallbackData.items);
                                this.updateStatusBar(fallbackData.items);
                                this.currentPath = fallbackData.current_path;
                                this.updateAddressBar();
                                this.showWarning(`已切换到可访问目录: ${fallbackPath}`);
                                fallbackSuccess = true;
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                    
                    if (!fallbackSuccess) {
                        this.showError('无法访问文件系统 - 请检查服务器状态和权限');
                        this.renderFiles([]);
                        this.updateStatusBar([]);
                    }
                }
            } catch (fallbackError) {
                console.error('加载后备目录也失败:', fallbackError);
                this.showError('无法访问文件系统 - 请联系系统管理员');
                this.renderFiles([]);
                this.updateStatusBar([]);
            }
        } finally {
            this.hideLoading();
        }
    }

    renderFiles(items) {
        const fileGrid = document.getElementById('file-grid');
        if (!fileGrid) {
            console.error('找不到file-grid元素');
            return;
        }
        
        fileGrid.innerHTML = '';

        if (!items || items.length === 0) {
            this.showEmptyFolder();
            return;
        }

        this.hideEmptyFolder();

        items.forEach((item, index) => {
            const fileElement = this.createFileElement(item, index);
            fileGrid.appendChild(fileElement);
        });
    }

    createFileElement(item, index) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.path = item.path;
        fileItem.dataset.isDir = item.is_dir;
        fileItem.style.animationDelay = `${index * 0.05}s`;

        const icon = this.getFileIcon(item);
        const iconClass = this.getFileIconClass(item);

        fileItem.innerHTML = `
            <div class="file-icon ${iconClass}">
                <i class="${icon}"></i>
            </div>
            <div class="file-name" title="${item.name}">${item.name}</div>
        `;

        // 添加事件监听器
        fileItem.addEventListener('click', (e) => this.selectFile(e, fileItem));
        fileItem.addEventListener('dblclick', (e) => this.openFile(e, item));
        fileItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.selectFile(e, fileItem);
            this.showContextMenu(e, item);
        });

        return fileItem;
    }

    getFileIcon(item) {
        if (item.is_dir) {
            return 'fas fa-folder';
        }

        const ext = item.name.split('.').pop().toLowerCase();
        const iconMap = {
            // 文档文件
            'txt': 'fas fa-file-alt',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'pdf': 'fas fa-file-pdf',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            
            // 图片文件
            'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image',
            'png': 'fas fa-file-image',
            'gif': 'fas fa-file-image',
            'bmp': 'fas fa-file-image',
            'svg': 'fas fa-file-image',
            
            // 音频文件
            'mp3': 'fas fa-file-audio',
            'wav': 'fas fa-file-audio',
            'flac': 'fas fa-file-audio',
            'aac': 'fas fa-file-audio',
            
            // 视频文件
            'mp4': 'fas fa-file-video',
            'avi': 'fas fa-file-video',
            'mkv': 'fas fa-file-video',
            'mov': 'fas fa-file-video',
            
            // 压缩文件
            'zip': 'fas fa-file-archive',
            'rar': 'fas fa-file-archive',
            '7z': 'fas fa-file-archive',
            'tar': 'fas fa-file-archive',
            'gz': 'fas fa-file-archive',
            
            // 代码文件
            'js': 'fas fa-file-code',
            'html': 'fas fa-file-code',
            'css': 'fas fa-file-code',
            'py': 'fas fa-file-code',
            'java': 'fas fa-file-code',
            'cpp': 'fas fa-file-code',
            'c': 'fas fa-file-code',
            'php': 'fas fa-file-code',
            'json': 'fas fa-file-code',
            'xml': 'fas fa-file-code'
        };

        return iconMap[ext] || 'fas fa-file';
    }

    getFileIconClass(item) {
        if (item.is_dir) {
            return 'folder';
        }

        const ext = item.name.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) {
            return 'image';
        }
        
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return 'archive';
        }
        
        if (item.permissions && item.permissions.includes('x')) {
            return 'executable';
        }
        
        return 'file';
    }

    selectFile(event, fileItem) {
        if (!event.ctrlKey && !event.metaKey) {
            this.clearSelection();
        }

        fileItem.classList.toggle('selected');
        
        if (fileItem.classList.contains('selected')) {
            this.selectedItems.push(fileItem);
        } else {
            this.selectedItems = this.selectedItems.filter(item => item !== fileItem);
        }

        this.updateStatusBar();
    }

    clearSelection() {
        this.selectedItems.forEach(item => {
            item.classList.remove('selected');
        });
        this.selectedItems = [];
    }

    openFile(event, item) {
        if (item.is_dir) {
            this.navigateToPath(item.path);
        } else {
            // 对于文件，显示预览
            this.previewFile(item);
        }
    }

    navigateToPath(path) {
        if (path !== this.currentPath) {
            // 添加到历史记录
            this.historyIndex++;
            this.history = this.history.slice(0, this.historyIndex);
            this.history.push(path);
            
            this.loadDirectory(path);
            this.updateNavigationState();
            this.updateSidebarSelection(path);
        }
    }

    goBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const path = this.history[this.historyIndex];
            this.loadDirectory(path);
            this.updateNavigationState();
        }
    }

    goForward() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const path = this.history[this.historyIndex];
            this.loadDirectory(path);
            this.updateNavigationState();
        }
    }

    goUp() {
        const parentPath = this.getParentPath(this.currentPath);
        if (parentPath !== this.currentPath) {
            this.navigateToPath(parentPath);
        }
    }

    getParentPath(path) {
        if (path === '/') return '/';
        return path.substring(0, path.lastIndexOf('/')) || '/';
    }

    refresh() {
        this.loadDirectory(this.currentPath);
    }

    updateNavigationState() {
        const backBtn = document.getElementById('back-btn');
        const forwardBtn = document.getElementById('forward-btn');
        const upBtn = document.getElementById('up-btn');
        
        if (backBtn) {
            backBtn.disabled = this.historyIndex <= 0;
        }
        if (forwardBtn) {
            forwardBtn.disabled = this.historyIndex >= this.history.length - 1;
        }
        if (upBtn) {
            upBtn.disabled = this.currentPath === '/';
        }
    }

    updateAddressBar() {
        const pathInput = document.getElementById('path-input');
        if (pathInput) {
            pathInput.value = this.currentPath;
        }
    }

    updateSidebarSelection(path) {
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.path === path) {
                item.classList.add('active');
            }
        });
    }

    switchView(viewMode) {
        this.viewMode = viewMode;
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[data-view="${viewMode}"]`).classList.add('active');
        
        const fileGrid = document.getElementById('file-grid');
        if (viewMode === 'list') {
            fileGrid.classList.add('list-view');
        } else {
            fileGrid.classList.remove('list-view');
        }
    }

    toggleSidebarItem(item) {
        const isExpanded = item.classList.contains('expanded');
        const subItems = item.parentNode.querySelectorAll('.sub-item');
        
        if (isExpanded) {
            item.classList.remove('expanded');
            subItems.forEach(subItem => {
                subItem.style.display = 'none';
            });
        } else {
            item.classList.add('expanded');
            subItems.forEach(subItem => {
                subItem.style.display = 'flex';
            });
        }
    }

    searchFiles(query) {
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileName = item.querySelector('.file-name').textContent.toLowerCase();
            const matches = fileName.includes(query.toLowerCase());
            
            item.style.display = matches || query === '' ? 'flex' : 'none';
        });
    }

    showContextMenu(event, item = null) {
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
        contextMenu.querySelectorAll('.menu-item').forEach(menuItem => {
            menuItem.onclick = () => {
                this.handleContextMenuAction(menuItem.dataset.action, item);
                this.hideContextMenu();
            };
        });
    }

    hideContextMenu() {
        document.getElementById('context-menu').style.display = 'none';
    }

    handleContextMenuAction(action, item) {
        switch(action) {
            case 'open':
                if (item) this.openFile({}, item);
                break;
            case 'copy':
                this.copyItems();
                break;
            case 'cut':
                this.cutItems();
                break;
            case 'paste':
                this.pasteItems();
                break;
            case 'rename':
                this.renameItem(item);
                break;
            case 'delete':
                this.deleteItems();
                break;
            case 'properties':
                this.showProperties(item);
                break;
            default:
                console.log(`执行操作: ${action}`);
        }
    }

    copyItems() {
        if (this.selectedItems.length > 0) {
            this.clipboard = {
                action: 'copy',
                items: this.selectedItems.map(item => ({
                    path: item.dataset.path,
                    name: item.querySelector('.file-name').textContent
                }))
            };
            this.showNotification(`已复制 ${this.selectedItems.length} 个项目`);
        }
    }

    cutItems() {
        if (this.selectedItems.length > 0) {
            this.clipboard = {
                action: 'cut',
                items: this.selectedItems.map(item => ({
                    path: item.dataset.path,
                    name: item.querySelector('.file-name').textContent
                }))
            };
            this.selectedItems.forEach(item => {
                item.style.opacity = '0.5';
            });
            this.showNotification(`已剪切 ${this.selectedItems.length} 个项目`);
        }
    }

    pasteItems() {
        if (this.clipboard && this.clipboard.items.length > 0) {
            this.showNotification(`粘贴功能开发中...`);
            // 这里可以实现实际的粘贴功能
        }
    }

    renameItem(item) {
        if (item) {
            const newName = prompt('请输入新名称:', item.name);
            if (newName && newName !== item.name) {
                this.showNotification(`重命名功能开发中...`);
                // 这里可以实现实际的重命名功能
            }
        }
    }

    deleteItems() {
        if (this.selectedItems.length > 0) {
            const confirmed = confirm(`确定要删除选中的 ${this.selectedItems.length} 个项目吗？`);
            if (confirmed) {
                this.showNotification(`删除功能开发中...`);
                // 这里可以实现实际的删除功能
            }
        }
    }

    showProperties(item) {
        if (item) {
            const modal = document.getElementById('properties-modal');
            const content = document.getElementById('properties-content');
            
            content.innerHTML = `
                <div style="margin-bottom: 16px;">
                    <strong>名称:</strong> ${item.name}<br>
                    <strong>路径:</strong> ${item.path}<br>
                    <strong>类型:</strong> ${item.is_dir ? '文件夹' : '文件'}<br>
                    <strong>大小:</strong> ${item.size_formatted || '计算中...'}<br>
                    <strong>修改时间:</strong> ${item.modified || '未知'}<br>
                    <strong>权限:</strong> ${item.permissions || '未知'}
                </div>
            `;
            
            modal.style.display = 'flex';
        }
    }

    hideModal() {
        document.getElementById('properties-modal').style.display = 'none';
    }

    updateStatusBar(items = null) {
        const itemCount = document.getElementById('item-count');
        const selectedInfo = document.getElementById('selected-info');
        
        if (items && itemCount) {
            const folderCount = items.filter(item => item.is_dir).length;
            const fileCount = items.length - folderCount;
            itemCount.textContent = `${items.length} 个对象 (${folderCount} 个文件夹, ${fileCount} 个文件)`;
        }
        
        if (selectedInfo) {
            if (this.selectedItems.length > 0) {
                selectedInfo.textContent = `已选择 ${this.selectedItems.length} 个项目`;
            } else {
                selectedInfo.textContent = '';
            }
        }
    }

    showLoading() {
        const loadingIndicator = document.getElementById('loading-indicator');
        const fileGrid = document.getElementById('file-grid');
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }
        if (fileGrid) {
            fileGrid.style.display = 'none';
        }
        this.hideEmptyFolder();
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loading-indicator');
        const fileGrid = document.getElementById('file-grid');
        
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        if (fileGrid) {
            fileGrid.style.display = 'grid';
        }
    }

    showEmptyFolder() {
        const emptyFolder = document.getElementById('empty-folder');
        if (emptyFolder) {
            emptyFolder.style.display = 'flex';
        }
    }

    hideEmptyFolder() {
        const emptyFolder = document.getElementById('empty-folder');
        if (emptyFolder) {
            emptyFolder.style.display = 'none';
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch(event.key) {
                case 'a':
                    event.preventDefault();
                    this.selectAll();
                    break;
                case 'c':
                    event.preventDefault();
                    this.copyItems();
                    break;
                case 'x':
                    event.preventDefault();
                    this.cutItems();
                    break;
                case 'v':
                    event.preventDefault();
                    this.pasteItems();
                    break;
                case 'r':
                    event.preventDefault();
                    this.refresh();
                    break;
            }
        } else {
            switch(event.key) {
                case 'Delete':
                    this.deleteItems();
                    break;
                case 'F2':
                    if (this.selectedItems.length === 1) {
                        const item = {
                            name: this.selectedItems[0].querySelector('.file-name').textContent,
                            path: this.selectedItems[0].dataset.path
                        };
                        this.renameItem(item);
                    }
                    break;
                case 'F5':
                    this.refresh();
                    break;
                case 'Escape':
                    this.clearSelection();
                    this.hideContextMenu();
                    break;
            }
        }
    }

    selectAll() {
        const fileItems = document.querySelectorAll('.file-item');
        this.clearSelection();
        
        fileItems.forEach(item => {
            if (item.style.display !== 'none') {
                item.classList.add('selected');
                this.selectedItems.push(item);
            }
        });
        
        this.updateStatusBar();
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        const colors = {
            info: '#007acc',
            error: '#ff5f57',
            success: '#28ca42',
            warning: '#ffbd2e'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 4px;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 3000;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;

        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    async showDiagnosis() {
        try {
            const response = await fetch('/api/file-system-diagnosis');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const diagnosis = await response.json();
            
            let diagnosisHtml = `
                <div style="max-height: 400px; overflow-y: auto; font-family: monospace; font-size: 12px;">
                    <h4>文件系统诊断报告</h4>
                    
                    <h5>系统信息:</h5>
                    <ul>
                        <li>操作系统: ${diagnosis.system_info.platform} ${diagnosis.system_info.platform_release}</li>
                        <li>架构: ${diagnosis.system_info.architecture}</li>
                        <li>当前用户: ${diagnosis.system_info.current_user}</li>
                        <li>工作目录: ${diagnosis.system_info.current_working_directory}</li>
                        <li>主目录: ${diagnosis.system_info.home_directory}</li>
                        ${diagnosis.system_info.effective_uid !== 'N/A' ? `<li>用户ID: ${diagnosis.system_info.effective_uid}</li>` : ''}
                    </ul>
                    
                    <h5>可访问目录 (${diagnosis.accessible_directories.length}):</h5>
                    <ul>
            `;
            
            diagnosis.accessible_directories.forEach(dir => {
                diagnosisHtml += `
                    <li style="color: green;">
                        ${dir.path} (${dir.items_count} 项目) 
                        ${dir.writable ? '<span style="color: blue;">[可写]</span>' : '<span style="color: orange;">[只读]</span>'}
                    </li>
                `;
            });
            
            diagnosisHtml += `
                    </ul>
                    
                    <h5>权限错误 (${diagnosis.permission_errors.length}):</h5>
                    <ul>
            `;
            
            diagnosis.permission_errors.forEach(error => {
                diagnosisHtml += `
                    <li style="color: red;">
                        ${error.path}: ${error.error}
                    </li>
                `;
            });
            
            diagnosisHtml += `
                    </ul>
                    
                    <h5>建议:</h5>
                    <ul>
            `;
            
            diagnosis.recommendations.forEach(recommendation => {
                diagnosisHtml += `<li style="color: orange;">${recommendation}</li>`;
            });
            
            diagnosisHtml += `
                    </ul>
                </div>
            `;
            
            // 创建诊断对话框
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 3000;
            `;
            
            modal.innerHTML = `
                <div class="modal" style="background: white; padding: 20px; border-radius: 8px; max-width: 600px; width: 90%;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">文件系统诊断</h3>
                        <button class="modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${diagnosisHtml}
                    </div>
                </div>
            `;
            
            // 添加关闭事件
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('获取诊断信息失败:', error);
            this.showError('获取诊断信息失败: ' + error.message);
        }
    }

    // 主题切换功能
    toggleTheme() {
        if (window.themeManager) {
            window.themeManager.toggleTheme();
            this.updateThemeIcon();
        }
    }

    updateThemeIcon() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn && window.themeManager) {
            const icon = themeToggleBtn.querySelector('i');
            if (icon) {
                const isDark = window.themeManager.getCurrentTheme() === 'dark';
                icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
                themeToggleBtn.title = isDark ? '切换到浅色主题' : '切换到深色主题';
            }
        }
    }

    // 文件预览功能
    initPreviewPanel() {
        const closeBtn = document.getElementById('close-preview-btn');
        const downloadBtn = document.getElementById('download-btn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hidePreview());
        }
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadCurrentFile());
        }
        
        // 初始状态隐藏预览面板
        this.hidePreview();
    }

    async previewFile(item) {
        const previewPanel = document.getElementById('preview-panel');
        const previewContent = document.getElementById('preview-content');
        const previewFilename = document.getElementById('preview-filename');
        
        if (!previewPanel || !previewContent || !previewFilename) {
            console.error('预览面板元素未找到');
            return;
        }

        // 显示预览面板
        this.showPreview();
        
        // 更新文件名
        previewFilename.textContent = item.name;
        
        // 存储当前预览的文件信息
        this.currentPreviewFile = item;
        
        // 显示加载状态
        this.showPreviewLoading();
        
        try {
            const response = await fetch(`/api/file-preview?path=${encodeURIComponent(item.path)}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '预览失败');
            }
            
            const data = await response.json();
            this.renderPreview(data);
            
        } catch (error) {
            console.error('预览文件失败:', error);
            this.showPreviewError(error.message);
        }
    }

    renderPreview(data) {
        const previewContent = document.getElementById('preview-content');
        
        switch (data.type) {
            case 'text':
                this.renderTextPreview(data, previewContent);
                break;
            case 'image':
                this.renderImagePreview(data, previewContent);
                break;
            case 'pdf':
                this.renderPdfPreview(data, previewContent);
                break;
            case 'unsupported':
                this.renderUnsupportedPreview(data, previewContent);
                break;
            case 'error':
                this.showPreviewError(data.message);
                break;
            default:
                this.showPreviewError('未知的预览类型');
        }
    }

    renderTextPreview(data, container) {
        const fileInfo = data.file_info;
        
        container.innerHTML = `
            <div class="text-preview">${this.escapeHtml(data.content)}</div>
            <div class="image-info">
                <div>文件大小: ${fileInfo.size_formatted}</div>
                <div>行数: ${data.lines}</div>
                <div>编码: ${data.encoding}</div>
                <div>修改时间: ${fileInfo.modified}</div>
            </div>
        `;
    }

    renderImagePreview(data, container) {
        const fileInfo = data.file_info;
        
        container.innerHTML = `
            <div class="image-preview">
                <div class="image-loading" style="display: flex; justify-content: center; align-items: center; height: 200px;">
                    <div class="spinner"></div>
                    <span style="margin-left: 10px;" data-i18n="file-manager-loading">加载中...</span>
                </div>
                <img src="${data.url}" alt="${fileInfo.name}" style="display: none; max-width: 100%; max-height: 500px; transition: opacity 0.3s;">
                <div class="image-error" style="display: none; text-align: center; padding: 20px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>图片加载失败</div>
                    <button onclick="this.parentElement.previousElementSibling.src = this.parentElement.previousElementSibling.src" style="margin-top: 10px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">重试</button>
                </div>
                <div class="image-info">
                    <div>文件大小: ${fileInfo.size_formatted}</div>
                    <div>修改时间: ${fileInfo.modified}</div>
                </div>
            </div>
        `;
        
        // 获取图片元素并添加事件监听器
        const img = container.querySelector('img');
        const loading = container.querySelector('.image-loading');
        const error = container.querySelector('.image-error');
        
        img.onload = function() {
            loading.style.display = 'none';
            error.style.display = 'none';
            this.style.display = 'block';
            this.style.opacity = '1';
        };
        
        img.onerror = function() {
            loading.style.display = 'none';
            this.style.display = 'none';
            error.style.display = 'block';
            console.error('图片加载失败:', data.url);
        };
        
        // 添加超时处理
        setTimeout(() => {
            if (loading.style.display !== 'none') {
                img.onerror();
            }
        }, 10000); // 10秒超时
    }

    renderPdfPreview(data, container) {
        const fileInfo = data.file_info;
        
        // 添加调试信息
        console.log('PDF预览数据:', data);
        console.log('PDF URL:', data.url);
        
        container.innerHTML = `
            <div class="pdf-preview">
                <div class="pdf-viewer-container">
                    <div class="pdf-loading" id="pdf-loading">
                        <div class="loading-spinner"></div>
                        <span>正在加载PDF...</span>
                        <div style="font-size: 12px; margin-top: 10px; color: #666;">
                            URL: ${data.url}
                        </div>
                    </div>
                    <iframe 
                        src="${data.url}" 
                        frameborder="0"
                        style="display: none; width: 100%; height: 600px;"
                        id="pdf-iframe"
                        title="PDF预览">
                    </iframe>
                    <div class="pdf-fallback" style="display: none;" id="pdf-fallback">
                        <div class="pdf-error">
                            <i class="fas fa-file-pdf"></i>
                            <p>无法在浏览器中预览PDF</p>
                            <p>URL: ${data.url}</p>
                            <button onclick="window.fileManager.downloadCurrentFile()" class="pdf-download-btn">
                                <i class="fas fa-download"></i> 下载PDF文件
                            </button>
                            <button onclick="window.open('${data.url}', '_blank')" class="pdf-open-btn">
                                <i class="fas fa-external-link-alt"></i> 在新窗口打开
                            </button>
                            <button onclick="window.fileManager.testPdfUrl('${data.url}')" class="pdf-test-btn">
                                <i class="fas fa-bug"></i> 测试URL
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pdf-info">
                    <div>文件大小: ${fileInfo.size_formatted}</div>
                    <div>修改时间: ${fileInfo.modified}</div>
                </div>
            </div>
        `;
        
        // 获取元素
        const iframe = container.querySelector('#pdf-iframe');
        const loading = container.querySelector('#pdf-loading');
        const fallback = container.querySelector('#pdf-fallback');
        
        if (iframe && loading && fallback) {
            console.log('开始加载PDF iframe');
            
            // 设置加载超时（5秒，缩短以便更快看到问题）
            const timeout = setTimeout(() => {
                console.warn('PDF加载超时，显示备用方案');
                loading.style.display = 'none';
                fallback.style.display = 'block';
            }, 5000);
            
            // iframe加载成功
            iframe.addEventListener('load', () => {
                console.log('iframe load事件触发');
                clearTimeout(timeout);
                loading.style.display = 'none';
                iframe.style.display = 'block';
            });
            
            // iframe加载错误
            iframe.addEventListener('error', (e) => {
                console.error('iframe error事件触发:', e);
                clearTimeout(timeout);
                loading.style.display = 'none';
                fallback.style.display = 'block';
            });
            
            // 立即检查iframe状态
            setTimeout(() => {
                console.log('检查iframe状态...');
                console.log('iframe.src:', iframe.src);
                console.log('iframe.contentDocument:', iframe.contentDocument);
                console.log('iframe.contentWindow:', iframe.contentWindow);
                
                // 如果5秒后仍在加载状态，显示备用方案
                if (loading.style.display !== 'none') {
                    console.log('iframe似乎没有正确加载，显示备用方案');
                    loading.style.display = 'none';
                    fallback.style.display = 'block';
                }
            }, 3000);
        }
    }
    
    // 添加测试PDF URL的方法
    testPdfUrl(url) {
        console.log('测试PDF URL:', url);
        fetch(url)
            .then(response => {
                console.log('PDF URL响应状态:', response.status);
                console.log('PDF URL响应头:', response.headers);
                return response.blob();
            })
            .then(blob => {
                console.log('PDF文件大小:', blob.size);
                console.log('PDF文件类型:', blob.type);
                alert(`PDF URL测试成功！\n状态: 200\n大小: ${blob.size} bytes\n类型: ${blob.type}`);
            })
            .catch(error => {
                console.error('PDF URL测试失败:', error);
                alert(`PDF URL测试失败: ${error.message}`);
            });
    }

    renderUnsupportedPreview(data, container) {
        const fileInfo = data.file_info;
        
        container.innerHTML = `
            <div class="unsupported-preview">
                <i class="fas fa-file-alt"></i>
                <div>${data.message}</div>
                <div class="image-info">
                    <div>文件大小: ${fileInfo.size_formatted}</div>
                    <div>修改时间: ${fileInfo.modified}</div>
                </div>
            </div>
        `;
    }

    showPreviewLoading() {
        const previewContent = document.getElementById('preview-content');
        previewContent.innerHTML = `
            <div class="preview-loading">
                <div class="loading-spinner"></div>
                <span data-i18n="file-manager-loading">加载中...</span>
            </div>
        `;
    }

    showPreviewError(message) {
        const previewContent = document.getElementById('preview-content');
        previewContent.innerHTML = `
            <div class="preview-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${this.escapeHtml(message)}</span>
            </div>
        `;
    }

    showPreview() {
        const previewPanel = document.getElementById('preview-panel');
        if (previewPanel) {
            previewPanel.classList.remove('hidden');
        }
    }

    hidePreview() {
        const previewPanel = document.getElementById('preview-panel');
        const previewContent = document.getElementById('preview-content');
        const previewFilename = document.getElementById('preview-filename');
        
        if (previewPanel) {
            previewPanel.classList.add('hidden');
        }
        
        if (previewContent) {
            previewContent.innerHTML = `
                <div class="preview-placeholder">
                    <i class="fas fa-file"></i>
                    <span>选择文件以预览</span>
                </div>
            `;
        }
        
        if (previewFilename) {
            previewFilename.textContent = '文件预览';
        }
        
        this.currentPreviewFile = null;
    }

    downloadCurrentFile() {
        if (this.currentPreviewFile) {
            const downloadUrl = `/api/file-download?path=${encodeURIComponent(this.currentPreviewFile.path)}`;
            
            // 创建隐藏的下载链接
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = this.currentPreviewFile.name;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification(`开始下载: ${this.currentPreviewFile.name}`, 'success');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化文件管理器
document.addEventListener('DOMContentLoaded', () => {
    window.fileManager = new FileManager();
});