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

# 显示启动横幅
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Linux系统监控Web应用                      ║"
    echo "║                      启动脚本 v1.0                          ║"
    echo "║                                                              ║"
    echo "║  功能: 自动配置环境、安装依赖、获取IP、启动Web服务            ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查Python版本是否满足要求
check_python_version() {
    local version_string=$1
    local major=$(echo $version_string | cut -d. -f1)
    local minor=$(echo $version_string | cut -d. -f2)
    
    # 检查是否为Python 3.6+
    if [[ $major -lt 3 ]] || [[ $major -eq 3 && $minor -lt 6 ]]; then
        return 1
    fi
    return 0
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
    
    # 检查Python3
    if ! command -v python3 &> /dev/null; then
        log_error "未找到Python3，请先安装Python3"
        log_info "Ubuntu/Debian: sudo apt update && sudo apt install python3 python3-pip"
        log_info "CentOS/RHEL: sudo yum install python3 python3-pip"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    log_success "Python版本: $PYTHON_VERSION"
    
    # 检查Python版本是否满足要求
    if ! check_python_version "$PYTHON_VERSION"; then
        log_error "Python版本过低！需要Python 3.6或更高版本"
        log_info "当前版本: $PYTHON_VERSION"
        log_info "请升级Python版本或使用兼容的Python环境"
        exit 1
    fi
    
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
    
    log_info "升级pip3到最新版本..."
    pip3 install --upgrade pip
    
    log_info "在base环境中安装依赖包..."
    
    # 尝试安装依赖，如果失败则尝试不同的方法
    if ! pip3 install -r "$REQUIREMENTS_FILE"; then
        log_warning "使用requirements.txt安装失败，尝试逐个安装..."
        
        # 逐个安装核心依赖
        local packages=("Flask>=2.0.0,<2.3.0" "psutil>=5.8.0" "requests>=2.25.0")
        local failed_packages=()
        
        for package in "${packages[@]}"; do
            log_info "安装 $package..."
            if ! pip3 install "$package"; then
                log_warning "$package 安装失败"
                failed_packages+=("$package")
            else
                log_success "$package 安装成功"
            fi
        done
        
        # 如果有包安装失败，尝试使用更宽松的版本要求
        if [[ ${#failed_packages[@]} -gt 0 ]]; then
            log_warning "部分包安装失败，尝试安装兼容版本..."
            
            for package in "${failed_packages[@]}"; do
                case $package in
                    "Flask"*)
                        log_info "尝试安装Flask兼容版本..."
                        pip3 install "Flask>=1.1.0" || pip3 install "Flask"
                        ;;
                    "psutil"*)
                        log_info "尝试安装psutil兼容版本..."
                        pip3 install "psutil>=5.0.0" || pip3 install "psutil"
                        ;;
                    "requests"*)
                        log_info "尝试安装requests兼容版本..."
                        pip3 install "requests>=2.20.0" || pip3 install "requests"
                        ;;
                esac
            done
        fi
    fi
    
    # 验证关键包是否安装成功
    log_info "验证依赖安装..."
    local required_packages=("flask" "psutil" "requests")
    local missing_packages=()
    
    for package in "${required_packages[@]}"; do
        if ! python3 -c "import $package" 2>/dev/null; then
            missing_packages+=("$package")
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        log_error "以下关键依赖包未能成功安装: ${missing_packages[*]}"
        log_info "请手动安装这些包："
        for package in "${missing_packages[@]}"; do
            echo "  pip3 install $package"
        done
        exit 1
    fi
    
    log_success "所有依赖安装完成（base环境）"
    
    # 显示已安装的包
    log_info "已安装的主要包:"
    pip3 list | grep -E "(Flask|psutil|requests)" | while read line; do
        echo -e "  ${GREEN}$line${NC}"
    done
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
    log_header "启动Web应用"
    
    if [[ ! -f "$APP_FILE" ]]; then
        log_error "未找到应用文件: $APP_FILE"
        exit 1
    fi
    
    # 创建启动命令
    export FLASK_APP="$APP_FILE"
    export FLASK_ENV="production"
    
    log_info "启动参数:"
    echo -e "  ${CYAN}应用文件${NC}: $APP_FILE"
    echo -e "  ${CYAN}监听地址${NC}: $LOCAL_IP:$PORT"
    echo -e "  ${CYAN}日志文件${NC}: $LOG_FILE"
    echo -e "  ${CYAN}Python环境${NC}: base环境 (无虚拟环境)"
    
    # 显示访问信息
    echo
    log_success "应用启动成功！"
    echo -e "${GREEN}访问地址:${NC}"
    echo -e "  本地访问: ${CYAN}http://localhost:$PORT${NC}"
    echo -e "  局域网访问: ${CYAN}http://$LOCAL_IP:$PORT${NC}"
    
    # 显示局域网内其他可能的访问地址
    echo -e "\n${YELLOW}局域网内其他设备可通过以下地址访问:${NC}"
    ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d'/' -f1 | while read ip; do
        echo -e "  ${CYAN}http://$ip:$PORT${NC}"
    done
    
    echo
    log_info "按 Ctrl+C 停止应用"
    echo -e "${YELLOW}日志输出:${NC}"
    echo "----------------------------------------"
    
    # 启动Flask应用
    python3 "$APP_FILE" 2>&1 | tee "$LOG_FILE"
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
        echo "示例:"
        echo "  $0              # 启动应用"
        echo "  $0 --check      # 检查环境"
        exit 0
        ;;
    --version|-v)
        echo "Linux系统监控Web应用启动脚本 v1.0"
        exit 0
        ;;
    --check)
        show_banner
        check_system
        get_local_ip
        log_success "环境检查完成"
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