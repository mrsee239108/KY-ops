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

// AI 对话界面功能
class AIChatInterface {
    constructor() {
        this.conversations = [];
        this.updateInterval = null;
        this.currentConversationId = null;
        this.messageHistory = [];
        this.currentAlerts = new Map(); // 存储当前活动的告警
        this.alertTypeMap = {
            'cpu-overload': { type: 'warning', title: 'CPU 过载' },
            'memory-overload': { type: 'error', title: '内存不足' },
            'disk-space-overload': { type: 'error', title: '磁盘空间不足' },
            'disk-io-overload': { type: 'warning', title: '磁盘IO过载' },
            'network-overload': { type: 'warning', title: '网络过载' },
            'high-process-load': { type: 'info', title: '高进程负载' }
        };
        this.performanceData = null; // 存储性能数据
        this.systemLog = null; // 存储系统日志
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConversations();
        this.autoResizeTextarea();

        this.loadAlertNotification();
        this.loadPerformanceData();
        this.loadSystemLog();
        // 检查AI模型状态
        setTimeout(() => {
            this.checkInitialAIStatus();
        }, 1000);

        this.startAutoUpdate();
        
        // 初始化主题图标
        setTimeout(() => {
           this.updateThemeIcon();
        }, 100);
        
        console.log(languageManager ? languageManager.translate('ai-chat-interface-initialized') : 'AI 对话界面已初始化');
    }
    
    // 切换主题
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

