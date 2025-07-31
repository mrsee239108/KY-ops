// 设置页面JavaScript功能
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

class SettingsManager {
    constructor() {
        this.currentSettings = {};
        this.defaultSettings = {
            theme: {
                background_type: 'gradient',
                background_color: '#1a1a2e',
                secondary_color: '#16213e',
                accent_color: '#0f3460',
                opacity: 0.95
            },
            interface: {
                animation_enabled: true,
                blur_enabled: true,
                transparency_enabled: true
            }
        };
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.loadSystemInfo();
        this.updateConnectionTime();
        
        // 每秒更新连接时间
        setInterval(() => this.updateConnectionTime(), 1000);
    }

    bindEvents() {
        // 导航切换
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchSection(e.target.closest('.nav-item').dataset.section);
            });
        });

        // 窗口控制
        document.getElementById('closeBtn')?.addEventListener('click', () => {
            window.close();
        });

        document.getElementById('minimizeBtn')?.addEventListener('click', () => {
            // 最小化功能（需要Electron支持）
            console.log('最小化窗口');
        });

        document.getElementById('maximizeBtn')?.addEventListener('click', () => {
            // 最大化功能（需要Electron支持）
            console.log('最大化窗口');
        });

        // 颜色输入同步
        this.bindColorInputs();

        // 滑块值显示
        this.bindSliders();

        // 主题预设
        this.bindThemePresets();

        // 底部按钮
        this.bindFooterButtons();

        // 操作按钮
        this.bindActionButtons();

        // 背景类型切换
        document.querySelectorAll('input[name="background_type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateBackgroundType(e.target.value);
            });
        });

        // 实时预览
        this.bindRealTimePreview();
    }

    bindColorInputs() {
        const colorInputs = [
            { color: 'background-color', text: 'background-color-text' },
            { color: 'secondary-color', text: 'secondary-color-text' },
            { color: 'accent-color', text: 'accent-color-text' }
        ];

        colorInputs.forEach(({ color, text }) => {
            const colorInput = document.getElementById(color);
            const textInput = document.getElementById(text);

            if (colorInput && textInput) {
                colorInput.addEventListener('input', (e) => {
                    textInput.value = e.target.value;
                    this.applyPreview();
                });

                textInput.addEventListener('input', (e) => {
                    const value = e.target.value;
                    if (/^#[0-9A-F]{6}$/i.test(value)) {
                        colorInput.value = value;
                        this.applyPreview();
                    }
                });
            }
        });
    }

    bindSliders() {
        const opacitySlider = document.getElementById('opacity-slider');
        const opacityValue = document.querySelector('.slider-value');

        if (opacitySlider && opacityValue) {
            opacitySlider.addEventListener('input', (e) => {
                const value = Math.round(e.target.value * 100);
                opacityValue.textContent = `${value}%`;
                this.applyPreview();
            });
        }
    }

    bindThemePresets() {
        document.querySelectorAll('.theme-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.applyThemePreset(theme);
            });
        });
    }

    bindFooterButtons() {
        document.getElementById('cancel-btn')?.addEventListener('click', () => {
            this.loadSettings();
            this.showStatus('已取消更改');
        });

        document.getElementById('apply-btn')?.addEventListener('click', () => {
            this.applySettings();
        });

        document.getElementById('save-btn')?.addEventListener('click', () => {
            this.saveSettings();
        });
    }

    bindActionButtons() {
        document.getElementById('reset-settings')?.addEventListener('click', () => {
            this.resetSettings();
        });

        document.getElementById('export-settings')?.addEventListener('click', () => {
            this.exportSettings();
        });

        document.getElementById('import-settings')?.addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file')?.addEventListener('change', (e) => {
            this.importSettings(e.target.files[0]);
        });
    }

    bindRealTimePreview() {
        // 监听所有输入变化进行实时预览
        const inputs = document.querySelectorAll('input[type="color"], input[type="range"], input[type="radio"], input[type="checkbox"]');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.applyPreview();
            });
        });
    }

    switchSection(sectionName) {
        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // 切换内容区域
        document.querySelectorAll('.settings-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${sectionName}-section`).classList.add('active');
    }

    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                this.currentSettings = await response.json();
                this.applySettingsToUI();
            } else {
                this.currentSettings = { ...this.defaultSettings };
                this.applySettingsToUI();
            }
        } catch (error) {
            console.error('加载设置失败:', error);
            this.currentSettings = { ...this.defaultSettings };
            this.applySettingsToUI();
        }
    }

    applySettingsToUI() {
        const settings = this.currentSettings;

        // 应用主题设置
        if (settings.theme) {
            document.getElementById('background-color').value = settings.theme.background_color || '#1a1a2e';
            document.getElementById('background-color-text').value = settings.theme.background_color || '#1a1a2e';
            document.getElementById('secondary-color').value = settings.theme.secondary_color || '#16213e';
            document.getElementById('secondary-color-text').value = settings.theme.secondary_color || '#16213e';
            document.getElementById('accent-color').value = settings.theme.accent_color || '#0f3460';
            document.getElementById('accent-color-text').value = settings.theme.accent_color || '#0f3460';
            document.getElementById('opacity-slider').value = settings.theme.opacity || 0.95;
            document.querySelector('.slider-value').textContent = `${Math.round((settings.theme.opacity || 0.95) * 100)}%`;

            // 背景类型
            const bgType = settings.theme.background_type || 'gradient';
            document.querySelector(`input[name="background_type"][value="${bgType}"]`).checked = true;
        }

        // 应用界面设置
        if (settings.interface) {
            document.getElementById('animation-enabled').checked = settings.interface.animation_enabled !== false;
            document.getElementById('blur-enabled').checked = settings.interface.blur_enabled !== false;
            document.getElementById('transparency-enabled').checked = settings.interface.transparency_enabled !== false;
        }

        this.applyPreview();
    }

    applyPreview() {
        const bgColor = document.getElementById('background-color').value;
        const secondaryColor = document.getElementById('secondary-color').value;
        const accentColor = document.getElementById('accent-color').value;
        const opacity = document.getElementById('opacity-slider').value;
        const bgType = document.querySelector('input[name="background_type"]:checked').value;

        let background;
        switch (bgType) {
            case 'gradient':
                background = `linear-gradient(135deg, ${bgColor}, ${secondaryColor}, ${accentColor})`;
                break;
            case 'solid':
                background = bgColor;
                break;
            case 'image':
                background = `${bgColor} url('/static/images/bg.jpg') center/cover`;
                break;
            default:
                background = `linear-gradient(135deg, ${bgColor}, ${secondaryColor}, ${accentColor})`;
        }

        // 应用到当前页面
        document.body.style.background = background;
        
        // 更新透明度
        const elements = document.querySelectorAll('.settings-group, .title-bar, .settings-sidebar, .settings-footer');
        elements.forEach(el => {
            const currentBg = window.getComputedStyle(el).backgroundColor;
            if (currentBg.includes('rgba')) {
                const rgba = currentBg.match(/rgba?\(([^)]+)\)/)[1].split(',');
                rgba[3] = opacity;
                el.style.backgroundColor = `rgba(${rgba.join(',')})`;
            }
        });
    }

    applyThemePreset(themeName) {
        const presets = {
            default: {
                background_color: '#1a1a2e',
                secondary_color: '#16213e',
                accent_color: '#0f3460'
            },
            dark: {
                background_color: '#2c3e50',
                secondary_color: '#34495e',
                accent_color: '#1a252f'
            },
            purple: {
                background_color: '#667eea',
                secondary_color: '#764ba2',
                accent_color: '#f093fb'
            },
            green: {
                background_color: '#11998e',
                secondary_color: '#38ef7d',
                accent_color: '#2dd4bf'
            },
            orange: {
                background_color: '#ff9a9e',
                secondary_color: '#fecfef',
                accent_color: '#fecfef'
            },
            blue: {
                background_color: '#667eea',
                secondary_color: '#764ba2',
                accent_color: '#667eea'
            }
        };

        const preset = presets[themeName];
        if (preset) {
            document.getElementById('background-color').value = preset.background_color;
            document.getElementById('background-color-text').value = preset.background_color;
            document.getElementById('secondary-color').value = preset.secondary_color;
            document.getElementById('secondary-color-text').value = preset.secondary_color;
            document.getElementById('accent-color').value = preset.accent_color;
            document.getElementById('accent-color-text').value = preset.accent_color;

            // 更新预设选择状态
            document.querySelectorAll('.theme-preset').forEach(p => p.classList.remove('active'));
            document.querySelector(`[data-theme="${themeName}"]`).classList.add('active');

            this.applyPreview();
        }
    }

    updateBackgroundType(type) {
        // 根据背景类型显示/隐藏相关选项
        console.log('背景类型切换为:', type);
        this.applyPreview();
    }

    async applySettings() {
        const settings = this.collectSettings();
        
        try {
            // 应用到当前页面
            this.applyPreview();
            
            // 保存到localStorage用于其他页面
            localStorage.setItem('userSettings', JSON.stringify(settings));
            
            this.showStatus('设置已应用', 'success');
        } catch (error) {
            console.error('应用设置失败:', error);
            this.showStatus('应用设置失败', 'error');
        }
    }

    async saveSettings() {
        const settings = this.collectSettings();
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.currentSettings = settings;
                this.applySettings();
                this.showStatus('设置已保存', 'success');
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showStatus('保存设置失败', 'error');
        }
    }

    collectSettings() {
        return {
            theme: {
                background_type: document.querySelector('input[name="background_type"]:checked').value,
                background_color: document.getElementById('background-color').value,
                secondary_color: document.getElementById('secondary-color').value,
                accent_color: document.getElementById('accent-color').value,
                opacity: parseFloat(document.getElementById('opacity-slider').value)
            },
            interface: {
                animation_enabled: document.getElementById('animation-enabled').checked,
                blur_enabled: document.getElementById('blur-enabled').checked,
                transparency_enabled: document.getElementById('transparency-enabled').checked
            }
        };
    }

    async resetSettings() {
        if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
            try {
                const response = await fetch('/api/settings/reset', {
                    method: 'POST'
                });

                if (response.ok) {
                    this.currentSettings = { ...this.defaultSettings };
                    this.applySettingsToUI();
                    this.showStatus('设置已重置', 'success');
                } else {
                    throw new Error('重置失败');
                }
            } catch (error) {
                console.error('重置设置失败:', error);
                this.showStatus('重置设置失败', 'error');
            }
        }
    }

    exportSettings() {
        const settings = this.collectSettings();
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `settings_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showStatus('设置已导出', 'success');
    }

    importSettings(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                this.currentSettings = settings;
                this.applySettingsToUI();
                this.showStatus('设置已导入', 'success');
            } catch (error) {
                console.error('导入设置失败:', error);
                this.showStatus('导入设置失败：文件格式错误', 'error');
            }
        };
        reader.readAsText(file);
    }

    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system-status');
            if (response.ok) {
                const data = await response.json();
                
                document.getElementById('system-version').textContent = `${data.system} ${data.version || ''}`;
                document.getElementById('system-uptime').textContent = data.uptime || '未知';
                document.getElementById('memory-usage').textContent = `${data.memory_percent}% (${data.memory_used}/${data.memory_total})`;
            }
        } catch (error) {
            console.error('加载系统信息失败:', error);
        }
    }

    updateConnectionTime() {
        // 模拟连接时间更新
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        
        // 如果有连接时间显示元素，更新它
        const timeElement = document.querySelector('.connection-time');
        if (timeElement) {
            timeElement.textContent = timeStr;
        }
    }

    showStatus(message, type = 'info') {
        const statusText = document.getElementById('status-text');
        if (statusText) {
            statusText.textContent = message;
            statusText.className = `status-text ${type}`;
            
            // 3秒后恢复默认状态
            setTimeout(() => {
                statusText.textContent = '就绪';
                statusText.className = 'status-text';
            }, 3000);
        }

        // 也可以显示临时消息
        this.showTemporaryMessage(message, type);
    }

    showTemporaryMessage(message, type = 'info') {
        // 创建临时消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `${type}-message`;
        messageEl.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}-circle"></i> ${message}`;
        
        // 添加到页面
        const container = document.querySelector('.settings-main');
        container.insertBefore(messageEl, container.firstChild);
        
        // 3秒后移除
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});

// 全局函数：应用用户设置到其他页面
function applyUserSettings() {
    const settings = localStorage.getItem('userSettings');
    if (settings) {
        try {
            const userSettings = JSON.parse(settings);
            
            if (userSettings.theme) {
                const { background_color, secondary_color, accent_color, background_type } = userSettings.theme;
                
                let background;
                switch (background_type) {
                    case 'gradient':
                        background = `linear-gradient(135deg, ${background_color}, ${secondary_color}, ${accent_color})`;
                        break;
                    case 'solid':
                        background = background_color;
                        break;
                    case 'image':
                        background = `${background_color} url('/static/images/bg.jpg') center/cover`;
                        break;
                    default:
                        background = `linear-gradient(135deg, ${background_color}, ${secondary_color}, ${accent_color})`;
                }
                
                document.body.style.background = background;
            }
        } catch (error) {
            console.error('应用用户设置失败:', error);
        }
    }
}

// 如果不是设置页面，自动应用用户设置
if (!window.location.pathname.includes('/settings')) {
    document.addEventListener('DOMContentLoaded', applyUserSettings);
}