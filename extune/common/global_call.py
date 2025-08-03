'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 09:52:53 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3


import sys
from .threadpool import ThreadPool
from .config import Config
from .log import Logger


class GlobalCall:
    # global thread pool object
    real_time_cpu_data = [] # object to store real-time cpu data

    monitor_info_thread_pool = ThreadPool()
    output_cpu_file = "CPUInfo.txt"
    output_net_file = "netInfo.txt"
    output_disk_file = "diskInfo.txt"
    output_jvm_file = "jvmInfo.txt"
    output_mem_file = "memInfo.txt"
    output_sys_message_file = "systemMessage.txt"
    output_sys_param_file = "sysParamInfo.txt"
    output_hotspot_file = "hotspotInfo.txt"
    output_custom_file = "custom.txt"

    @staticmethod
    def get_str_v(k , default ):
        cfg = Config.get_json_dict()
        arr = k.strip().split('.')

        while 1 < len(arr):
            if  arr[0] not in cfg:
                return False, default

            cfg = cfg[arr[0]]
            arr.remove(arr[0])

        if arr[0] in cfg:
            return True, str(cfg[arr[0]])
        else:
            return False, default

    @staticmethod
    def get_str(k , default ):
        cfg = Config.get_json_dict()
        arr = k.strip().split('.')

        while 1 < len(arr):
            if arr[0] not in cfg:
                return default

            cfg = cfg[arr[0]]
            arr.remove(arr[0])

        if arr[0] in cfg:
            return str(cfg[arr[0]])
        else:
            return default

    @staticmethod
    def get_int(k , default ):
        cfg = Config.get_json_dict()
        arr = k.strip().split('.')

        while 1 < len(arr):
            if arr[0] not in cfg:
                return default

            cfg = cfg[arr[0]]
            arr.remove(arr[0])

        if arr[0] in cfg:
            return int(cfg[arr[0]])
        else:
            return default

    @staticmethod
    def get_bool(k , default):
        cfg = Config.get_json_dict()
        arr = k.strip().split('.')

        while 1 < len(arr):
            if arr[0] not in cfg:
                return default

            cfg = cfg[arr[0]]
            arr.remove(arr[0])

        if arr[0] in cfg:
            return bool(cfg[arr[0]])
        else:
            return default

    @staticmethod
    def get_json_value(k , default, cfg = Config.get_json_dict()):
        '''
        获取conf文件中key对应value
        k: key
        default: 默认值
        '''
        # cfg = Config.get_json_dict()
        # 当查询字典为空返回默认值
        if not cfg:
            return default
        
        arr = k.strip().split('.')

        while 1 < len(arr):
            if not arr[0] in cfg:
                return default

            cfg = cfg[arr[0]]
            arr.remove(arr[0])

        if arr[0] in cfg:
            value = cfg[arr[0]]
            if (not sys.version_info[0] >= 3) and isinstance(value, unicode):
                value = value.encode('utf-8')
                
            if not isinstance(value, type(default)):
                # value =  type(default)(value)
                errMsg = "配置文件数据格式输入异常：{} : [{}],请修改后重试".format(k, value)
                Logger().error("{} 。异常类型为: {} 目标类型为: {}".format(errMsg, type(value), type(default)))
        
                if not sys.version_info[0] >= 3:
                    raise ValueError(unicode(errMsg,'utf-8'))
                else:
                    raise ValueError(errMsg)
                
            if not sys.version_info[0] >= 3:
                tup_types = (int, long, float)
            else:
                tup_types = (int, float)
                
            if isinstance(value, tup_types):
                # 异常：1.配置文件数字为负数 2.interval或times设置为0
                if value < 0 or (('interval' in k or 'times' in k or 'seconds' in k )and value == 0):
                    errMsg = "配置文件数值输入异常：{} : [{}],请修改后重试".format(k, value)
                    Logger().error(errMsg)
                    if not sys.version_info[0] >= 3:
                        raise ValueError(unicode(errMsg,'utf-8'))
                    else:
                        raise ValueError(errMsg)
                # if 'interval' in k and value == 0:
                     
            return value
        else:
            return default

    def __chek_value(k, value):
        error_f = False
        if value < 0 :
            error_f = True
        if (('interval' in k or 'times' in k or 'seconds' in k )and value == 0):
            error_f = True
        return error_f

