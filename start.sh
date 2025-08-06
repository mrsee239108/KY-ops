#!/bin/bash

# =============================================================================
# Linux系统监控Web应用启动脚本
# 功能：环境配置、依赖安装、获取IPv4地址、启动Web服务
# =============================================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "检测到以root用户运行，建议使用普通用户运行此应用"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 配置变量
APP_NAME="系统监控Web应用"
APP_FILE="app.py"
REQUIREMENTS_FILE="requirements.txt"
DEFAULT_PORT=5000
LOG_FILE="app.log"

# 新增AI模型配置
AI_MODEL_REPO="Qwen/Qwen3-0.6B"
AI_MODEL_PATH="LLM/model/Qwen3-0.6B"  # 更新为0.6B模型
LORA_PATH="LLM/lora"
AI_API_PORT=8000
AI_LOG_FILE="ai_service.log"

# Python自动安装配置
# 在脚本开头添加环境变量设置（在现有配置变量之后）
# Python 3.11自动安装相关配置
PYTHON_VERSION_REQUIRED="3.11"
PYTHON_TARBALL="Python-3.11.13.tgz"
PYTHON_SOURCE_DIR="Python-3.11.13"
PYTHON_INSTALL_PREFIX="/usr/local"

# 设置动态库路径环境变量
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
export PKG_CONFIG_PATH="/usr/local/lib/pkgconfig:$PKG_CONFIG_PATH"

# 设置transformers库的日志级别，减少警告信息
export TRANSFORMERS_VERBOSITY=error
export TOKENIZERS_PARALLELISM=false

# AI模型相关配置
LLM_DIR="LLM"
AI_MODEL_PATH="LLM/model/Qwen3-0.6B"
LORA_PATH="LLM/lora"
AI_API_PORT=8000
AI_LOG_FILE="ai_service.log"

# 显示启动横幅
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Linux系统监控Web应用                      ║"
    echo "║                      启动脚本 v1.1                          ║"
    echo "║                                                              ║"
    echo "║  功能: 自动配置环境、安装依赖、获取IP、启动Web服务            ║"
    echo "║        支持Python 3.11自动安装和AI模型集成                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查Python版本是否满足要求
check_python_version() {
    local version_string=$1
    local major=$(echo $version_string | cut -d. -f1)
    local minor=$(echo $version_string | cut -d. -f2)
    
    # 检查是否为Python 3.11+
    if [[ $major -lt 3 ]] || [[ $major -eq 3 && $minor -lt 11 ]]; then
        return 1
    fi
    return 0
}

