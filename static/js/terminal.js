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

// 终端界面JavaScript功能
class Terminal {
    constructor() {
        this.commandHistory = [];
        this.historyIndex = -1;
        this.currentDirectory = '~';
        this.isConnected = false;
        this.connectionStartTime = new Date();
        this.terminalInfo = {};
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.loadTerminalInfo();
        this.updateConnectionTime();
        this.displayWelcomeMessage();
        
        // 每秒更新连接时间
        setInterval(() => this.updateConnectionTime(), 1000);
        
        // 初始化主题图标
        setTimeout(() => {
            this.updateThemeIcon();
        }, 100);
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

    initializeElements() {
        this.terminalOutput = document.getElementById('terminal-output');
        this.commandInput = document.getElementById('command-input');
        this.executeBtn = document.getElementById('execute-btn');
        this.clearBtn = document.getElementById('clear-terminal');
        this.copyBtn = document.getElementById('copy-output');
        this.saveBtn = document.getElementById('save-session');
        this.historyList = document.getElementById('history-list');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.hostnameSpan = document.getElementById('hostname');
        this.serverIpSpan = document.getElementById('server-ip');
        this.connectionTimeSpan = document.getElementById('connection-time');
    }

    bindEvents() {
        // 主题切换按钮事件
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        // 命令输入事件
        this.commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.executeCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory('down');
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTabCompletion();
            }
        });
        
        // 添加输入事件监听
        this.commandInput.addEventListener('input', (e) => this.handleInput(e));

        // 执行按钮事件
        this.executeBtn.addEventListener('click', () => {
            this.executeCommand();
        });

        // 清屏按钮事件
        this.clearBtn.addEventListener('click', () => {
            this.clearTerminal();
        });

        // 复制输出事件
        this.copyBtn.addEventListener('click', () => {
            this.copyOutput();
        });

        // 保存会话事件
        this.saveBtn.addEventListener('click', () => {
            this.saveSession();
        });

        // 快捷命令按钮事件
        document.querySelectorAll('.quick-cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.getAttribute('data-command');
                this.commandInput.value = command;
                this.executeCommand();
            });
        });

        // 窗口控制按钮事件（可选，如果存在的话）
        const closeBtn = document.querySelector('.window-control.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (confirm('确定要关闭终端吗？')) {
                    window.close();
                }
            });
        }

        const minimizeBtn = document.querySelector('.window-control.minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                // 最小化功能（在实际应用中可能需要与桌面环境集成）
                console.log('最小化窗口');
            });
        }

        const maximizeBtn = document.querySelector('.window-control.maximize');
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
                // 最大化功能
                document.body.classList.toggle('maximized');
            });
        }
    }

    async loadTerminalInfo() {
        try {
            const response = await fetch('/api/terminal-info');
            if (response.ok) {
                this.terminalInfo = await response.json();
                this.updateUserInfo();
                this.isConnected = true;
                this.updateConnectionStatus();
            }
        } catch (error) {
            console.error('Failed to load terminal info:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    updateUserInfo() {
        if (this.terminalInfo.user) {
            this.hostnameSpan.textContent = this.terminalInfo.hostname || 'localhost';
            this.serverIpSpan.textContent = this.terminalInfo.internal_ip || 'N/A';
            
            // 更新提示符
            if (document.querySelector('.prompt-host')) {
                document.querySelector('.prompt-host').textContent = this.terminalInfo.hostname || 'localhost';
            }
            if (document.querySelector('.prompt-user')) {
                document.querySelector('.prompt-user').textContent = this.terminalInfo.user;
            }
        }
    }

    updateConnectionStatus() {
        // 更新连接状态显示
        const statusElements = document.querySelectorAll('.connection-status');
        statusElements.forEach(element => {
            if (this.isConnected) {
                element.textContent = '已连接';
                element.className = 'connection-status connected';
            } else {
                element.textContent = '未连接';
                element.className = 'connection-status disconnected';
            }
        });
    }

    updateConnectionTime() {
        const now = new Date();
        const diff = Math.floor((now - this.connectionStartTime) / 1000);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        if (this.connectionTimeSpan) {
            this.connectionTimeSpan.textContent = timeStr;
        }
    }

    displayWelcomeMessage() {
        if (this.terminalOutput) {
            const welcomeMsg = `
╔══════════════════════════════════════════════════════════════╗
║                    欢迎使用远程终端控制系统                    ║
║                                                              ║
║  功能特性:                                                   ║
║  • 安全的命令执行环境                                        ║
║  • 跨平台命令支持 (Windows/Linux)                           ║
║  • 命令历史记录                                              ║
║  • 快捷命令按钮                                              ║
║  • 会话保存功能                                              ║
║                                                              ║
║  输入 'help' 查看可用命令                                    ║
║  输入 'clear' 清空终端                                       ║
╚══════════════════════════════════════════════════════════════╝

系统初始化完成 - ${new Date().toLocaleString()}
            `;
            this.addTerminalLine(welcomeMsg, 'welcome');
        }
    }

    async executeCommand() {
        const command = this.commandInput.value.trim();
        if (!command) return;

        // 添加到历史记录
        this.addToHistory(command);
        
        // 显示命令
        this.addTerminalLine(`${this.getPrompt()} ${command}`, 'command');
        
        // 清空输入框
        this.commandInput.value = '';
        
        // 处理特殊命令
        if (await this.handleSpecialCommands(command)) {
            return;
        }

        // 显示加载指示器
        this.showLoading();

        try {
            const response = await fetch('/api/execute-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: command })
            });

            const result = await response.json();
            
            if (result.special === 'clear') {
                this.clearTerminal();
                return;
            }
            
            if (response.ok) {
                // 显示输出
                if (result.output) {
                    this.addTerminalLine(result.output, 'output');
                }
                
                // 显示错误（如果有）
                if (result.error) {
                    this.addTerminalLine(result.error, 'error');
                }
                
                // 显示返回码
                if (result.return_code !== undefined && result.return_code !== 0) {
                    this.addTerminalLine(`命令退出码: ${result.return_code}`, 'warning');
                }
                
                // 更新当前路径（如果是cd命令）
                if (command.startsWith('cd ')) {
                    this.updateCurrentPath(command);
                }
            } else {
                this.addTerminalLine(`错误: ${result.error}`, 'error');
            }
        } catch (error) {
            this.addTerminalLine(`网络错误: ${error.message}`, 'error');
        } finally {
            this.hideLoading();
        }
    }

    async handleSpecialCommands(command) {
        const cmd = command.toLowerCase().trim();
        
        switch(cmd) {
            case 'help':
                this.showHelp();
                return true;
                
            case 'clear':
            case 'cls':
                this.clearTerminal();
                return true;
                
            case 'history':
                this.showHistory();
                return true;
                
            case 'sysinfo':
                this.showSystemInfo();
                return true;
                
            default:
                return false;
        }
    }

    addTerminalLine(text, type = 'output') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'timestamp';
        timestampSpan.textContent = `[${timestamp}]`;
        
        line.appendChild(timestampSpan);
        line.appendChild(document.createTextNode(' ' + text));
        
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();
    }

    addToHistory(command) {
        if (command && this.commandHistory[this.commandHistory.length - 1] !== command) {
            this.commandHistory.push(command);
            this.updateHistoryDisplay();
        }
        this.historyIndex = this.commandHistory.length;
    }

    updateHistoryDisplay() {
        this.historyList.innerHTML = '';
        
        // 只显示最近的10条命令
        const recentCommands = this.commandHistory.slice(-10);
        
        recentCommands.forEach((cmd, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.textContent = cmd;
            historyItem.addEventListener('click', () => {
                this.commandInput.value = cmd;
                this.commandInput.focus();
            });
            this.historyList.appendChild(historyItem);
        });
    }

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;
        
        if (direction === 'up') {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.commandInput.value = this.commandHistory[this.historyIndex];
            }
        } else if (direction === 'down') {
            if (this.historyIndex < this.commandHistory.length - 1) {
                this.historyIndex++;
                this.commandInput.value = this.commandHistory[this.historyIndex];
            } else {
                this.historyIndex = this.commandHistory.length;
                this.commandInput.value = '';
            }
        }
    }

    handleInput(e) {
        // 实时命令提示可以在这里实现
    }

    handleTabCompletion() {
        const input = this.commandInput.value.toLowerCase();
        const commonCommands = [
            'ls', 'dir', 'cd', 'pwd', 'cat', 'type', 'echo', 'ping',
            'netstat', 'ipconfig', 'ifconfig', 'ps', 'tasklist', 'help',
            'clear', 'cls', 'history', 'whoami', 'date', 'time', 'sysinfo',
            'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'grep', 'find', 'top',
            'kill', 'chmod', 'chown', 'df', 'du', 'free', 'wget', 'curl'
        ];
        
        const matches = commonCommands.filter(cmd => cmd.startsWith(input));
        
        if (matches.length === 1) {
            this.commandInput.value = matches[0] + ' ';
        } else if (matches.length > 1) {
            this.addTerminalLine(`可能的命令: ${matches.join(', ')}`, 'output');
        }
    }

    updateCurrentPath(cdCommand) {
        // 简单的路径更新逻辑
        const parts = cdCommand.split(' ');
        if (parts.length > 1) {
            const newPath = parts[1];
            if (newPath === '..') {
                // 返回上级目录
                const pathParts = this.currentDirectory.split('/');
                pathParts.pop();
                this.currentDirectory = pathParts.join('/') || '/';
            } else if (newPath.startsWith('/')) {
                // 绝对路径
                this.currentDirectory = newPath;
            } else {
                // 相对路径
                this.currentDirectory = this.currentDirectory === '/' ? `/${newPath}` : `${this.currentDirectory}/${newPath}`;
            }
            
            const promptPath = document.querySelector('.prompt-path');
            if (promptPath) {
                promptPath.textContent = this.currentDirectory;
            }
        }
    }

    getPrompt() {
        const userElement = document.querySelector('.prompt-user');
        const hostElement = document.querySelector('.prompt-host');
        const pathElement = document.querySelector('.prompt-path');
        
        const user = userElement ? userElement.textContent : (this.terminalInfo.user || 'user');
        const host = hostElement ? hostElement.textContent : (this.terminalInfo.hostname || 'localhost');
        const path = pathElement ? pathElement.textContent : this.currentDirectory;
        
        return `${user}@${host}:${path}$`;
    }

    clearTerminal() {
        if (this.terminalOutput) {
            this.terminalOutput.innerHTML = '';
            this.addTerminalLine('终端已清空', 'info');
            this.displayWelcomeMessage();
        }
    }

    showHelp() {
        const helpText = `
可用命令:
  help          - 显示此帮助信息
  clear/cls     - 清空终端
  history       - 显示命令历史
  sysinfo       - 显示系统信息
  ls/dir        - 列出文件
  cd            - 切换目录
  pwd           - 显示当前目录
  ps/tasklist   - 显示进程
  ping          - 网络测试
  ipconfig      - 网络配置
  whoami        - 显示当前用户
  date/time     - 显示日期时间

快捷键:
  Ctrl+L        - 清空终端
  Ctrl+C        - 复制输出
  ↑/↓           - 浏览历史
  Tab           - 命令补全
  Enter         - 执行命令
        `;
        this.addTerminalLine(helpText, 'info');
    }

    showSystemInfo() {
        if (this.terminalInfo.system_info) {
            const info = this.terminalInfo.system_info;
            const infoText = `
系统信息:
  操作系统: ${info.system || 'N/A'} ${info.release || ''}
  版本: ${info.version || 'N/A'}
  架构: ${info.machine || 'N/A'}
  处理器: ${info.processor || 'N/A'}
  用户: ${this.terminalInfo.user || 'N/A'}
  主机名: ${this.terminalInfo.hostname || 'N/A'}
  Shell: ${this.terminalInfo.shell || 'N/A'}
            `;
            this.addTerminalLine(infoText, 'info');
        } else {
            this.addTerminalLine('系统信息不可用', 'error');
        }
    }

    showHistory() {
        if (this.commandHistory.length === 0) {
            this.addTerminalLine('命令历史为空', 'info');
            return;
        }
        
        let historyText = '命令历史:\n';
        this.commandHistory.forEach((cmd, index) => {
            historyText += `  ${index + 1}. ${cmd}\n`;
        });
        
        this.addTerminalLine(historyText, 'info');
    }

    copyOutput() {
        const outputText = Array.from(this.terminalOutput.children)
            .map(line => line.textContent)
            .join('\n');
        
        navigator.clipboard.writeText(outputText).then(() => {
            this.addTerminalLine('输出已复制到剪贴板', 'output');
        }).catch(err => {
            this.addTerminalLine('复制失败: ' + err.message, 'error');
        });
    }

    saveSession() {
        const sessionData = {
            timestamp: new Date().toISOString(),
            commands: this.commandHistory,
            output: Array.from(this.terminalOutput.children).map(line => ({
                type: line.className.split(' ')[1] || 'output',
                text: line.textContent
            }))
        };
        
        const dataStr = JSON.stringify(sessionData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `terminal-session-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        link.click();
        
        this.addTerminalLine('会话已保存', 'output');
    }

    scrollToBottom() {
        if (this.terminalOutput) {
            this.terminalOutput.scrollTop = this.terminalOutput.scrollHeight;
        }
    }

    showLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }
}

// 页面加载完成后初始化终端
document.addEventListener('DOMContentLoaded', () => {
    new Terminal();
    
    // 自动聚焦到命令输入框
    document.getElementById('command-input').focus();
});

// 防止页面意外关闭
window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    // Ctrl+L 清屏
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        document.getElementById('clear-terminal').click();
    }
    
    // Ctrl+C 复制
    if (e.ctrlKey && e.key === 'c' && !window.getSelection().toString()) {
        e.preventDefault();
        document.getElementById('copy-output').click();
    }
    
    // Ctrl+S 保存会话
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        document.getElementById('save-session').click();
    }
});
