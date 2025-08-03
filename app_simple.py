from flask import Flask, render_template, jsonify, request, send_file, make_response
import psutil
import platform
import socket
import subprocess
import os
import json
import time
from datetime import datetime, timedelta
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your-secret-key-here'

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def format_bytes(bytes_value):
    """格式化字节数为可读格式"""
    if bytes_value is None:
        return "N/A"
    
    try:
        bytes_value = float(bytes_value)
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_value < 1024.0:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024.0
        return f"{bytes_value:.1f} PB"
    except (ValueError, TypeError):
        return "N/A"

@app.route('/')
def desktop():
    return render_template('desktop.html')

@app.route('/performance-monitor')
def performance_monitor():
    return render_template('performance_monitor.html')

@app.route('/api/system-status')
def system_status():
    """获取系统状态信息"""
    try:
        # CPU使用率
        cpu_usage = psutil.cpu_percent(interval=1)
        
        # 内存信息
        memory = psutil.virtual_memory()
        memory_info = {
            'total': memory.total,
            'available': memory.available,
            'used': memory.used,
            'percent': memory.percent,
            'cached': getattr(memory, 'cached', 0),
            'buffers': getattr(memory, 'buffers', 0)
        }
        
        # 磁盘使用情况
        disk_usage = psutil.disk_usage('/')
        disk_info = {
            'total': disk_usage.total,
            'used': disk_usage.used,
            'free': disk_usage.free,
            'percent': (disk_usage.used / disk_usage.total) * 100
        }
        
        # 网络I/O
        net_io = psutil.net_io_counters()
        network_info = {
            'bytes_sent': net_io.bytes_sent,
            'bytes_recv': net_io.bytes_recv,
            'packets_sent': net_io.packets_sent,
            'packets_recv': net_io.packets_recv
        }
        
        # 磁盘I/O
        disk_io = psutil.disk_io_counters()
        disk_io_info = {
            'read_bytes': disk_io.read_bytes if disk_io else 0,
            'write_bytes': disk_io.write_bytes if disk_io else 0
        }
        
        # 负载平均值（Windows上模拟）
        if platform.system() == 'Linux':
            load_avg = os.getloadavg()
        else:
            # Windows上模拟负载平均值
            load_avg = (cpu_usage/100, cpu_usage/100, cpu_usage/100)
        
        # 进程统计
        process_count = len(psutil.pids())
        active_processes = len([p for p in psutil.process_iter() if p.status() == psutil.STATUS_RUNNING])
        
        return jsonify({
            'cpu_usage': cpu_usage,
            'cpu_model': platform.processor() or 'Unknown',
            'memory': memory_info,
            'disk': disk_info,
            'network': network_info,
            'disk_io': disk_io_info,
            'load_averages': {
                '1min': load_avg[0],
                '5min': load_avg[1],
                '15min': load_avg[2]
            },
            'process_count': process_count,
            'active_processes': active_processes,
            'current_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'current_date': datetime.now().strftime('%Y年%m月%d日')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/top-processes')
def get_top_processes():
    """获取CPU占用最高的进程"""
    try:
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                proc_info = proc.info
                if proc_info['cpu_percent'] and proc_info['cpu_percent'] > 0:
                    processes.append({
                        'pid': proc_info['pid'],
                        'name': proc_info['name'],
                        'cpu_percent': proc_info['cpu_percent'],
                        'memory_percent': proc_info['memory_percent'] or 0
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        # 按CPU使用率排序，取前5个
        processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
        return jsonify(processes[:5])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)