'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Mon Nov 20 15:50:39 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3

from time import sleep
try:
    from common.customizefunctionthread import CustomizeFunctionThread
    from common.file import FileOperation
    from common.global_call import GlobalCall
    from common.command import Command
    from common.global_parameter import GlobalParameter
    from common.config import Config
    from common.log import Logger
except:
    from ..common.customizefunctionthread import CustomizeFunctionThread
    from ..common.file import FileOperation
    from ..common.global_call import GlobalCall
    from ..common.command import Command
    from ..common.global_parameter import GlobalParameter
    from ..common.config import Config
    from ..common.log import Logger


import threading
import time
import subprocess
import re
import json
try:
    from common.global_call import GlobalCall
except:
    from ..common.global_call import GlobalCall


class RealTimeCPU:
    def __init__(self, interval=2):
        self.interval = interval
        self._stop_event = threading.Event()
        self.thread = None
        self.data = {
            'total_usage': 0.0,
            'core_usage': []
        }
        # 添加广播功能
        GlobalCall.real_time_cpu_data = self.data

    def __collect_real_time_data(self):
        """使用命令行工具采集实时CPU数据"""
        try:
            # 使用 mpstat 命令获取CPU使用率
            cmd = "mpstat -P ALL 1 1"
            output = subprocess.check_output(cmd, shell=True, text=True)

            # 解析输出
            lines = output.splitlines()
            core_data = []
            total_usage = 0.0

            for line in lines:
                if line.startswith('Average:') or line.startswith('平均时间:'):
                    parts = line.split()
                    if parts[1] == 'all':
                        total_usage = 100.0 - float(parts[11])  # %idle
                    elif parts[1].isdigit():
                        core_id = int(parts[1])
                        idle = float(parts[11])
                        usage = 100.0 - idle
                        core_data.append(usage)

            # 更新数据
            self.data = {
                'model_name': cpu_model,
                'total_usage': total_usage,
                'core_usage': core_data
            }
            # 广播数据
            GlobalCall.real_time_cpu_data = self.data

        except Exception as e:
            print(f"Error collecting CPU data: {e}")

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
            print(f"RealTimeCPU: {self.data}")
            self.__collect_real_time_data()
            time.sleep(self.interval)

    def stop_broadcasting(self):
        """停止广播"""
        self._stop_event.set()
        if self.thread is not None:
            self.thread.join(timeout=1)

    def get_current_data(self):
        """获取当前CPU数据"""
        return self.data


