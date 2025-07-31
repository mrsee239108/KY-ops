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
        this.isRecording = false;
        this.recognition = null;
        this.messageHistory = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConversations();
        this.initSpeechRecognition();
        this.autoResizeTextarea();
        
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

        // 文件上传事件
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#667eea';
                uploadArea.style.background = '#f8f9fa';
            });
            
            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#dee2e6';
                uploadArea.style.background = '';
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#dee2e6';
                uploadArea.style.background = '';
                this.handleFileUpload(e.dataTransfer.files);
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }

        // 模态框外部点击关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
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
        
        // 显示加载指示器
        this.showLoading();
        
        try {
            // 发送消息到后端
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.currentConversationId,
                    history: this.messageHistory.slice(-10) // 只发送最近10条消息作为上下文
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // 添加AI回复到界面
            this.addMessage('ai', data.response);
            
            // 更新对话ID
            if (data.conversation_id) {
                this.currentConversationId = data.conversation_id;
            }
            
            // 更新对话历史
            this.updateConversationHistory(message, data.response);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            this.addMessage('ai', '抱歉，我现在无法回复您的消息。请稍后再试。', true);
        } finally {
            this.hideLoading();
            if (sendBtn) {
                sendBtn.disabled = false;
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

    // 文件上传
    attachFile() {
        this.showModal('file-upload-modal');
    }

    // 处理文件上传
    handleFileUpload(files) {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;
        
        fileList.innerHTML = '';
        
        Array.from(files).forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <i class="fas fa-file"></i>
                <span>${file.name}</span>
                <span>(${this.formatFileSize(file.size)})</span>
            `;
            fileList.appendChild(item);
        });
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 上传文件
    async uploadFiles() {
        const fileInput = document.getElementById('file-input');
        if (!fileInput || !fileInput.files.length) {
            alert('请选择要上传的文件。');
            return;
        }
        
        const formData = new FormData();
        Array.from(fileInput.files).forEach(file => {
            formData.append('files', file);
        });
        
        try {
            this.showLoading();
            
            const response = await fetch('/api/upload-files', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.closeModal('file-upload-modal');
            alert('文件上传成功！');
            
            // 清空文件选择
            fileInput.value = '';
            document.getElementById('file-list').innerHTML = '';
            
        } catch (error) {
            console.error('文件上传失败:', error);
            alert('文件上传失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 语音输入
    toggleVoice() {
        if (this.isRecording) {
            this.stopVoice();
        } else {
            this.showModal('voice-modal');
        }
    }

    // 初始化语音识别
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'zh-CN';
            
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const voiceText = document.getElementById('voice-text');
                if (voiceText) {
                    voiceText.textContent = finalTranscript + interimTranscript;
                }
                
                if (finalTranscript) {
                    const messageInput = document.getElementById('message-input');
                    if (messageInput) {
                        messageInput.value = finalTranscript;
                        this.updateCharCount();
                        this.autoResizeTextarea();
                    }
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('语音识别错误:', event.error);
                this.stopVoice();
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceStatus('录音已停止');
            };
        }
    }

    // 开始语音录音
    startVoice() {
        if (!this.recognition) {
            alert('您的浏览器不支持语音识别功能。');
            return;
        }
        
        this.isRecording = true;
        this.recognition.start();
        this.updateVoiceStatus('正在录音...');
        
        const voiceAnimation = document.getElementById('voice-animation');
        if (voiceAnimation) {
            voiceAnimation.style.display = 'flex';
        }
    }

    // 停止语音录音
    stopVoice() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
        this.isRecording = false;
        this.updateVoiceStatus('录音已停止');
        
        const voiceAnimation = document.getElementById('voice-animation');
        if (voiceAnimation) {
            voiceAnimation.style.display = 'none';
        }
        
        setTimeout(() => {
            this.closeModal('voice-modal');
        }, 1000);
    }

    // 更新语音状态
    updateVoiceStatus(status) {
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = status;
        }
    }

    // 显示模态框
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    // 关闭模态框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        
        // 如果是语音模态框，停止录音
        if (modalId === 'voice-modal') {
            this.stopVoice();
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
}

// 全局变量，供HTML中的onclick使用
let aiChat;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    aiChat = new AIChatInterface();
});