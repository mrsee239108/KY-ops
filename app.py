from extune import common
from flask import Flask, render_template, jsonify, request, send_file, make_response
import psutil
import platform
import socket
import subprocess
import os
import json
import time
import shutil
import re
from datetime import datetime, timedelta
import requests
from pathlib import Path

app = Flask(__name__)

# 配置
app.config['SECRET_KEY'] = 'your-secret-key-here'

# 初始化实时CPU监控
try:
    from extune.category.get_cpu_info import RealTimeCPU
    from extune.common.global_call import GlobalCall
    real_time_cpu_monitor = RealTimeCPU(interval=2)
    real_time_cpu_monitor.start_broadcasting()
    print("CPU实时监控已启动")
except ImportError as e:
    print(f"无法导入实时CPU监控: {e}")
    real_time_cpu_monitor = None
except Exception as e:
    print(f"启动实时CPU监控失败: {e}")
    real_time_cpu_monitor = None


# 添加CORS支持
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def get_external_ip():
    """获取外部IP地址"""
    try:
        response = requests.get('https://api.ipify.org?format=text', timeout=5)
        return response.text.strip()
    except:
        return "获取失败"

def get_internal_ip():
    """获取内部IP地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def format_bytes(bytes_value):
    """格式化字节数"""
    if bytes_value == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    
    while bytes_value >= 1024 and unit_index < len(units) - 1:
        bytes_value /= 1024
        unit_index += 1
    
    return f"{bytes_value:.2f} {units[unit_index]}"

def format_uptime(seconds):
    """格式化运行时间"""
    days = seconds // 86400
    hours = (seconds % 86400) // 3600
    minutes = (seconds % 3600) // 60
    
    if days > 0:
        return f"{days}天 {hours}小时 {minutes}分钟"
    elif hours > 0:
        return f"{hours}小时 {minutes}分钟"
    else:
        return f"{minutes}分钟"

def parse_extune_data():
    """解析extune输出的数据文件"""
    extune_data_path = os.path.join(os.path.dirname(__file__), 'extune', 'extunerData')
    
    result = {
        'hostname': '未知',
        'system_name': '未知',
        'kernel_version': '未知',
        'external_ip': '获取失败',
        'internal_ip': '未知',
        'cpu_model': '未知',
        'cpu_architecture': '未知',
        'cpu_count': 0,
        'memory_total': '未知',
        'memory_free': '未知',
        'disk_total': '未知',
        'disk_info': '未知',
        'network_info': '未知',
        'os_version': '未知',
        'gcc_version': '未知',
        'glibc_version': '未知',
        'jdk_version': '未知',
        'uptime_days': '0 天',
        'last_update': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    try:
        # 解析CPU信息
        cpu_file = os.path.join(extune_data_path, 'CPUInfo.txt')
        if os.path.exists(cpu_file):
            with open(cpu_file, 'r', encoding='utf-8') as f:
                cpu_content = f.read()
                
                # 提取CPU型号
                cpu_match = re.search(r'Model name:\s*(.+)', cpu_content)
                if cpu_match:
                    result['cpu_model'] = cpu_match.group(1).strip()
                
                # 提取CPU架构
                arch_match = re.search(r'Architecture:\s*(.+)', cpu_content)
                if arch_match:
                    result['cpu_architecture'] = arch_match.group(1).strip()
                
                # 提取CPU核心数
                cpu_count_match = re.search(r'CPU\(s\):\s*(\d+)', cpu_content)
                if cpu_count_match:
                    result['cpu_count'] = int(cpu_count_match.group(1))
        
        # 解析内存信息
        mem_file = os.path.join(extune_data_path, 'memInfo.txt')
        if os.path.exists(mem_file):
            with open(mem_file, 'r', encoding='utf-8') as f:
                mem_content = f.read()
                
                # 提取总内存
                mem_total_match = re.search(r'MemTotal:\s*(\d+)\s*kB', mem_content)
                if mem_total_match:
                    mem_kb = int(mem_total_match.group(1))
                    mem_bytes = mem_kb * 1024
                    result['memory_total'] = format_bytes(mem_bytes)
                
                # 提取空闲内存
                mem_free_match = re.search(r'MemFree:\s*(\d+)\s*kB', mem_content)
                if mem_free_match:
                    mem_free_kb = int(mem_free_match.group(1))
                    mem_free_bytes = mem_free_kb * 1024
                    result['memory_free'] = format_bytes(mem_free_bytes)
        
        # 解析磁盘信息
        disk_file = os.path.join(extune_data_path, 'diskInfo.txt')
        if os.path.exists(disk_file):
            with open(disk_file, 'r', encoding='utf-8') as f:
                disk_content = f.read()
                
                # 提取磁盘总容量
                disk_match = re.search(r'Disk /dev/sda: ([\d.]+) GiB', disk_content)
                if disk_match:
                    disk_gb = float(disk_match.group(1))
                    disk_bytes = int(disk_gb * 1024 * 1024 * 1024)
                    result['disk_total'] = format_bytes(disk_bytes)
                    result['disk_info'] = f"sda: {disk_gb} GiB"
        
        # 解析网络信息
        net_file = os.path.join(extune_data_path, 'netInfo.txt')
        if os.path.exists(net_file):
            with open(net_file, 'r', encoding='utf-8') as f:
                net_content = f.read()
                
                # 提取网络接口信息
                interface_match = re.search(r'NAME\s+UUID\s+TYPE\s+DEVICE\s*\n(\w+)', net_content)
                if interface_match:
                    result['network_info'] = interface_match.group(1)
                
                # 提取内部IP（从网络配置中获取）
                # 这里需要根据实际的网络配置格式调整
                ip_match = re.search(r'inet (192\.168\.\d+\.\d+)', net_content)
                if ip_match:
                    result['internal_ip'] = ip_match.group(1)
        
        # 解析系统参数信息
        sys_file = os.path.join(extune_data_path, 'sysParamInfo.txt')
        if os.path.exists(sys_file):
            with open(sys_file, 'r', encoding='utf-8') as f:
                sys_content = f.read()
                
                # 从sysctl输出中提取主机名
                hostname_match = re.search(r'kernel\.hostname = (.+)', sys_content)
                if hostname_match:
                    result['hostname'] = hostname_match.group(1).strip()
                
                # 从sysctl输出中提取内核版本
                kernel_match = re.search(r'kernel\.osrelease = (.+)', sys_content)
                if kernel_match:
                    result['kernel_version'] = kernel_match.group(1).strip()
                
                # 从sysctl输出中提取操作系统类型
                os_match = re.search(r'kernel\.ostype = (.+)', sys_content)
                if os_match:
                    result['system_name'] = os_match.group(1).strip()
                
                # 尝试获取更详细的系统版本信息
                kylin_match = re.search(r'kernel\.kylinversion = (.+)', sys_content)
                if kylin_match:
                    result['os_version'] = kylin_match.group(1).strip()
        
        # 解析系统消息以获取GCC版本
        sys_msg_file = os.path.join(extune_data_path, 'systemMessage.txt')
        if os.path.exists(sys_msg_file):
            with open(sys_msg_file, 'r', encoding='utf-8') as f:
                sys_msg_content = f.read()
                
                # 提取GCC版本
                gcc_match = re.search(r'gcc version ([\d.]+)', sys_msg_content)
                if gcc_match:
                    result['gcc_version'] = gcc_match.group(1)
        
        # 尝试获取Glibc版本（通常需要执行命令）
        try:
            glibc_result = subprocess.run(['ldd', '--version'], capture_output=True, text=True, timeout=5)
            if glibc_result.returncode == 0:
                glibc_match = re.search(r'ldd \(GNU libc\) ([\d.]+)', glibc_result.stdout)
                if glibc_match:
                    result['glibc_version'] = glibc_match.group(1)
        except:
            result['glibc_version'] = '未知'
        
        # 尝试获取JDK版本
        try:
            java_result = subprocess.run(['java', '-version'], capture_output=True, text=True, timeout=5)
            if java_result.returncode == 0:
                java_match = re.search(r'version "([^"]+)"', java_result.stderr)
                if java_match:
                    result['jdk_version'] = java_match.group(1)
        except:
            result['jdk_version'] = '未安装'
        
        # 获取外部IP（实时获取）
        result['external_ip'] = get_external_ip()
        
        # 计算运行天数（使用psutil获取）
        try:
            boot_time = psutil.boot_time()
            uptime_seconds = int(time.time() - boot_time)
            uptime_days = uptime_seconds // 86400
            result['uptime_days'] = f"{uptime_days} 天"
        except:
            result['uptime_days'] = "0 天"
            
    except Exception as e:
        print(f"解析extune数据时出错: {e}")
    
    return result

# 路由定义
@app.route('/')
def desktop():
    """Windows 10 桌面主页"""
    return render_template('desktop.html')

@app.route('/system-info')
def system_info():
    """系统信息页面"""
    return render_template('system_info.html')

@app.route('/file-manager')
def file_manager():
    """文件管理器页面"""
    return render_template('file_manager.html')

@app.route('/task-manager')
def task_manager():
    """任务管理器页面"""
    return render_template('task_manager.html')

@app.route('/network-monitor')
def network_monitor():
    """网络监控页面"""
    return render_template('network_monitor.html')

@app.route('/performance-monitor')
def performance_monitor():
    """性能监控页面"""
    return render_template('performance_monitor.html')

@app.route('/security-center')
def security_center():
    """安全中心页面"""
    return render_template('security_center.html')

@app.route('/terminal')
def terminal():
    """终端页面"""
    return render_template('terminal.html')

@app.route('/settings')
def settings():
    """设置页面"""
    return render_template('settings.html')

@app.route('/ai-chat')
def ai_chat():
    """AI对话页面"""
    return render_template('ai_chat.html')

@app.route('/test-js')
def test_js():
    """JavaScript测试页面"""
    return render_template('test_js.html')

# API 路由
@app.route('/system_info.json')
def get_system_info_json():
    """提供预生成的系统信息JSON文件"""
    try:
        json_file_path = os.path.join(os.path.dirname(__file__), 'system_info.json')
        if os.path.exists(json_file_path):
            return send_file(json_file_path, mimetype='application/json')
        else:
            # 如果JSON文件不存在，返回404
            return jsonify({'error': 'system_info.json文件不存在'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/system-status')
def system_status():
    """获取系统状态信息（使用实时CPU数据）"""
    try:
        # 从全局广播获取CPU数据
        cpu_data = GlobalCall.real_time_cpu_data

        # 如果没有实时数据，使用psutil作为后备
        if not cpu_data:
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_model = "未知"
        else:
            cpu_percent = cpu_data['total_usage']
            cpu_model = cpu_data['model_name']

        memory = psutil.virtual_memory()

        print(cpu_percent)

        return jsonify({
            'cpu_usage': cpu_percent,
            'cpu_model': cpu_model,
            'memory_usage': memory.percent,
            'current_time': datetime.now().strftime('%H:%M'),
            'current_date': datetime.now().strftime('%Y/%m/%d'),
            'day_of_week': datetime.now().strftime('%A')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/system-info-txt')
def get_system_info_txt():
    """从info.txt文件获取系统信息"""
    try:
        info_file = os.path.join(os.path.dirname(__file__), 'extune', 'info.txt')
        
        if not os.path.exists(info_file):
            return jsonify({
                'error': 'info.txt文件不存在',
                'message': '请先运行extune数据采集生成info.txt文件'
            }), 404
        
        with open(info_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析txt内容为结构化数据
        info_data = parse_info_txt(content)
        
        return jsonify(info_data)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def parse_info_txt(content):
    """解析info.txt文件内容为结构化数据"""
    lines = content.split('\n')
    data = {
        'base_info': {},
        'cpu_info': {},
        'memory_info': {},
        'network_info': [],
        'disk_info': [],
        'time_info': {}
    }
    
    current_section = None
    current_network = {}
    current_disk = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if line.startswith('=== ') and line.endswith(' ==='):
            current_section = line.replace('===', '').strip()
            continue
            
        if line == '---':
            if current_section == '网络接口信息' and current_network:
                data['network_info'].append(current_network.copy())
                current_network = {}
            elif current_section == '磁盘信息' and current_disk:
                data['disk_info'].append(current_disk.copy())
                current_disk = {}
            continue
            
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            
            if current_section == '系统基本信息':
                data['base_info'][key] = value
            elif current_section == 'CPU信息':
                data['cpu_info'][key] = value
            elif current_section == '内存信息':
                data['memory_info'][key] = value
            elif current_section == '网络接口信息':
                current_network[key] = value
            elif current_section == '磁盘信息':
                current_disk[key] = value
            elif current_section == '时间信息':
                data['time_info'][key] = value
    
    # 处理最后一个网络接口或磁盘
    if current_network:
        data['network_info'].append(current_network)
    if current_disk:
        data['disk_info'].append(current_disk)
    
    return data

@app.route('/api/system-info')
def get_system_info():
    """获取详细系统信息"""
    try:
        # 从extune数据文件获取基本信息
        extune_data = parse_extune_data()
        
        # 获取实时性能数据
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_freq = psutil.cpu_freq()
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # 磁盘信息 - Windows环境适配
        try:
            if os.name == 'nt':  # Windows
                disk = psutil.disk_usage('C:')
            else:  # Linux/Unix
                disk = psutil.disk_usage('/')
        except:
            # 如果获取失败，使用默认值
            disk = type('obj', (object,), {'total': 0, 'used': 0, 'free': 0})()
        
        network_io = psutil.net_io_counters()
        
        # 运行时间
        boot_time = psutil.boot_time()
        uptime_seconds = int(time.time() - boot_time)
        
        return jsonify({
            # 基本系统信息
            'hostname': extune_data['hostname'],
            'system_name': extune_data['system_name'],
            'kernel_version': extune_data['kernel_version'],
            'os_version': extune_data['os_version'],
            
            # CPU信息
            'cpu_model': extune_data['cpu_model'],
            'cpu_architecture': extune_data['cpu_architecture'],
            'cpu_count': extune_data['cpu_count'],
            'cpu_usage': cpu_percent,
            'cpu_frequency': cpu_freq.current if cpu_freq else 0,
            
            # 内存信息
            'memory_total': extune_data['memory_total'],
            'memory_free': extune_data['memory_free'],
            'memory_total_bytes': memory.total,
            'memory_available': memory.available,
            'memory_used': memory.used,
            'memory_percent': memory.percent,
            
            # Swap内存信息
            'swap_total': swap.total,
            'swap_used': swap.used,
            'swap_free': swap.free,
            'swap_percent': swap.percent,
            
            # 磁盘信息
            'disk_total': extune_data['disk_total'],
            'disk_info': extune_data['disk_info'],
            'disk_total_bytes': disk.total,
            'disk_used': disk.used,
            'disk_free': disk.free,
            'disk_percent': (disk.used / disk.total) * 100 if disk.total > 0 else 0,
            
            # 网络信息
            'external_ip': extune_data['external_ip'],
            'internal_ip': extune_data['internal_ip'],
            'network_info': extune_data['network_info'],
            'network_bytes_sent': network_io.bytes_sent,
            'network_bytes_recv': network_io.bytes_recv,
            'network_packets_sent': network_io.packets_sent,
            'network_packets_recv': network_io.packets_recv,
            
            # 开发工具版本
            'gcc_version': extune_data['gcc_version'],
            'glibc_version': extune_data['glibc_version'],
            'jdk_version': extune_data['jdk_version'],
            
            # 运行时间信息
            'uptime_seconds': uptime_seconds,
            'uptime_formatted': format_uptime(uptime_seconds),
            'uptime_days': extune_data['uptime_days'],
            'last_update': extune_data['last_update'],
            'boot_time': datetime.fromtimestamp(boot_time).strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/processes')
def get_processes():
    """获取进程列表"""
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status', 'create_time', 'username']):
            try:
                proc_info = proc.info
                proc_info['create_time'] = datetime.fromtimestamp(proc_info['create_time']).strftime('%H:%M:%S')
                processes.append(proc_info)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # 按CPU使用率排序
        processes.sort(key=lambda x: x['cpu_percent'] or 0, reverse=True)
        return jsonify(processes)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files')
def list_files():
    """列出指定目录下的文件和文件夹"""
    try:
        # 获取路径参数
        path = request.args.get('path', '/')
        
        # URL解码和路径标准化
        import urllib.parse
        path = urllib.parse.unquote(path)
        path = os.path.normpath(path)
        
        # 安全检查：防止路径遍历
        if '..' in path or path.startswith('..'):
            path = '/'
        
        # 检查路径是否存在
        if not os.path.exists(path):
            # 尝试根目录
            path = '/'
            if not os.path.exists(path):
                return jsonify({'error': 'File system not accessible'}), 500
        
        # 确保是目录
        if not os.path.isdir(path):
            path = os.path.dirname(path)
            if not os.path.isdir(path):
                path = '/'
        
        # 尝试读取目录内容
        try:
            file_list = os.listdir(path)
        except PermissionError:
            path = '/'
            file_list = os.listdir(path)
        
        items = []
        for item_name in file_list:
            try:
                item_path = os.path.join(path, item_name)
                
                # 跳过隐藏文件
                if item_name.startswith('.'):
                    continue
                
                stat_info = os.stat(item_path)
                is_directory = os.path.isdir(item_path)
                
                item_data = {
                    'name': item_name,
                    'path': item_path,
                    'is_dir': is_directory,
                    'size': stat_info.st_size if not is_directory else 0,
                    'size_formatted': format_bytes(stat_info.st_size) if not is_directory else '',
                    'modified': datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                    'permissions': oct(stat_info.st_mode)[-3:],
                    'owner': stat_info.st_uid,
                    'group': stat_info.st_gid
                }
                
                items.append(item_data)
                
            except (OSError, PermissionError):
                continue
        
        # 排序：文件夹在前，文件在后
        items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        
        response_data = {
            'current_path': path,
            'parent_path': os.path.dirname(path) if path != '/' else None,
            'items': items,
            'total_items': len(items)
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/file-system-diagnosis')
def file_system_diagnosis():
    """文件系统诊断 - 检查文件系统访问状态"""
    try:
        diagnosis = {
            'accessible_directories': [],
            'permission_errors': [],
            'system_info': {},
            'recommendations': []
        }
        
        # 检查常见目录的访问权限
        test_directories = [
            '/',
            '/home',
            '/tmp',
            '/var',
            '/var/tmp',
            '/usr',
            '/etc',
            '/opt',
            '/mnt',
            '/media'
        ]
        
        # 添加用户主目录
        try:
            home_dir = os.path.expanduser('~')
            if home_dir not in test_directories:
                test_directories.append(home_dir)
        except:
            pass
        
        for directory in test_directories:
            try:
                if os.path.exists(directory) and os.path.isdir(directory):
                    # 测试读取权限
                    items = os.listdir(directory)
                    diagnosis['accessible_directories'].append({
                        'path': directory,
                        'items_count': len(items),
                        'readable': True,
                        'writable': os.access(directory, os.W_OK)
                    })
                else:
                    diagnosis['permission_errors'].append({
                        'path': directory,
                        'error': 'Directory does not exist'
                    })
            except PermissionError:
                diagnosis['permission_errors'].append({
                    'path': directory,
                    'error': 'Permission denied'
                })
            except Exception as e:
                diagnosis['permission_errors'].append({
                    'path': directory,
                    'error': str(e)
                })
        
        # 获取系统信息
        try:
            diagnosis['system_info'] = {
                'platform': platform.system(),
                'platform_release': platform.release(),
                'platform_version': platform.version(),
                'architecture': platform.architecture()[0],
                'processor': platform.processor(),
                'python_version': platform.python_version(),
                'current_user': os.getenv('USER') or os.getenv('USERNAME') or 'unknown',
                'current_working_directory': os.getcwd(),
                'home_directory': os.path.expanduser('~'),
                'effective_uid': os.geteuid() if hasattr(os, 'geteuid') else 'N/A',
                'effective_gid': os.getegid() if hasattr(os, 'getegid') else 'N/A'
            }
        except Exception as e:
            diagnosis['system_info']['error'] = str(e)
        
        # 生成建议
        if len(diagnosis['accessible_directories']) == 0:
            diagnosis['recommendations'].append('严重：没有可访问的目录，请检查文件系统权限')
        elif len(diagnosis['accessible_directories']) < 3:
            diagnosis['recommendations'].append('警告：可访问的目录较少，可能存在权限问题')
        
        if any('Permission denied' in error['error'] for error in diagnosis['permission_errors']):
            diagnosis['recommendations'].append('建议：检查用户权限，可能需要管理员权限')
        
        if diagnosis['system_info'].get('current_user') == 'root':
            diagnosis['recommendations'].append('注意：当前以root用户运行，请确保这是必要的')
        
        # 检查是否有可写目录
        writable_dirs = [d for d in diagnosis['accessible_directories'] if d.get('writable', False)]
        if len(writable_dirs) == 0:
            diagnosis['recommendations'].append('警告：没有可写目录，文件操作功能将受限')
        
        return jsonify(diagnosis)
        
    except Exception as e:
        return jsonify({'error': f'Diagnosis failed: {str(e)}'}), 500

@app.route('/api/network-connections')
def get_network_connections():
    """获取网络连接信息"""
    try:
        connections = []
        net_connections = psutil.net_connections(kind='inet')
        
        for conn in net_connections:
            try:
                connection_info = {
                    'laddr': conn.laddr.ip if conn.laddr else '',
                    'lport': conn.laddr.port if conn.laddr else 0,
                    'raddr': conn.raddr.ip if conn.raddr else '',
                    'rport': conn.raddr.port if conn.raddr else 0,
                    'status': conn.status,
                    'pid': conn.pid,
                    'type': 'TCP' if conn.type == socket.SOCK_STREAM else 'UDP'
                }
                connections.append(connection_info)
            except (AttributeError, psutil.AccessDenied):
                continue
        
        return jsonify(connections)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/network-interfaces')
def get_network_interfaces():
    """获取网络接口信息"""
    try:
        interfaces = []
        net_if_addrs = psutil.net_if_addrs()
        net_if_stats = psutil.net_if_stats()
        
        for interface_name, addresses in net_if_addrs.items():
            interface_info = {
                'name': interface_name,
                'addresses': [],
                'is_up': net_if_stats[interface_name].isup if interface_name in net_if_stats else False,
                'speed': net_if_stats[interface_name].speed if interface_name in net_if_stats else 0
            }
            
            for addr in addresses:
                if addr.family == socket.AF_INET:
                    interface_info['addresses'].append({
                        'type': 'IPv4',
                        'address': addr.address,
                        'netmask': addr.netmask,
                        'broadcast': addr.broadcast
                    })
                elif addr.family == socket.AF_INET6:
                    interface_info['addresses'].append({
                        'type': 'IPv6',
                        'address': addr.address,
                        'netmask': addr.netmask
                    })
            
            interfaces.append(interface_info)
        
        return jsonify(interfaces)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/network-stats')
def get_network_stats():
    """获取网络统计信息"""
    try:
        net_io = psutil.net_io_counters()
        net_connections = len(psutil.net_connections())
        
        return jsonify({
            'bytes_sent': net_io.bytes_sent,
            'bytes_recv': net_io.bytes_recv,
            'packets_sent': net_io.packets_sent,
            'packets_recv': net_io.packets_recv,
            'errin': net_io.errin,
            'errout': net_io.errout,
            'dropin': net_io.dropin,
            'dropout': net_io.dropout,
            'connections': net_connections
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/performance-data')
def get_performance_data():
    """获取详细的性能监控数据"""
    try:
        # CPU详细信息 - 增加interval时间以获得更准确的数据
        cpu_percent = psutil.cpu_percent(interval=1, percpu=True)
        cpu_average = psutil.cpu_percent(interval=0.1)  # 获取平均CPU使用率
        cpu_freq = psutil.cpu_freq()
        cpu_count = psutil.cpu_count()
        cpu_count_logical = psutil.cpu_count(logical=True)
        
        # 系统负载
        try:
            load_avg = psutil.getloadavg()
        except AttributeError:
            # Windows系统没有getloadavg，使用CPU使用率模拟
            avg_cpu = sum(cpu_percent) / len(cpu_percent)
            load_avg = [avg_cpu/100, avg_cpu/100, avg_cpu/100]
        
        # 内存详细信息
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        
        # 磁盘详细信息
        disk_usage = []
        disk_io = psutil.disk_io_counters()
        
        # 获取所有磁盘分区
        partitions = psutil.disk_partitions()
        for partition in partitions:
            try:
                partition_usage = psutil.disk_usage(partition.mountpoint)
                disk_usage.append({
                    'device': partition.device,
                    'mountpoint': partition.mountpoint,
                    'fstype': partition.fstype,
                    'total': partition_usage.total,
                    'used': partition_usage.used,
                    'free': partition_usage.free,
                    'percent': (partition_usage.used / partition_usage.total) * 100
                })
            except PermissionError:
                continue
        
        # 网络详细信息
        net_io = psutil.net_io_counters()
        net_interfaces = {}
        
        # 获取网络接口详细信息
        net_if_stats = psutil.net_if_stats()
        net_if_addrs = psutil.net_if_addrs()
        
        for interface_name, interface_stats in net_if_stats.items():
            if interface_name in net_if_addrs:
                addresses = []
                for addr in net_if_addrs[interface_name]:
                    if addr.family == 2:  # IPv4
                        addresses.append({
                            'type': 'IPv4',
                            'address': addr.address,
                            'netmask': addr.netmask
                        })
                    elif addr.family == 17:  # MAC
                        addresses.append({
                            'type': 'MAC',
                            'address': addr.address
                        })
                
                net_interfaces[interface_name] = {
                    'is_up': interface_stats.isup,
                    'speed': interface_stats.speed,
                    'mtu': interface_stats.mtu,
                    'addresses': addresses
                }
        
        # 进程信息
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                proc_info = proc.info
                if proc_info['cpu_percent'] > 0 or proc_info['memory_percent'] > 0:
                    processes.append(proc_info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # 按CPU使用率排序，取前10个
        processes = sorted(processes, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:10]
        
        # 电池信息（如果是笔记本电脑）
        battery = None
        try:
            battery_info = psutil.sensors_battery()
            if battery_info:
                battery = {
                    'percent': battery_info.percent,
                    'secsleft': battery_info.secsleft,
                    'power_plugged': battery_info.power_plugged
                }
        except AttributeError:
            pass
        
        # 获取CPU名称 - 从system_info.json文件中读取
        cpu_name = "Unknown CPU"
        try:
            system_info_path = os.path.join(os.path.dirname(__file__), 'system_info.json')
            if os.path.exists(system_info_path):
                with open(system_info_path, 'r', encoding='utf-8') as f:
                    system_info_data = json.load(f)
                    cpu_name = system_info_data.get('cpu_info', 'Unknown CPU')
        except Exception as e:
            print(f"读取system_info.json失败: {e}")
            # 如果读取失败，使用platform.processor()作为备选
            cpu_name = platform.processor()
            if not cpu_name or cpu_name.strip() == '':
                cpu_name = f"Unknown CPU ({cpu_count} cores)"
        
        return jsonify({
            # CPU信息
            'cpu_percent': cpu_percent,
            'cpu_average': cpu_average,  # 使用单独获取的平均CPU使用率
            'cpu_name': cpu_name,  # 添加cpu_name字段
            'cpu_frequency': {
                'current': cpu_freq.current if cpu_freq else 0,
                'min': cpu_freq.min if cpu_freq else 0,
                'max': cpu_freq.max if cpu_freq else 0,
                'base': cpu_freq.current if cpu_freq else 0,  # 基准频率
                'turbo_max': cpu_freq.max if cpu_freq else 0,  # Turbo最大频率
                'boost': True if cpu_freq and cpu_freq.current > cpu_freq.min * 1.1 else False,  # Boost状态
                'cores': []  # 每个核心的频率（psutil不直接支持，留空）
            },
            'cpu_count_physical': cpu_count,
            'cpu_count_logical': cpu_count_logical,
            'load_avg': load_avg,
            
            # 内存信息
            'memory_percent': memory.percent,
            'memory_used': memory.used,
            'memory_total': memory.total,
            'memory_available': memory.available,
            'memory_cached': getattr(memory, 'cached', 0),
            'memory_buffers': getattr(memory, 'buffers', 0),
            
            # 交换内存
            'swap_percent': swap.percent,
            'swap_used': swap.used,
            'swap_total': swap.total,
            'swap_free': swap.free,
            
            # 磁盘信息
            'disk_usage': disk_usage,
            'disk_io': {
                'read_bytes': disk_io.read_bytes if disk_io else 0,
                'write_bytes': disk_io.write_bytes if disk_io else 0,
                'read_count': disk_io.read_count if disk_io else 0,
                'write_count': disk_io.write_count if disk_io else 0
            },
            
            # 网络信息
            'network_io': {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv,
                'errin': net_io.errin,
                'errout': net_io.errout,
                'dropin': net_io.dropin,
                'dropout': net_io.dropout
            },
            'network_interfaces': net_interfaces,
            
            # 进程信息
            'top_processes': processes,
            'process_count': len(list(psutil.process_iter())),
            
            # 电池信息
            'battery': battery,
            
            # 系统信息
            'boot_time': psutil.boot_time(),
            'timestamp': time.time()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-status')
def get_security_status():
    """获取安全状态信息"""
    try:
        # 检查防火墙状态 (Windows)
        firewall_active = False
        try:
            if platform.system() == 'Windows':
                firewall_result = subprocess.run(['netsh', 'advfirewall', 'show', 'allprofiles', 'state'], 
                                               capture_output=True, text=True, shell=True)
                firewall_active = 'ON' in firewall_result.stdout
            else:
                firewall_result = subprocess.run(['ufw', 'status'], capture_output=True, text=True)
                firewall_active = 'Status: active' in firewall_result.stdout
        except:
            firewall_active = True  # 默认假设防火墙开启
        
        # 检查Windows Defender状态
        antivirus_active = False
        try:
            if platform.system() == 'Windows':
                defender_result = subprocess.run(['powershell', '-Command', 
                    'Get-MpComputerStatus | Select-Object -ExpandProperty RealTimeProtectionEnabled'], 
                    capture_output=True, text=True, shell=True)
                antivirus_active = 'True' in defender_result.stdout
            else:
                antivirus_active = True  # Linux系统默认假设有防护
        except:
            antivirus_active = True
        
        # 检查系统更新状态
        updates_available = 0
        try:
            if platform.system() == 'Windows':
                # Windows更新检查
                update_result = subprocess.run(['powershell', '-Command', 
                    'Get-WindowsUpdate -AcceptAll | Measure-Object | Select-Object -ExpandProperty Count'], 
                    capture_output=True, text=True, shell=True)
                try:
                    updates_available = int(update_result.stdout.strip())
                except:
                    updates_available = 3  # 模拟数据
            else:
                # Linux更新检查
                update_result = subprocess.run(['apt', 'list', '--upgradable'], capture_output=True, text=True)
                updates_available = len(update_result.stdout.split('\n')) - 2
        except:
            updates_available = 3  # 模拟数据
        
        # 检查登录失败次数
        failed_logins = 0
        try:
            if platform.system() == 'Windows':
                # Windows事件日志检查
                event_result = subprocess.run(['powershell', '-Command', 
                    'Get-EventLog -LogName Security -InstanceId 4625 -Newest 10 | Measure-Object | Select-Object -ExpandProperty Count'], 
                    capture_output=True, text=True, shell=True)
                try:
                    failed_logins = int(event_result.stdout.strip())
                except:
                    failed_logins = 0
            else:
                auth_log = subprocess.run(['grep', 'Failed password', '/var/log/auth.log'], capture_output=True, text=True)
                failed_logins = len(auth_log.stdout.split('\n')) - 1
        except:
            failed_logins = 0
        
        # 计算总体安全评分
        security_score = 100
        if not firewall_active:
            security_score -= 30
        if not antivirus_active:
            security_score -= 40
        if updates_available > 0:
            security_score -= min(updates_available * 5, 20)
        if failed_logins > 5:
            security_score -= 10
        
        security_level = "excellent" if security_score >= 90 else "good" if security_score >= 70 else "warning" if security_score >= 50 else "critical"
        
        return jsonify({
            'firewall_active': firewall_active,
            'antivirus_active': antivirus_active,
            'updates_available': updates_available,
            'failed_logins': failed_logins,
            'security_score': security_score,
            'security_level': security_level,
            'last_check': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'threats_blocked': 0,  # 模拟数据
            'permission_requests': 2,  # 模拟数据
            'last_scan': datetime.now().strftime('%Y-%m-%d'),
            'definitions_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-scan', methods=['POST'])
def start_security_scan():
    """启动安全扫描"""
    try:
        scan_type = request.json.get('type', 'quick')
        
        # 模拟扫描过程
        scan_results = {
            'scan_id': f"scan_{int(time.time())}",
            'type': scan_type,
            'status': 'running',
            'progress': 0,
            'files_scanned': 0,
            'threats_found': 0,
            'estimated_time': 300 if scan_type == 'full' else 60,
            'start_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        return jsonify(scan_results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-scan/<scan_id>')
def get_scan_status(scan_id):
    """获取扫描状态"""
    try:
        # 模拟扫描进度
        import random
        progress = min(random.randint(10, 100), 100)
        files_scanned = progress * 10
        threats_found = random.randint(0, 2) if progress > 80 else 0
        
        scan_status = {
            'scan_id': scan_id,
            'status': 'completed' if progress >= 100 else 'running',
            'progress': progress,
            'files_scanned': files_scanned,
            'threats_found': threats_found,
            'estimated_time': max(0, 60 - (progress * 0.6)),
            'current_file': f'C:\\Windows\\System32\\file_{files_scanned}.dll' if progress < 100 else 'Scan completed'
        }
        
        return jsonify(scan_status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-recommendations')
def get_security_recommendations():
    """获取安全建议"""
    try:
        recommendations = [
            {
                'id': 1,
                'type': 'warning',
                'title': '启用自动更新',
                'description': '建议启用系统自动更新以获得最新的安全补丁',
                'priority': 'high',
                'action': 'enable_auto_update'
            },
            {
                'id': 2,
                'type': 'info',
                'title': '定期备份数据',
                'description': '建议定期备份重要数据以防止数据丢失',
                'priority': 'medium',
                'action': 'setup_backup'
            },
            {
                'id': 3,
                'type': 'warning',
                'title': '更新密码策略',
                'description': '建议使用更强的密码策略来提高账户安全性',
                'priority': 'medium',
                'action': 'update_password_policy'
            }
        ]
        
        return jsonify(recommendations)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-history')
def get_security_history():
    """获取安全历史记录"""
    try:
        period = request.args.get('period', 'today')
        
        # 模拟历史数据
        history_items = []
        
        if period == 'today':
            history_items = [
                {
                    'id': 1,
                    'type': 'success',
                    'title': '系统扫描完成',
                    'description': '快速扫描未发现威胁',
                    'time': '2小时前',
                    'timestamp': (datetime.now() - timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': 2,
                    'type': 'warning',
                    'title': '防火墙规则更新',
                    'description': '已更新防火墙规则以阻止可疑连接',
                    'time': '4小时前',
                    'timestamp': (datetime.now() - timedelta(hours=4)).strftime('%Y-%m-%d %H:%M:%S')
                }
            ]
        elif period == 'week':
            history_items = [
                {
                    'id': 3,
                    'type': 'success',
                    'title': '病毒定义更新',
                    'description': '病毒定义已更新到最新版本',
                    'time': '2天前',
                    'timestamp': (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': 4,
                    'type': 'error',
                    'title': '检测到恶意软件',
                    'description': '已检测并清除1个恶意软件',
                    'time': '3天前',
                    'timestamp': (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')
                }
            ]
        else:  # month
            history_items = [
                {
                    'id': 5,
                    'type': 'success',
                    'title': '系统更新安装',
                    'description': '已安装5个安全更新',
                    'time': '1周前',
                    'timestamp': (datetime.now() - timedelta(weeks=1)).strftime('%Y-%m-%d %H:%M:%S')
                },
                {
                    'id': 6,
                    'type': 'warning',
                    'title': '登录异常检测',
                    'description': '检测到异常登录尝试，已自动阻止',
                    'time': '2周前',
                    'timestamp': (datetime.now() - timedelta(weeks=2)).strftime('%Y-%m-%d %H:%M:%S')
                }
            ]
        
        return jsonify(history_items)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/security-toggle', methods=['POST'])
def toggle_security_feature():
    """切换安全功能状态"""
    try:
        data = request.get_json()
        feature = data.get('feature')
        enabled = data.get('enabled', True)
        
        # 模拟切换功能
        success = True
        message = f"{'启用' if enabled else '禁用'}了{feature}"
        
        # 这里可以添加实际的功能切换逻辑
        if feature == 'firewall':
            # 防火墙切换逻辑
            pass
        elif feature == 'antivirus':
            # 防病毒切换逻辑
            pass
        
        return jsonify({
            'success': success,
            'message': message,
            'feature': feature,
            'enabled': enabled
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/execute-command', methods=['POST'])
def execute_command():
    """执行终端命令"""
    try:
        data = request.get_json()
        command = data.get('command', '').strip()
        
        if not command:
            return jsonify({'error': 'No command provided'}), 400
        
        # 安全检查 - 禁止危险命令
        dangerous_commands = [
            'rm -rf', 'mkfs', 'dd if=', 'shutdown', 'reboot', 'halt',
            'format', 'fdisk', 'parted', 'wipefs', 'shred',
            'passwd', 'su -', 'sudo su', 'chmod 777', 'chown root'
        ]
        
        command_lower = command.lower()
        if any(dangerous in command_lower for dangerous in dangerous_commands):
            return jsonify({'error': 'Dangerous command not allowed for security reasons'}), 403
        
        # 限制某些系统目录的访问
        restricted_paths = ['/etc/passwd', '/etc/shadow', '/boot', '/sys', '/proc/sys']
        if any(path in command for path in restricted_paths):
            return jsonify({'error': 'Access to system files restricted'}), 403
        
        # 处理特殊命令
        if command_lower == 'clear' or command_lower == 'cls':
            return jsonify({
                'output': '',
                'error': '',
                'return_code': 0,
                'command': command,
                'special': 'clear'
            })
        
        # Windows系统命令映射
        if platform.system() == 'Windows':
            command_mappings = {
                'ls': 'dir',
                'ls -la': 'dir /a',
                'ls -l': 'dir',
                'cat': 'type',
                'grep': 'findstr',
                'ps': 'tasklist',
                'ps aux': 'tasklist /v',
                'kill': 'taskkill /PID',
                'which': 'where',
                'pwd': 'cd',
                'df -h': 'wmic logicaldisk get size,freespace,caption',
                'free -h': 'wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:list',
                'top': 'tasklist /v',
                'netstat -tuln': 'netstat -an',
                'ifconfig': 'ipconfig',
                'uname -a': 'systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type"'
            }
            
            # 检查是否需要映射命令
            for unix_cmd, windows_cmd in command_mappings.items():
                if command.startswith(unix_cmd):
                    command = command.replace(unix_cmd, windows_cmd, 1)
                    break
        
        # 执行命令
        try:
            if platform.system() == 'Windows':
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30,
                    encoding='utf-8',
                    errors='ignore'
                )
            else:
                result = subprocess.run(
                    command,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
        except UnicodeDecodeError:
            # 处理编码问题
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                timeout=30
            )
            output = result.stdout.decode('utf-8', errors='ignore') if result.stdout else ''
            error = result.stderr.decode('utf-8', errors='ignore') if result.stderr else ''
            
            return jsonify({
                'output': output,
                'error': error,
                'return_code': result.returncode,
                'command': command
            })
        
        return jsonify({
            'output': result.stdout,
            'error': result.stderr,
            'return_code': result.returncode,
            'command': command
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Command timeout (30 seconds limit)'}), 408
    except FileNotFoundError:
        return jsonify({'error': 'Command not found'}), 404
    except PermissionError:
        return jsonify({'error': 'Permission denied'}), 403
    except Exception as e:
        return jsonify({'error': f'Execution error: {str(e)}'}), 500

@app.route('/api/terminal-info')
def get_terminal_info():
    """获取终端相关信息"""
    try:
        import getpass
        
        # 获取当前用户
        try:
            current_user = getpass.getuser()
        except:
            current_user = 'user'
        
        # 获取主机名
        hostname = platform.node()
        
        # 获取当前工作目录
        try:
            current_dir = os.getcwd()
        except:
            current_dir = '~'
        
        # 获取系统信息
        system_info = {
            'system': platform.system(),
            'release': platform.release(),
            'version': platform.version(),
            'machine': platform.machine(),
            'processor': platform.processor()
        }
        
        return jsonify({
            'user': current_user,
            'hostname': hostname,
            'current_directory': current_dir,
            'system_info': system_info,
            'shell': os.environ.get('SHELL', 'cmd' if platform.system() == 'Windows' else 'bash')
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/weather')
def weather():
    """模拟天气信息"""
    return jsonify({
        'temperature': '22°C',
        'condition': 'sunny',
        'location': '北京'
    })

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """获取当前设置"""
    try:
        settings_file = 'settings.json'
        if os.path.exists(settings_file):
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings = json.load(f)
        else:
            # 默认设置
            settings = {
                'theme': {
                    'background_type': 'gradient',
                    'background_color': '#1a1a2e',
                    'secondary_color': '#16213e',
                    'accent_color': '#0f3460',
                    'custom_background': '',
                    'opacity': 0.95
                },
                'interface': {
                    'animation_enabled': True,
                    'blur_enabled': True,
                    'transparency_enabled': True
                }
            }
        
        return jsonify(settings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['POST'])
def save_settings():
    """保存设置"""
    try:
        data = request.get_json()
        settings_file = 'settings.json'
        
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': '设置已保存'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/reset', methods=['POST'])
def reset_settings():
    """重置设置为默认值"""
    try:
        settings_file = 'settings.json'
        default_settings = {
            'theme': {
                'background_type': 'gradient',
                'background_color': '#1a1a2e',
                'secondary_color': '#16213e',
                'accent_color': '#0f3460',
                'custom_background': '',
                'opacity': 0.95
            },
            'interface': {
                'animation_enabled': True,
                'blur_enabled': True,
                'transparency_enabled': True
            }
        }
        
        with open(settings_file, 'w', encoding='utf-8') as f:
            json.dump(default_settings, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'message': '设置已重置为默认值'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai-chat', methods=['POST'])
def ai_chat_api():
    """AI对话API"""
    try:
        data = request.get_json()
        message = data.get('message', '').strip()
        
        if not message:
            return jsonify({'error': '消息不能为空'}), 400
        
        # 模拟AI回复
        import random
        import time
        
        # 模拟处理时间
        time.sleep(random.uniform(0.5, 1.5))
        
        # 预设回复
        responses = [
            f"我理解您说的是：{message}。这是一个很有趣的话题。",
            f"关于「{message}」，我认为这需要更深入的分析。",
            f"您提到的「{message}」确实值得讨论。让我为您详细解释一下。",
            f"这是一个关于「{message}」的好问题。根据我的理解...",
            f"感谢您分享「{message}」。我的观点是..."
        ]
        
        # 特殊关键词回复
        if '你好' in message or 'hello' in message.lower():
            ai_response = "您好！我是您的AI助手，很高兴为您服务。有什么我可以帮助您的吗？"
        elif '天气' in message:
            ai_response = "今天天气不错，温度适宜。建议您外出时注意防晒。"
        elif '时间' in message:
            current_time = datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')
            ai_response = f"当前时间是：{current_time}"
        elif '系统' in message:
            ai_response = "我可以帮您监控系统状态、管理文件、查看进程等。您需要什么帮助？"
        elif '帮助' in message or 'help' in message.lower():
            ai_response = "我可以帮助您：\n1. 回答各种问题\n2. 提供系统信息\n3. 协助文件管理\n4. 解释技术概念\n5. 进行日常对话\n\n请告诉我您需要什么帮助！"
        else:
            ai_response = random.choice(responses)
        
        return jsonify({
            'response': ai_response,
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'message_id': f"msg_{int(time.time() * 1000)}"
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai-chat/history', methods=['GET'])
def get_chat_history():
    """获取聊天历史"""
    try:
        # 模拟聊天历史
        history = [
            {
                'id': 1,
                'type': 'user',
                'message': '你好，AI助手！',
                'timestamp': '10:30:15'
            },
            {
                'id': 2,
                'type': 'ai',
                'message': '您好！我是您的AI助手，很高兴为您服务。有什么我可以帮助您的吗？',
                'timestamp': '10:30:16'
            },
            {
                'id': 3,
                'type': 'user',
                'message': '请介绍一下这个系统监控界面',
                'timestamp': '10:31:20'
            },
            {
                'id': 4,
                'type': 'ai',
                'message': '这是一个功能强大的系统监控界面，包含以下主要功能：\n\n1. **系统信息** - 查看CPU、内存、磁盘使用情况\n2. **进程管理** - 监控和管理运行中的进程\n3. **网络监控** - 查看网络连接和流量统计\n4. **文件管理** - 浏览和管理系统文件\n5. **安全中心** - 系统安全状态和威胁检测\n6. **终端** - 执行系统命令\n\n您可以通过桌面上的图标访问这些功能。',
                'timestamp': '10:31:25'
            }
        ]
        
        return jsonify(history)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ai-chat/clear', methods=['POST'])
def clear_chat_history():
    """清空聊天历史"""
    try:
        # 实际应用中这里会清空数据库或文件中的聊天记录
        return jsonify({
            'success': True,
            'message': '聊天历史已清空'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/file-preview')
def file_preview():
    """文件预览API - 获取文件内容用于预览"""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': '文件路径不能为空'}), 400
        
        # URL解码和路径标准化
        import urllib.parse
        file_path = urllib.parse.unquote(file_path)
        file_path = os.path.normpath(file_path)
        
        # 安全检查：防止路径遍历
        if '..' in file_path or not os.path.isabs(file_path):
            return jsonify({'error': '无效的文件路径'}), 400
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        
        # 检查是否为文件
        if not os.path.isfile(file_path):
            return jsonify({'error': '指定路径不是文件'}), 400
        
        # 获取文件信息
        stat_info = os.stat(file_path)
        file_size = stat_info.st_size
        file_name = os.path.basename(file_path)
        file_ext = os.path.splitext(file_name)[1].lower()
        
        # 文件大小限制（10MB）
        max_size = 10 * 1024 * 1024
        if file_size > max_size:
            return jsonify({
                'error': f'文件过大（{format_bytes(file_size)}），无法预览',
                'file_info': {
                    'name': file_name,
                    'size': file_size,
                    'size_formatted': format_bytes(file_size),
                    'extension': file_ext
                }
            }), 413
        
        # 根据文件类型处理
        response_data = {
            'file_info': {
                'name': file_name,
                'path': file_path,
                'size': file_size,
                'size_formatted': format_bytes(file_size),
                'extension': file_ext,
                'modified': datetime.fromtimestamp(stat_info.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
            }
        }
        
        # 文本文件类型
        text_extensions = {
            '.txt', '.log', '.md', '.py', '.js', '.html', '.css', '.json', '.xml', '.yml', '.yaml',
            '.conf', '.cfg', '.ini', '.sh', '.bat', '.ps1', '.sql', '.csv', '.tsv', '.properties',
            '.dockerfile', '.gitignore', '.gitattributes', '.env', '.htaccess', '.robots'
        }
        
        # 图像文件类型
        image_extensions = {
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'
        }
        
        # PDF文件类型
        pdf_extensions = {'.pdf'}
        
        if file_ext in text_extensions or file_ext == '':
            # 尝试读取为文本文件
            try:
                # 尝试不同的编码
                encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1', 'ascii']
                content = None
                used_encoding = None
                
                for encoding in encodings:
                    try:
                        with open(file_path, 'r', encoding=encoding) as f:
                            content = f.read()
                            used_encoding = encoding
                            break
                    except UnicodeDecodeError:
                        continue
                
                if content is not None:
                    # 限制预览内容长度
                    max_content_length = 50000  # 50KB
                    if len(content) > max_content_length:
                        content = content[:max_content_length] + '\n\n... (文件内容过长，已截断)'
                    
                    response_data.update({
                        'type': 'text',
                        'content': content,
                        'encoding': used_encoding,
                        'lines': len(content.split('\n'))
                    })
                else:
                    response_data.update({
                        'type': 'unsupported',
                        'message': '无法读取文件内容（编码不支持）'
                    })
                    
            except Exception as e:
                response_data.update({
                    'type': 'error',
                    'message': f'读取文件失败: {str(e)}'
                })
                
        elif file_ext in image_extensions:
            # 图像文件
            response_data.update({
                'type': 'image',
                'url': f'/api/file-download?path={urllib.parse.quote(file_path)}'
            })
            
        elif file_ext in pdf_extensions:
            # PDF文件 - 使用专门的PDF预览路由
            response_data.update({
                'type': 'pdf',
                'url': f'/api/pdf-viewer?path={urllib.parse.quote(file_path)}'
            })
            
        else:
            # 不支持的文件类型
            response_data.update({
                'type': 'unsupported',
                'message': f'不支持预览 {file_ext} 类型的文件'
            })
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'预览文件失败: {str(e)}'}), 500

@app.route('/api/pdf-viewer')
def pdf_viewer():
    """PDF查看器API - 专门用于PDF文件预览"""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': '文件路径不能为空'}), 400
        
        # URL解码和路径标准化
        import urllib.parse
        file_path = urllib.parse.unquote(file_path)
        file_path = os.path.normpath(file_path)
        
        # 安全检查：防止路径遍历
        if '..' in file_path or not os.path.isabs(file_path):
            return jsonify({'error': '无效的文件路径'}), 400
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        
        # 检查是否为PDF文件
        if not file_path.lower().endswith('.pdf'):
            return jsonify({'error': '不是PDF文件'}), 400
        
        # 检查是否为文件
        if not os.path.isfile(file_path):
            return jsonify({'error': '指定路径不是文件'}), 400
        
        # 创建响应
        response = make_response(send_file(
            file_path,
            mimetype='application/pdf',
            as_attachment=False
        ))
        
        # 设置PDF预览的HTTP头部
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = 'inline'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Content-Security-Policy'] = "frame-ancestors 'self'"
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'PDF预览失败: {str(e)}'}), 500

@app.route('/api/file-download')
def file_download():
    """文件下载API"""
    try:
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'error': '文件路径不能为空'}), 400
        
        # URL解码和路径标准化
        import urllib.parse
        file_path = urllib.parse.unquote(file_path)
        file_path = os.path.normpath(file_path)
        
        # 安全检查：防止路径遍历
        if '..' in file_path or not os.path.isabs(file_path):
            return jsonify({'error': '无效的文件路径'}), 400
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404
        
        # 检查是否为文件
        if not os.path.isfile(file_path):
            return jsonify({'error': '指定路径不是文件'}), 400
        
        # 获取文件名和MIME类型
        file_name = os.path.basename(file_path)
        file_ext = os.path.splitext(file_name)[1].lower()
        
        # 设置MIME类型
        mime_types = {
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.zip': 'application/zip',
            '.tar': 'application/x-tar',
            '.gz': 'application/gzip'
        }
        
        mimetype = mime_types.get(file_ext, 'application/octet-stream')
        
        # 检查是否为内联显示（图像和PDF）
        inline_types = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.pdf'}
        as_attachment = file_ext not in inline_types
        
        # 为PDF文件添加特殊处理
        if file_ext == '.pdf':
            response = make_response(send_file(
                file_path,
                mimetype=mimetype,
                as_attachment=as_attachment,
                download_name=file_name
            ))
            # 添加允许iframe嵌入的头部
            response.headers['X-Frame-Options'] = 'SAMEORIGIN'
            response.headers['Content-Security-Policy'] = "frame-ancestors 'self'"
            return response
        else:
            return send_file(
                file_path,
                mimetype=mimetype,
                as_attachment=as_attachment,
                download_name=file_name
            )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'下载文件失败: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)