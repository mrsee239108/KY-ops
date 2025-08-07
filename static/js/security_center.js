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

// 安全中心页面功能
class SecurityCenter {
    constructor() {
        this.currentAlerts = new Map(); // 存储当前活动的告警
        this.alertTypeMap = {
            'cpu-overload': { type: 'warning', title: 'CPU 过载' },
            'memory-overload': { type: 'error', title: '内存不足' },
            'disk-space-overload': { type: 'error', title: '磁盘空间不足' },
            'disk-io-overload': { type: 'warning', title: '磁盘IO过载' },
            'network-overload': { type: 'warning', title: '网络过载' },
            'high-process-load': { type: 'info', title: '高进程负载' }
        };
        this.currentScanId = null;
        this.scanInterval = null;
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSecurityData();
        this.loadRecommendations();
        this.loadSecurityHistory('today');
<<<<<<< Updated upstream

        this.loadAlertNotification();
        console.log('首次状态加载成功');
        this.startAutoUpdate();
        setTimeout(() => {
            this.updateThemeIcon();
        }, 200);

=======
        
        // 应用当前语言翻译（延迟执行确保DOM完全加载）
        setTimeout(() => {
            if (window.languageManager) {
                window.languageManager.applyLanguage(window.languageManager.getCurrentLanguage());
            }
        }, 200);
        
>>>>>>> Stashed changes
        // 定期更新安全状态
        this.updateInterval = setInterval(() => {
            this.loadSecurityData();
        }, 30000); // 每30秒更新一次

        // 初始化主题图标
        setTimeout(() => {
            this.updateThemeIcon();
        }, 100);
    }

