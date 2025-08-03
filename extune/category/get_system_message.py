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