# 自动安装Python 3.11
# 自动安装Python 3.11
install_python311() {
    log_header "自动安装Python 3.11"
    
    # 检查Python源码包是否存在
    if [[ ! -f "$PYTHON_TARBALL" ]]; then
        log_error "未找到Python源码包: $PYTHON_TARBALL"
        log_info "请确保 $PYTHON_TARBALL 文件在当前目录下"
        return 1
    fi
    
    log_info "检测到Python源码包: $PYTHON_TARBALL"
    
    # 检查是否有编译工具
    log_info "检查编译环境..."
    local missing_tools=()
    
    if ! command -v gcc &> /dev/null; then
        missing_tools+=("gcc")
    fi
    
    if ! command -v make &> /dev/null; then
        missing_tools+=("make")
    fi
    
    # 安装必要的编译工具和依赖
    if [[ ${#missing_tools[@]} -gt 0 ]] || ! dpkg -l | grep -q "build-essential\|libssl-dev\|zlib1g-dev"; then
        log_info "安装编译依赖..."
        
        if command -v apt &> /dev/null; then
            sudo apt update
            sudo apt install -y build-essential libssl-dev zlib1g-dev \
                libncurses5-dev libncursesw5-dev libreadline-dev libsqlite3-dev \
                libgdbm-dev libdb5.3-dev libbz2-dev libexpat1-dev liblzma-dev \
                tk-dev libffi-dev
        elif command -v yum &> /dev/null; then
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y openssl-devel zlib-devel ncurses-devel \
                readline-devel sqlite-devel gdbm-devel db4-devel \
                libpcap-devel xz-devel expat-devel
        elif command -v dnf &> /dev/null; then
            sudo dnf groupinstall -y "Development Tools"
            sudo dnf install -y openssl-devel zlib-devel ncurses-devel \
                readline-devel sqlite-devel gdbm-devel libdb-devel \
                libpcap-devel xz-devel expat-devel
        else
            log_error "无法自动安装编译依赖，请手动安装"
            return 1
        fi
    fi
    
    # 解压源码包
    log_info "解压Python源码包..."
    if [[ -d "$PYTHON_SOURCE_DIR" ]]; then
        log_warning "源码目录已存在，删除旧目录..."
        rm -rf "$PYTHON_SOURCE_DIR"
    fi
    
    tar -xzf "$PYTHON_TARBALL"
    if [[ $? -ne 0 ]]; then
        log_error "解压失败"
        return 1
    fi
    
    # 进入源码目录
    cd "$PYTHON_SOURCE_DIR"
    
    # 配置编译选项
    log_info "配置Python编译选项..."
    ./configure --prefix="$PYTHON_INSTALL_PREFIX" \
                --enable-optimizations \
                --with-ssl \
                --enable-shared \
                --with-system-ffi \
                --enable-loadable-sqlite-extensions
    
    if [[ $? -ne 0 ]]; then
        log_error "配置失败"
        cd ..
        return 1
    fi
    
    # 编译Python
    log_info "编译Python（这可能需要几分钟时间）..."
    make -j$(nproc)
    
    if [[ $? -ne 0 ]]; then
        log_error "编译失败"
        cd ..
        return 1
    fi
    
    # 安装Python
    log_info "安装Python到系统..."
    sudo make altinstall
    
    if [[ $? -ne 0 ]]; then
        log_error "安装失败"
        cd ..
        return 1
    fi
    
    # 返回原目录
    cd ..
    
    # 配置动态链接库路径
    log_info "配置动态链接库路径..."
    
    # 创建库路径配置文件
    echo "$PYTHON_INSTALL_PREFIX/lib" | sudo tee /etc/ld.so.conf.d/python3.11.conf > /dev/null
    
    # 更新动态链接库缓存
    sudo ldconfig
    
    # 验证库文件是否可以找到
    if ! ldconfig -p | grep -q "libpython3.11.so"; then
        log_warning "动态链接库配置可能有问题，尝试手动配置..."
        
        # 手动添加到系统库路径
        if [[ -f "$PYTHON_INSTALL_PREFIX/lib/libpython3.11.so.1.0" ]]; then
            sudo ln -sf "$PYTHON_INSTALL_PREFIX/lib/libpython3.11.so.1.0" /usr/lib/libpython3.11.so.1.0
            sudo ln -sf "$PYTHON_INSTALL_PREFIX/lib/libpython3.11.so.1.0" /usr/lib/libpython3.11.so
        fi
        
        # 再次更新缓存
        sudo ldconfig
    fi
    
    # 创建符号链接
    log_info "创建Python符号链接..."
    if [[ -f "$PYTHON_INSTALL_PREFIX/bin/python3.11" ]]; then
        sudo ln -sf "$PYTHON_INSTALL_PREFIX/bin/python3.11" /usr/bin/python3.11
        sudo ln -sf "$PYTHON_INSTALL_PREFIX/bin/python3.11" /usr/bin/python3
        
        # 安装pip
        if [[ -f "$PYTHON_INSTALL_PREFIX/bin/pip3.11" ]]; then
            sudo ln -sf "$PYTHON_INSTALL_PREFIX/bin/pip3.11" /usr/bin/pip3.11
            sudo ln -sf "$PYTHON_INSTALL_PREFIX/bin/pip3.11" /usr/bin/pip3
        else
            log_info "安装pip..."
            # 使用完整路径调用python3.11来避免库路径问题
            curl -sS https://bootstrap.pypa.io/get-pip.py | sudo "$PYTHON_INSTALL_PREFIX/bin/python3.11"
            
            # 创建pip符号链接
            if [[ -f "$PYTHON_INSTALL_PREFIX/bin/pip3.11" ]]; then
                sudo ln -sf "$PYTHON_INSTALL_PREFIX/bin/pip3.11" /usr/bin/pip3.11
                sudo ln -sf "$PYTHON_INSTALL_PREFIX/bin/pip3.11" /usr/bin/pip3
            fi
        fi
        
        log_success "Python 3.11 安装完成！"
        log_info "Python路径: $PYTHON_INSTALL_PREFIX/bin/python3.11"
        
        # 验证安装 - 使用完整路径避免库路径问题
        log_info "验证Python安装..."
        PYTHON_VERSION=$("$PYTHON_INSTALL_PREFIX/bin/python3.11" --version 2>&1 | cut -d' ' -f2)
        if [[ -n "$PYTHON_VERSION" ]]; then
            log_success "Python版本验证成功: $PYTHON_VERSION"
        else
            log_warning "Python版本验证失败，但安装可能成功"
        fi
        
        # 测试符号链接是否工作
        log_info "测试系统Python链接..."
        if python3 --version &>/dev/null; then
            SYSTEM_PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
            log_success "系统Python链接正常: $SYSTEM_PYTHON_VERSION"
        else
            log_warning "系统Python链接有问题，将使用完整路径"
            # 如果符号链接有问题，我们在后续使用完整路径
            export PYTHON_FULL_PATH="$PYTHON_INSTALL_PREFIX/bin/python3.11"
            export PIP_FULL_PATH="$PYTHON_INSTALL_PREFIX/bin/pip3.11"
        fi
        
        return 0
    else
        log_error "Python安装失败，未找到可执行文件"
        return 1
    fi
}

# 检查并自动安装Python
check_and_install_python() {
    log_header "检查Python环境"
    
    # 检查Python3是否存在
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
        log_info "当前Python版本: $PYTHON_VERSION"
        
        # 检查版本是否满足要求
        if check_python_version "$PYTHON_VERSION"; then
            log_success "Python版本满足要求 (>= 3.11)"
            return 0
        else
            log_warning "Python版本过低，需要升级到3.11+"
            log_info "当前版本: $PYTHON_VERSION，要求版本: >= $PYTHON_VERSION_REQUIRED"
        fi
    else
        log_warning "未找到Python3"
    fi
    
    # 询问是否自动安装
    echo
    log_info "检测到本地有Python 3.11.13源码包，可以自动编译安装"
    read -p "是否自动安装Python 3.11？(y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if install_python311; then
            log_success "Python 3.11 安装成功！"
        else
            log_error "Python 3.11 安装失败"
            log_info "请手动安装Python 3.11或更高版本"
            exit 1
        fi
    else
        log_error "Python版本不满足要求，请手动升级Python"
        log_info "Ubuntu/Debian: sudo apt update && sudo apt install python3.11 python3.11-pip"
        log_info "或者重新运行脚本选择自动安装"
        exit 1
    fi
}

# 检查系统环境
check_system() {
    log_header "检查系统环境"
    
    # 检查操作系统
    if [[ "$OSTYPE" != "linux-gnu"* ]]; then
        log_error "此脚本仅支持Linux系统"
        exit 1
    fi
    
    log_success "操作系统: $(lsb_release -d 2>/dev/null | cut -f2 || echo "Linux")"
    
    # 检查并自动安装Python
    check_and_install_python
    
    # 检查pip3
    if ! command -v pip3 &> /dev/null; then
        log_warning "未找到pip3，尝试安装..."
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install python3-pip -y
        elif command -v yum &> /dev/null; then
            sudo yum install python3-pip -y
        elif command -v dnf &> /dev/null; then
            sudo dnf install python3-pip -y
        else
            log_error "无法自动安装pip3，请手动安装"
            exit 1
        fi
    fi
    
    log_success "pip3已安装，将在base环境中配置依赖"
}

# 获取本机IPv4地址
get_local_ip() {
    log_header "获取网络配置"
    
    # 获取主要网络接口的IP地址
    LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    
    if [[ -z "$LOCAL_IP" ]]; then
        # 备用方法
        LOCAL_IP=$(hostname -I | awk '{print $1}')
    fi
    
    if [[ -z "$LOCAL_IP" ]]; then
        # 再次备用方法
        LOCAL_IP=$(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d'/' -f1)
    fi
    
    if [[ -z "$LOCAL_IP" ]]; then
        log_warning "无法自动获取IP地址，使用默认值 0.0.0.0"
        LOCAL_IP="0.0.0.0"
    else
        log_success "本机IP地址: $LOCAL_IP"
    fi
    
    # 显示网络接口信息
    log_info "网络接口信息:"
    ip addr show | grep -E '^[0-9]+:' | while read line; do
        interface=$(echo "$line" | cut -d':' -f2 | tr -d ' ')
        if [[ "$interface" != "lo" ]]; then
            ip_addr=$(ip addr show "$interface" 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)
            if [[ -n "$ip_addr" ]]; then
                echo -e "  ${CYAN}$interface${NC}: $ip_addr"
            fi
        fi
    done
}

# 安装依赖（直接在base环境中）
install_dependencies() {
    log_header "在base环境中安装项目依赖"
    
    if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
        log_error "未找到requirements.txt文件"
        exit 1
    fi
    
    # 确定使用的Python和pip路径
    local python_cmd="python3"
    local pip_cmd="pip3"
    
    # 如果设置了完整路径环境变量，使用完整路径
    if [[ -n "$PYTHON_FULL_PATH" ]]; then
        python_cmd="$PYTHON_FULL_PATH"
    fi
    
    if [[ -n "$PIP_FULL_PATH" ]]; then
        pip_cmd="$PIP_FULL_PATH"
    fi
    
    log_info "使用Python: $python_cmd"
    log_info "使用pip: $pip_cmd"
    
    log_info "升级pip3到最新版本..."
    $pip_cmd install --upgrade pip -i https://pypi.tuna.tsinghua.edu.cn/simple
    
    log_info "在base环境中安装依赖包..."
    
    # 首先安装主要依赖
    log_info "安装主要应用依赖..."
    local main_packages=("Flask==2.3.3" "psutil" "requests" "GPUtil" "py-cpuinfo" "json5")
    local failed_main_packages=()
    
    for package in "${main_packages[@]}"; do
        log_info "安装主要依赖 $package..."
        if ! $pip_cmd install "$package" -i https://pypi.tuna.tsinghua.edu.cn/simple; then
            log_warning "主要依赖 $package 安装失败"
            failed_main_packages+=("$package")
        else
            log_success "主要依赖 $package 安装成功"
        fi
    done
    
    # 检查是否需要安装AI依赖
    if [[ -d "$LLM_DIR" ]]; then
        log_info "检测到AI模型目录，安装AI相关依赖..."
        
        # 安装AI依赖，使用LLM目录下的requirements.txt
        if [[ -f "$LLM_DIR/requirements.txt" ]]; then
            log_info "使用LLM目录下的requirements.txt安装AI依赖..."
            if ! $pip_cmd install -r "$LLM_DIR/requirements.txt" -i https://pypi.tuna.tsinghua.edu.cn/simple; then
                log_warning "使用LLM requirements.txt安装失败，尝试逐个安装..."
                
                # 从LLM requirements.txt读取并逐个安装
                while IFS= read -r line; do
                    # 跳过空行和注释
                    if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
                        log_info "安装AI依赖 $line..."
                        if ! $pip_cmd install "$line" -i https://pypi.tuna.tsinghua.edu.cn/simple; then
                            log_warning "AI依赖 $line 安装失败，尝试不指定版本..."
                            # 提取包名（去掉版本要求）
                            package_name=$(echo "$line" | sed 's/[>=<].*//')
                            $pip_cmd install "$package_name" || log_error "无法安装 $package_name"
                        else
                            log_success "AI依赖 $line 安装成功"
                        fi
                    fi
                done < "$LLM_DIR/requirements.txt"
            else
                log_success "AI依赖安装成功"
            fi
        else
            # 如果没有LLM requirements.txt，使用硬编码的依赖列表
            log_info "使用默认AI依赖列表..."
            local ai_packages=(
                "torch>=2.0.0"
                "transformers>=4.35.0"
                "peft>=0.6.0"
                "accelerate>=0.24.0"
                "bitsandbytes>=0.41.0"
                "numpy>=1.24.0"
                "safetensors>=0.4.0"
            )
            
            for package in "${ai_packages[@]}"; do
                log_info "安装AI依赖 $package..."
                if ! $pip_cmd install "$package"; then
                    log_warning "AI依赖 $package 安装失败，尝试不指定版本..."
                    # 提取包名（去掉版本要求）
                    package_name=$(echo "$package" | sed 's/[>=<].*//')
                    $pip_cmd install "$package_name" || log_error "无法安装 $package_name"
                else
                    log_success "AI依赖 $package 安装成功"
                fi
            done
        fi
        
        # 验证关键AI依赖是否安装成功
        log_info "验证AI依赖安装..."
        local ai_required_packages=("torch" "transformers" "peft" "accelerate")
        local missing_ai_packages=()
        
        for package in "${ai_required_packages[@]}"; do
            if ! $python_cmd -c "import $package" &>/dev/null; then
                missing_ai_packages+=("$package")
            fi
        done
        
        if [[ ${#missing_ai_packages[@]} -eq 0 ]]; then
            log_success "所有AI依赖包安装成功"
        else
            log_warning "以下AI依赖包未能成功安装: ${missing_ai_packages[*]}"
            log_info "尝试重新安装缺失的AI依赖..."
            
            for package in "${missing_ai_packages[@]}"; do
                log_info "重新安装 $package..."
                $pip_cmd install --force-reinstall "$package" -i https://pypi.tuna.tsinghua.edu.cn/simple || log_warning "$package 重新安装失败"
            done
        fi
        
        # 检查AI模型文件
        if [[ -d "$AI_MODEL_PATH" ]]; then
            log_success "AI模型路径存在: $AI_MODEL_PATH"
        else
            log_warning "AI模型路径不存在: $AI_MODEL_PATH"
            log_info "AI对话功能可能无法正常工作"
        fi
        
        if [[ -d "$LORA_PATH" ]]; then
            log_success "LoRA适配器路径存在: $LORA_PATH"
        else
            log_warning "LoRA适配器路径不存在: $LORA_PATH"
        fi
    else
        log_info "未检测到AI模型目录，跳过AI依赖安装"
    fi
    
    # 如果主要包安装失败，尝试使用更宽松的版本要求
    if [[ ${#failed_main_packages[@]} -gt 0 ]]; then
        log_warning "部分主要包安装失败，尝试安装兼容版本..."
        
        for package in "${failed_main_packages[@]}"; do
            case $package in
                "Flask"*)
                    log_info "尝试安装Flask兼容版本..."
                    $pip_cmd install "Flask>=2.0.0" || $pip_cmd install "Flask"
                    ;;
                "psutil"*)
                    log_info "尝试安装psutil兼容版本..."
                    $pip_cmd install "psutil>=5.0.0" || $pip_cmd install "psutil"
                    ;;
                "requests"*)
                    log_info "尝试安装requests兼容版本..."
                    $pip_cmd install "requests>=2.20.0" || $pip_cmd install "requests"
                    ;;
                *)
                    log_info "尝试安装 $package 兼容版本..."
                    package_name=$(echo "$package" | sed 's/[>=<==].*//')
                    $pip_cmd install "$package_name"
                    ;;
            esac
        done
    fi
    
    # 验证关键包是否安装成功
    log_info "验证主要依赖安装..."
    local required_packages=("flask" "psutil" "requests")
    local missing_packages=()
    
    for package in "${required_packages[@]}"; do
        if ! $python_cmd -c "import $package" &>/dev/null; then
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -eq 0 ]]; then
        log_success "所有关键依赖包安装成功"
    else
        log_error "以下关键依赖包未能成功安装: ${missing_packages[*]}"
        log_info "请手动安装这些包："
        for package in "${missing_packages[@]}"; do
            echo "  $pip_cmd install $package"
        done
        return 1
    fi
    
    # 最终验证：检查peft模块是否可用
    if [[ -d "$LLM_DIR" ]]; then
        log_info "最终验证AI模块可用性..."
        if $python_cmd -c "import peft" &>/dev/null; then
            log_success "✓ peft模块验证成功"
        else
            log_warning "✗ peft模块验证失败，尝试强制重新安装..."
            $pip_cmd install --force-reinstall peft
            
            # 再次验证
            if $python_cmd -c "import peft" &>/dev/null; then
                log_success "✓ peft模块重新安装成功"
            else
                log_error "✗ peft模块仍然无法导入，AI功能可能受影响"
            fi
        fi
    fi
}

# 下载AI模型
download_ai_model() {
    log_header "下载AI模型"
    
    # 检查模型是否已存在
    if [[ -d "$AI_MODEL_PATH" ]]; then
        log_success "AI模型已存在: $AI_MODEL_PATH"
        return 0
    fi
    
    log_info "需要下载AI模型: $AI_MODEL_REPO"
    log_info "模型将保存到: $AI_MODEL_PATH"
    
    # 检查modelscope是否可用
    if ! command -v modelscope &> /dev/null; then
        log_warning "未找到modelscope-cli，尝试安装..."
        
        # 确定pip命令
        local pip_cmd="pip3"
        if [[ -n "$PIP_FULL_PATH" ]]; then
            pip_cmd="$PIP_FULL_PATH"
        fi
        
        log_info "安装modelscope-cli..."
        if ! $pip_cmd install modelscope -i https://pypi.tuna.tsinghua.edu.cn/simple --trusted-host pypi.tuna.tsinghua.edu.cn; then
            log_error "安装modelscope-cli失败，无法下载模型"
            return 1
        fi
        log_success "modelscope-cli安装成功"
    fi
    
    # 创建模型目录
    mkdir -p "$AI_MODEL_PATH"
    
    # 下载模型
    log_info "开始下载模型（大小约1.2GB，可能需要几分钟）..."
    modelscope download --model $AI_MODEL_REPO --local_dir "$AI_MODEL_PATH"
    
    if [[ $? -eq 0 ]]; then
        log_success "模型下载完成！"
        # 验证模型文件
        local model_files=("config.json" "pytorch_model.bin" "tokenizer.json")
        local missing_files=()
        
        for file in "${model_files[@]}"; do
            if [[ ! -f "$AI_MODEL_PATH/$file" ]]; then
                missing_files+=("$file")
            fi
        done
        
        if [[ ${#missing_files[@]} -eq 0 ]]; then
            log_success "✓ 模型文件完整"
        else
            log_warning "⚠ 缺少模型文件: ${missing_files[*]}"
            log_info "可能需要手动下载缺失文件"
        fi
    else
        log_error "模型下载失败"
        log_info "请检查网络连接后重试"
        return 1
    fi
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        return 0  # 端口被占用
    else
        return 1  # 端口可用
    fi
}

# 选择可用端口
select_port() {
    log_header "检查端口可用性"
    
    PORT=$DEFAULT_PORT
    
    if check_port $PORT; then
        log_warning "端口 $PORT 已被占用，寻找可用端口..."
        for ((i=5001; i<=5010; i++)); do
            if ! check_port $i; then
                PORT=$i
                break
            fi
        done
        
        if check_port $PORT; then
            log_error "无法找到可用端口 (5000-5010)"
            exit 1
        fi
    fi
    
    log_success "使用端口: $PORT"
}

# 配置防火墙
configure_firewall() {
    log_header "配置防火墙"
    
    # 检查防火墙状态
    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian UFW
        if ufw status | grep -q "Status: active"; then
            log_info "检测到UFW防火墙，配置端口访问..."
            sudo ufw allow $PORT/tcp > /dev/null 2>&1
            log_success "UFW防火墙已配置端口 $PORT"
        fi
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL firewalld
        if systemctl is-active --quiet firewalld; then
            log_info "检测到firewalld防火墙，配置端口访问..."
            sudo firewall-cmd --permanent --add-port=$PORT/tcp > /dev/null 2>&1
            sudo firewall-cmd --reload > /dev/null 2>&1
            log_success "firewalld防火墙已配置端口 $PORT"
        fi
    elif command -v iptables &> /dev/null; then
        # iptables
        log_info "检测到iptables，建议手动配置防火墙规则"
        log_info "命令: sudo iptables -A INPUT -p tcp --dport $PORT -j ACCEPT"
    fi
}

# 检查AI模型状态
check_ai_model() {
    log_header "检查AI模型状态"
    
    if [[ ! -d "$LLM_DIR" ]]; then
        log_info "未检测到AI模型目录，AI对话功能将不可用"
        return 0
    fi
    
    log_info "AI模型目录: $LLM_DIR"
    
    # 检查模型文件
    if [[ -d "$AI_MODEL_PATH" ]]; then
        log_success "✓ Qwen3-0.6B模型文件存在"
        
        # 检查关键模型文件
        local model_files=("config.json" "pytorch_model.bin" "tokenizer.json")
        local missing_files=()
        
        for file in "${model_files[@]}"; do
            if [[ ! -f "$AI_MODEL_PATH/$file" ]]; then
                missing_files+=("$file")
            fi
        done
        
        if [[ ${#missing_files[@]} -eq 0 ]]; then
            log_success "✓ 模型文件完整"
        else
            log_warning "⚠ 缺少模型文件: ${missing_files[*]}"
        fi
    else
        log_warning "✗ 模型路径不存在: $AI_MODEL_PATH"
    fi
    
    # 检查LoRA适配器
    if [[ -d "$LORA_PATH" ]]; then
        log_success "✓ LoRA适配器存在"
        
        if [[ -f "$LORA_PATH/adapter_model.safetensors" ]]; then
            log_success "✓ LoRA权重文件存在"
        else
            log_warning "⚠ LoRA权重文件缺失"
        fi
    else
        log_warning "✗ LoRA适配器路径不存在: $LORA_PATH"
    fi
    
    # 检查AI服务文件
    if [[ -f "ai_service.py" ]]; then
        log_success "✓ AI服务模块存在"
    else
        log_warning "✗ AI服务模块缺失"
    fi
    
    # 检查LLM相关文件
    local llm_files=("$LLM_DIR/qwen3_streaming_inference.py" "$LLM_DIR/advanced_streaming.py")
    for file in "${llm_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_success "✓ $(basename "$file") 存在"
        else
            log_warning "✗ $(basename "$file") 缺失"
        fi
    done
    
    log_info "AI模型检查完成"
}

# 收集系统信息
collect_system_info() {
    log_header "收集系统信息"
    
    # 检查extune目录是否存在
    if [[ ! -d "extune" ]]; then
        log_warning "未找到extune目录，跳过系统信息收集"
        log_info "应用将使用实时获取的系统信息"
        return 0
    fi
    
    # 检查json5依赖
    if ! python3 -c "import json5" 2>/dev/null; then
        log_warning "缺少json5依赖，尝试安装..."
        if ! pip3 install json5 --user 2>/dev/null; then
            log_warning "无法安装json5依赖，跳过extune系统信息收集"
            log_info "应用将使用实时获取的系统信息"
            return 0
        fi
    fi
    
    # 检查extune数据目录
    local extune_data_dir="extune/extunerData"
    if [[ ! -d "$extune_data_dir" ]]; then
        log_info "创建extune数据目录..."
        mkdir -p "$extune_data_dir"
    fi
    
    log_info "正在使用extune收集系统硬件信息..."
    
    # 尝试运行extune数据收集
    cd extune
    if python3 main.py; then
        log_success "extune系统信息收集完成"
        cd ..
        
        # 检查生成的数据文件
        local data_files=("$extune_data_dir/CPUInfo.txt" "$extune_data_dir/memInfo.txt" "$extune_data_dir/diskInfo.txt" "$extune_data_dir/netInfo.txt" "$extune_data_dir/sysParamInfo.txt")
        local found_files=0
        
        for file in "${data_files[@]}"; do
            if [[ -f "$file" ]]; then
                ((found_files++))
            fi
        done
        
        if [[ $found_files -gt 0 ]]; then
            log_success "系统信息已保存到 $extune_data_dir/ ($found_files 个文件)"
            
            # 显示收集到的主要信息
            log_info "收集到的主要信息:"
            
            # 从CPUInfo.txt提取CPU信息
            if [[ -f "$extune_data_dir/CPUInfo.txt" ]]; then
                local cpu_info=$(grep "Model name" "$extune_data_dir/CPUInfo.txt" | head -1 | cut -d':' -f2 | sed 's/^[ \t]*//')
                if [[ -n "$cpu_info" ]]; then
                    echo -e "  ${CYAN}CPU${NC}: $cpu_info"
                fi
            fi
            
            # 从memInfo.txt提取内存信息
            if [[ -f "$extune_data_dir/memInfo.txt" ]]; then
                local mem_info=$(grep "MemTotal" "$extune_data_dir/memInfo.txt" | head -1 | awk '{print $2 " " $3}')
                if [[ -n "$mem_info" ]]; then
                    echo -e "  ${CYAN}内存${NC}: $mem_info"
                fi
            fi
            
            # 从sysParamInfo.txt提取主机名和系统信息
            if [[ -f "$extune_data_dir/sysParamInfo.txt" ]]; then
                local hostname_info=$(grep "Static hostname" "$extune_data_dir/sysParamInfo.txt" | head -1 | cut -d':' -f2 | sed 's/^[ \t]*//')
                if [[ -n "$hostname_info" ]]; then
                    echo -e "  ${CYAN}主机名${NC}: $hostname_info"
                fi
                
                local os_info=$(grep "PRETTY_NAME" "$extune_data_dir/sysParamInfo.txt" | head -1 | cut -d'=' -f2 | sed 's/"//g')
                if [[ -n "$os_info" ]]; then
                    echo -e "  ${CYAN}操作系统${NC}: $os_info"
                fi
            fi
        else
            log_warning "未找到生成的系统信息文件"
        fi
    else
        cd ..
        log_warning "extune系统信息收集失败，但不影响应用启动"
        log_info "应用将使用实时获取的系统信息和现有的示例数据"
        
        # 检查是否已有示例数据文件
        if [[ -f "$extune_data_dir/CPUInfo.txt" ]]; then
            log_info "发现现有的系统信息数据文件，将使用这些数据"
        fi
    fi
}

# 启动应用
start_application() {
    log_header "启动KY-ops智能运维管家"
    
    # 确定使用的Python路径
    local python_cmd="python3"
    if [[ -n "$PYTHON_FULL_PATH" ]]; then
        python_cmd="$PYTHON_FULL_PATH"
        log_info "使用完整Python路径: $python_cmd"
        
        # 设置环境变量确保动态库可以找到
        export LD_LIBRARY_PATH="$PYTHON_INSTALL_PREFIX/lib:$LD_LIBRARY_PATH"
        export PATH="$PYTHON_INSTALL_PREFIX/bin:$PATH"
    fi
    
    # 验证Python环境
    log_info "验证Python环境..."
    if ! $python_cmd --version &>/dev/null; then
        log_error "Python环境验证失败"
        exit 1
    fi
    
    PYTHON_VERSION=$($python_cmd --version 2>&1 | cut -d' ' -f2)
    log_success "Python版本: $PYTHON_VERSION"
    
    # 检查关键模块是否可用
    log_info "检查关键模块..."
    local critical_modules=("flask" "psutil" "requests")
    for module in "${critical_modules[@]}"; do
        if $python_cmd -c "import $module" &>/dev/null; then
            log_success "✓ $module 模块可用"
        else
            log_error "✗ $module 模块不可用"
            exit 1
        fi
    done
    
    # 如果存在AI模型目录，检查AI相关模块
    if [[ -d "$LLM_DIR" ]]; then
        log_info "检查AI模块..."
        local ai_modules=("torch" "transformers" "peft" "accelerate")
        local missing_ai_modules=()
        
        for module in "${ai_modules[@]}"; do
            if $python_cmd -c "import $module" &>/dev/null; then
                log_success "✓ $module 模块可用"
            else
                log_warning "✗ $module 模块不可用"
                missing_ai_modules+=("$module")
            fi
        done
        
        if [[ ${#missing_ai_modules[@]} -gt 0 ]]; then
            log_warning "部分AI模块不可用: ${missing_ai_modules[*]}"
            log_info "AI功能可能受到影响，但系统监控功能仍可正常使用"
        fi
    fi
    
    log_info "启动参数:"
    log_info "  主机地址: $LOCAL_IP"
    log_info "  端口: $PORT"
    log_info "  调试模式: $DEBUG_MODE"
    
    # 显示访问信息
    echo
    log_success "=== 访问信息 ==="
    log_info "系统监控界面:"
    log_info "  本地访问: http://localhost:$PORT"
    log_info "  局域网访问: http://$LOCAL_IP:$PORT"
    
    # 如果存在AI模型，显示AI聊天界面信息
    if [[ -d "$LLM_DIR" ]]; then
        log_info "AI智能对话界面:"
        log_info "  本地访问: http://localhost:$PORT/ai_chat"
        log_info "  局域网访问: http://$LOCAL_IP:$PORT/ai_chat"
        log_info "AI模型: Qwen3-0.6B (支持4096 token响应，Markdown渲染)"
    fi
    
    echo
    log_info "启动应用..."
    
    # 启动应用
    if [[ "$DEBUG_MODE" == "true" ]]; then
        $python_cmd app.py --host="$LOCAL_IP" --port="$PORT" --debug
    else
        $python_cmd app.py --host="$LOCAL_IP" --port="$PORT"
    fi
}

# 清理函数
cleanup() {
    log_info "正在停止应用..."
    if [[ -n "$APP_PID" ]]; then
        kill $APP_PID 2>/dev/null
    fi
    log_success "应用已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    show_banner
    check_root
    check_system
    get_local_ip
    install_dependencies

    if [[ -d "$LLM_DIR" ]]; then
        download_ai_model
    fi

    check_ai_model
    collect_system_info
    select_port
    configure_firewall
    start_application
}

# 检查参数
case "${1:-}" in
    --help|-h)
        echo "用法: $0 [选项]"
        echo "选项:"
        echo "  --help, -h     显示此帮助信息"
        echo "  --version, -v  显示版本信息"
        echo "  --check        仅检查环境，不启动应用"
        echo
        echo "功能说明:"
        echo "  • 系统监控Web界面 (端口 $PORT)"
        echo "  • AI对话助手 (集成在主应用中)"
        echo "  • 实时系统信息收集"
        echo "  • 自动依赖管理"
        echo "  • Python 3.11自动安装 (从本地源码包)"
        echo
        echo "Python自动安装:"
        echo "  脚本会检测当前Python版本，如果低于3.11会提示自动安装"
        echo "  需要本地存在 Python-3.11.13.tgz 源码包"
        echo "  自动安装包括编译依赖、编译、安装和配置"
        echo
        echo "示例:"
        echo "  $0              # 启动完整应用 (包含Python检查和自动安装)"
        echo "  $0 --check      # 检查环境、Python版本和AI模型"
        exit 0
        ;;
    --version|-v)
        echo "Linux系统监控与AI对话Web应用启动脚本 v1.1"
        echo "集成功能: 系统监控 + Qwen3-0.6B AI对话助手 + Python 3.11自动安装"
        exit 0
        ;;
    --check)
        show_banner
        check_system
        get_local_ip
        check_ai_model
        log_success "环境、Python版本和AI模型检查完成"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "未知参数: $1"
        echo "使用 $0 --help 查看帮助信息"
        exit 1
        ;;
esac