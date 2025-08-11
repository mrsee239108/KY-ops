'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 10:01:23 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*- 
# cython:language_level=3

import sys
from .config import Config
from .decorator_wrap import DecoratorWrap
from .global_call import GlobalCall

@DecoratorWrap.singleton
class GlobalParameter:
    def __init__(self):
        if not sys.version_info[0] >= 3:
            default_disk_dev = ''.encode('utf-8')
        else:
            default_disk_dev = ''
            
        # *-----------------------get cpu info-------------------
        # 默认时间间隔为1s
        self.g_cpu_interval = GlobalCall.get_json_value("Getting.Common.CPU.interval", 1, Config.get_json_dict())
        # 默认执行5次
        self.g_cpu_times = GlobalCall.get_json_value("Getting.Common.CPU.times", 5, Config.get_json_dict())
        # 默认执行15秒,perf stat专用参数
        self.g_perf_stat_duration = GlobalCall.get_json_value("Getting.Common.CPU.duration", 15, Config.get_json_dict())

        # *-----------------------get memory info-------------------
        # 默认时间间隔为1s
        self.g_mem_interval = GlobalCall.get_json_value("Getting.Common.Memory.interval", 1, Config.get_json_dict())
        # 默认执行5次
        self.g_mem_times    = GlobalCall.get_json_value("Getting.Common.Memory.times"   , 5, Config.get_json_dict())

        # *-----------------------get disk info-------------------
        # 默认时间间隔为1s
        self.g_disk_interval = GlobalCall.get_json_value("Getting.Common.Disk.interval", 1, Config.get_json_dict())
        
        # 默认执行5次
        self.g_disk_times = GlobalCall.get_json_value("Getting.Common.Disk.times"          , 5, Config.get_json_dict())

        #默认不采集blktrace
        self.g_disk_bt_enable = GlobalCall.get_json_value("Getting.Common.Disk.enable_blktrace", 0)
        
        #blktrace默认采集时长为10s
        self.g_disk_bt_intval = GlobalCall.get_json_value("Getting.Common.Disk.seconds"        , 10)

        #blktrace采集dev块名，多个dev块使用‘，’分隔
        self.g_disk_bt_devlst = GlobalCall.get_json_value("Getting.Common.Disk.dev"            , default_disk_dev, Config.get_json_dict())

        # *-----------------------get net info-------------------
        # 默认时间间隔为1s
        self.g_net_interval = GlobalCall.get_json_value("Getting.Common.Net.interval", 1, Config.get_json_dict())
        # 默认执行5次
        self.g_net_times    = GlobalCall.get_json_value("Getting.Common.Net.times", 5, Config.get_json_dict())

        # *-----------------------get jvm info-------------------
        # 默认pid为1
        self.g_jvm_pid      = GlobalCall.get_json_value("Getting.Application.JVM.pid"     , 1, Config.get_json_dict())
        # 默认不采集jvm
        self.g_jvm_enable   = GlobalCall.get_json_value("Getting.Application.JVM.enable"  , 0, Config.get_json_dict())
        # 默认时间间隔为1000ms
        self.g_jvm_interval = GlobalCall.get_json_value("Getting.Application.JVM.interval", 1000, Config.get_json_dict()) # (milliseconds)
        # 默认执行0次
        self.g_jvm_times    = GlobalCall.get_json_value("Getting.Application.JVM.times"   , 0, Config.get_json_dict())

        # *-----------------------get sar info-------------------
        # 默认时间间隔为2s
        self.g_subsar_interval = GlobalCall.get_json_value("Getting.Common.subSar.interval", 2, Config.get_json_dict())
        # 默认执行5次
        self.g_subsar_times = GlobalCall.get_json_value("Getting.Common.subSar.times", 5, Config.get_json_dict())

        # *-----------------------get pidstat info-------------------
        # 默认时间间隔为2s
        self.g_pidstat_interval = GlobalCall.get_json_value("Getting.Common.CPU.interval", 1, Config.get_json_dict())
        # 默认执行5次
        self.g_pidstat_times = GlobalCall.get_json_value("Getting.Common.CPU.times", 1, Config.get_json_dict())
        

        # 定义sub_sarall cmd
        self.sub_sarall = "sar -u ALL -P ALL -q -r -B -W -d -p -n DEV -n EDEV {} {}".format(self.get_subsar_interval(), self.get_subsar_times())
        # 定义pidstat_cmd
        self.pidstat_cmd = "pidstat -w {} {}".format(self.get_pidstat_interval(), self.get_pidstat_times())

     # -------------------cpu parameters----------------------- 
    def get_cpu_interval(self):
        return self.g_cpu_interval
    
    def get_cpu_times(self):
        return self.g_cpu_times

    def get_perf_stat_duration(self):
        return self.g_perf_stat_duration
    
    # -------------------memory parameters----------------------- 
    def get_mem_interval(self):
        return self.g_mem_interval
    
    def get_mem_times(self):
        return self.g_mem_times

   # -------------------disk parameters----------------------- 
    def get_disk_interval(self):
        return self.g_disk_interval
    
    def get_disk_times(self):
        return self.g_disk_times
    
    def get_disk_bt_enable(self):
        return self.g_disk_bt_enable
    
    def get_disk_bt_intval(self):
        return self.g_disk_bt_intval
    
    def get_disk_bt_devlst(self):
        return self.g_disk_bt_devlst

    # -------------------net parameters----------------------- 
    def get_net_interval(self):
        return self.g_net_interval
    
    def get_net_times(self):
        return self.g_net_times

    # -------------------jvm parameters-----------------------
    def get_jvm_pid(self):
        return self.g_jvm_pid

    def get_jvm_enable(self):
        return self.g_jvm_enable

    def get_jvm_interval(self):
        return self.g_jvm_interval

    def get_jvm_times(self):
        return self.g_jvm_times

    # -------------------sar parameters-----------------------
    def get_subsar_interval(self):
        return self.g_subsar_interval
    
    def get_subsar_times(self):
        return self.g_subsar_times
    
    # -------------------pidstat parameters-----------------------
    def get_pidstat_interval(self):
        return self.g_pidstat_interval

    def get_pidstat_times(self):
        return self.g_pidstat_times

