# KY-ops

**基于银河麒麟操作系统的智能运维管家工具**

一个集成了AI智能对话、实时系统监控、安全扫描、性能分析等功能的现代化Linux运维管理平台。

## 🚀 快速部署

### 系统要求

- **操作系统**: Linux (推荐银河麒麟、Ubuntu 18.04+、CentOS 7+)
- **Python版本**: Python 3.11+ (脚本支持自动安装)
- **内存**: 最低 4GB RAM (AI功能需要 8GB+)
- **磁盘空间**: 最低 10GB 可用空间
- **网络**: 需要互联网连接用于依赖安装

### 一键部署

1. **下载项目**
   ```bash
   git clone https://github.com/mrsee239108/KY-ops.git
   cd KY-ops
   ```

2. **运行部署脚本**
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

   部署脚本将自动完成以下操作：
   - 检查并安装Python 3.11环境
   - 安装项目依赖包
   - 配置AI模型环境
   - 启动Web服务

3. **访问系统**
   
   部署完成后，在浏览器中访问：
   ```
   http://your-server-ip:5000
   ```

### 手动部署

如果自动部署脚本遇到问题，可以手动部署：

1. **安装Python 3.11+**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install python3.11 python3.11-pip
   
   # CentOS/RHEL
   sudo yum install python3.11 python3.11-pip
   ```

2. **安装依赖**
   ```bash
   pip3 install -r requirements.txt
   pip3 install -r LLM/requirements.txt  # AI功能依赖
   ```

3. **启动服务**
   ```bash
   python3 app.py
   ```

## 🏗️ 技术架构

### 核心技术栈

- **后端框架**: Flask 2.3.3
- **系统监控**: psutil + 自研extuner模块
- **AI模型**: Qwen3-0.6B + LoRA微调
- **前端技术**: HTML5 + CSS3 + JavaScript + Font Awesome
- **数据处理**: NumPy + JSON
- **安全扫描**: 自研SecurityScanner模块

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Web前端界面                          │
├─────────────────────────────────────────────────────────────┤
│                      Flask Web服务                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│   系统监控模块   │    AI服务模块    │      安全扫描模块        │
│   (extuner)     │  (ai_service)   │  (security_scanner)     │
├─────────────────┼─────────────────┼─────────────────────────┤
│     实时监控     │   Qwen3模型     │     漏洞扫描            │
│   CPU/内存/网络  │   LoRA微调      │     日志分析            │
│   磁盘/进程     │   流式对话      │     敏感信息检测         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## 📋 功能模块详解

### 1. 系统监控模块 (extuner)

**核心组件**:
- `get_cpu_info.py`: CPU使用率、频率、温度监控
- `get_memory_info.py`: 内存使用情况、交换分区监控
- `get_disk_info.py`: 磁盘空间、I/O性能监控
- `get_net_info.py`: 网络接口、流量、连接状态监控
- `get_system_message.py`: 系统消息、日志监控

**技术特点**:
- 实时数据采集 (2秒间隔)
- 多线程并发监控
- 数据缓存机制
- 配置文件驱动 (`extuner.conf`)

### 2. AI智能服务模块

**模型架构**:
- **基础模型**: Qwen3-0.6B (轻量级大语言模型)
- **微调技术**: LoRA (Low-Rank Adaptation)
- **推理引擎**: 自研流式推理引擎

**核心文件**:
- `ai_service.py`: AI服务管理器
- `advanced_streaming.py`: 流式推理引擎
- `LLM/model/`: 模型文件存储
- `LLM/lora/`: LoRA适配器

**功能特性**:
- 智能运维问答
- 系统故障诊断建议
- 流式对话体验
- 对话历史管理

### 3. 安全扫描模块

**扫描类型**:
- **快速扫描**: 基础安全检查
- **全面扫描**: 深度安全分析
- **日志分析**: 异常行为检测

**检测能力**:
- 敏感信息泄露检测 (密码、手机号、身份证等)
- 系统漏洞扫描
- 文件权限检查
- 网络端口安全分析
- 实时日志监控

### 4. 性能监控与告警

**监控指标**:
- CPU使用率 (阈值: 85%)
- 内存使用率 (阈值: 90%)
- 磁盘空间 (阈值: 90%)
- 网络带宽 (阈值: 80%)
- 进程负载 (阈值: 50%)

**告警机制**:
- 实时阈值监控
- 多级告警等级
- 自动修复建议
- 历史告警记录

## 🔧 配置说明

### 系统配置文件

1. **extuner.conf**: 监控模块配置
   ```json
   {
       "Getting": {
           "Common": {
               "enable": 1,
               "CPU": {"interval": 3, "times": 1},
               "Memory": {"interval": 3, "times": 1}
           }
       }
   }
   ```

2. **settings.json**: 界面主题配置
   ```json
   {
       "theme": {
           "background_type": "solid",
           "background_color": "#1a1a2e"
       }
   }
   ```

### AI模型配置

- **模型路径**: `LLM/model/Qwen3-0.6B/`
- **LoRA适配器**: `LLM/lora/`
- **API端口**: 8000 (可配置)
- **推理参数**: 在 `advanced_streaming.py` 中配置

## 🛠️ 开发指南

### 项目结构

```
KYops/
├── app.py                 # Flask主应用
├── ai_service.py          # AI服务模块
├── security_scanner.py    # 安全扫描模块
├── requirements.txt       # Python依赖
├── start.sh              # 部署脚本
├── settings.json         # 系统配置
├── extuner/              # 系统监控模块
│   ├── category/         # 监控组件
│   ├── common/           # 公共工具
│   └── extuner.conf      # 监控配置
├── LLM/                  # AI模型模块
│   ├── model/            # 模型文件
│   ├── lora/             # LoRA适配器
│   └── requirements.txt  # AI依赖
├── templates/            # HTML模板
├── static/               # 静态资源
│   ├── css/              # 样式文件
│   └── js/               # JavaScript文件
└── repair_scripts/       # 自动修复脚本
```

### API接口

主要REST API端点：

- `GET /api/system-status`: 获取系统状态
- `GET /api/performance-data`: 获取性能数据
- `POST /api/security-scan`: 启动安全扫描
- `POST /api/ai-chat`: AI对话接口
- `GET /api/processes`: 获取进程列表
- `GET /api/network-stats`: 获取网络统计

### 扩展开发

1. **添加新的监控指标**:
   - 在 `extuner/category/` 下创建新的监控模块
   - 继承基础监控类
   - 在 `app.py` 中注册新的API端点

2. **自定义AI模型**:
   - 替换 `LLM/model/` 下的模型文件
   - 修改 `advanced_streaming.py` 中的模型加载逻辑
   - 重新训练LoRA适配器

3. **扩展安全扫描**:
   - 在 `security_scanner.py` 中添加新的扫描规则
   - 扩展敏感信息检测模式
   - 添加自动修复脚本

## 🔍 故障排除

### 常见问题

1. **Python版本问题**
   ```bash
   # 检查Python版本
   python3 --version
   # 如果版本低于3.11，运行部署脚本自动安装
   ./start.sh
   ```

2. **依赖安装失败**
   ```bash
   # 使用国内镜像源
   pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
   ```

3. **AI模型加载失败**
   - 检查模型文件是否完整
   - 确认内存是否充足 (需要8GB+)
   - 查看 `ai_service.log` 日志

4. **权限问题**
   ```bash
   # 确保脚本有执行权限
   chmod +x start.sh
   # 某些监控功能可能需要sudo权限
   ```

### 日志查看

- **应用日志**: `app.log`
- **AI服务日志**: `ai_service.log`
- **系统监控日志**: `extuner/extunerData/log/`
- **安全扫描日志**: 在Web界面查看

## 📄 许可证

本项目采用开源许可证，详见LICENSE文件。

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进项目。

## 📞 技术支持

如有技术问题，请通过以下方式联系：17799789413/liaoyuxuan239108@qq.com
- 提交GitHub Issue
- 查看项目文档
- 参考故障排除指南
