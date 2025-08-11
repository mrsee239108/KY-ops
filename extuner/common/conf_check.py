'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: wuzhaomin <wuzhaomin@kylinos.cn>
  Date: Wed Jun 26 14:37:51 2024 +0800
'''
# -*- coding:utf-8 -*-
#!/usr/bin/env python
# cython:language_level=3
from .command import Command
import subprocess,shlex

class ConfCheck:
    def pid(process):
        '''
            check pid exist or not, return pid or null
        '''
        get_pid_cmd = "ps -ef | grep {} | grep -v grep | awk '{{print $2}}'".format(process)
        pid_list = Command.cmd_run(get_pid_cmd).split("\n")
        pid_list.pop(0)
        pid_list.pop(-1)
        if len(pid_list) != 0:
            return pid_list[0]
        else:
            return ''

    def pid_list(process):
        '''
            check process exist or not, return pid_list or null
        '''
        get_pid_cmd = "ps -ef | grep {} | grep -v grep | awk '{{print $2}}'".format(process)
        p_list = Command.cmd_run(get_pid_cmd).split("\n")
        p_list.pop(0)
        p_list.pop(-1)
        return p_list

    @staticmethod
    def f_exists(file  = ''):
        if file == '':
            return False
        devnull = open("/dev/null", "w")
        ret = subprocess.Popen(shlex('test -e ' + file), stdout = devnull, stderr = devnull)
        ret.communicate()
        devnull.close()
        if 0 == ret.returncode:
            return True
        else:
            return False

    @staticmethod
    def strict_pid_list(process):
        '''
            check process exist or not, return pid_list or null
        '''
        get_pid_cmd = "pgrep -x {}".format(process)
        p_list = Command.cmd_run(get_pid_cmd).split("\n")

        if not p_list:
            return None
        elif len(p_list) == 1 and p_list[0] == '':
            return []
        else:
            p_list.pop(0)
            p_list.pop(-1)
            return p_list
