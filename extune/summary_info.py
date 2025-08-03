'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Fri Nov 17 09:30:22 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3

from category.get_memory_info import MemInfo
from category.get_net_info import NetInfo
from category.get_cpu_info import CPUInfo
from category.get_disk_info import DiskInfo
from category.get_sysparam_info import SysParamInfo 
from category.get_system_message import SysMessage
from common.config import Config
from common.log import Logger
from common.global_call import GlobalCall


# Access to information for external use
class SummaryInfo:
    @staticmethod
    def init(out_path , work_path , inst_path ):
        '''
            initialization, must be called first
        '''
        Config.init_config(out_path, work_path, inst_path)
        # Specify debug mode
        # Logger().on_debug_type()

    @staticmethod
    def get_info():
        '''
            A function that collects all information, called externally
        '''

        if GlobalCall.get_json_value('Getting.Common.enable', 1) == 1:
            MemInfo(GlobalCall.output_mem_file).get_info()
            Logger().info(u"内存数据采集完成")

            if not NetInfo(GlobalCall.output_net_file).get_info():
                Logger().error("Failed to obtain network status due to an error in obtaining network card information !") 
            Logger().info(u"网络数据采集完成")
            
            CPUInfo(GlobalCall.output_cpu_file).get_info()
            Logger().info(u"CPU数据采集完成")

            DiskInfo(GlobalCall.output_disk_file).get_info()
            Logger().info(u"磁盘数据采集完成")

            SysParamInfo(GlobalCall.output_sys_param_file).get_info()
            Logger().info(u"系统参数采集完成")        

            SysMessage(GlobalCall.output_sys_message_file).get_info()
            Logger().info(u"系统日志采集完成")
            
            return True
        else:
            Logger().warning("配置文件中关闭数据获取功能, Getting.Common.enable = {}".format(GlobalCall.get_json_value('Getting.Common.enable', 1)))
            return False

    @staticmethod
    def get_info():
        '''采集所有信息并启动实时监控'''
        # 原有的静态数据采集
        if GlobalCall.get_json_value('Getting.Common.enable', 1) == 1:
            # ... 原有采集代码 ...

            # 启动CPU实时监控
            cpu_monitor = CPUInfo(GlobalCall.output_cpu_file)
            cpu_monitor.start_broadcasting()
            Logger().info(u"CPU实时监控已启动")

            return True
        else:
            Logger().warning("配置文件中关闭数据获取功能")
            return False
