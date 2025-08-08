'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: wangxiaomeng <wangxiaomeng@kylinos.cn>
  Date: Wed Jun 12 10:48:40 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3
# Copyright (c) 2023 KylinSoft  Co., Ltd. All Rights Reserved.

try:
    from common.file import FileOperation
    from common.command import Command
except:
    from ..common.file import FileOperation
    from ..common.command import Command

import threading
import time
import subprocess
import os
import re

try:
    from common.global_call import GlobalCall
    from common.log import Logger
except:
    from ..common.global_call import GlobalCall
    from ..common.log import Logger


class RealTimeSysMessage:
    def __init__(self, interval=5):
        self.interval = interval
        self._stop_event = threading.Event()
        self.thread = None
        self.data = {
            'recent_logs': [],  # 最近日志
            'error_logs': [],  # 错误日志
            'log_sources': []  # 可用日志源
        }
        # 初始化日志源
        self.__find_log_sources()
        # 添加广播功能
        GlobalCall.real_time_sys_message_data = self.data

    def __find_log_sources(self):
        """检测可用的系统日志源"""
        common_logs = [
            '/var/log/messages',
            '/var/log/syslog',
            '/var/log/kern.log',
            '/var/log/dmesg'
        ]
        self.data['log_sources'] = [log for log in common_logs if os.path.exists(log)]

    def __collect_real_time_data(self):
        """采集实时系统日志数据"""
        try:
            # 1. 采集最近日志
            recent_logs = []
            for log_file in self.data['log_sources']:
                try:
                    cmd = f"tail -n 50 {log_file} 2>/dev/null"
                    output = subprocess.check_output(cmd, shell=True, text=True)
                    recent_logs.append(f"## {log_file} ##\n{output}")
                except Exception as e:
                    Logger().error(f"Error reading {log_file}: {str(e)}")

            # 2. 采集错误日志
            error_logs = []
            for log_file in self.data['log_sources']:
                try:
                    cmd = f"grep -E -i 'error|warning|fail|critical' {log_file} | tail -n 50 2>/dev/null"
                    output = subprocess.check_output(cmd, shell=True, text=True)
                    if output.strip():
                        error_logs.append(f"## {log_file} ##\n{output}")
                except Exception as e:
                    Logger().error(f"Error filtering {log_file}: {str(e)}")

            # 3. 更新数据
            self.data = {
                'recent_logs': recent_logs,
                'error_logs': error_logs,
                'log_sources': self.data['log_sources']  # 保持日志源不变
            }
            # 广播数据
            GlobalCall.real_time_sys_message_data = self.data

        except Exception as e:
            Logger().error(f"Error collecting system logs: {str(e)}")

    def start_broadcasting(self):
        """启动广播线程"""
        if self.thread is not None and self.thread.is_alive():
            return

        self._stop_event.clear()
        self.thread = threading.Thread(target=self._broadcast_loop)
        self.thread.daemon = True
        self.thread.start()

    def _broadcast_loop(self):
        """广播循环"""
        while not self._stop_event.is_set():
            self.__collect_real_time_data()
            time.sleep(self.interval)

    def stop_broadcasting(self):
        """停止广播"""
        self._stop_event.set()
        if self.thread is not None:
            self.thread.join(timeout=1)

    def get_current_data(self):
        """获取当前日志数据"""
        return self.data

# System log class
class SysMessage():
    def __init__(self, t_fileName):
        self.__default_file_name = t_fileName
        FileOperation.remove_txt_file(self.__default_file_name)

    def __get_system_message(self):
        '''
            get system log
        '''
        mem_command="dmesg -T"
        cmd_result = Command.cmd_run(mem_command)
        return Command.cmd_output(mem_command, cmd_result, self.__default_file_name, '=')

    def get_info(self):
        self.__get_system_message()
        super().start_broadcasting()  # 启动实时采集
