'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: 李璐 <lilu@kylinos.cn>
  Date: Tue Jun 25 18:05:43 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3

from logging import Logger
try:
    from common.conf_check import ConfCheck
    from common.file import FileOperation
    from common.command import Command
    from common.global_call import GlobalCall
    from common.global_parameter import GlobalParameter
except:
    from ..common.conf_check import ConfCheck
    from ..common.file import FileOperation
    from ..common.command import Command
    from ..common.global_call import GlobalCall
    from ..common.global_parameter import GlobalParameter

# jvm class
class JVMInfo:
    def __init__(self, t_fileName):
        # output file
        self.__default_file_name = t_fileName
        FileOperation.remove_txt_file(self.__default_file_name)
        # pid is 1 by default
        self.__pid = GlobalParameter().get_jvm_pid()
        # jvm are not collected by default
        self.__enable = GlobalParameter().get_jvm_enable()
        # The default interval is 1000ms
        self.__interval = GlobalParameter().get_jvm_interval()
        # The default value is 0
        self.__times    = GlobalParameter().get_jvm_times()
        
    @GlobalCall.monitor_info_thread_pool.threaded_pool    
    def __get_heap_usage_info(self):
        '''
            Get the java heap usage
        '''
        devices_command="jmap -heap {}".format(self.__pid)
        cmd_result = Command.cmd_run(devices_command)
        return Command.cmd_output("jmap -heap", cmd_result, self.__default_file_name, '=')
    
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_heap_obj_count_size(self):
        '''
            Get count and size of objects in heap memory 
        '''
        devices_command="jmap -histo {}".format(self.__pid)
        cmd_result = Command.cmd_run(devices_command)
        return Command.cmd_output("jmap -histo", cmd_result, self.__default_file_name, '=')
    
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_jstat_class(self):
        '''
            Get jstat -class pid interval times
        '''
        jstat_class_cmd = "jstat -class {} {} {}".format(self.__pid, self.__interval, self.__times)
        cmd_result = Command.cmd_run(jstat_class_cmd)
        return Command.cmd_output("jstat -class", cmd_result, self.__default_file_name, '=')
    
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_jstat_gc(self):
        '''
            Get jstat -gc pid interval times
        '''
        jstat_gc_cmd = "jstat -gc {} {} {}".format(self.__pid, self.__interval, self.__times)
        cmd_result = Command.cmd_run(jstat_gc_cmd)
        return Command.cmd_output("jstat -gc", cmd_result, self.__default_file_name, '=')

    def get_info(self):
        '''
            Get jvm information external interface
        '''
        if self.__enable == 0:
            Logger().info("JVM is disabled.")
            return True
        
        Logger().info("JVMData......")
        pid = ConfCheck.pid(self.__pid)
        if len(pid) == 0:
            Logger().error("JVM: Please set up correct process")
            return False
        
        if Command.cmd_exists('jmap'):
            self.__get_heap_usage_info()
            self.__get_heap_obj_count_size() 
        
        if Command.cmd_exists('jstat'):  
            self.__get_jstat_class()
            self.__get_jstat_gc()
