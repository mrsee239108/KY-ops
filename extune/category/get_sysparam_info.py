'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: lixiaoyong1 <lixiaoyong@kylinos.cn>
  Date: Fri Mar 22 14:21:39 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3
try:
    from common.file import FileOperation
    from common.command import Command
    from common.log import Logger
except:
    from ..common.file import FileOperation
    from ..common.command import Command
    from ..common.log import Logger

class SysParamInfo:
    '''
        System parameter class
    '''
    def __init__(self, t_fileName):
        self.__default_file_name = t_fileName
        try:
            FileOperation.remove_txt_file(self.__default_file_name)
        except Exception as e:
            Logger().error(f"Failed to remove file {self.__default_file_name}: {e}")

    def __get_sys_param_info(self):
        '''
            get current system parameters
        '''
        sysparam_command = "sysctl -a"
        cmd_name = sysparam_command
        cmd_result = Command.cmd_run(sysparam_command)
        return Command.cmd_output(cmd_name, cmd_result, self.__default_file_name, '=')

    def __get_boot_param_info(self):
        '''
            Get startup parameters
        '''
        bootparam_command = "cat /proc/cmdline"
        cmd_name = "cmdline"
        cmd_result = Command.cmd_run(bootparam_command)
        res_cmd = FileOperation.wrap_output_format(cmd_name, cmd_result, '-')

        kernel_command = "grubby --info=ALL | grep ^kernel"
        ker_result = Command.cmd_run(kernel_command)
        res_gk = FileOperation.wrap_output_format(cmd_name, ker_result, '-')

        default_kernel_command = "grubby --default-kernel"
        cmd_result = Command.cmd_run(default_kernel_command)
        res_gdk = FileOperation.wrap_output_format(cmd_name, cmd_result, '-')

        kernel_title_cmd = "grubby --default-title"
        cmd_result = Command.cmd_run(kernel_title_cmd)
        res_gdt = FileOperation.wrap_output_format(cmd_name, cmd_result, '=')

        res_all = res_cmd + res_gk + res_gdk + res_gdt
        return Command.cmd_write_file(res_all, self.__default_file_name)

    def __get_kernel_info(self):
        '''
            get installed kernels
        '''
        kernel_command = "grubby --info=ALL | grep ^kernel"
        ker_result = Command.cmd_run(kernel_command)
        return Command.cmd_output("grubby", ker_result, self.__default_file_name, '-') 
        
    def __get_default_kernel_info(self):
        '''
            Get the default boot kernel
        '''
        default_kernel_command = "grubby --default-kernel"
        cmd_result = Command.cmd_run(default_kernel_command)
        return Command.cmd_output("grubby", cmd_result, self.__default_file_name, '-')


    def __get_kernel_title_info(self):
        '''
            Get the header information of the default boot kernel
        '''
        kernel_title_cmd = "grubby --default-title"
        cmd_result = Command.cmd_run(kernel_title_cmd)
        return Command.cmd_output("grubby", cmd_result, self.__default_file_name, '=')

    def __get_ulimit_info(self):
        '''
            Get resource Limit Information
        '''
        ulimit_cmd = "ulimit -a"
        cmd_name = 'ulimit'
        cmd_result = Command.cmd_run(ulimit_cmd)
        return Command.cmd_output(cmd_name, cmd_result, self.__default_file_name, '=')

    # getInfo
    def get_info(self):
        self.__get_sys_param_info()
        self.__get_boot_param_info()
        # self.__get_kernel_info()
        # self.__get_default_kernel_info()
        # self.__get_kernel_title_info()
        self.__get_ulimit_info()

