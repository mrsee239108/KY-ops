// 语言管理器
class LanguageManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('system-language') || 'zh';
        this.translations = {
            'zh': {
                // 窗口标题栏
                'system-info': '系统信息',
                'toggle-theme': '切换主题',
                'refresh': '刷新',
                'back': '返回',
                
                // 用户信息
                'online': '在线',
                
                // 导航菜单
                'system-status': '系统状态',
                'personalization': '个性化',
                'user-management': '用户管理',
                'ssh-management': 'SSH管理',
                'system-management': '系统管理',
                'mfa': 'MFA',
                'mfa-settings': 'MFA设置',
                'dns-settings': 'DNS设置',
                'swap-memory': 'Swap虚拟内存',
                'expiry-settings': '到期设置',
                'license': '许可证',
                'license-management': '许可证管理',
                
                // 系统状态面板
                'hostname': '主机名称',
                'system-name': '系统名称',
                'kernel-version': '内核版本',
                'cpu-model': 'CPU型号',
                'cpu-architecture': 'CPU架构',
                'cpu-count': 'CPU核心数',
                'memory-total': '内存总大小',
                'memory-free': '内存空闲',
                'gcc-version': 'GCC版本',
                'glibc-version': 'Glibc版本',
                'jdk-version': 'JDK版本',
                'network-info': '网络1',
                'disk-info': '磁盘1',
                'loading': '加载中...',
                
                // 个性化面板
                'personalization-settings': '个性化设置',
                'personalization-desc': '自定义您的系统外观和行为',
                'theme-settings': '主题设置',
                'theme-desc': '选择您喜欢的界面主题',
                'dark-theme': '深色主题',
                'light-theme': '浅色主题',
                'language-settings': '语言设置',
                'language-desc': '选择系统显示语言',
                'chinese': '简体中文',
                'english': 'English',
                
                // 用户管理面板
                'user-management-title': '用户管理',
                'user-management-desc': '管理系统用户账户和权限',
                'add-user': '添加用户',
                'edit-user': '编辑用户',
                'delete-user': '删除用户',
                'system-admin': '系统管理员',
                
                // SSH管理面板
                'ssh-management-title': 'SSH管理',
                'ssh-management-desc': '管理SSH连接和密钥',
                'ssh-service-status': 'SSH服务状态',
                'ssh-running-port': '运行中 - 端口 22',
                'ssh-stopped': '已停止',
                'stop': '停止',
                'start': '启动',
                'active-connections': '活动连接',
                'disconnect': '断开',
                'minutes-ago': '2分钟前',
                'ssh-service-stopped': 'SSH服务已停止',
                'ssh-service-started': 'SSH服务已启动',
                'ssh-connection-disconnected': 'SSH连接已断开',
                
                // 系统管理面板
                'system-management-title': '系统管理',
                'system-management-desc': '系统服务和进程管理',
                'system-control': '系统控制',
                'restart-system': '重启系统',
                'shutdown-system': '关闭系统',
                'system-update': '系统更新',
                'system-services': '系统服务',
                'running': '运行中',
                'restart': '重启',
                
                // MFA面板
                'mfa-title': '多因素认证 (MFA)',
                'mfa-desc': '增强账户安全性',
                'totp-authenticator': 'TOTP认证器',
                'hardware-key': '硬件密钥',
                'not-enabled': '未启用',
                'not-configured': '未配置',
                'enable': '启用',
                'configure': '配置',
                
                // DNS设置面板
                'dns-settings-title': 'DNS设置',
                'dns-settings-desc': '配置域名解析服务器',
                'primary-dns': '主DNS服务器',
                'secondary-dns': '备用DNS服务器',
                'primary-dns-placeholder': '主DNS服务器地址',
                'secondary-dns-placeholder': '备用DNS服务器地址',
                'save-settings': '保存设置',
                'test-connection': '测试连接',
                
                // Swap虚拟内存面板
                'swap-memory-title': 'Swap虚拟内存',
                'swap-memory-desc': '管理系统虚拟内存设置',
                'current-swap-status': '当前Swap状态',
                'total-capacity': '总容量:',
                'used': '已使用:',
                'usage-rate': '使用率:',
                
                // 到期设置面板
                'expiry-settings-title': '到期设置',
                'expiry-settings-desc': '管理系统和服务到期时间',
                'ssl-certificate': 'SSL证书',
                'expiry-time': '到期时间: 2024-12-31',
                'expires-in-30-days': '30天后到期',
                'renew': '续期',
                'license-expiry': '许可证',
                'license-expiry-time': '到期时间: 2025-06-15',
                'expires-in-180-days': '180天后到期',
                'view-details': '查看详情',
                
                // 许可证面板
                'license-management': '许可证管理',
                'license-management-desc': '查看和管理系统许可证',
                'system-license': '系统许可证',
                'valid': '有效',
                'license-type': '许可证类型:',
                'enterprise': '企业版',
                'authorized-users': '授权用户:',
                'unlimited': '无限制',
                'expiry-date': '到期时间:',
                'update-license': '更新许可证',
                'export-license': '导出许可证'
            },
            'en': {
                // 窗口标题栏
                'system-info': 'System Information',
                'toggle-theme': 'Toggle Theme',
                'refresh': 'Refresh',
                'back': 'Back',
                
                // 用户信息
                'online': 'Online',
                
                // 导航菜单
                'system-status': 'System Status',
                'personalization': 'Personalization',
                'user-management': 'User Management',
                'ssh-management': 'SSH Management',
                'system-management': 'System Management',
                'mfa': 'MFA',
                'mfa-settings': 'MFA Settings',
                'dns-settings': 'DNS Settings',
                'swap-memory': 'Swap Memory',
                'expiry-settings': 'Expiry Settings',
                'license': 'License',
                'license-management': 'License Management',
                
                // 系统状态面板
                'hostname': 'Hostname',
                'system-name': 'System Name',
                'kernel-version': 'Kernel Version',
                'cpu-model': 'CPU Model',
                'cpu-architecture': 'CPU Architecture',
                'cpu-count': 'CPU Cores',
                'memory-total': 'Total Memory',
                'memory-free': 'Free Memory',
                'gcc-version': 'GCC Version',
                'glibc-version': 'Glibc Version',
                'jdk-version': 'JDK Version',
                'network-info': 'Network 1',
                'disk-info': 'Disk 1',
                'loading': 'Loading...',
                
                // 个性化面板
                'personalization-settings': 'Personalization Settings',
                'personalization-desc': 'Customize your system appearance and behavior',
                'theme-settings': 'Theme Settings',
                'theme-desc': 'Choose your preferred interface theme',
                'dark-theme': 'Dark Theme',
                'light-theme': 'Light Theme',
                'language-settings': 'Language Settings',
                'language-desc': 'Select system display language',
                'chinese': '简体中文',
                'english': 'English',
                
                // 用户管理面板
                'user-management-title': 'User Management',
                'user-management-desc': 'Manage system user accounts and permissions',
                'add-user': 'Add User',
                'edit-user': 'Edit User',
                'delete-user': 'Delete User',
                'system-admin': 'System Administrator',
                
                // SSH管理面板
                'ssh-management-title': 'SSH Management',
                'ssh-management-desc': 'Manage SSH connections and keys',
                'ssh-service-status': 'SSH Service Status',
                'ssh-running-port': 'Running - Port 22',
                'ssh-stopped': 'Stopped',
                'stop': 'Stop',
                'start': 'Start',
                'active-connections': 'Active Connections',
                'disconnect': 'Disconnect',
                'minutes-ago': '2 minutes ago',
                'ssh-service-stopped': 'SSH service stopped',
                'ssh-service-started': 'SSH service started',
                'ssh-connection-disconnected': 'SSH connection disconnected',
                
                // 系统管理面板
                'system-management-title': 'System Management',
                'system-management-desc': 'System services and process management',
                'system-control': 'System Control',
                'restart-system': 'Restart System',
                'shutdown-system': 'Shutdown System',
                'system-update': 'System Update',
                'system-services': 'System Services',
                'running': 'Running',
                'restart': 'Restart',
                
                // MFA面板
                'mfa-title': 'Multi-Factor Authentication (MFA)',
                'mfa-desc': 'Enhance account security',
                'totp-authenticator': 'TOTP Authenticator',
                'hardware-key': 'Hardware Key',
                'not-enabled': 'Not Enabled',
                'not-configured': 'Not Configured',
                'enable': 'Enable',
                'configure': 'Configure',
                
                // DNS设置面板
                'dns-settings-title': 'DNS Settings',
                'dns-settings-desc': 'Configure domain name resolution servers',
                'primary-dns': 'Primary DNS Server',
                'secondary-dns': 'Secondary DNS Server',
                'primary-dns-placeholder': 'Primary DNS server address',
                'secondary-dns-placeholder': 'Secondary DNS server address',
                'save-settings': 'Save Settings',
                'test-connection': 'Test Connection',
                
                // Swap虚拟内存面板
                'swap-memory-title': 'Swap Virtual Memory',
                'swap-memory-desc': 'Manage system virtual memory settings',
                'current-swap-status': 'Current Swap Status',
                'total-capacity': 'Total Capacity:',
                'used': 'Used:',
                'usage-rate': 'Usage Rate:',
                
                // 到期设置面板
                'expiry-settings-title': 'Expiry Settings',
                'expiry-settings-desc': 'Manage system and service expiry times',
                'ssl-certificate': 'SSL Certificate',
                'expiry-time': 'Expiry Time: 2024-12-31',
                'expires-in-30-days': 'Expires in 30 days',
                'renew': 'Renew',
                'license-expiry': 'License',
                'license-expiry-time': 'Expiry Time: 2025-06-15',
                'expires-in-180-days': 'Expires in 180 days',
                'view-details': 'View Details',
                
                // 许可证面板
                'license-management': 'License Management',
                'license-management-desc': 'View and manage system licenses',
                'system-license': 'System License',
                'valid': 'Valid',
                'license-type': 'License Type:',
                'enterprise': 'Enterprise',
                'authorized-users': 'Authorized Users:',
                'unlimited': 'Unlimited',
                'expiry-date': 'Expiry Date:',
                'update-license': 'Update License',
                'export-license': 'Export License'
            }
        };
    }

    // 初始化语言管理器
    init() {
        this.setupLanguageSelector();
        this.applyLanguage(this.currentLanguage);
    }

    // 设置语言选择器
    setupLanguageSelector() {
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.currentLanguage;
            languageSelect.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }
    }

    // 更改语言
    changeLanguage(language) {
        this.currentLanguage = language;
        localStorage.setItem('system-language', language);
        this.applyLanguage(language);
    }

    // 应用语言
    applyLanguage(language) {
        const translations = this.translations[language];
        if (!translations) return;

        // 更新所有带有 data-i18n 属性的元素
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[key]) {
                if (element.tagName === 'INPUT' && element.type === 'text') {
                    element.placeholder = translations[key];
                } else if (element.tagName === 'OPTION') {
                    element.textContent = translations[key];
                } else {
                    element.textContent = translations[key];
                }
            }
        });

        // 更新所有带有 data-i18n-title 属性的元素的title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (translations[key]) {
                element.title = translations[key];
            }
        });

        // 更新页面标题
        document.title = translations['system-info'] || 'System Information';

        // 更新HTML lang属性
        document.documentElement.lang = language;

        // 更新面包屑导航
        this.updateBreadcrumb(language);
    }

    // 获取当前语言的翻译
    t(key) {
        return this.translations[this.currentLanguage][key] || key;
    }

    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // 更新面包屑导航
    updateBreadcrumb(language) {
        const breadcrumb = document.querySelector('.breadcrumb span');
        if (breadcrumb) {
            const activeNavItem = document.querySelector('.nav-item.active span');
            if (activeNavItem) {
                const key = activeNavItem.getAttribute('data-i18n');
                if (key && this.translations[language][key]) {
                    breadcrumb.textContent = this.translations[language][key];
                }
            }
        }
    }

    // 更新系统信息值的显示（当数据加载完成后调用）
    updateSystemInfoValues() {
        // 移除所有系统信息值元素的data-i18n属性，避免被翻译覆盖
        const systemInfoValues = [
            'hostname', 'system-name', 'kernel-version', 'cpu-model', 
            'cpu-architecture', 'cpu-count', 'memory-total', 'memory-free',
            'gcc-version', 'glibc-version', 'jdk-version', 'network-info', 'disk-info'
        ];
        
        systemInfoValues.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.textContent !== '加载中...' && element.textContent !== 'Loading...') {
                element.removeAttribute('data-i18n');
            }
        });
    }
}

// 导出语言管理器
window.LanguageManager = LanguageManager;