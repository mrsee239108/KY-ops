## start.sh 关键行为概述
***
注意：start.sh内的大量自检类代码被省略，只保留了安装模块、抓取关键包的代码。

该INSTRUCTION.md***不宜***替代start.sh用于生产，但可以用于启动排错。
***


### 安装Python3.11.13

**！请不要卸载自带的python3.7!**

盲目地卸载旧的python支持将会导致很多麻烦的问题。
如：yum、dnf命令不可用，找不到命令等。

**下面是正确的python3.11.13配置方法**

下载Python-3.11.13.tgz包

解压包
```bash
tar -xvf Python-3.11.13.tgz
```

进入文件夹Python-3.11.13
```bash
cd Python-3.11.13
```

配置和编译Python3.11

```bash
./configure --enable-optimizations
make altinstall
```

检查Python3.11是否安装成功：

```bash
python3.11 --version
```

### 安装依赖包
```bash
pip3.11 install "Flask==2.3.3" "psutil" "requests" "GPUtil" "py-cpuinfo" "json5" -i https://pypi.tuna.tsinghua.edu.cn/simple
```



### 安装 Transformers

#### （非必要操作）（0）分配缓存空间：

系统的临时目录 /tmp 实际上是 tmpfs，而tmpfs的默认限制大小可能过小，导致安装过程中各类不必要的麻烦。

现在检查它的大小状况：

```bash
df -h /tmp
```

如果大小过小，可以适当对它进行扩充。

```bash
#size=[你希望为它分配的大小]
sudo mount -o remount,size=5G /tmp
```

（其他临时方案）如果在安装过程中依旧出现了空间不足的情况，亦可使用自带的方法进行缓存清理。
```bash
pip3.11 cache purge
```

#### （1）开始安装：
```bash
#安装torch
pip3.11 install torch -i https://pypi.tuna.tsinghua.edu.cn/simple

#安装transformers
pip3.11 install transformers -i  https://pypi.tuna.tsinghua.edu.cn/simple

#安装peft
pip3.11 install peft -i https://pypi.tuna.tsinghua.edu.cn/simple

#安装modelscope，用于解决下载问题
pip3.11 install modelscope -i  https://pypi.tuna.tsinghua.edu.cn/simple

#安装accelerate
pip3.11 install accelerate -i  https://pypi.tuna.tsinghua.edu.cn/simple
```

### 拉取模型
```bash
mkdir -p "LLM/model/Qwen3-0.6B" # 位于根目录（KY-ops）时执行

modelscope download --model Qwen/Qwen3-0.6B --local_dir LLM/model/Qwen3-0.6B
```

### 配置防火墙
该部分是网络通路保障内容。

网络通讯异常，考虑参考本部分；或阅读start.sh相关文段。

```bash
PORT = 5000

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
```

### 检查LLM/LoRA
该部分是start.sh的自动检查步骤。

如果确认模型无误，可以跳过。

```bash
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
```

### 启动extuner报告生成/实时采集开启
这一部分是app.py中系统信息模块正常运行的关键前提。

该部分未包含完整代码块。请注意。

系统信息采集异常，应考虑参阅该部分；或参阅start.sh内相关片段

创建目录
```bash
    local extune_data_dir="extune/extunerData"
    if [[ ! -d "$extune_data_dir" ]]; then
        log_info "创建extune数据目录..."
        mkdir -p "$extune_data_dir"
    fi
```

尝试运行extune数据收集
```bash
    # 尝试运行extune数据收集
    cd extuner
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
```

### 启动应用(app)

虽然是整段代码，但是可以分为3个模块：
1. python环境与各模块验证
2. 驱动LLM/LoRA启动
3. 启动应用(app.py)，开始服务

```bash
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
```