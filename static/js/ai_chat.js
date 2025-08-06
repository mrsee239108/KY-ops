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

// AI 对话界面功能
class AIChatInterface {
    constructor() {
        this.conversations = [];
        this.currentConversationId = null;
        this.messageHistory = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConversations();
        this.autoResizeTextarea();
        
        // 检查AI模型状态
        setTimeout(() => {
            this.checkInitialAIStatus();
        }, 1000);
        
        console.log('AI 对话界面已初始化');
    }

    setupEventListeners() {
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
                this.addMessage('ai', data.error || '模型正在加载中，请稍后再试...', true);
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
            console.error('发送消息失败:', error);
            this.addMessage('ai', '抱歉，我现在无法回复您的消息。请稍后再试。', true);
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

    // 快捷操作
    async quickAction(action) {


        const actions = {
            'system-check': '请帮我检查系统状态，包括CPU、内存、磁盘使用情况',
            'performance-analysis': '请分析当前系统性能，给出优化建议',
            'security-scan': '请进行安全扫描，检查系统是否存在安全风险',
            'log-analysis': '请帮我分析系统日志，查找可能的问题'
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
                console.error('加载对话历史失败:', error);
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
        if (confirm('确定要清空所有对话历史吗？此操作不可撤销。')) {
            this.conversations = [];
            localStorage.removeItem('ai_conversations');
            this.renderConversationHistory();
            this.newConversation();
        }
    }

    // 导出对话
    exportChat() {
        if (this.messageHistory.length === 0) {
            alert('当前对话为空，无法导出。');
            return;
        }
        
        let content = `AI 对话记录\n导出时间: ${new Date().toLocaleString()}\n\n`;
        
        this.messageHistory.forEach(msg => {
            const sender = msg.sender === 'user' ? '用户' : 'AI助手';
            const time = new Date(msg.timestamp).toLocaleTimeString();
            content += `[${time}] ${sender}: ${msg.content}\n\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI对话记录_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 分享对话
    shareChat() {
        if (this.messageHistory.length === 0) {
            alert('当前对话为空，无法分享。');
            return;
        }
        
        const shareData = {
            title: 'AI 对话记录',
            text: '查看我与AI助手的对话记录',
            url: window.location.href
        };
        
        if (navigator.share) {
            navigator.share(shareData);
        } else {
            // 复制到剪贴板
            const url = window.location.href;
            navigator.clipboard.writeText(url).then(() => {
                alert('对话链接已复制到剪贴板！');
            }).catch(() => {
                alert('分享功能暂不可用。');
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
    aiChat = new AIChatInterface();
});