// 通用功能函数
function refreshPage() {
    location.reload();
}

function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
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
class PerformanceMonitor {
    constructor() {
        console.log('PerformanceMonitor构造函数开始执行...');
        this.currentSection = 'overview';
        this.charts = {};
        this.updateInterval = null;
        this.performanceData = {
            cpu: [],
            memory: [],
            disk: [],
            network: []
        };
        this.maxDataPoints = 60; // 保留60个数据点
        this.currentAlerts = new Map(); // 存储当前活动的告警
        this.alertTypeMap = {
            'cpu-overload': { type: 'warning', title: 'CPU 过载' },
            'memory-overload': { type: 'error', title: '内存不足' },
            'disk-space-overload': { type: 'error', title: '磁盘空间不足' },
            'disk-io-overload': { type: 'warning', title: '磁盘IO过载' },
            'network-overload': { type: 'warning', title: '网络过载' },
            'high-process-load': { type: 'info', title: '高进程负载' }
        };
        console.log('PerformanceMonitor属性初始化完成，开始调用init()...');
        this.init();
    }

    init() {
        console.log('init()方法开始执行...');
        this.setupEventListeners();
        console.log('事件监听器设置完成');
        
        // 初始化语言管理器
        if (window.languageManager && !window.languageManager.initialized) {
            window.languageManager.init();
        }
        
        // 监听主题变化（在图表初始化之前设置）
        this.setupThemeListener();
        
        this.initializeCharts();
        console.log('图表初始化完成');
        
        // 立即应用当前主题
        setTimeout(() => {
            this.updateChartTheme();
            console.log('初始主题应用完成');
        }, 100);
        
        this.loadPerformanceData();
        console.log('首次数据加载完成');
        this.loadAlertNotification();
        console.log('首次状态加载成功');
        this.startAutoUpdate();
        console.log('自动更新启动完成');
        // 初始化主题图标
        setTimeout(() => {
            this.updateThemeIcon();
        }, 200);
    }

    getChartColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            cpu: style.getPropertyValue('--chart-cpu').trim() || '#00ff88',
            memory: style.getPropertyValue('--chart-memory').trim() || '#00bcd4',
            disk: style.getPropertyValue('--chart-disk').trim() || '#ff9800',
            networkUpload: style.getPropertyValue('--chart-network-upload').trim() || '#00ff88',
            networkDownload: style.getPropertyValue('--chart-network-download').trim() || '#00bcd4',
            text: style.getPropertyValue('--chart-text').trim() || '#ffffff',
            grid: style.getPropertyValue('--chart-grid').trim() || 'rgba(255, 255, 255, 0.1)',
            tooltipBg: style.getPropertyValue('--chart-tooltip-bg').trim() || 'rgba(45, 45, 45, 0.9)',
            tooltipBorder: style.getPropertyValue('--chart-tooltip-border').trim() || '#3c3c3c'
        };
    }

    hexToRgba(hex, alpha = 0.1) {
        if (!hex) return `rgba(0, 0, 0, ${alpha})`;
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgba(0, 0, 0, ${alpha})`;
    }

    updateChartTheme() {
        const colors = this.getChartColors();
        
        // 更新所有图表的颜色
        Object.keys(this.charts).forEach(chartKey => {
            const chart = this.charts[chartKey];
            if (!chart) return;

            // 更新图表选项中的颜色
            if (chart.options.plugins.legend) {
                chart.options.plugins.legend.labels.color = colors.text;
            }
            
            if (chart.options.plugins.tooltip) {
                chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
                chart.options.plugins.tooltip.titleColor = colors.text;
                chart.options.plugins.tooltip.bodyColor = colors.text;
                chart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
            }

            if (chart.options.scales) {
                if (chart.options.scales.x) {
                    chart.options.scales.x.grid.color = colors.grid;
                    chart.options.scales.x.ticks.color = colors.text;
                }
                if (chart.options.scales.y) {
                    chart.options.scales.y.grid.color = colors.grid;
                    chart.options.scales.y.ticks.color = colors.text;
                }
            }

            // 更新数据集颜色
            chart.data.datasets.forEach((dataset, index) => {
                if (chartKey.includes('cpu')) {
                    dataset.borderColor = colors.cpu;
                    dataset.backgroundColor = this.hexToRgba(colors.cpu, 0.1);
                } else if (chartKey.includes('memory')) {
                    dataset.borderColor = colors.memory;
                    dataset.backgroundColor = this.hexToRgba(colors.memory, 0.1);
                } else if (chartKey.includes('disk')) {
                    dataset.borderColor = colors.disk;
                    dataset.backgroundColor = this.hexToRgba(colors.disk, 0.1);
                } else if (chartKey.includes('network')) {
                    if (index === 0) { // 上传
                        dataset.borderColor = colors.networkUpload;
                        dataset.backgroundColor = this.hexToRgba(colors.networkUpload, 0.1);
                    } else { // 下载
                        dataset.borderColor = colors.networkDownload;
                        dataset.backgroundColor = this.hexToRgba(colors.networkDownload, 0.1);
                    }
                }
            });

            chart.update('none');
        });

        // 强制更新网络接口表格的主题
        this.updateNetworkInterfacesTheme();
    }

    updateNetworkInterfacesTheme() {
        // 强制重新渲染网络接口表格以应用新主题
        if (this.lastNetworkData) {
            this.updateNetworkInterfaces(this.lastNetworkData);
        }
    }

    updateChartLabels() {
        if (!window.languageManager) return;
        
        // 更新CPU详细图表标签
        if (this.charts.cpuDetailed) {
            this.charts.cpuDetailed.data.datasets[0].label = window.languageManager.t('performance-monitor-cpu-usage-chart');
            this.charts.cpuDetailed.update('none');
        }
        
        // 更新内存详细图表标签
        if (this.charts.memoryDetailed) {
            this.charts.memoryDetailed.data.datasets[0].label = window.languageManager.t('performance-monitor-memory-usage-chart');
            this.charts.memoryDetailed.update('none');
        }
        
        // 更新磁盘详细图表标签
        if (this.charts.diskDetailed) {
            this.charts.diskDetailed.data.datasets[0].label = window.languageManager.t('performance-monitor-disk-usage-chart');
            this.charts.diskDetailed.update('none');
        }
        
        // 更新网络详细图表标签
        if (this.charts.networkDetailed) {
            this.charts.networkDetailed.data.datasets[0].label = window.languageManager.t('performance-monitor-network-upload-chart');
            this.charts.networkDetailed.data.datasets[1].label = window.languageManager.t('performance-monitor-network-download-chart');
            this.charts.networkDetailed.update('none');
        }
        
        // 触发UI更新以刷新动态文本
        if (this.lastData) {
            this.updateUI(this.lastData);
        }
    }

    setupThemeListener() {
        // 监听主题变化事件
        document.addEventListener('themeChanged', () => {
            this.updateChartTheme();
        });
        
        // 监听body类变化（备用方案）
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.updateChartTheme();
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    setupEventListeners() {
        // 主题切换按钮事件
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // 导航项点击事件
        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchSection(e.currentTarget.dataset.section);
            });
        });

        // 窗口大小改变时重新调整图表
        window.addEventListener('resize', () => {
            this.resizeCharts();
        });
        
        // 监听语言切换事件
        document.addEventListener('languageChanged', () => {
            this.updateChartLabels();
        });
    }

    switchSection(sectionName) {
        // 更新导航状态
        document.querySelectorAll('.nav-item[data-section]').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // 切换内容
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');

        this.currentSection = sectionName;
        
        // 重新调整当前显示的图表
        setTimeout(() => {
            this.resizeCharts();
        }, 100);
    }

    initializeCharts() {
        const colors = this.getChartColors();
        
        // 设置Chart.js默认配置
        Chart.defaults.color = colors.text;
        Chart.defaults.borderColor = colors.grid;
        Chart.defaults.backgroundColor = this.hexToRgba(colors.cpu, 0.1);

        // 初始化小图表
        this.initSmallCharts();
        
        // 初始化详细图表
        this.initDetailedCharts();
    }

    initSmallCharts() {
        const colors = this.getChartColors();
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 },
                line: { tension: 0.4 }
            },
            animation: { duration: 0 }
        };

        // CPU小图表
        this.charts.cpuSmall = new Chart(document.getElementById('cpu-chart'), {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    data: Array(20).fill(0),
                    borderColor: colors.cpu,
                    backgroundColor: this.hexToRgba(colors.cpu, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: chartOptions
        });

        // 内存小图表
        this.charts.memorySmall = new Chart(document.getElementById('memory-chart'), {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    data: Array(20).fill(0),
                    borderColor: colors.memory,
                    backgroundColor: this.hexToRgba(colors.memory, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: chartOptions
        });

        // 磁盘小图表
        this.charts.diskSmall = new Chart(document.getElementById('disk-chart'), {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    data: Array(20).fill(0),
                    borderColor: colors.disk,
                    backgroundColor: this.hexToRgba(colors.disk, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: chartOptions
        });

        // 网络小图表
        this.charts.networkSmall = new Chart(document.getElementById('network-chart'), {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    data: Array(20).fill(0),
                    borderColor: colors.networkUpload,
                    backgroundColor: this.hexToRgba(colors.networkUpload, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: chartOptions
        });
    }

    initDetailedCharts() {
        const colors = this.getChartColors();
        
        const detailedChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: colors.text }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: colors.tooltipBg,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.tooltipBorder,
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: { color: colors.grid },
                    ticks: { color: colors.text }
                },
                y: {
                    display: true,
                    grid: { color: colors.grid },
                    ticks: { color: colors.text },
                    beginAtZero: true,
                    max: 100
                }
            },
            elements: {
                point: { radius: 2 },
                line: { tension: 0.4 }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        };

        // CPU详细图表
        this.charts.cpuDetailed = new Chart(document.getElementById('cpu-detailed-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: window.languageManager ? window.languageManager.t('performance-monitor-cpu-usage-chart') : 'CPU 使用率 (%)',
                    data: [],
                    borderColor: colors.cpu,
                    backgroundColor: this.hexToRgba(colors.cpu, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: detailedChartOptions
        });

        // 内存详细图表
        this.charts.memoryDetailed = new Chart(document.getElementById('memory-detailed-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: window.languageManager ? window.languageManager.t('performance-monitor-memory-usage-chart') : '内存使用率 (%)',
                    data: [],
                    borderColor: colors.memory,
                    backgroundColor: this.hexToRgba(colors.memory, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: detailedChartOptions
        });

        // 磁盘详细图表
        this.charts.diskDetailed = new Chart(document.getElementById('disk-detailed-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: window.languageManager ? window.languageManager.t('performance-monitor-disk-usage-chart') : '磁盘使用率 (%)',
                    data: [],
                    borderColor: colors.disk,
                    backgroundColor: this.hexToRgba(colors.disk, 0.1),
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: detailedChartOptions
        });

        // 网络详细图表 - 使用深拷贝避免修改原始配置
        const networkChartOptions = JSON.parse(JSON.stringify(detailedChartOptions));
        networkChartOptions.scales.y.max = null; // 网络图表不限制最大值

        this.charts.networkDetailed = new Chart(document.getElementById('network-detailed-chart'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: window.languageManager ? window.languageManager.t('performance-monitor-network-upload-chart') : '上传 (KB/s)',
                    data: [],
                    borderColor: colors.networkUpload,
                    backgroundColor: this.hexToRgba(colors.networkUpload, 0.1),
                    fill: false,
                    borderWidth: 2
                }, {
                    label: window.languageManager ? window.languageManager.t('performance-monitor-network-download-chart') : '下载 (KB/s)',
                    data: [],
                    borderColor: colors.networkDownload,
                    backgroundColor: this.hexToRgba(colors.networkDownload, 0.1),
                    fill: false,
                    borderWidth: 2
                }]
            },
            options: networkChartOptions
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

    async loadPerformanceData() {
        try {
            console.log('开始加载性能数据...', new Date().toLocaleTimeString());
            
            // 使用XMLHttpRequest替代fetch
            const xhr = new XMLHttpRequest();
            xhr.open('GET', '/api/performance-data', true);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('Content-Type', 'application/json');
            console.log('XMLHttpRequest已配置，准备发送请求...');
            
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText); // 解析JSON数据
                            console.log('成功获取数据:', data);
                            console.log('CPU核心数据:', data.cpu_percent);
                            console.log('CPU平均使用率:', data.cpu_average);
                            this.updatePerformanceData(data);
                            this.updateUI(data);
                        } catch (parseError) {
                            console.error('解析JSON失败:', parseError);
                            //this.generateMockData();
                        }
                    } else {
                        console.error('HTTP错误:', xhr.status, xhr.statusText);
                        //this.generateMockData();
                    }
                }
            };
            
            xhr.onerror = () => {
                console.error('网络错误');
                //this.generateMockData();
            };
            
            xhr.send(); // 使用异步请求
        } catch (error) {
            console.error('加载性能数据失败:', error);
            // 使用模拟数据继续运行
            //this.generateMockData();
        }
    }

    generateMockData() {
        // 生成更真实的CPU核心数据 - 使用32核心匹配实际系统
        const coreCount = 32; // 匹配实际的32逻辑核心
        const cpuCores = Array(coreCount).fill(0).map(() => {
            // 生成0-80%之间的随机CPU使用率，大部分核心使用率较低
            const baseUsage = Math.random() * 15; // 0-15%基础使用率
            const spikeChance = Math.random();
            if (spikeChance < 0.1) {
                // 10%概率出现高负载
                return baseUsage + Math.random() * 60 + 20; // 20-80%
            } else if (spikeChance < 0.3) {
                // 20%概率出现中等负载
                return baseUsage + Math.random() * 25 + 10; // 10-35%
            } else {
                // 70%概率保持低负载
                return baseUsage; // 0-15%
            }
        });

        const mockData = {
            cpu_name: "13th Gen Intel(R) Core(TM) i9-13900KF (24核心/32线程)",
            cpu_average: cpuCores.reduce((sum, usage) => sum + usage, 0) / cpuCores.length,
            cpu_percent: cpuCores,
            cpu_frequency: {
                current: 5200,
                min: 0.0,
                max: 5800,
                base: 3000,
                boost: true,
                turbo_max: 5800
            },
            cpu_count_physical: 24,
            cpu_count_logical: 32,
            memory_percent: Math.random() * 30 + 15,
            memory_used: 8 * 1024 * 1024 * 1024, // 8GB
            memory_total: 31 * 1024 * 1024 * 1024, // 31GB
            memory_free: 23 * 1024 * 1024 * 1024, // 23GB
            memory_cached: 128 * 1024 * 1024, // 128MB
            memory_buffers: 64 * 1024 * 1024, // 64MB
            disk_usage: Math.random() * 40 + 20,
            network_sent: Math.random() * 10,
            network_recv: Math.random() * 50,
            load_avg: [0.09, 0.06, 0.05],
            processes: {
                total: 136,
                running: 2,
                sleeping: 134
            }
        };

        console.log('生成模拟数据:', mockData);
        console.log('模拟CPU核心数据:', mockData.cpu_percent);

        this.updatePerformanceData(mockData);
        this.updateUI(mockData);
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

    updatePerformanceData(data) {
        const timestamp = new Date().toLocaleTimeString();

        // 更新CPU数据
        this.performanceData.cpu.push({
            timestamp,
            value: data.cpu_average || 0,
            cores: data.cpu_percent || [],
            frequency: data.cpu_frequency || {},
            load_avg: data.load_avg || [0, 0, 0]
        });

        // 更新内存数据
        this.performanceData.memory.push({
            timestamp,
            value: data.memory_percent || 0,
            used: data.memory_used || 0,
            total: data.memory_total || 0,
            available: data.memory_free || 0,
            cached: data.memory_cached || 0,
            buffers: data.memory_buffers || 0
        });

        // 更新磁盘数据
        const diskUsageAvg = data.total_utilization;
        
        this.performanceData.disk.push({
            timestamp,
            value: diskUsageAvg,
            disks: data.disk_usage || [],
            io: data.disk_io || {}
        });

        // 更新网络数据
        this.performanceData.network.push({
            timestamp,
            // bytes/s -> KB/s
            sent: data.network_io ? data.tx_speed / 1024 : 0,
            recv: data.network_io ? data.rx_speed / 1024 : 0,
            interfaces: data.network_interfaces || {}
        });

        // 限制数据点数量
        Object.keys(this.performanceData).forEach(key => {
            if (this.performanceData[key].length > this.maxDataPoints) {
                this.performanceData[key] = this.performanceData[key].slice(-this.maxDataPoints);
            }
        });

        // 更新图表
        this.updateCharts();
        
        // 存储最新数据用于详细显示
        this.latestData = data;
    }

    updateCharts() {
        // 更新小图表
        this.updateSmallChart('cpuSmall', this.performanceData.cpu.map(d => d.value));
        this.updateSmallChart('memorySmall', this.performanceData.memory.map(d => d.value));
        this.updateSmallChart('diskSmall', this.performanceData.disk.map(d => d.value));
        this.updateSmallChart('networkSmall', this.performanceData.network.map(d => d.recv));

        // 更新详细图表
        this.updateDetailedChart('cpuDetailed', 
            this.performanceData.cpu.map(d => d.timestamp),
            [this.performanceData.cpu.map(d => d.value)]
        );

        this.updateDetailedChart('memoryDetailed',
            this.performanceData.memory.map(d => d.timestamp),
            [this.performanceData.memory.map(d => d.value)]
        );

        this.updateDetailedChart('diskDetailed',
            this.performanceData.disk.map(d => d.timestamp),
            [this.performanceData.disk.map(d => d.value)]
        );

        this.updateDetailedChart('networkDetailed',
            this.performanceData.network.map(d => d.timestamp),
            [
                this.performanceData.network.map(d => d.sent),
                this.performanceData.network.map(d => d.recv)
            ]
        );
    }

    updateSmallChart(chartName, data) {
        const chart = this.charts[chartName];
        if (chart) {
            // 只保留最后20个数据点用于小图表
            const recentData = data.slice(-20);
            chart.data.datasets[0].data = recentData;
            chart.update('none');
        }
    }

    updateDetailedChart(chartName, labels, datasets) {
        const chart = this.charts[chartName];
        if (chart) {
            chart.data.labels = labels;
            datasets.forEach((data, index) => {
                if (chart.data.datasets[index]) {
                    chart.data.datasets[index].data = data;
                }
            });
            chart.update('none');
        }
    }

    updateUI(data) {
        console.log('开始更新UI，接收到的数据:', data);
        
        // 保存数据以供语言切换时使用
        this.lastData = data;
        
        // 更新概览页面的数值
        this.updateElement('cpu-usage', `${(data.cpu_average || 0).toFixed(2)}%`);
        this.updateElement('cpu-usage-text', `${(data.cpu_average || 0).toFixed(2)}%`);
        this.updateElement('memory-usage', `${(data.memory_percent || 0).toFixed(2)}%`);
        this.updateElement('memory-usage-text', `${window.languageManager ? window.languageManager.t('performance-monitor-memory-used-label') : '已使用：'}${this.formatBytes(data.memory_used || 0)}`);
        // 更新CPU名称和详细信息
        if (data.cpu_name) {
            this.updateElement('cpu-model', data.cpu_name);
            this.updateElement('cpu-details-header', `${data.cpu_name} - ${(data.cpu_average || 0).toFixed(2)}%`);
        }
        
        // 更新内存大小和详细信息
        if (data.memory_total) {
            this.updateElement('memory-size', this.formatBytes(data.memory_total));
            this.updateElement('memory-details-header', 
                `${this.formatBytes(data.memory_total)} ${window.languageManager ? window.languageManager.t('performance-monitor-total-memory') : '总内存'} - ${(data.memory_percent || 0).toFixed(2)}% ${window.languageManager ? window.languageManager.t('performance-monitor-memory-used') : '已使用'}`);
        }
        
        // 计算平均磁盘使用率
        const avgDiskUsage = data.total_utilization;
        this.updateElement('disk-usage', `${(avgDiskUsage).toFixed(2)}%`);
        this.updateElement('disk-usage-text',`${(avgDiskUsage).toFixed(2)}%`)
        this.updateElement('disk-details-header', `${window.languageManager ? window.languageManager.t('performance-monitor-average-disk-usage') : '平均磁盘使用率：'}${(avgDiskUsage).toFixed(2)}%`);

        // 计算总体负载
        //const totalLoad = data.load_avg ? Math.round(data.load_avg[0] * 100) : Math.round(data.cpu_average || 0);
        //改成小数：
        const totalLoad = data.load_avg ? data.load_avg[0] : data.cpu_average || 0;
        this.updateElement('total-load', `${((totalLoad)?.toFixed(2))}`);

        // 更新负载平均值
        if (data.load_avg) {
            this.updateElement('load-1min', `${((data.load_avg[0])?.toFixed(2))}` || '0.00');
            this.updateElement('load-5min', `${((data.load_avg[1])?.toFixed(2))}` || '0.00');
            this.updateElement('load-15min', `${((data.load_avg[2])?.toFixed(2))}` || '0.00');
        }

        //是否有CPU详细信息
        this.updateElement('usr', data.cpu_details.usr?.toFixed(2) || '0.00');
        this.updateElement('nice', data.cpu_details.nice?.toFixed(2) || '0.00');
        this.updateElement('sys', data.cpu_details.sys?.toFixed(2) || '0.00');
        this.updateElement('iowait', data.cpu_details.iowait?.toFixed(2) || '0.00');
        this.updateElement('irq', data.cpu_details.irq?.toFixed(2) || '0.00');
        this.updateElement('soft', data.cpu_details.soft?.toFixed(2) || '0.00');
        this.updateElement('steal', data.cpu_details.steal?.toFixed(2) || '0.00');
        this.updateElement('guest', data.cpu_details.guest?.toFixed(2) || '0.00');
        this.updateElement('gnice', data.cpu_details.gnice?.toFixed(2) || '0.00');
        this.updateElement('idle', data.cpu_details.idle?.toFixed(2) || '0.00');


        // 更新内存详细信息
        this.updateElement('memory-used', this.formatBytes(data.memory_used || 0));
        this.updateElement('memory-free', this.formatBytes(data.memory_free || 0));
        this.updateElement('memory-cached', this.formatBytes(data.memory_cached || 0));
        this.updateElement('memory-buffers', this.formatBytes(data.memory_buffers || 0));


        // 更新CPU详细信息
        this.updateCpuDetails(data);
        
        // 更新CPU核心信息 - 添加详细调试
        console.log('准备更新CPU核心，数据:', data.cpu_percent);
        console.log('CPU核心数据类型:', typeof data.cpu_percent);
        console.log('CPU核心数据是否为数组:', Array.isArray(data.cpu_percent));
        if (data.cpu_percent) {
            console.log('CPU核心数据长度:', data.cpu_percent.length);
            console.log('核心数据:', data.cpu_percent_per_core);
        }
        this.updateCpuCores(data.cpu_percent_per_core || []);

        // 更新磁盘列表
        this.updateDiskList(data.disk_usage || []);

        // 更新网络接口
        this.updateNetworkInterfaces(data.network_interfaces || {});

        let info = '';
        info = `↑${this.formatBytes(data.tx_speed)}/s  ↓${this.formatBytes(data.rx_speed)}/s`;
        this.updateElement('network-status', info);

        // 获取第一个网络接口的名称
        const firstInterfaceName = data.network_interfaces && Object.keys(data.network_interfaces).length > 0
            ? Object.keys(data.network_interfaces)[0]
            : 'N/A';
        this.updateElement('network-name', firstInterfaceName);

        // 更新进程信息
        this.updateTopProcesses(data.top_processes || []);
        
        // 更新电池信息（如果有）
        this.updateBatteryInfo(data.battery);
        
        console.log('UI更新完成');
    }

    updateCpuDetails(data) {
        // 更新CPU频率信息
        if (data.cpu_frequency) {
            const currentFreq = data.cpu_frequency.current || 0;
            const maxFreq = data.cpu_frequency.max || 0;
            const baseFreq = data.cpu_frequency.base || 0;
            const turboMax = data.cpu_frequency.turbo_max || 0;
            const isBoost = data.cpu_frequency.boost || false;
            const cores = data.cpu_frequency.cores || [];
            
            // 显示当前频率（实时频率）
            let currentFreqText = '';
            if (currentFreq > 0) {
                if (currentFreq >= 1000) {
                    currentFreqText = `${(currentFreq / 1000).toFixed(2)} GHz`;
                } else {
                    currentFreqText = `${Math.round(currentFreq)} MHz`;
                }
                
                // 如果启用了Turbo Boost，添加标识
                if (isBoost && baseFreq > 0 && currentFreq > baseFreq * 1.05) {
                    currentFreqText += ' (Turbo)';
                }
            } else {
                currentFreqText = 'N/A';
            }
            
            this.updateElement('cpu-frequency-current', currentFreqText);
            
            // 显示最大频率
            let maxFreqText = 'N/A';
            if (maxFreq > 0) {
                if (maxFreq >= 1000) {
                    maxFreqText = `${(maxFreq / 1000).toFixed(2)} GHz`;
                } else {
                    maxFreqText = `${Math.round(maxFreq)} MHz`;
                }
            }
            this.updateElement('cpu-frequency-max', maxFreqText);
            
            // 如果有基准频率信息，更新显示
            if (baseFreq > 0) {
                // 查找或创建基准频率显示元素
                let baseFreqElement = document.getElementById('cpu-frequency-base');
                if (!baseFreqElement) {
                    // 在最大频率后面添加基准频率显示
                    const maxFreqContainer = document.getElementById('cpu-frequency-max').parentElement;
                    const baseFreqContainer = document.createElement('div');
                    baseFreqContainer.className = 'info-item';
                    baseFreqContainer.innerHTML = `
                        <span class="info-label">基准频率</span>
                        <span class="info-value" id="cpu-frequency-base">N/A</span>
                    `;
                    maxFreqContainer.parentElement.insertBefore(baseFreqContainer, maxFreqContainer.nextSibling);
                    baseFreqElement = document.getElementById('cpu-frequency-base');
                }
                
                let baseFreqText = '';
                if (baseFreq >= 1000) {
                    baseFreqText = `${(baseFreq / 1000).toFixed(2)} GHz`;
                } else {
                    baseFreqText = `${Math.round(baseFreq)} MHz`;
                }
                this.updateElement('cpu-frequency-base', baseFreqText);
            }
            
            // 显示Turbo最大频率
            if (turboMax > 0) {
                let turboMaxElement = document.getElementById('cpu-frequency-turbo-max');
                if (!turboMaxElement) {
                    const baseFreqContainer = document.getElementById('cpu-frequency-base')?.parentElement;
                    if (baseFreqContainer) {
                        const turboMaxContainer = document.createElement('div');
                        turboMaxContainer.className = 'info-item';
                        turboMaxContainer.innerHTML = `
                            <span class="info-label">Turbo最大</span>
                            <span class="info-value" id="cpu-frequency-turbo-max">N/A</span>
                        `;
                        baseFreqContainer.parentElement.insertBefore(turboMaxContainer, baseFreqContainer.nextSibling);
                    }
                }
                
                let turboMaxText = '';
                if (turboMax >= 1000) {
                    turboMaxText = `${(turboMax / 1000).toFixed(2)} GHz`;
                } else {
                    turboMaxText = `${Math.round(turboMax)} MHz`;
                }
                this.updateElement('cpu-frequency-turbo-max', turboMaxText);
            }
            
            // 显示Boost状态
            let boostElement = document.getElementById('cpu-boost-status');
            if (!boostElement) {
                const turboMaxContainer = document.getElementById('cpu-frequency-turbo-max')?.parentElement;
                const targetContainer = turboMaxContainer || document.getElementById('cpu-frequency-base')?.parentElement;
                if (targetContainer) {
                    const boostContainer = document.createElement('div');
                    boostContainer.className = 'info-item';
                    boostContainer.innerHTML = `
                        <span class="info-label">Turbo Boost</span>
                        <span class="info-value" id="cpu-boost-status">N/A</span>
                    `;
                    targetContainer.parentElement.insertBefore(boostContainer, targetContainer.nextSibling);
                }
            }
            
            const boostText = isBoost ? '已启用' : '未启用';
            this.updateElement('cpu-boost-status', boostText);
            
            // 设置Boost状态颜色
            const boostStatusElement = document.getElementById('cpu-boost-status');
            if (boostStatusElement) {
                boostStatusElement.style.color = isBoost ? '#4CAF50' : '#f44336';
            }
            
            // 显示每个核心的频率信息
            // if (cores.length > 0) {
            //     this.updateCoreFrequencies(cores);
            // }
        }
        
        // 更新CPU核心数
        this.updateElement('cpu-cores-physical', data.cpu_count_physical || 'N/A');
        this.updateElement('cpu-cores-logical', data.cpu_count_logical || 'N/A');
    }

    updateTopProcesses(processes) {
        const container = document.getElementById('top-processes');
        if (!container || !Array.isArray(processes)) return;

        container.innerHTML = '';
        processes.slice(0, 5).forEach((proc, index) => {
            const processItem = document.createElement('div');
            processItem.className = 'process-item';
            processItem.innerHTML = `
                <div class="process-name">${proc.command || 'Unknown'}</div>
                <div class="process-pid">PID: ${proc.pid || 'N/A'}</div>
                <div class="process-cpu">${(proc.cpu_percent || 0).toFixed(1)}%</div>
                <div class="process-memory">${(proc.mem_percent || 0).toFixed(1)}%</div>
            `;
            container.appendChild(processItem);
        });
    }

    updateBatteryInfo(battery) {
        const container = document.getElementById('battery-info');
        if (!container) return;

        if (battery) {
            container.style.display = 'block';
            this.updateElement('battery-percent', `${Math.round(battery.percent)}%`);
            this.updateElement('battery-status', battery.power_plugged ? '充电中' : '使用电池');
            
            if (battery.secsleft && battery.secsleft > 0) {
                const hours = Math.floor(battery.secsleft / 3600);
                const minutes = Math.floor((battery.secsleft % 3600) / 60);
                this.updateElement('battery-time', `${hours}:${minutes.toString().padStart(2, '0')}`);
            } else {
                this.updateElement('battery-time', 'N/A');
            }
        } else {
            container.style.display = 'none';
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateCpuCores(coreData) {
        // 确保coreData是数组且有数据
        if (!Array.isArray(coreData) || coreData.length === 0) {
            console.log('CPU核心数据为空或无效:', coreData);
            return;
        }

        const container = document.getElementById('cpu-core-grid');
        if (!container) return;

        // 清空容器并重新创建核心项
        container.innerHTML = '';
        coreData.forEach((usage, index) => {
            const coreItem = document.createElement('div');
            coreItem.className = 'cpu-core-item';
            coreItem.innerHTML = `
                <h4>核心 ${index + 1}</h4>
                <div class="cpu-core-usage">${Math.round(usage || 0)}%</div>
            `;
            container.appendChild(coreItem);
        });
    }

    updateDiskList(disks) {
        const container = document.getElementById('disk-list');
        if (!container || !Array.isArray(disks)) return;

        container.innerHTML = '';
        disks.forEach((disk, index) => {
            const diskItem = document.createElement('div');
            diskItem.className = 'disk-item';
            diskItem.innerHTML = `
                <div class="disk-info-detailed">
                    <div class="disk-name-detailed">${disk.device || disk.mountpoint}</div>
                    <div class="disk-path">${disk.mountpoint}</div>
                </div>
                <div class="disk-usage-detailed">
                    <div class="disk-usage-percent">已用空间：${Math.round(disk.percent)}%</div>
                    <div class="disk-usage-size">
                        ${this.formatBytes(disk.used)} / ${this.formatBytes(disk.total)}
                    </div>
                </div>
            `;
            container.appendChild(diskItem);
        });
    }

updateNetworkInterfaces(interfaces) {
    const container = document.getElementById('network-interfaces');
    if (!container || typeof interfaces !== 'object') return;

    // 保存网络数据以便主题切换时重新渲染
    this.lastNetworkData = interfaces;

    container.innerHTML = '';
    Object.keys(interfaces).forEach((ifaceName, index) => {
        const iface = interfaces[ifaceName];
        const stats = iface.stats || {};

        // 提取IPv4地址和MAC地址
        const ipv4Addr = iface.addrs?.find(addr => addr.type === 'IPv4')?.address || 'N/A';
        const macAddr = iface.addrs?.find(addr => addr.type === 'MAC')?.address || 'N/A';

        // 格式化网络速度
        const formatSpeed = (speed) => {
            if (speed === 0) return 'N/A';
            return speed >= 1000 ? `${speed/1000} Gbps` : `${speed} Mbps`;
        };

        const interfaceItem = document.createElement('div');
        interfaceItem.className = 'network-interface';
        interfaceItem.innerHTML = `
            <div class="interface-header">
                <div class="interface-name">${ifaceName}</div>
                <div class="interface-status">${stats.is_up ? '已连接' : '已断开'}</div>
            </div>
            <div class="interface-stats">
                <div class="interface-stat">
                    <span class="stat-label">IP 地址</span>
                    <span class="stat-value">${ipv4Addr}</span>
                </div>
                <div class="interface-stat">
                    <span class="stat-label">MAC 地址</span>
                    <span class="stat-value">${macAddr}</span>
                </div>
                <div class="interface-stat">
                    <span class="stat-label">MTU</span>
                    <span class="stat-value">${stats.mtu || 'N/A'}</span>
                </div>
                <div class="interface-stat">
                    <span class="stat-label">速度</span>
                    <span class="stat-value">${formatSpeed(stats.speed || 0)}</span>
                </div>
            </div>
        `;
        container.appendChild(interfaceItem);
    });
}

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.resize();
            }
        });
    }

    startAutoUpdate() {
        // 每1秒自动更新一次，提高刷新频率
        this.updateInterval = setInterval(() => {
            this.loadPerformanceData();
            this.loadAlertNotification();
        }, 1000);
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        const colors = {
            info: '#00ff88',
            error: '#f44336',
            success: '#4caf50',
            warning: '#ff9800'
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

    getNotificationIcon(type) {
        const icons = {
            info: 'fa-info-circle',
            error: 'fa-exclamation-triangle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-circle'
        };
        return icons[type] || icons.info;
    }

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
            const currentTheme = window.themeManager.getCurrentTheme();
            
            if (currentTheme === 'light') {
                icon.className = 'fas fa-sun';
                themeToggleBtn.title = '切换到深色模式';
            } else {
                icon.className = 'fas fa-moon';
                themeToggleBtn.title = '切换到浅色模式';
            }
        }
    }

    destroy() {
        this.stopAutoUpdate();
        
        // 销毁所有图表
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
    }
}

// 初始化性能监控器
// PerformanceMonitor现在在HTML中延迟初始化，确保languageManager先初始化

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
    if (window.performanceMonitor) {
        window.performanceMonitor.destroy();
    }
});