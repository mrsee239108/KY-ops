# security_scanner.py
import os
import re
import time
import subprocess
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Tuple

# 敏感信息正则表达式模式
SENSITIVE_PATTERNS = {
    'password': re.compile(r'(password|pass|pwd)\s*[:=]\s*[^\s]+', re.IGNORECASE),
    'phone': re.compile(r'1[3-9]\d{9}'),
    'id_card': re.compile(r'\d{17}[\dXx]'),
    'email': re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'),
    'credit_card': re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b')
}

# 系统日志文件路径
SYSTEM_LOG_PATHS = [
    '/var/log/auth.log',
    '/var/log/syslog',
    '/var/log/messages',
    '/var/log/apache2/access.log',
    '/var/log/nginx/access.log'
]

# 扫描任务存储
scan_tasks = {}
task_lock = threading.Lock()


class SecurityScanner:
    def __init__(self):
        self.scan_id = None
        self.scan_type = 'quick'
        self.status = 'pending'
        self.progress = 0
        self.files_scanned = 0
        self.threats_found = 0
        self.start_time = None
        self.end_time = None
        self.results = {
            'vulnerabilities': [],
            'sensitive_data': [],
            'misconfigurations': [],
            'open_ports': []
        }

    def start_scan(self, scan_type: str = 'quick') -> Dict:
        """启动安全扫描"""
        self.scan_id = f"scan_{uuid.uuid4().hex[:10]}"
        self.scan_type = scan_type
        self.status = 'running'
        self.start_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self.progress = 0

        with task_lock:
            scan_tasks[self.scan_id] = self

        # 启动扫描线程
        threading.Thread(target=self._perform_scan, daemon=True).start()

        return {
            'scan_id': self.scan_id,
            'type': self.scan_type,
            'status': self.status,
            'progress': self.progress,
            'files_scanned': self.files_scanned,
            'threats_found': self.threats_found,
            'estimated_time': 300 if scan_type == 'full' else 60,
            'start_time': self.start_time
        }

    def _perform_scan(self):
        """执行扫描任务"""
        try:
            if self.scan_type == 'quick':
                self._quick_scan()
            else:
                self._full_scan()

            self.status = 'completed'
            self.end_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        except Exception as e:
            self.status = 'failed'
            self.results['error'] = str(e)
        finally:
            self.progress = 100

    def _quick_scan(self):
        """快速扫描实现"""
        scan_steps = [
            ('检查开放端口', self._check_open_ports, 30),
            ('检查系统更新', self._check_system_updates, 20),
            ('检查认证日志', self._check_auth_logs, 30),
            ('检查敏感文件权限', self._check_sensitive_file_permissions, 20)
        ]

        for step_name, step_func, weight in scan_steps:
            step_func()
            self.progress += weight
            time.sleep(1)  # 模拟扫描耗时

    def _full_scan(self):
        """全面扫描实现"""
        scan_steps = [
            ('检查开放端口', self._check_open_ports, 15),
            ('检查系统更新', self._check_system_updates, 10),
            ('检查所有系统日志', self._check_all_system_logs, 25),
            ('检查敏感文件权限', self._check_sensitive_file_permissions, 15),
            ('检查系统配置', self._check_system_configurations, 20),
            ('检查已安装软件漏洞', self._check_software_vulnerabilities, 15)
        ]

        for step_name, step_func, weight in scan_steps:
            step_func()
            self.progress += weight
            time.sleep(2)  # 模拟扫描耗时

    def _check_open_ports(self):
        """检查开放端口"""
        try:
            # 使用netstat检查开放端口
            result = subprocess.run(
                ['netstat', '-tuln'],
                capture_output=True,
                text=True,
                timeout=10
            )

            # 解析结果，过滤常见危险端口
            dangerous_ports = {21, 23, 139, 445}  # FTP, Telnet, SMB等
            lines = result.stdout.splitlines()

            for line in lines[2:]:  # 跳过标题行
                parts = line.strip().split()
                if len(parts) >= 4:
                    local_addr = parts[3]
                    port = local_addr.split(':')[-1]
                    if port.isdigit() and int(port) in dangerous_ports:
                        self.results['open_ports'].append({
                            'port': port,
                            'protocol': parts[0],
                            'status': '危险端口开放',
                            'description': f"不建议开放的危险端口 {port}"
                        })
                        self.threats_found += 1

            self.files_scanned += 1
        except Exception as e:
            self.results['vulnerabilities'].append({
                'type': '端口扫描错误',
                'description': str(e)
            })

    def _check_system_updates(self):
        """检查系统安全更新"""
        try:
            # 检查可用的安全更新
            result = subprocess.run(
                ['apt', 'list', '--upgradable'],
                capture_output=True,
                text=True,
                timeout=20
            )

            updates = result.stdout.splitlines()
            security_updates = [u for u in updates if 'security' in u.lower()]

            if security_updates:
                self.results['vulnerabilities'].append({
                    'type': '系统安全更新',
                    'description': f"发现 {len(security_updates)} 个安全更新需要安装",
                    'details': security_updates[:5]  # 只显示前5个
                })
                self.threats_found += len(security_updates)

            self.files_scanned += 1
        except Exception as e:
            self.results['vulnerabilities'].append({
                'type': '更新检查错误',
                'description': str(e)
            })

    def _check_auth_logs(self):
        """检查认证日志中的异常"""
        if os.path.exists('/var/log/auth.log'):
            self._scan_log_file('/var/log/auth.log')

    def _check_all_system_logs(self):
        """检查所有系统日志"""
        for log_path in SYSTEM_LOG_PATHS:
            if os.path.exists(log_path) and os.access(log_path, os.R_OK):
                self._scan_log_file(log_path)

    def _scan_log_file(self, file_path: str):
        """扫描日志文件中的敏感信息"""
        try:
            with open(file_path, 'r', errors='ignore') as f:
                # 只检查最后1000行，避免大文件处理过慢
                lines = f.readlines()[-1000:]

                for line_num, line in enumerate(lines, 1):
                    for sens_type, pattern in SENSITIVE_PATTERNS.items():
                        matches = pattern.findall(line)
                        if matches:
                            # 脱敏处理匹配到的敏感信息
                            redacted_line = self._redact_sensitive_info(line, sens_type)
                            self.results['sensitive_data'].append({
                                'file': file_path,
                                'line': line_num,
                                'type': sens_type,
                                'content': redacted_line,
                                'description': f"发现{self._get_sensitive_type_name(sens_type)}信息"
                            })
                            self.threats_found += 1

            self.files_scanned += 1
        except Exception as e:
            self.results['vulnerabilities'].append({
                'type': '日志扫描错误',
                'description': f"扫描文件 {file_path} 时出错: {str(e)}"
            })

    def _check_sensitive_file_permissions(self):
        """检查敏感文件权限"""
        sensitive_files = [
            '/etc/passwd',
            '/etc/shadow',
            '/etc/sudoers',
            '/etc/ssh/sshd_config'
        ]

        for file_path in sensitive_files:
            if os.path.exists(file_path):
                try:
                    # 获取文件权限
                    stat_info = os.stat(file_path)
                    permissions = oct(stat_info.st_mode & 0o777)

                    # 检查是否过于宽松
                    if file_path == '/etc/shadow' and permissions != '0o600':
                        self.results['misconfigurations'].append({
                            'file': file_path,
                            'issue': '权限过于宽松',
                            'current_perms': permissions,
                            'recommended': '0o600',
                            'description': 'shadow文件包含用户密码哈希，必须严格限制访问'
                        })
                        self.threats_found += 1

                    elif file_path == '/etc/sudoers' and permissions != '0o440':
                        self.results['misconfigurations'].append({
                            'file': file_path,
                            'issue': '权限过于宽松',
                            'current_perms': permissions,
                            'recommended': '0o440',
                            'description': 'sudoers文件控制sudo权限，必须严格限制访问'
                        })
                        self.threats_found += 1

                except Exception as e:
                    self.results['vulnerabilities'].append({
                        'type': '文件权限检查错误',
                        'description': f"检查文件 {file_path} 时出错: {str(e)}"
                    })

        self.files_scanned += len(sensitive_files)

    def _check_system_configurations(self):
        """检查系统配置"""
        # 检查SSH配置
        ssh_config = '/etc/ssh/sshd_config'
        if os.path.exists(ssh_config):
            try:
                with open(ssh_config, 'r') as f:
                    content = f.read()

                    # 检查root登录是否允许
                    if re.search(r'PermitRootLogin\s+yes', content, re.IGNORECASE):
                        self.results['misconfigurations'].append({
                            'type': 'SSH配置',
                            'issue': '允许root直接登录',
                            'description': '不建议允许root用户直接通过SSH登录'
                        })
                        self.threats_found += 1

                    # 检查密码认证是否启用
                    if re.search(r'PasswordAuthentication\s+no', content, re.IGNORECASE) is None:
                        self.results['misconfigurations'].append({
                            'type': 'SSH配置',
                            'issue': '启用密码认证',
                            'description': '建议禁用密码认证，使用SSH密钥认证'
                        })
                        self.threats_found += 1

            except Exception as e:
                self.results['vulnerabilities'].append({
                    'type': '配置检查错误',
                    'description': f"检查SSH配置时出错: {str(e)}"
                })

        self.files_scanned += 1

    def _check_software_vulnerabilities(self):
        """检查已安装软件漏洞"""
        try:
            # 使用apt-check检查漏洞
            result = subprocess.run(
                ['apt', 'list', '--installed'],
                capture_output=True,
                text=True,
                timeout=30
            )

            # 这里简化处理，实际应与CVE数据库比对
            installed_packages = [line.split('/')[0] for line in result.stdout.splitlines() if '/' in line]

            # 模拟常见有漏洞的软件检查
            vulnerable_patterns = {
                'openssl': '可能存在Heartbleed等漏洞',
                'bash': '可能存在Shellshock漏洞',
                'nginx': '可能存在HTTP解析漏洞',
                'apache2': '可能存在目录遍历漏洞'
            }

            for pkg in installed_packages:
                for pattern, desc in vulnerable_patterns.items():
                    if pattern in pkg:
                        self.results['vulnerabilities'].append({
                            'type': '软件漏洞',
                            'package': pkg,
                            'description': desc,
                            'recommendation': f"更新 {pkg} 到最新版本"
                        })
                        self.threats_found += 1
                        break

            self.files_scanned += 1
        except Exception as e:
            self.results['vulnerabilities'].append({
                'type': '软件漏洞检查错误',
                'description': str(e)
            })

    def _redact_sensitive_info(self, content: str, sens_type: str) -> str:
        """脱敏处理敏感信息"""
        if sens_type == 'password':
            return re.sub(r'(password|pass|pwd)\s*[:=]\s*[^\s]+', r'\1: ******', content, flags=re.IGNORECASE)
        elif sens_type == 'phone':
            return re.sub(r'1[3-9]\d{9}', '13********', content)
        elif sens_type == 'id_card':
            return re.sub(r'\d{17}[\dXx]', '****************X', content)
        elif sens_type == 'email':
            return re.sub(r'([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', r'***@\2', content)
        elif sens_type == 'credit_card':
            return re.sub(r'\b(?:\d{4}[-\s]?){3}\d{4}\b', '****-****-****-****', content)
        return content

    def _get_sensitive_type_name(self, sens_type: str) -> str:
        """获取敏感信息类型的中文名称"""
        names = {
            'password': '密码',
            'phone': '手机号码',
            'id_card': '身份证号',
            'email': '邮箱地址',
            'credit_card': '信用卡号'
        }
        return names.get(sens_type, sens_type)

    def get_status(self) -> Dict:
        """获取扫描状态"""
        status_info = {
            'scan_id': self.scan_id,
            'type': self.scan_type,
            'status': self.status,
            'progress': self.progress,
            'files_scanned': self.files_scanned,
            'threats_found': self.threats_found,
            'start_time': self.start_time,
            'end_time': self.end_time
        }

        # 如果扫描完成，添加结果摘要
        if self.status in ['completed', 'failed']:
            status_info['results_summary'] = {
                'vulnerabilities': len(self.results['vulnerabilities']),
                'sensitive_data': len(self.results['sensitive_data']),
                'misconfigurations': len(self.results['misconfigurations']),
                'open_ports': len(self.results['open_ports'])
            }
            status_info['results'] = self.results if self.status == 'failed' else None

        return status_info


# 对外提供的接口函数
def start_new_scan(scan_type: str = 'quick') -> Dict:
    """启动新的安全扫描"""
    scanner = SecurityScanner()
    return scanner.start_scan(scan_type)


def get_specified_scan_status(scan_id: str) -> Dict:
    """获取指定扫描的状态"""
    with task_lock:
        scanner = scan_tasks.get(scan_id)
        if not scanner:
            return {'error': '扫描任务不存在'}
        return scanner.get_status()