class SystemInfoCenter {
    constructor() {
        this.init();
    }

    init() {
        this.loadSystemInfo();
        // 每30秒更新一次系统信息
        setInterval(() => {
            this.loadSystemInfo();
        }, 30000);
    }

    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system-info');
            const data = await response.json();

            if (data.error) {
                console.error('获取系统信息失败:', data.error);
                return;
            }

            this.updateSystemInfo(data);
        } catch (error) {
            console.error('加载系统信息失败:', error);
        }
    }

    updateSystemInfo(data) {
        // 更新各个字段
        this.updateElement('hostname', data.hostname);
        this.updateElement('kernel-version', data.kernel_version);
        this.updateElement('external-ip', data.external_ip, 'ip-address');
        this.updateElement('internal-ip', data.internal_ip, 'ip-address');
        this.updateElement('cpu-info', data.cpu_info, 'cpu-info');
        this.updateElement('memory-info', data.memory_info, 'memory-info');
        this.updateElement('disk-info', data.disk_info, 'disk-info');
        this.updateElement('os-version', data.os_version);
        this.updateElement('uptime', data.uptime_formatted, 'uptime');
        this.updateElement('last-update', data.last_update);

        // 添加状态指示器
        this.addStatusIndicators(data);
    }

    updateElement(id, value, className = '') {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (className) {
                element.className = `info-value ${className}`;
            }
        }
    }

    addStatusIndicators(data) {
        // 为IP地址添加在线状态指示器
        const externalIpElement = document.getElementById('external-ip');
        const internalIpElement = document.getElementById('internal-ip');
        
        if (externalIpElement && !externalIpElement.querySelector('.status-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'status-indicator status-online';
            externalIpElement.insertBefore(indicator, externalIpElement.firstChild);
        }

        if (internalIpElement && !internalIpElement.querySelector('.status-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'status-indicator status-online';
            internalIpElement.insertBefore(indicator, internalIpElement.firstChild);
        }

        // 为CPU添加使用率指示器
        const cpuElement = document.getElementById('cpu-info');
        if (cpuElement && data.cpu_usage !== undefined) {
            let statusClass = 'status-online';
            if (data.cpu_usage > 80) {
                statusClass = 'status-error';
            } else if (data.cpu_usage > 60) {
                statusClass = 'status-warning';
            }

            if (!cpuElement.querySelector('.status-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = `status-indicator ${statusClass}`;
                cpuElement.insertBefore(indicator, cpuElement.firstChild);
            } else {
                const indicator = cpuElement.querySelector('.status-indicator');
                indicator.className = `status-indicator ${statusClass}`;
            }
        }

        // 为内存添加使用率指示器
        const memoryElement = document.getElementById('memory-info');
        if (memoryElement && data.memory_usage !== undefined) {
            let statusClass = 'status-online';
            if (data.memory_usage > 90) {
                statusClass = 'status-error';
            } else if (data.memory_usage > 75) {
                statusClass = 'status-warning';
            }

            if (!memoryElement.querySelector('.status-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = `status-indicator ${statusClass}`;
                memoryElement.insertBefore(indicator, memoryElement.firstChild);
            } else {
                const indicator = memoryElement.querySelector('.status-indicator');
                indicator.className = `status-indicator ${statusClass}`;
            }
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}天 ${hours}小时 ${minutes}分钟`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes}分钟`;
        } else {
            return `${minutes}分钟`;
        }
    }
}

// 导航菜单交互
document.addEventListener('DOMContentLoaded', function() {
    // 初始化系统信息中心
    new SystemInfoCenter();

    // 导航菜单点击事件
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除所有活动状态
            navItems.forEach(nav => nav.classList.remove('active'));
            // 添加当前活动状态
            this.classList.add('active');
            
            // 这里可以添加切换不同页面的逻辑
            console.log('切换到:', this.textContent.trim());
        });
    });

    // 添加鼠标悬停效果
    const infoRows = document.querySelectorAll('.info-row');
    infoRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(2px)';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });
});