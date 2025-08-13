'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: lixiaoyong1 <lixiaoyong@kylinos.cn>
  Date: Tue Feb 27 13:54:14 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3
try:
    from common.global_parameter import GlobalParameter
    from common.log import Logger
    from common.file import FileOperation
    from common.global_call import GlobalCall
    from common.command import Command
except:
    from ..common.global_parameter import GlobalParameter
    from ..common.log import Logger
    from ..common.file import FileOperation
    from ..common.global_call import GlobalCall
    from ..common.command import Command

import threading
import time
import subprocess
import re
import json
try:
    from common.global_call import GlobalCall
except:
    from ..common.global_call import GlobalCall


class RealTimeMemory:
    def __init__(self, interval=2):
        self.interval = interval
        self._stop_event = threading.Event()
        self.thread = None
        self.data = {
            'mem_total': 0.0,
            'mem_used': 0.0,
            'mem_available': 0.0,
            'mem_percent': 0.0,
            'mem_cached': 0.0,
            'mem_buffers': 0.0,
            'swap_total': 0.0,
            'swap_used': 0.0,
            'swap_free': 0.0,
            'swap_percent': 0.0
        }
        # 添加广播功能
        GlobalCall.real_time_mem_data = self.data

    def __collect_real_time_data(self):
        """使用命令行工具采集实时内存数据"""
        try:
            # 使用 free 命令获取内存信息
            cmd = "free -b"
            output = subprocess.check_output(cmd, shell=True, text=True)

            # 解析输出
            lines = output.splitlines()
            mem_line = lines[1].split()
            swap_line = lines[2].split()

            # 提取内存数据（单位：字节）
            mem_total = float(mem_line[1])
            mem_free = float(mem_line[3])
            if len(mem_line) > 6:
                mem_available = float(mem_line[6])
            mem_used = mem_total - mem_available
            mem_buffers = float(mem_line[5])
            mem_cached = float(mem_line[5])

            # 提取交换内存数据
            swap_total = float(swap_line[1])
            swap_used = float(swap_line[2])
            swap_free = float(swap_line[3])

            # 计算百分比
            mem_percent = ((mem_total - mem_available) / mem_total) * 100 if mem_total > 0 else 0.0
            swap_percent = (swap_used / swap_total) * 100 if swap_total > 0 else 0.0

            # 更新数据
            self.data = {
                'mem_total': mem_total,
                'mem_used': mem_used,
                'mem_free': mem_free,
                'mem_percent': mem_percent,
                'mem_cached': mem_cached,
                'mem_buffers': mem_buffers,
                'swap_total': swap_total,
                'swap_used': swap_used,
                'swap_free': swap_free,
                'swap_percent': swap_percent,
            }
            # 广播数据
            GlobalCall.real_time_mem_data = self.data

        except Exception as e:
            Logger().logger(f"Error collecting memory data: {e}")
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
        """获取当前内存数据"""
        return self.data

# memory class
class MemInfo():
    def __init__(self, t_fileName):
        self.__TOTALNUMS = 2
        self.__success_counts, self.__failed_counts, self.__waiting_counts = 0, 0, 0
        self.__default_file_name = t_fileName
        FileOperation.remove_txt_file(self.__default_file_name)
        # 默认时间间隔为1s
        self.__interval = GlobalParameter().get_mem_interval()
        # 默认执行5次
        self.__times    = GlobalParameter().get_mem_times()

    def __get_mem_info(self):
        '''
            Mem information
        '''
        mem_command="cat /proc/meminfo"
        cmd_name_m = mem_command
        cmd_result = Command.cmd_run(mem_command)
        res_m = FileOperation.wrap_output_format(cmd_name_m, cmd_result, '-')

        dmidecode_command="dmidecode -t memory"
        cmd_result = Command.cmd_run(dmidecode_command)
        res_d = FileOperation.wrap_output_format(cmd_name_m, cmd_result, '-')

        pagesize_command="getconf PAGE_SIZE"
        cmd_result = Command.cmd_run(pagesize_command)
        res_p = FileOperation.wrap_output_format(cmd_name_m, cmd_result, '=')

        res_all = res_m + res_d + res_p
        return Command.cmd_write_file(res_all, self.__default_file_name)

    def __get_dmidecode_info(self):
        '''
            Memory slots info
        '''
        dmidecode_command="dmidecode -t memory"
        cmd_name = dmidecode_command
        cmd_result = Command.cmd_run(dmidecode_command)
        return Command.cmd_output(cmd_name, cmd_result, self.__default_file_name, '=')

    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_free_info(self,interval, times):
        '''
            Get memory information
        '''
        free_command="free -m"
        cmd_name = "free -m"
        cmd_result = Command.cmd_run(free_command)
        res_free = FileOperation.wrap_output_format(cmd_name, cmd_result,'-')

        vmstat_s_cmd="vmstat -s"
        cmd_result = Command.cmd_run(vmstat_s_cmd)
        res_vmstat_s = FileOperation.wrap_output_format(cmd_name, cmd_result,'-')

        vmstat_command="vmstat {} {}".format(interval, times)
        cmd_result = Command.cmd_run(vmstat_command)
        res_vmstat = FileOperation.wrap_output_format(cmd_name, cmd_result,'=')

        res = res_free + res_vmstat_s + res_vmstat
        return Command.cmd_write_file(res, self.__default_file_name)

    def get_info(self):
        '''
            Get the external interface of memory monitoring information
        '''
        if self.__get_mem_info():
            self.__success_counts += 1
        else:
            self.__failed_counts += 1
            Logger().debug("__get_mem_info failed!!!")
        # if self.__get_dmidecode_info():
        #     self.__success_counts += 1
        # else:
        #     self.__failed_counts += 1
        #     Logger().debug("__get_dmidecode_info failed!!!")
        if self.__get_free_info(self.__interval, self.__times):
            self.__success_counts += 1
        else:
            self.__failed_counts += 1
            Logger().debug("__get_free_info failed!!!")

        if self.__TOTALNUMS == self.__failed_counts:
            Logger().error("Failed to get memory information")
        Logger().debug("Get memory information end : total [{}] success[{}] failed[{}] waiting threads[{}]".format(self.__TOTALNUMS, self.__success_counts, self.__failed_counts,self.__waiting_counts))