    setupEventListeners() {
        // 主题切换按钮事件
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // 消息输入框事件
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.updateCharCount();
                this.autoResizeTextarea();
            });
            
            messageInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    // 自动调整文本框高度
    autoResizeTextarea() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
    }

    // 更新字符计数
    updateCharCount() {
        const messageInput = document.getElementById('message-input');
        const charCount = document.getElementById('char-count');
        
        if (messageInput && charCount) {
            const count = messageInput.value.length;
            charCount.textContent = count;
            
            if (count > 1800) {
                charCount.style.color = '#dc3545';
            } else if (count > 1500) {
                charCount.style.color = '#ffc107';
            } else {
                charCount.style.color = '#6c757d';
            }
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

                            console.log('加载性能数据成功:', data);
                            this.setPerformanceData(data);

                        } catch (parseError) {
                            console.error('解析JSON失败:', parseError);
                        }
                    } else {
                        console.error('HTTP错误:', xhr.status, xhr.statusText);
                    }
                }
            };

            xhr.onerror = () => {
                console.error('网络错误');
            };

            xhr.send(); // 使用异步请求
        } catch (error) {
            console.error('加载性能数据失败:', error);
            // 使用模拟数据继续运行
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

                            console.log('加载告警数据成功:', alerts);
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

    async loadSystemLog() {
        try {
            const xhr3 = new XMLHttpRequest();
            xhr3.open('GET', 'api/system-log', true);
            xhr3.setRequestHeader('Accept', 'application/json');
            xhr3.setRequestHeader('Content-Type', 'application/json')

            xhr3.onreadystatechange = () => {
                if (xhr3.readyState === 4) {
                    if (xhr3.status === 200) {
                        try {
                            const log = JSON.parse(xhr3.responseText);
                            console.log('加载系统日志成功:', log);
                            this.setSystemLog(log);
                        } catch (parseError) {
                            console.error('解析JSON失败:', parseError);
                        }
                    } else{
                        console.error('HTTP错误:', xhr3.status, xhr3.statusText);
                    }
                }
            };
            xhr3.onerror = () => {
                console.error('网络错误');
            }
            xhr3.send();
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


    // 发送消息
    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (!messageInput || !messageInput.value.trim()) return;
        
        const message = messageInput.value.trim();
        messageInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        
        // 禁用发送按钮
        if (sendBtn) {
            sendBtn.disabled = true;
        }
        
        // 添加用户消息到界面
        this.addMessage('user', message);
        
        try {
            // 发送消息到后端，启用流式输出
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.currentConversationId,
                    stream: true
                })
            });
            
            if (response.status === 202) {
                // 模型正在加载
                const data = await response.json();
                this.addMessage('ai', data.error || (languageManager ? languageManager.getText('ai-chat-model-loading') : '模型正在加载中，请稍后再试...'), true);
                this.showModelInitButton();
                return;
            }
            
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.loading) {
                    this.addMessage('ai', '模型正在初始化中，请稍等片刻...', true);
                    this.showModelInitButton();
                } else {
                    throw new Error(errorData.error || '请求失败');
                }
                return;
            }
            
            // 处理流式响应
            await this.handleStreamResponse(response, message);
            
        } catch (error) {
            console.error(languageManager ? languageManager.getText('ai-chat-send-failed') : '发送消息失败:', error);
            this.addMessage('ai', languageManager ? languageManager.getText('ai-chat-reply-error') : '抱歉，我现在无法回复您的消息。请稍后再试。', true);
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
            }
        }
    }

    // 处理流式响应
    async handleStreamResponse(response, userMessage) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        // 创建AI消息容器
        const aiMessageDiv = this.createStreamingMessage();
        const textDiv = aiMessageDiv.querySelector('.message-text');
        
        let fullResponse = '';
        let conversationId = null;
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            // 流式输出结束
                            this.finalizeStreamingMessage(aiMessageDiv);
                            
                            // 更新对话历史
                            if (fullResponse) {
                                this.updateConversationHistory(userMessage, fullResponse);
                            }
                            return;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                textDiv.innerHTML = this.formatMessage(fullResponse);
                                
                                // 滚动到底部
                                const messagesContainer = document.getElementById('messages-container');
                                if (messagesContainer) {
                                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                }
                            }
                            
                            if (parsed.conversation_id) {
                                conversationId = parsed.conversation_id;
                                this.currentConversationId = conversationId;
                            }
                            
                        } catch (parseError) {
                            console.warn('解析流式数据失败:', parseError);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('处理流式响应失败:', error);
            textDiv.innerHTML = '<span style="color: #dc3545;">回复过程中出现错误，请重试。</span>';
            this.finalizeStreamingMessage(aiMessageDiv);
        }
    }

    // 创建流式消息容器
    createStreamingMessage() {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return null;
        
        // 移除欢迎消息
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai streaming';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = '<span class="typing-indicator">●</span>';
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString();
        
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(timeDiv);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        messagesContainer.appendChild(messageDiv);
        
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return messageDiv;
    }

    // 完成流式消息
    finalizeStreamingMessage(messageDiv) {
        if (messageDiv) {
            messageDiv.classList.remove('streaming');
            const textDiv = messageDiv.querySelector('.message-text');
            if (textDiv) {
                // 移除打字指示器
                const typingIndicator = textDiv.querySelector('.typing-indicator');
                if (typingIndicator) {
                    typingIndicator.remove();
                }
            }
        }
    }

    // 添加消息到界面
    addMessage(sender, content, isError = false) {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        // 移除欢迎消息
        const welcomeMessage = messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        if (isError) {
            contentDiv.style.background = '#f8d7da';
            contentDiv.style.color = '#721c24';
        }
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.formatMessage(content);
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date().toLocaleTimeString();
        
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(timeDiv);
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(contentDiv);
        
        messagesContainer.appendChild(messageDiv);
        
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // 添加到消息历史
        this.messageHistory.push({
            sender: sender,
            content: content,
            timestamp: new Date().toISOString()
        });
    }

    // 格式化消息内容
    formatMessage(content) {
        // 检查是否包含Markdown语法
        const hasMarkdown = this.hasMarkdownSyntax(content);
        
        if (hasMarkdown && typeof marked !== 'undefined') {
            // 配置marked选项
            marked.setOptions({
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {
                            console.warn('代码高亮失败:', err);
                        }
                    }
                    return code;
                },
                breaks: true,
                gfm: true,
                sanitize: false
            });
            
            try {
                // 使用marked渲染Markdown
                let html = marked.parse(content);
                
                // 为代码块添加复制按钮
                html = this.addCopyButtons(html);
                
                return html;
            } catch (error) {
                console.warn('Markdown渲染失败，使用基础格式化:', error);
                return this.basicFormatMessage(content);
            }
        } else {
            // 使用基础格式化
            return this.basicFormatMessage(content);
        }
    }

    // 检查是否包含Markdown语法
    hasMarkdownSyntax(content) {
        const markdownPatterns = [
            /^#{1,6}\s/m,           // 标题
            /\*\*.*?\*\*/,          // 粗体
            /\*.*?\*/,              // 斜体
            /```[\s\S]*?```/,       // 代码块
            /`[^`]+`/,              // 行内代码
            /^\s*[-*+]\s/m,         // 无序列表
            /^\s*\d+\.\s/m,         // 有序列表
            /\[.*?\]\(.*?\)/,       // 链接
            /!\[.*?\]\(.*?\)/,      // 图片
            /^\s*>\s/m,             // 引用
            /^\s*\|.*\|/m,          // 表格
            /---+/,                 // 分隔线
        ];
        
        return markdownPatterns.some(pattern => pattern.test(content));
    }

    // 基础格式化（不使用Markdown）
    basicFormatMessage(content) {
        // 处理代码块
        content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // 处理行内代码
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 处理换行
        content = content.replace(/\n/g, '<br>');
        
        // 处理链接
        content = content.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        return content;
    }

    // 为代码块添加复制按钮
    addCopyButtons(html) {
        return html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (match, attrs, code) => {
            const cleanCode = code.replace(/<[^>]*>/g, ''); // 移除HTML标签
            return `
                <div class="code-block-container">
                    <div class="code-block-header">
                        <button class="copy-code-btn" onclick="aiChat.copyCode(this)" data-code="${this.escapeHtml(cleanCode)}">
                            <i class="fas fa-copy"></i> 复制代码
                        </button>
                    </div>
                    <pre><code${attrs}>${code}</code></pre>
                </div>
            `;
        });
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 复制代码功能
    copyCode(button) {
        const code = button.getAttribute('data-code');
        if (code) {
            navigator.clipboard.writeText(code).then(() => {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> 已复制';
                button.style.background = '#28a745';
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = '';
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制代码');
            });
        }
    }

    // 新建对话
    newConversation() {
        this.currentConversationId = null;
        this.messageHistory = [];
        
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <div class="ai-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="welcome-content">
                        <h3>👋 欢迎使用 AI 智能助手</h3>
                        <p>我是您的专业运维助手，可以帮助您：</p>
                        <ul>
                            <li>🔍 系统性能监控与分析</li>
                            <li>🛡️ 安全威胁检测与处理</li>
                            <li>📊 数据分析与报告生成</li>
                            <li>🔧 故障诊断与解决方案</li>
                            <li>📚 技术文档与最佳实践</li>
                        </ul>
                        <p>请输入您的问题，我将为您提供专业的帮助！</p>
                    </div>
                </div>
            `;
        }
        
        this.updateChatTitle('AI 智能助手', '随时为您提供专业的运维支持');
    }

    // 更新对话标题
    updateChatTitle(title, subtitle) {
        const titleElement = document.getElementById('current-chat-title');
        const subtitleElement = document.getElementById('current-chat-subtitle');
        
        if (titleElement) titleElement.textContent = title;
        if (subtitleElement) subtitleElement.textContent = subtitle;
    }

    // 构建问题
    buildQuery(action) {
        const template = this.getQueryTemplate(action);
        if (!template) return null;

        const dataSummary = this.getDataSummary(action);
        return `${template}\n\n当前系统状态：\n${dataSummary}`;
    }

    // 查询模板
    getQueryTemplate(action) {
        const templates = {
            'system-check': '请帮我检查系统状态，包括CPU、内存、磁盘使用情况',
            'performance-analysis': '请分析当前系统性能，给出优化建议',
            'security-scan': '请进行安全扫描，检查系统是否存在安全风险',
            'log-analysis': '请帮我分析系统日志，查找可能的问题',
        };
        return templates[action] || null;
    }

    // 数据摘要
    getDataSummary(action) {
        // 确保加载了最新的性能数据和系统日志
        this.loadPerformanceData();
        this.loadSystemLog();

        if (!this.performanceData || !this.systemLog) {
            return '数据采集失败，请稍后再试';
        }

        const perf = this.performanceData;
        const log = this.systemLog;
        let summary = '';

        // 通用系统状态摘要
        const systemSummary = () => {
            return `CPU: ${perf.cpu_percent}% | 内存: ${perf.memory_percent}%
交换空间: ${perf.swap_percent}% | 系统负载: ${perf.load_avg}
进程总数: ${perf.process_count}`;
        };

        // 根据action类型构建综合摘要
        switch (action) {
            case 'system-check':
                // 综合系统检查（包含磁盘、网络等）
                const diskUsage = perf.disk_usage.map(disk =>
                    `- ${disk.mountpoint}: ${disk.percent}% (可用 ${(disk.free / 1024 / 1024).toFixed(1)}MB)`
                ).join('\n');

                const networkSummary = `接收: ${(perf.network_io.bytes_recv / 1024 / 1024).toFixed(2)}MB | 发送: ${(perf.network_io.bytes_sent / 1024 / 1024).toFixed(2)}MB
丢包: ${perf.network_io.dropin}输入/${perf.network_io.dropout}输出 | 错误: ${perf.network_io.errin}输入/${perf.network_io.errout}输出`;

                summary = `## 综合系统状态检查 ##
${systemSummary()}

磁盘使用情况:
${diskUsage}

网络概况:
${networkSummary}`;
                break;

            case 'performance-analysis':
                // 综合性能分析（包含进程、磁盘IO等）
                const topProcesses = perf.top_processes.slice(0, 5).map(p =>
                    `- ${p.command.slice(0, 20)} (PID:${p.pid}, CPU:${p.cpu_percent}%, MEM:${p.mem_percent}%)`
                ).join('\n');

                let highIOTargets = '无高IO设备';
                if (perf.disk_io && Object.keys(perf.disk_io).length > 0) {
                    const ioEntries = Object.entries(perf.disk_io);
                    const highIO = ioEntries
                        .filter(([_, stats]) => stats.utilization > 50)
                        .map(([dev, stats]) =>
                            `- ${dev}: ${stats.utilization}% (读 ${(stats.read_bytes / 1024).toFixed(1)}KB/s, 写 ${(stats.write_bytes / 1024).toFixed(1)}KB/s)`
                        );
                    if (highIO.length > 0) {
                        highIOTargets = highIO.join('\n');
                    }
                }

                summary = `## 综合性能分析 ##
${systemSummary()}
CPU核心: ${perf.cpu_count_physical}物理/${perf.cpu_count_logical}逻辑
CPU频率: ${perf.cpu_frequency.current}MHz

高负载进程:
${topProcesses || '未检测到显著高负载进程'}

高IO设备:
${highIOTargets}`;
                break;

            case 'security-scan':
                // 综合安全扫描（包含网络连接、可疑进程等）
                const suspiciousProcesses = perf.top_processes
                    .filter(p =>
                        parseFloat(p.cpu_percent) > 30 ||
                        parseFloat(p.mem_percent) > 30 ||
                        p.command.includes('unknown') ||
                        p.user === 'unknown'
                    )
                    .map(p => `- ${p.command} (PID:${p.pid}, 用户:${p.user})`)
                    .join('\n') || '未发现可疑进程';

                summary = `## 综合安全扫描 ##
${systemSummary()} | 可疑进程：${suspiciousProcesses}`;
                break;

            case 'log-analysis':
                // 错误日志分析
                if (!this.parsedErrorLogs) {
                    this.parsedErrorLogs = this.parseErrorLogs(log);
                }

                const errors = Array.from(this.parsedErrorLogs.values());

                // 按最近发生时间排序
                errors.sort((a, b) => b.lastOccurrence - a.lastOccurrence);

                // 生成错误摘要
                const errorSummary = errors.slice(0, 10).map((error, index) => {
                    return `[错误${index + 1}]
内容: ${error.message}
次数: ${error.count}次
首次发生: ${error.firstOccurrence.toLocaleString()}
最近发生: ${error.lastOccurrence.toLocaleString()} (${error.timeAgo})`;
                }).join('\n\n');

                summary = `## 系统错误摘要 ##
共发现 ${errors.length} 类错误

${errorSummary}`;
                break;
// ${errors.length > 10 ? `\n...还有${errors.length - 10}个错误未显示` : ''}`;
//                 break;
            default:
                summary = `当前系统状态:
${systemSummary()}`;
        }

        return summary;
    }

    // 设置性能数据
    setPerformanceData(data) {
        console.log('设置性能数据:', data);
        this.performanceData = data;
    }

    setSystemLog(log) {
        console.log('设置系统日志:', log)
        this.systemLog = log;
    }

    // 发送消息
    generateQuery(action) {
        const query = this.buildQuery(action);
        if (!query) {
            console.warn(`未知的操作类型: ${action}`);
            return;
        }

        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.value = query;
            this.updateCharCount();
            this.autoResizeTextarea();

            // 滚动到输入框
            messageInput.scrollIntoView({ behavior: 'smooth' });
            messageInput.focus();
        }
    }

    parseErrorLogs(logData) {
        const uniqueErrors = new Map();
        const currentYear = new Date().getFullYear();
        const monthMap = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };

        // 处理日志数组
        const processLogs = (logs) => {
            logs.forEach(logString => {
                const lines = logString.split('\n');
                lines.forEach(line => {
                    if (!line.trim()) return;

                    // 匹配日志格式: "月 日 时间 主机 进程: 消息"
                    const match = line.match(/^(\w{3})\s+(\d{1,2}) (\d{2}:\d{2}:\d{2}) \S+ (.+)$/);
                    if (!match) return;

                    const [, month, day, time, message] = match;
                    const [hours, minutes, seconds] = time.split(':').map(Number);

                    // 创建时间戳 (假设是当前年)
                    const timestamp = new Date(
                        currentYear,
                        monthMap[month],
                        parseInt(day),
                        hours, minutes, seconds
                    );

                    // 提取错误关键部分 (去除进程ID等变化部分)
                    const key = message.replace(/\[\d+\]/g, '[PID]')
                                       .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'IP')
                                       .replace(/port \d+/g, 'port PORT');

                    // 计算相对时间
                    const now = new Date();
                    const timeDiff = Math.floor((now - timestamp) / 1000); // 秒
                    let timeAgo = '';

                    if (timeDiff < 60) {
                        timeAgo = `${timeDiff}秒前`;
                    } else if (timeDiff < 3600) {
                        timeAgo = `${Math.floor(timeDiff / 60)}分钟前`;
                    } else if (timeDiff < 86400) {
                        timeAgo = `${Math.floor(timeDiff / 3600)}小时前`;
                    } else {
                        timeAgo = `${Math.floor(timeDiff / 86400)}天前`;
                    }

                    // 添加或更新错误条目
                    if (uniqueErrors.has(key)) {
                        const entry = uniqueErrors.get(key);
                        entry.count++;
                        if (timestamp < entry.firstOccurrence) {
                            entry.firstOccurrence = timestamp;
                        }
                        if (timestamp > entry.lastOccurrence) {
                            entry.lastOccurrence = timestamp;
                        }
                    } else {
                        uniqueErrors.set(key, {
                            message: message,
                            count: 1,
                            firstOccurrence: timestamp,
                            lastOccurrence: timestamp,
                            timeAgo: timeAgo
                        });
                    }
                });
            });
        };

        // 处理错误日志和最近日志
        if (logData.error_logs) processLogs(logData.error_logs);
        if (logData.recent_logs) processLogs(logData.recent_logs);

        return uniqueErrors;
    }



    // 快捷操作
    async quickAction(action) {


        const actions = {
            'security-scan': languageManager ? languageManager.translate('ai-chat-security-scan-prompt') : '请进行安全扫描，检查系统是否存在安全风险',
            'log-analysis': languageManager ? languageManager.translate('ai-chat-log-analysis-prompt') : '请帮我分析系统日志，查找可能的问题'
        };
        
        const message = actions[action];
        if (message) {
            const messageInput = document.getElementById('message-input');
            if (messageInput) {
                messageInput.value = message;
                this.updateCharCount();
                this.autoResizeTextarea();
            }
        }
    }

    // 加载对话历史
    loadConversations() {
        // 从本地存储加载对话历史
        const saved = localStorage.getItem('ai_conversations');
        if (saved) {
            try {
                this.conversations = JSON.parse(saved);
                this.renderConversationHistory();
            } catch (error) {
                console.error(languageManager ? languageManager.getText('ai-chat-load-history-failed') : '加载对话历史失败:', error);
            }
        }
    }

    // 渲染对话历史
    renderConversationHistory() {
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        this.conversations.forEach((conv, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            if (conv.id === this.currentConversationId) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="history-title">${conv.title}</div>
                <div class="history-time">${new Date(conv.updated_at).toLocaleString()}</div>
            `;
            
            item.addEventListener('click', () => {
                this.loadConversation(conv.id);
            });
            
            historyList.appendChild(item);
        });
    }

    // 加载指定对话
    loadConversation(conversationId) {
        const conversation = this.conversations.find(c => c.id === conversationId);
        if (!conversation) return;
        
        this.currentConversationId = conversationId;
        this.messageHistory = conversation.messages || [];
        
        // 清空消息容器
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            
            // 重新渲染消息
            this.messageHistory.forEach(msg => {
                this.addMessage(msg.sender, msg.content);
            });
        }
        
        this.updateChatTitle(conversation.title, `更新于 ${new Date(conversation.updated_at).toLocaleString()}`);
        this.renderConversationHistory();
    }

    // 更新对话历史
    updateConversationHistory(userMessage, aiResponse) {
        if (!this.currentConversationId) {
            // 创建新对话
            this.currentConversationId = 'conv_' + Date.now();
            const newConversation = {
                id: this.currentConversationId,
                title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                messages: []
            };
            this.conversations.unshift(newConversation);
        }
        
        // 更新对话
        const conversation = this.conversations.find(c => c.id === this.currentConversationId);
        if (conversation) {
            conversation.updated_at = new Date().toISOString();
            conversation.messages = [...this.messageHistory];
        }
        
        // 保存到本地存储
        localStorage.setItem('ai_conversations', JSON.stringify(this.conversations));
        this.renderConversationHistory();
    }

    // 清空对话历史
    clearHistory() {
        if (confirm(languageManager ? languageManager.getText('ai-chat-clear-history-confirm') : '确定要清空所有对话历史吗？此操作不可撤销。')) {
            this.conversations = [];
            localStorage.removeItem('ai_conversations');
            this.renderConversationHistory();
            this.newConversation();
        }
    }

    // 导出对话
    exportChat() {
        if (this.messageHistory.length === 0) {
            alert(languageManager ? languageManager.getText('ai-chat-export-empty') : '当前对话为空，无法导出。');
            return;
        }
        
        const exportTitle = languageManager ? languageManager.getText('ai-chat-export-title') : 'AI 对话记录';
        const exportTime = languageManager ? languageManager.getText('ai-chat-export-time') : '导出时间';
        let content = `${exportTitle}\n${exportTime}: ${new Date().toLocaleString()}\n\n`;
        
        this.messageHistory.forEach(msg => {
            const userLabel = languageManager ? languageManager.getText('ai-chat-export-user') : '用户';
            const assistantLabel = languageManager ? languageManager.getText('ai-chat-export-assistant') : 'AI助手';
            const sender = msg.sender === 'user' ? userLabel : assistantLabel;
            const time = new Date(msg.timestamp).toLocaleTimeString();
            content += `[${time}] ${sender}: ${msg.content}\n\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = languageManager ? languageManager.getText('ai-chat-export-filename') : 'AI对话记录';
        a.download = `${filename}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 分享对话
    shareChat() {
        if (this.messageHistory.length === 0) {
            alert(languageManager ? languageManager.getText('ai-chat-share-empty') : '当前对话为空，无法分享。');
            return;
        }
        
        const shareData = {
            title: languageManager ? languageManager.getText('ai-chat-share-title') : 'AI 对话记录',
            text: languageManager ? languageManager.getText('ai-chat-share-text') : '查看我与AI助手的对话记录',
            url: window.location.href
        };
        
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // 复制到剪贴板
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                alert(languageManager ? languageManager.getText('ai-chat-share-copied') : '对话链接已复制到剪贴板！');
            }).catch(() => {
                alert(languageManager ? languageManager.getText('ai-chat-share-unavailable') : '分享功能暂不可用。');
            });
        }
    }



    // 显示加载指示器
    showLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.style.display = 'flex';
        }
    }

    // 隐藏加载指示器
    hideLoading() {
        const loading = document.getElementById('loading-overlay');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    // 检查AI模型状态
    async checkAIStatus() {
        try {
            const response = await fetch('/api/ai-chat/status');
            const status = await response.json();
            
            if (status.error) {
                console.error('获取AI状态失败:', status.error);
                return false;
            }
            
            return status;
        } catch (error) {
            console.error('检查AI状态失败:', error);
            return false;
        }
    }

    // 初始化AI模型
    async initAIModel() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/ai-chat/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.addMessage('ai', '正在初始化AI模型，这可能需要几分钟时间，请耐心等待...', false);
            
            // 定期检查模型状态
            this.checkModelLoadingStatus();
            
        } catch (error) {
            console.error('初始化AI模型失败:', error);
            this.addMessage('ai', '初始化AI模型失败: ' + error.message, true);
        } finally {
            this.hideLoading();
        }
    }

    // 检查模型加载状态
    async checkModelLoadingStatus() {
        const checkInterval = setInterval(async () => {
            const status = await this.checkAIStatus();
            
            if (status && status.loaded && !status.loading) {
                clearInterval(checkInterval);
                this.addMessage('ai', '🎉 AI模型已成功加载！现在可以正常对话了。', false);
                this.hideModelInitButton();
            } else if (status && status.error) {
                clearInterval(checkInterval);
                this.addMessage('ai', '❌ AI模型加载失败: ' + status.error, true);
            }
        }, 3000); // 每3秒检查一次
        
        // 30秒后停止检查
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 30000);
    }

    // 显示模型初始化按钮
    showModelInitButton() {
        const messagesContainer = document.getElementById('messages-container');
        if (!messagesContainer) return;
        
        // 检查是否已经有初始化按钮
        if (messagesContainer.querySelector('.model-init-button')) return;
        
        const buttonDiv = document.createElement('div');
        buttonDiv.className = 'message ai model-init-button';
        buttonDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="message-text">
                    <p>AI模型尚未加载，点击下方按钮初始化模型：</p>
                    <button onclick="aiChat.initAIModel()" class="btn btn-primary" style="margin-top: 10px;">
                        <i class="fas fa-play"></i> 初始化AI模型
                    </button>
                </div>
                <div class="message-time">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        messagesContainer.appendChild(buttonDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // 隐藏模型初始化按钮
    hideModelInitButton() {
        const button = document.querySelector('.model-init-button');
        if (button) {
            button.remove();
        }
    }

    // 页面加载时检查AI状态
    async checkInitialAIStatus() {
        const status = await this.checkAIStatus();
        
        if (status && !status.available) {
            this.addMessage('ai', '⚠️ AI模型模块不可用，将使用基础回复功能。', true);
        } else if (status && !status.loaded && !status.loading) {
            this.showModelInitButton();
        } else if (status && status.loading) {
            this.addMessage('ai', '🔄 AI模型正在加载中，请稍候...', false);
            this.checkModelLoadingStatus();
        } else if (status && status.loaded) {
            this.addMessage('ai', '✅ AI模型已就绪，可以开始对话！', false);
        }
    }
}

// 全局变量，供HTML中的onclick使用
let aiChat;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 延迟初始化，确保languageManager和themeManager先被创建
    setTimeout(() => {
        aiChat = new AIChatInterface();
    }, 100);
});