    setupEventListeners() {
        // 快速扫描按钮
        const quickScanBtn = document.getElementById('quick-scan-btn');
        if (quickScanBtn) {
            quickScanBtn.addEventListener('click', () => this.startScan('quick'));
        }

        // 查看详情按钮
        const viewDetailsBtn = document.getElementById('view-details-btn');
        if (viewDetailsBtn) {
            viewDetailsBtn.addEventListener('click', () => this.showSecurityDetails());
        }

        // 功能切换开关
        const firewallToggle = document.getElementById('firewall-toggle');
        if (firewallToggle) {
            firewallToggle.addEventListener('change', (e) => {
                this.toggleSecurityFeature('firewall', e.target.checked);
            });
        }

        const antivirusToggle = document.getElementById('antivirus-toggle');
        if (antivirusToggle) {
            antivirusToggle.addEventListener('change', (e) => {
                this.toggleSecurityFeature('antivirus', e.target.checked);
            });
        }

        // 更新按钮
        const updateBtn = document.getElementById('update-btn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => this.checkForUpdates());
        }

        // 账户设置按钮
        const accountBtn = document.getElementById('account-btn');
        if (accountBtn) {
            accountBtn.addEventListener('click', () => this.openAccountSettings());
        }

        // 刷新建议按钮
        const refreshRecommendationsBtn = document.getElementById('refresh-recommendations');
        if (refreshRecommendationsBtn) {
            refreshRecommendationsBtn.addEventListener('click', () => this.loadRecommendations());
        }

        // 历史记录时间段按钮
        const historyBtns = document.querySelectorAll('.history-btn');
        historyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 移除所有活动状态
                historyBtns.forEach(b => b.classList.remove('active'));
                // 添加当前按钮的活动状态
                e.target.classList.add('active');
                // 加载对应时间段的历史记录
                this.loadSecurityHistory(e.target.dataset.period);
            });
        });

        // 扫描模态框关闭按钮
        const scanModalClose = document.getElementById('scan-modal-close');
        if (scanModalClose) {
            scanModalClose.addEventListener('click', () => this.closeScanModal());
        }

        // 点击模态框外部关闭
        const scanModal = document.getElementById('scan-modal');
        if (scanModal) {
            scanModal.addEventListener('click', (e) => {
                if (e.target === scanModal) {
                    this.closeScanModal();
                }
            });
        }

        // 主题切换按钮
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        // 扫描暂停按钮
        const pauseScanBtn = document.getElementById('pause-scan');
        if (pauseScanBtn) {
            pauseScanBtn.addEventListener('click', () => this.pauseScan());
        }

        // 扫描取消按钮
        const cancelScanBtn = document.getElementById('cancel-scan');
        if (cancelScanBtn) {
            cancelScanBtn.addEventListener('click', () => this.cancelScan());
        }

        console.log('安全中心页面已初始化');
    }

    async loadSecurityData() {
        try {
            const response = await fetch('/api/security-status');
            const data = await response.json();

            if (data.error) {
                console.error('获取安全状态失败:', data.error);
                return;
            }

            this.updateSecurityStatus(data);
            this.updateFeatureCards(data);
        } catch (error) {
            console.error('加载安全数据失败:', error);
        }
    }

    updateSecurityStatus(data) {
        const statusTitle = document.getElementById('security-status-title');
        const statusMessage = document.getElementById('security-status-message');
        const statusDetail = document.getElementById('security-status-detail');
        const mainIcon = document.getElementById('main-security-icon');

        if (data.security_level === 'excellent') {
            statusTitle.setAttribute('data-i18n', 'security-center-system-secure');
            statusMessage.setAttribute('data-i18n', 'security-center-device-protected');
            statusDetail.setAttribute('data-i18n', 'security-center-all-features-normal');
            mainIcon.className = 'fas fa-shield-alt';
            mainIcon.style.color = '#107c10';
        } else if (data.security_level === 'good') {
            statusTitle.setAttribute('data-i18n', 'security-center-system-basic-secure');
            statusMessage.setAttribute('data-i18n', 'security-center-most-features-normal');
            statusDetail.setAttribute('data-i18n', 'security-center-check-settings');
            mainIcon.className = 'fas fa-shield-alt';
            mainIcon.style.color = '#ca5010';
        } else if (data.security_level === 'warning') {
            statusTitle.setAttribute('data-i18n', 'security-center-needs-attention');
            statusMessage.setAttribute('data-i18n', 'security-center-security-issues-found');
            statusDetail.setAttribute('data-i18n', 'security-center-handle-issues-immediately');
            mainIcon.className = 'fas fa-exclamation-triangle';
            mainIcon.style.color = '#d13438';
        } else {
            statusTitle.setAttribute('data-i18n', 'security-center-security-risk');
            statusMessage.setAttribute('data-i18n', 'security-center-serious-issues');
            statusDetail.setAttribute('data-i18n', 'security-center-take-action-immediately');
            mainIcon.className = 'fas fa-exclamation-triangle';
            mainIcon.style.color = '#d13438';
        }
        
        // 重新应用翻译
        if (window.languageManager) {
            window.languageManager.applyLanguage();
        }
    }

    updateFeatureCards(data) {
        // 更新防火墙状态
        const firewallStatus = document.getElementById('firewall-status');
        const firewallToggle = document.getElementById('firewall-toggle');
        const firewallBlocked = document.getElementById('firewall-blocked');
        const firewallUpdated = document.getElementById('firewall-updated');

        if (firewallStatus && firewallToggle) {
            firewallToggle.checked = data.firewall_active;
            firewallStatus.setAttribute('data-i18n', data.firewall_active ? 'security-center-enabled' : 'security-center-disabled');
            firewallStatus.className = `feature-status ${data.firewall_active ? 'enabled' : 'disabled'}`;
        }
        if (firewallBlocked) firewallBlocked.textContent = data.threats_blocked || 0;
        if (firewallUpdated) firewallUpdated.setAttribute('data-i18n', 'security-center-just-now');

        // 更新防病毒状态
        const antivirusStatus = document.getElementById('antivirus-status');
        const antivirusToggle = document.getElementById('antivirus-toggle');
        const antivirusScan = document.getElementById('antivirus-scan');
        const antivirusDefinitions = document.getElementById('antivirus-definitions');

        if (antivirusStatus && antivirusToggle) {
            antivirusToggle.checked = data.antivirus_active;
            antivirusStatus.setAttribute('data-i18n', data.antivirus_active ? 'security-center-enabled' : 'security-center-disabled');
            antivirusStatus.className = `feature-status ${data.antivirus_active ? 'enabled' : 'disabled'}`;
        }
        if (antivirusScan) antivirusScan.setAttribute('data-i18n', 'security-center-today');
        if (antivirusDefinitions) antivirusDefinitions.setAttribute('data-i18n', 'security-center-latest');

        // 更新系统更新状态
        const updateStatus = document.getElementById('update-status');
        const availableUpdates = document.getElementById('available-updates');
        const lastCheck = document.getElementById('last-check');

        if (updateStatus) {
            if (data.updates_available > 0) {
                updateStatus.setAttribute('data-i18n', 'security-center-updates-available');
                updateStatus.className = 'feature-status warning';
            } else {
                updateStatus.setAttribute('data-i18n', 'security-center-up-to-date');
                updateStatus.className = 'feature-status enabled';
            }
        }
        if (availableUpdates) availableUpdates.textContent = data.updates_available || 0;
        if (lastCheck) lastCheck.setAttribute('data-i18n', 'security-center-1-hour-ago');
        
        // 重新应用翻译
        if (window.languageManager) {
            window.languageManager.applyLanguage();
        }

        // 更新账户保护状态
        const accountStatus = document.getElementById('account-status');
        const loginAttempts = document.getElementById('login-attempts');
        const permissionRequests = document.getElementById('permission-requests');

        if (accountStatus) {
            accountStatus.textContent = '已启用';
            accountStatus.className = 'feature-status enabled';
        }
        if (loginAttempts) loginAttempts.textContent = data.failed_logins || 0;
        if (permissionRequests) permissionRequests.textContent = data.permission_requests || 2;
    }

    async startScan(type = 'quick') {
        try {
            const response = await fetch('/api/security-scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error('启动扫描失败:', data.error);
                return;
            }

            this.currentScanId = data.scan_id;
            this.showScanModal();
            this.updateScanProgress(data);
            
            // 开始轮询扫描状态
            this.scanInterval = setInterval(() => {
                this.checkScanStatus();
            }, 2000);

        } catch (error) {
            console.error('启动扫描失败:', error);
        }
    }

    async checkScanStatus() {
        if (!this.currentScanId) return;

        try {
            const response = await fetch(`/api/security-scan/${this.currentScanId}`);
            const data = await response.json();

            this.updateScanProgress(data);

            if (data.status === 'completed') {
                clearInterval(this.scanInterval);
                this.scanInterval = null;
                
                // 延迟关闭模态框
                setTimeout(() => {
                    this.closeScanModal();
                    this.showScanResults(data);
                }, 2000);
            }
        } catch (error) {
            console.error('检查扫描状态失败:', error);
        }
    }

    updateScanProgress(data) {
        const scanStatus = document.getElementById('scan-status');
        const scanDetail = document.getElementById('scan-detail');
        const scanProgress = document.getElementById('scan-progress');
        const scannedFiles = document.getElementById('scanned-files');
        const threatsFound = document.getElementById('threats-found');
        const timeRemaining = document.getElementById('time-remaining');

        if (scanStatus) {
            if (data.status === 'completed') {
                scanStatus.setAttribute('data-i18n', 'security-center-scan-completed');
            } else {
                scanStatus.setAttribute('data-i18n', 'security-center-scanning-system');
            }
        }

        if (scanDetail) {
            if (data.current_file) {
                scanDetail.textContent = data.current_file;
            } else {
                scanDetail.setAttribute('data-i18n', 'security-center-check-system-files');
            }
        }

        if (scanProgress) {
            scanProgress.style.width = `${data.progress || 0}%`;
        }

        if (scannedFiles) scannedFiles.textContent = data.files_scanned || 0;
        if (threatsFound) threatsFound.textContent = data.threats_found || 0;
        if (timeRemaining) {
            const remaining = data.estimated_time || 0;
            if (remaining > 0) {
                timeRemaining.textContent = `${Math.ceil(remaining)} `;
                // 为秒数添加翻译
                const secondsSpan = document.createElement('span');
                secondsSpan.setAttribute('data-i18n', 'security-center-seconds');
                timeRemaining.appendChild(secondsSpan);
            } else {
                timeRemaining.setAttribute('data-i18n', 'security-center-almost-done');
            }
        }
        
        // 重新应用翻译
        if (window.languageManager) {
            window.languageManager.applyLanguage();
        }
    }

    showScanModal() {
        const modal = document.getElementById('scan-modal');
        if (modal) {
            modal.style.display = 'flex';
            // 确保弹窗内容应用当前语言设置
            if (window.languageManager) {
                window.languageManager.applyLanguage();
            }
        }
    }

    closeScanModal() {
        const modal = document.getElementById('scan-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        // 清理扫描状态
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        this.currentScanId = null;
    }

    pauseScan() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
            
            // 更新扫描状态显示
            const scanStatus = document.getElementById('scan-status');
            if (scanStatus) {
                const pausedText = window.languageManager ? window.languageManager.translate('security-center-scan-paused') : '扫描已暂停';
                scanStatus.textContent = pausedText;
            }
            
            // 更改按钮文本为继续
            const pauseBtn = document.getElementById('pause-scan');
            if (pauseBtn) {
                const resumeText = window.languageManager ? window.languageManager.translate('security-center-resume') : '继续';
                pauseBtn.textContent = resumeText;
                pauseBtn.onclick = () => this.resumeScan();
            }
        }
    }

    resumeScan() {
        // 恢复扫描
        if (this.currentScanId) {
            this.scanInterval = setInterval(() => {
                this.checkScanStatus();
            }, 1000);
            
            // 更新扫描状态显示
            const scanStatus = document.getElementById('scan-status');
            if (scanStatus) {
                const scanningText = window.languageManager ? window.languageManager.translate('security-center-scanning-system') : '正在扫描系统...';
                scanStatus.textContent = scanningText;
            }
            
            // 更改按钮文本为暂停
            const pauseBtn = document.getElementById('pause-scan');
            if (pauseBtn) {
                const pauseText = window.languageManager ? window.languageManager.translate('security-center-pause') : '暂停';
                pauseBtn.textContent = pauseText;
                pauseBtn.onclick = () => this.pauseScan();
            }
        }
    }

    cancelScan() {
        // 显示确认对话框
        const confirmText = window.languageManager ? window.languageManager.translate('security-center-cancel-scan-confirm') : '确定要取消扫描吗？';
        if (confirm(confirmText)) {
            // 停止扫描并关闭弹窗
            this.closeScanModal();
            
            // 可以在这里添加取消扫描的API调用
            // 例如: fetch('/api/cancel-scan', { method: 'POST' });
        }
    }

    showScanResults(data) {
        // 使用翻译键构建消息
        const scanCompleted = window.languageManager ? window.languageManager.translate('security-center-scan-completed') : '扫描完成';
        const scannedFiles = window.languageManager ? window.languageManager.translate('security-center-scanned-files') : '已扫描文件';
        
        let message = `${scanCompleted}!\n${scannedFiles}: ${data.files_scanned}`;
        
        if (data.threats_found > 0) {
            const threatsFound = window.languageManager ? window.languageManager.translate('security-center-threats-found') : '发现威胁';
            const handled = window.languageManager ? window.languageManager.translate('security-center-handle') : '已处理';
            message += `\n${threatsFound}: ${data.threats_found}, ${handled}`;
        } else {
            const noThreats = window.languageManager ? window.languageManager.translate('security-center-device-protected') : '系统安全';
            message += `\n${noThreats}`;
        }

        alert(message);
        
        // 重新加载安全数据
        this.loadSecurityData();
    }

    async toggleSecurityFeature(feature, enabled) {
        try {
            const response = await fetch('/api/security-toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ feature, enabled })
            });

            const data = await response.json();
            
            if (data.success) {
                console.log(data.message);
                // 重新加载安全数据
                this.loadSecurityData();
            } else {
                console.error('切换功能失败:', data.error);
            }
        } catch (error) {
            console.error('切换功能失败:', error);
        }
    }

    checkForUpdates() {
        const checkingMessage = window.languageManager ? 
            window.languageManager.translate('security-center-checking-updates') : 
            '正在检查系统更新...\n这可能需要几分钟时间。';
        alert(checkingMessage);
        
        // 模拟更新检查
        setTimeout(() => {
            const completeMessage = window.languageManager ? 
                window.languageManager.translate('security-center-update-check-complete') : 
                '更新检查完成！\n发现 3 个可用更新，建议尽快安装。';
            alert(completeMessage);
        }, 2000);
    }

    openAccountSettings() {
        const message = window.languageManager ? 
            window.languageManager.translate('security-center-account-settings') : 
            '账户保护设置\n\n当前设置：\n- 用户账户控制：已启用\n- 登录保护：已启用\n- 权限管理：严格模式';
        alert(message);
    }

    showSecurityDetails() {
        const message = window.languageManager ? 
            window.languageManager.translate('security-center-security-details') : 
            '安全详情\n\n系统安全评分：90/100\n\n详细信息：\n- 防火墙：正常运行\n- 病毒防护：实时保护已启用\n- 系统更新：有可用更新\n- 账户保护：已启用';
        alert(message);
    }

    async loadRecommendations() {
        try {
            const response = await fetch('/api/security-recommendations');
            const data = await response.json();

            if (data.error) {
                console.error('获取安全建议失败:', data.error);
                return;
            }

            this.renderRecommendations(data);
        } catch (error) {
            console.error('加载安全建议失败:', error);
        }
    }

    renderRecommendations(recommendations) {
        const container = document.getElementById('recommendations-list');
        if (!container) return;

        container.innerHTML = '';

        recommendations.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recommendation-item';
            
            const iconClass = rec.type === 'warning' ? 'warning' : 'info';
            const iconName = rec.type === 'warning' ? 'exclamation-triangle' : 'info-circle';

            // 使用翻译键或回退到原始文本
            const title = rec.title_key && window.languageManager ? 
                window.languageManager.translate(rec.title_key) : rec.title;
            const description = rec.description_key && window.languageManager ? 
                window.languageManager.translate(rec.description_key) : rec.description;

            item.innerHTML = `
                <div class="recommendation-icon ${iconClass}">
                    <i class="fas fa-${iconName}"></i>
                </div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${title}</div>
                    <div class="recommendation-description">${description}</div>
                </div>
                <div class="recommendation-action">
                    <button class="recommendation-btn" data-i18n="security-center-handle" onclick="securityCenter.handleRecommendation('${rec.action}')">
                        处理
                    </button>
                </div>
            `;

            container.appendChild(item);
        });
        
        // 重新应用翻译
        if (window.languageManager) {
            window.languageManager.applyLanguage();
        }
    }

    handleRecommendation(action) {
        let message;
        switch (action) {
            case 'enable_auto_update':
                message = window.languageManager ? 
                    window.languageManager.translate('security-center-enabling-auto-update') : 
                    '正在启用自动更新...\n自动更新已启用，系统将自动下载并安装安全更新。';
                break;
            case 'setup_backup':
                message = window.languageManager ? 
                    window.languageManager.translate('security-center-backup-settings') : 
                    '数据备份设置\n\n建议：\n- 定期备份重要文件\n- 使用云存储服务\n- 创建系统还原点';
                break;
            case 'update_password_policy':
                message = window.languageManager ? 
                    window.languageManager.translate('security-center-password-policy') : 
                    '密码策略更新\n\n建议：\n- 使用强密码（8位以上）\n- 包含大小写字母、数字和符号\n- 定期更换密码';
                break;
            default:
                message = window.languageManager ? 
                    window.languageManager.translate('security-center-processing-recommendation') : 
                    '正在处理该建议...';
        }
        alert(message);
    }

    async loadSecurityHistory(period) {
        try {
            const response = await fetch(`/api/security-history?period=${period}`);
            const data = await response.json();

            if (data.error) {
                console.error('获取安全历史失败:', data.error);
                return;
            }

            // 处理PowerShell返回的数据结构
            const historyData = data.value || data;
            this.renderSecurityHistory(historyData);
        } catch (error) {
            console.error('加载安全历史失败:', error);
        }
    }

    renderSecurityHistory(history) {
        const container = document.getElementById('history-list');
        if (!container) return;

        container.innerHTML = '';

        if (history.length === 0) {
            const noHistoryText = window.languageManager ? window.languageManager.translate('security-center-no-history') : '暂无历史记录';
            container.innerHTML = `<div style="text-align: center; color: #666; padding: 20px;">${noHistoryText}</div>`;
            return;
        }

        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const iconName = item.type === 'success' ? 'check-circle' : 
                           item.type === 'warning' ? 'exclamation-triangle' : 'times-circle';

            // 使用翻译键或回退到原始文本
            const title = item.title_key && window.languageManager ? 
                window.languageManager.translate(item.title_key) : item.title;
            const description = item.description_key && window.languageManager ? 
                window.languageManager.translate(item.description_key) : item.description;
            const time = item.time_key && window.languageManager ? 
                window.languageManager.translate(item.time_key) : item.time;

            historyItem.innerHTML = `
                <div class="history-icon ${item.type}">
                    <i class="fas fa-${iconName}"></i>
                </div>
                <div class="history-content">
                    <div class="history-title">${title}</div>
                    <div class="history-description">${description}</div>
                    <div class="history-time">${time}</div>
                </div>
            `;

            container.appendChild(historyItem);
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
        // 每2秒自动更新一次，提高刷新频率
        this.updateInterval = setInterval(() => {
            this.loadAlertNotification();
        }, 1000);
    }
    // 切换主题
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
            
            if (icon) {
                icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
            themeToggleBtn.title = isDark ? '切换到浅色主题' : '切换到深色主题';
        }
    }

    // 清理资源
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
    }
}

// 全局变量，供HTML中的onclick使用
let securityCenter;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 确保languageManager已经初始化
    setTimeout(() => {
        securityCenter = new SecurityCenter();
    }, 100);
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', function() {
    if (securityCenter) {
        securityCenter.destroy();
    }
});