# 在 CPUInfo 类中添加实时监控功能
class CPUInfo(RealTimeCPU):
    # 保留原有的静态数据收集功能
    def __init__(self, t_fileName):
        super().__init__()
        self.__default_file_name = t_fileName
        FileOperation.remove_txt_file(self.__default_file_name)
        self.__interval = GlobalParameter().get_cpu_interval()
        self.__times = GlobalParameter().get_cpu_times()
        self.__duration = GlobalParameter().get_perf_stat_duration()

    def __get_cpu_info(self):
        '''
            cat /proc/cpuinfo and lscpu
        '''
        cmd_name = "cat /proc/cpuinfo"
        
        lscpu_cmd = "lscpu"
        cmd_result = Command.cmd_run(lscpu_cmd)
        res_lscpu = FileOperation.wrap_output_format(cmd_name, cmd_result, '-')
        
        dmidecode_cmd = "dmidecode -t processor | grep 'Socket Designation:\|Max Speed:\|Current Speed:'"
        cmd_result = Command.cmd_run(dmidecode_cmd)
        res_dmidecode = FileOperation.wrap_output_format(cmd_name, cmd_result, '-')

        cpuinfo_command="cat /proc/cpuinfo"
        cmd_result = Command.cmd_run(cpuinfo_command)
        res_cpuinfo = FileOperation.wrap_output_format(cmd_name, cmd_result, '=')
        
        res_all = res_lscpu + res_dmidecode + res_cpuinfo
        return Command.cmd_write_file(res_all, self.__default_file_name)

    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_pid_cpustat_info(self):
        '''
            pidstat
        '''
        pidstat_command = GlobalParameter().pidstat_cmd
        cmd_name = 'pidstat'
        cmd_result = Command.cmd_run(pidstat_command)
        res_all = FileOperation.wrap_output_format(cmd_name, cmd_result,'-')
        
        pidstat_command="pidstat |sort -ir -k 9"
        for i in range(5):
            cmd_result = Command.cmd_run(pidstat_command)
            if i == 0 : 
                result = cmd_result.split('\n',1)[0] + '\n' + cmd_result.split('\n',1)[1].rsplit('\n',3)[1] + '\n\n'
            result += cmd_result.split('\n',1)[1].rsplit('\n',3)[0] + '\n\n'
            
            sleep(1)
        res_all += FileOperation.wrap_output_format(cmd_name, result,'=')       
        return Command.cmd_write_file(res_all, self.__default_file_name)
   
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_mpstat_info(self, interval , times):
        '''
            mpstat
        '''
        mpstat_command="mpstat -P ALL {} {}".format(interval, times)
        cmd_result = Command.cmd_run(mpstat_command)
        cmd_name = 'mpstat'
        return Command.cmd_output(cmd_name, cmd_result, self.__default_file_name, '=')

    # uptime
    def __get_top_info_task1(self):
        cmd_name_top = 'top'
        uptime_command="for i in {1..5}; do uptime; sleep 1; done"

        cmd_result_1 = Command.cmd_run(uptime_command)
        #将uptime_command替换成‘uptime’
        cmd_result = "uptime" + "\n" + cmd_result_1.split('\n',1)[1]
        res_uptime = FileOperation.wrap_output_format(cmd_name_top, cmd_result,'-')

        return res_uptime
    
    # dstat
    def __get_top_info_task2(self, interval, times):
        cmd_name_top = 'top'

        if Command.cmd_exists('dstat'):
            dstat_command="dstat --nocolor --noupdate -cdngy {} {}".format(interval, times)
            cmd_result = Command.cmd_run(dstat_command)
            res_dstat = FileOperation.wrap_output_format(cmd_name_top, cmd_result,'-')
        else:
            res_dstat = ''

        return res_dstat

    # perf stat
    def __get_top_info_task3(self):
        cmd_name_top = 'top'
        duration = self.__duration

        if Command.cmd_exists('perf'):
            perf_stat_file = "{}{}".format(Config.get_output_path(),'perf_stat.txt')
            try:
                if int(duration) < 5 or int(duration) > 300:
                    Logger().warning(u"Getting.Common.CPU.duration应在5-300之间,超出此范围设置为默认值15.")
                    duration = 15
            except ValueError as e:
                # should not arrive here
                Logger().debug("Getting.Common.CPU.duration: {}".format(e))
                duration = 15
            
            # 该命令并不包含cache-misses,cache-references
            # 若要同时采集,则需考虑将默认event和这两个事件逐一列出进行采集
            # 由于添加了-ddd,且对这两个事件暂无明显的分析需求,故暂不列入这两个事件。
            perf_stat_command = "perf stat -a -ddd sleep {} 2> {}".format(duration, perf_stat_file)
            Logger().debug("perf_stat_command : {}".format(perf_stat_command))
            Command.private_cmd_run(perf_stat_command, True)
            try:
                perf_stat_txt = FileOperation.readfile(perf_stat_file)
                cmd_result = "".join(["perf stat -a -ddd", '\n', perf_stat_txt])
                res_perf_stat = FileOperation.wrap_output_format(cmd_name_top, cmd_result, '-')
            except Exception as e:
                Logger().debug("read perf stat content error: {}".format(e))
                res_perf_stat = ''
        else:
            res_perf_stat = ''

        return res_perf_stat

    # top
    def __get_top_info_task4(self):
        cmd_name_top = 'top'
        top_command = "top -b -n 3"

        cmd_result = Command.cmd_run(top_command)
        cmd_results = cmd_result.split('\n\n')
        # 保留top最后一次的结果
        last_two_result = cmd_results[-2:]
        cmd_result = top_command + '\n' + '\n\n'.join(last_two_result)
        res_top = FileOperation.wrap_output_format(cmd_name_top, cmd_result,'=')

        return res_top

    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_top_info(self, interval , times):
        '''
            uptime,dstat,perf stat,top
        '''
        task_uptime = CustomizeFunctionThread(self.__get_top_info_task1)
        task_dstat = CustomizeFunctionThread(self.__get_top_info_task2, (interval, times))
        task_perf_stat = CustomizeFunctionThread(self.__get_top_info_task3)
        task_top = CustomizeFunctionThread(self.__get_top_info_task4)
        task_uptime.start()
        task_dstat.start()
        task_perf_stat.start()
        task_top.start()
        task_uptime.join()
        task_dstat.join()
        task_perf_stat.join()
        task_top.join()

        res = task_uptime.get_result() + task_dstat.get_result() + task_perf_stat.get_result() + task_top.get_result()
            
        return Command.cmd_write_file(res, self.__default_file_name)

    def __get_numastat_info(self):
        '''
            Get numastat information
        '''
        cmd_numactl = "numactl -H"
        cmd_numastat = "numastat -c"
        interval = 10
        
        if not Command.cmd_exists(cmd_numactl):
            return False
        if not Command.cmd_exists(cmd_numastat):
            return False
        
        #为保证两条命令输出到txt的位置必须相邻
        #需要先把两条numa命令的data 包装成可输出txt的格式，使用两次FileOperation.wrap_output_format
        #再统一进行输出到txt，使用Command.cmd_write_file
        
        #1.包装numactl命令
        cmd_result = Command.cmd_run(cmd_numactl)
        res_numactl = FileOperation.wrap_output_format('numactl', cmd_result,'-')
        
        res = Command.cmd_run(cmd_numastat)
        if len(res) == 0:
            return False
        sleep(interval)
        res += "\n\nsleep " + str(interval) + "seconds.....\n\n"
        res += Command.cmd_run(cmd_numastat)
        #2.包装numastat命令
        res_numastat = FileOperation.wrap_output_format('numactl', res,'=')
        
        #3.输出txt
        res_all = res_numactl + res_numastat
        return Command.cmd_write_file(res_all, self.__default_file_name)
    
    def __get_sar_task1(self, interval, times):
        cmd_name = 'sar'
        sar_command ="sar {} {}".format(interval, times)
        sar_result = Command.cmd_run(sar_command)
        #return Command.cmd_output(cmd_name, sar_result, self.__default_file_name, '=')
        res_sar = FileOperation.wrap_output_format(cmd_name, sar_result,'-')
        return res_sar
    
    def __get_sar_task2(self):
        cmd_name = 'sar'
        sar_all_command = GlobalParameter().sub_sarall
        sar_all_result = Command.cmd_run(sar_all_command)
        res_sar_all = FileOperation.wrap_output_format(cmd_name, sar_all_result,'=')
        return res_sar_all

    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_sar_info(self, interval, times):
        '''
            sar
        '''
        task1 = CustomizeFunctionThread(self.__get_sar_task1, (interval, times))
        task2 = CustomizeFunctionThread(self.__get_sar_task2)
        task1.start()
        task2.start()        
        task1.join()           
        task2.join()
        
        res_all = task1.get_result() + task2.get_result() # res_sar + res_sar_all
        return Command.cmd_write_file(res_all, self.__default_file_name)

    # getInfo
    def get_info(self):
        self.__get_cpu_info()
        self.__get_top_info(self.__interval, self.__times)
        
        #多线程执行命令，间隔self.__interval秒，运行self.__times次
        #必须放在一起，保证命令启动时间一致
        self.__get_pid_cpustat_info()
        self.__get_mpstat_info(self.__interval, self.__times)
        self.__get_sar_info(self.__interval, self.__times)
        self.__get_numastat_info()
