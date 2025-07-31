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

// 网络监控页面功能
class NetworkMonitor {
    constructor() {
        this.chart = null;
        this.updateInterval = null;
        this.trafficData = {
            labels: [],
            download: [],
            upload: []
        };
        this.lastNetworkStats = null;
        this.lastUpdateTime = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initChart();
        this.loadNetworkData();
        this.startRealTimeUpdates();
    }

    setupEventListeners() {
        // 图表时间段切换
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateChartPeriod(e.target.dataset.period);
            });
        });

        // 适配器刷新
        document.getElementById('adapter-refresh').addEventListener('click', () => {
            this.loadNetworkInterfaces();
        });

        // 连接刷新
        document.getElementById('connections-refresh').addEventListener('click', () => {
            this.loadNetworkConnections();
        });

        // 网络工具
        document.getElementById('ping-tool').addEventListener('click', () => {
            this.openTool('ping', 'Ping 测试');
        });

        document.getElementById('traceroute-tool').addEventListener('click', () => {
            this.openTool('traceroute', '路由跟踪');
        });

        document.getElementById('speedtest-tool').addEventListener('click', () => {
            this.openTool('speedtest', '速度测试');
        });

        document.getElementById('netstat-tool').addEventListener('click', () => {
            this.openTool('netstat', '网络统计');
        });

        // 模态框关闭
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('tool-modal').addEventListener('click', (e) => {
            if (e.target.id === 'tool-modal') {
                this.closeModal();
            }
        });

        console.log('网络监控页面已初始化');
    }

    initChart() {
        const ctx = document.getElementById('traffic-chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '下载 (MB/s)',
                    data: [],
                    borderColor: '#0078d4',
                    backgroundColor: 'rgba(0, 120, 212, 0.1)',
                    fill: true,
                    tension: 0.4
                }, {
                    label: '上传 (MB/s)',
                    data: [],
                    borderColor: '#107c10',
                    backgroundColor: 'rgba(16, 124, 16, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '速度 (MB/s)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '时间'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                animation: {
                    duration: 750
                }
            }
        });
    }

    async loadNetworkData() {
        try {
            // 加载网络接口
            await this.loadNetworkInterfaces();
            
            // 加载网络统计
            await this.loadNetworkStats();
            
            // 加载网络连接
            await this.loadNetworkConnections();
            
        } catch (error) {
            console.error('加载网络数据失败:', error);
        }
    }

    async loadNetworkInterfaces() {
        try {
            const response = await fetch('/api/network-interfaces');
            const interfaces = await response.json();
            
            const adaptersList = document.getElementById('adapters-list');
            adaptersList.innerHTML = '';
            
            interfaces.forEach(adapter => {
                const adapterElement = this.createAdapterElement(adapter);
                adaptersList.appendChild(adapterElement);
            });
            
        } catch (error) {
            console.error('加载网络接口失败:', error);
        }
    }

    async loadNetworkStats() {
        try {
            const response = await fetch('/api/network-stats');
            const stats = await response.json();
            
            // 计算速度数据（统一计算逻辑）
            const speedData = this.calculateNetworkSpeed(stats);
            
            // 同步更新状态卡片和图表
            this.updateNetworkStatus(stats, speedData);
            this.updateTrafficChart(stats, speedData);
            
        } catch (error) {
            console.error('加载网络统计失败:', error);
        }
    }

    calculateNetworkSpeed(stats) {
        let downloadSpeed = 0;
        let uploadSpeed = 0;
        
        if (this.lastNetworkStats && this.lastUpdateTime) {
            const currentTime = Date.now();
            const timeDiff = (currentTime - this.lastUpdateTime) / 1000; // 转换为秒
            
            // 确保时间差合理（避免除零或异常值）
            if (timeDiff > 0 && timeDiff < 10) {
                const bytesRecvDiff = stats.bytes_recv - this.lastNetworkStats.bytes_recv;
                const bytesSentDiff = stats.bytes_sent - this.lastNetworkStats.bytes_sent;
                
                // 计算速度 (MB/s)
                downloadSpeed = Math.max(0, bytesRecvDiff / timeDiff / 1024 / 1024);
                uploadSpeed = Math.max(0, bytesSentDiff / timeDiff / 1024 / 1024);
            }
        }
        
        // 更新上次统计数据和时间
        this.lastNetworkStats = stats;
        this.lastUpdateTime = Date.now();
        
        return {
            downloadSpeed,
            uploadSpeed,
            timestamp: new Date()
        };
    }

    async loadNetworkConnections() {
        try {
            const response = await fetch('/api/network-connections');
            const connections = await response.json();
            
            const connectionsList = document.getElementById('connections-list');
            connectionsList.innerHTML = '';
            
            connections.slice(0, 10).forEach(connection => {
                const connectionElement = this.createConnectionElement(connection);
                connectionsList.appendChild(connectionElement);
            });
            
        } catch (error) {
            console.error('加载网络连接失败:', error);
        }
    }

    updateNetworkStatus(stats, speedData) {
        // 更新速度显示（保持一致的数据源）
        document.getElementById('download-speed').textContent = `${speedData.downloadSpeed.toFixed(2)} MB/s`;
        document.getElementById('upload-speed').textContent = `${speedData.uploadSpeed.toFixed(2)} MB/s`;
        
        // 更新连接状态
        const hasConnections = stats.connections > 0;
        const statusIndicator = document.getElementById('status-indicator');
        const connectionStatus = document.getElementById('connection-status');
        
        if (hasConnections) {
            statusIndicator.className = 'status-indicator connected';
            connectionStatus.textContent = '已连接到互联网';
        } else {
            statusIndicator.className = 'status-indicator disconnected';
            connectionStatus.textContent = '网络连接异常';
        }
    }

    updateTrafficChart(stats, speedData) {
        const timeLabel = speedData.timestamp.toLocaleTimeString();
        
        // 使用统一计算的速度数据
        const downloadSpeed = speedData.downloadSpeed;
        const uploadSpeed = speedData.uploadSpeed;
        
        // 添加新数据点
        this.trafficData.labels.push(timeLabel);
        this.trafficData.download.push(downloadSpeed);
        this.trafficData.upload.push(uploadSpeed);
        
        // 保持最多30个数据点
        if (this.trafficData.labels.length > 30) {
            this.trafficData.labels.shift();
            this.trafficData.download.shift();
            this.trafficData.upload.shift();
        }
        
        // 更新图表
        this.chart.data.labels = this.trafficData.labels;
        this.chart.data.datasets[0].data = this.trafficData.download;
        this.chart.data.datasets[1].data = this.trafficData.upload;
        this.chart.update('none');
        
        // 调试信息
        console.log(`网络速度更新 - 下载: ${downloadSpeed.toFixed(2)} MB/s, 上传: ${uploadSpeed.toFixed(2)} MB/s`);
    }

    createAdapterElement(adapter) {
        const div = document.createElement('div');
        div.className = 'adapter-item';
        
        const ipv4Address = adapter.addresses.find(addr => addr.type === 'IPv4');
        const ipAddress = ipv4Address ? ipv4Address.address : '无IP地址';
        
        div.innerHTML = `
            <div class="adapter-header">
                <span class="adapter-name">${adapter.name}</span>
                <span class="adapter-status ${adapter.is_up ? 'connected' : 'disconnected'}">
                    ${adapter.is_up ? '已连接' : '未连接'}
                </span>
            </div>
            <div class="adapter-details">
                IP地址: ${ipAddress}<br>
                速度: ${adapter.speed > 0 ? adapter.speed + ' Mbps' : '未知'}
            </div>
        `;
        
        return div;
    }

    createConnectionElement(connection) {
        const div = document.createElement('div');
        div.className = 'connection-item';
        
        div.innerHTML = `
            <div class="connection-header">
                <span class="connection-name">${connection.laddr}:${connection.lport}</span>
                <span class="connection-status ${connection.status.toLowerCase()}">
                    ${connection.status}
                </span>
            </div>
            <div class="connection-details">
                远程地址: ${connection.raddr || '无'}:${connection.rport || ''}<br>
                协议: ${connection.type} | PID: ${connection.pid || '未知'}
            </div>
        `;
        
        return div;
    }

    updateChartPeriod(period) {
        // 清空当前数据
        this.trafficData = {
            labels: [],
            download: [],
            upload: []
        };
        
        this.chart.data.labels = [];
        this.chart.data.datasets[0].data = [];
        this.chart.data.datasets[1].data = [];
        this.chart.update();
        
        console.log(`切换到 ${period} 视图`);
    }

    startRealTimeUpdates() {
        // 每2秒更新一次数据
        this.updateInterval = setInterval(() => {
            this.loadNetworkStats();
        }, 2000);
        
        // 每10秒更新一次连接列表
        setInterval(() => {
            this.loadNetworkConnections();
        }, 10000);
    }

    openTool(toolType, title) {
        document.getElementById('modal-title').textContent = title;
        const modalBody = document.getElementById('modal-body');
        
        switch (toolType) {
            case 'ping':
                modalBody.innerHTML = this.createPingTool();
                break;
            case 'traceroute':
                modalBody.innerHTML = this.createTracerouteTool();
                break;
            case 'speedtest':
                modalBody.innerHTML = this.createSpeedTestTool();
                break;
            case 'netstat':
                modalBody.innerHTML = this.createNetstatTool();
                break;
        }
        
        document.getElementById('tool-modal').style.display = 'flex';
        
        // 设置工具特定的事件监听器
        this.setupToolEventListeners(toolType);
    }

    createPingTool() {
        return `
            <div class="tool-input">
                <input type="text" id="ping-host" placeholder="输入主机名或IP地址 (例如: google.com)" value="8.8.8.8">
                <button id="ping-start">开始 Ping</button>
            </div>
            <div class="tool-output" id="ping-output">点击"开始 Ping"开始测试...</div>
        `;
    }

    createTracerouteTool() {
        return `
            <div class="tool-input">
                <input type="text" id="traceroute-host" placeholder="输入主机名或IP地址" value="google.com">
                <button id="traceroute-start">开始跟踪</button>
            </div>
            <div class="tool-output" id="traceroute-output">点击"开始跟踪"开始路由跟踪...</div>
        `;
    }

    createSpeedTestTool() {
        return `
            <div class="tool-input">
                <button id="speedtest-start">开始速度测试</button>
            </div>
            <div class="tool-output" id="speedtest-output">点击"开始速度测试"测试网络速度...</div>
        `;
    }

    createNetstatTool() {
        return `
            <div class="tool-input">
                <button id="netstat-start">获取网络统计</button>
            </div>
            <div class="tool-output" id="netstat-output">点击"获取网络统计"查看详细信息...</div>
        `;
    }

    setupToolEventListeners(toolType) {
        switch (toolType) {
            case 'ping':
                document.getElementById('ping-start').addEventListener('click', () => {
                    this.runPing();
                });
                break;
            case 'traceroute':
                document.getElementById('traceroute-start').addEventListener('click', () => {
                    this.runTraceroute();
                });
                break;
            case 'speedtest':
                document.getElementById('speedtest-start').addEventListener('click', () => {
                    this.runSpeedTest();
                });
                break;
            case 'netstat':
                document.getElementById('netstat-start').addEventListener('click', () => {
                    this.runNetstat();
                });
                break;
        }
    }

    async runPing() {
        const host = document.getElementById('ping-host').value.trim();
        const output = document.getElementById('ping-output');
        const button = document.getElementById('ping-start');
        
        if (!host) {
            output.textContent = '请输入有效的主机名或IP地址';
            return;
        }
        
        button.disabled = true;
        button.textContent = '正在 Ping...';
        output.textContent = `正在 Ping ${host}...\n`;
        
        try {
            const response = await fetch('/api/execute-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: `ping -c 4 ${host}`
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                output.textContent += `错误: ${result.error}`;
            } else {
                output.textContent += result.output || result.error || '命令执行完成';
            }
            
        } catch (error) {
            output.textContent += `执行失败: ${error.message}`;
        } finally {
            button.disabled = false;
            button.textContent = '开始 Ping';
        }
    }

    async runTraceroute() {
        const host = document.getElementById('traceroute-host').value.trim();
        const output = document.getElementById('traceroute-output');
        const button = document.getElementById('traceroute-start');
        
        if (!host) {
            output.textContent = '请输入有效的主机名或IP地址';
            return;
        }
        
        button.disabled = true;
        button.textContent = '正在跟踪...';
        output.textContent = `正在跟踪到 ${host} 的路由...\n`;
        
        try {
            const response = await fetch('/api/execute-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: `tracert ${host}`
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                output.textContent += `错误: ${result.error}`;
            } else {
                output.textContent += result.output || result.error || '路由跟踪完成';
            }
            
        } catch (error) {
            output.textContent += `执行失败: ${error.message}`;
        } finally {
            button.disabled = false;
            button.textContent = '开始跟踪';
        }
    }

    async runSpeedTest() {
        const output = document.getElementById('speedtest-output');
        const button = document.getElementById('speedtest-start');
        
        button.disabled = true;
        button.textContent = '测试中...';
        output.textContent = '正在进行网络速度测试...\n';
        
        try {
            // 模拟速度测试
            output.textContent += '正在测试下载速度...\n';
            await this.simulateSpeedTest('download', output);
            
            output.textContent += '正在测试上传速度...\n';
            await this.simulateSpeedTest('upload', output);
            
            output.textContent += '\n速度测试完成！\n';
            
        } catch (error) {
            output.textContent += `测试失败: ${error.message}`;
        } finally {
            button.disabled = false;
            button.textContent = '开始速度测试';
        }
    }

    async simulateSpeedTest(type, output) {
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                const speed = Math.random() * 50 + 10; // 10-60 Mbps
                output.textContent += `${type === 'download' ? '下载' : '上传'}进度: ${progress}% - ${speed.toFixed(1)} Mbps\n`;
                
                if (progress >= 100) {
                    clearInterval(interval);
                    resolve();
                }
            }, 200);
        });
    }

    async runNetstat() {
        const output = document.getElementById('netstat-output');
        const button = document.getElementById('netstat-start');
        
        button.disabled = true;
        button.textContent = '获取中...';
        output.textContent = '正在获取网络统计信息...\n';
        
        try {
            const response = await fetch('/api/execute-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: 'netstat -an'
                })
            });
            
            const result = await response.json();
            
            if (result.error) {
                output.textContent += `错误: ${result.error}`;
            } else {
                output.textContent += result.output || '获取网络统计信息完成';
            }
            
        } catch (error) {
            output.textContent += `执行失败: ${error.message}`;
        } finally {
            button.disabled = false;
            button.textContent = '获取网络统计';
        }
    }

    closeModal() {
        document.getElementById('tool-modal').style.display = 'none';
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.chart) {
            this.chart.destroy();
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    window.networkMonitor = new NetworkMonitor();
});

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    if (window.networkMonitor) {
        window.networkMonitor.destroy();
    }
});