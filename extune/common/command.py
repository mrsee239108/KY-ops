'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Thu Nov 23 14:47:50 2023 +0800
'''
# -*- coding:utf-8 -*-
#!/usr/bin/env python
# cython:language_level=3

import subprocess
import os
import sys
import time
from .log import Logger
from .file import FileOperation

class Command:
    LANG = 'en_US.UTF-8'
    BASH = "/bin/sh"
    
    @staticmethod
    def call(cmd, caller = ''):
        '''
            Encapsulated CALL function to return abnormal location information
        '''
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode != 0:
            raise Exception("{} : [{}] Failed to execute! Output: {}".format(caller, cmd, result.stderr))

    @staticmethod
    def check_ethtool_cg(cmd_stde):
        if cmd_stde == b"Cannot get device coalesce settings: Operation not supported\n":
            return True
        elif cmd_stde == b"Cannot get device ring settings: Operation not supported\n":
            return True
        else:
            return False

    @staticmethod
    def cmd_check(cmd_stdo, cmd_stde, cmd_returncode, cmd):
        if cmd_returncode and Command.check_ethtool_cg(cmd_stde):
            Logger().warning("{} : {}".format(cmd, cmd_stde.decode('utf8')))
            return False
        elif cmd_returncode:
            if len(cmd_stde) != 0:
                Logger().warning("{}".format(cmd_stde.decode('utf8')))
            # else:
            #     Logger().error("exec command {} failed! ".format(cmd))
            return False
        else:
            return True

    @staticmethod
    def cmd_run(cmd,  caller = ''):
        '''
            Encapsulate the general RUN function, get the result 
            return: cmd + '\n' + cmd结果
        '''
        command_result = ''
        try:
            env_c = os.environ
            env_c['LANG'] = Command.LANG
            
            check_cmd = cmd.split()
            if check_cmd[0] == 'cat' or check_cmd[0] == 'ls':
                if not os.path.exists(check_cmd[1]):
                    Logger().error("{} 不存在, cmd_run 命令 {} 无法执行".format(check_cmd[1], cmd))
                    return command_result
            
            if cmd == "top -b -n 3":
                env = os.environ.copy()  
                env['COLUMNS'] = '132'  # 设置输出宽度为132列  
                ret = subprocess.Popen([Command.BASH, "-c", cmd], stdout = subprocess.PIPE , stderr = subprocess.PIPE, env = env)
            else:
                ret = subprocess.Popen([Command.BASH, "-c", cmd], stdout = subprocess.PIPE , stderr = subprocess.PIPE, env = env_c)
            
            stdout,stderr = ret.communicate()
            if sys.version_info[0] < 3:
                stdout = stdout.replace('\x1b[7l', '')
            if Command.cmd_check(stdout, stderr, ret.returncode, cmd):
                command_result = cmd + '\n'+ stdout.decode('utf8')
                
            return command_result
                       
        except Exception as err:
            Logger().error("001:An exception occurred when executing [{}]: {}".format(cmd, err))
            return command_result

    @staticmethod
    def cmd_exec(cmd,  caller = ''):
        '''
            Encapsulate the general RUN function, get the result 
        '''
        command_result = ''
        try:
            env_c = os.environ
            env_c['LANG'] = Command.LANG
            # 添加文件是否存在判断
            check_cmd = cmd.split()
            if check_cmd[0] == 'cat' or check_cmd[0] == 'ls':
                if "scaling_governor" in check_cmd[1] :
                    if len(os.listdir("/sys/devices/system/cpu/cpufreq/")) == 0:
                        Logger().debug("命令 {} 无法执行, 已经处于性能模式".format(cmd))
                        return command_result
                elif not os.path.exists(check_cmd[1]):
                    Logger().error("{} 不存在，命令 {} 无法执行".format(check_cmd[1], cmd))
                    return command_result
            ret = subprocess.Popen([Command.BASH, "-c", cmd], stdout = subprocess.PIPE , stderr = subprocess.PIPE, env = env_c)
            stdout,stderr = ret.communicate()
            if Command.cmd_check(stdout, stderr, ret.returncode, cmd):
                command_result = stdout.decode('utf8')
            return command_result.strip()
                       
        except Exception as err:
            Logger().error("002:An exception occurred when executing [{}]: {}".format(cmd, err))
            return command_result


    @staticmethod
    def cmd_exec_err(cmd,  caller = ''):
        '''
            Encapsulate the general RUN function, get the result 
        '''
        command_result = ''
        try:
            env_c = os.environ
            env_c['LANG'] = 'en_US.UTF-8'
            # ret = subprocess.run(cmd, shell = True, stdout = subprocess.PIPE , stderr = subprocess.PIPE, env = env_c)
            ret = subprocess.Popen(cmd, shell = True, stdout = subprocess.PIPE , stderr = subprocess.PIPE, env = env_c)
            stdout,stderr = ret.communicate()
            if Command.cmd_check(stdout, stderr, ret.returncode, cmd):
                command_result = stderr.decode('utf8')
            return command_result
                       
        except Exception as err:
            Logger().error("An exception occurred when executing [{}]: {}".format(cmd, err))
            return command_result


    @staticmethod
    def cmd_output(cmd_name, data, file_name, split='=' , caller = ''):
        '''
            Encapsulate the general RUN function, get the result and save the file
        '''
        try:
            #FileOperation.write_txt_file(cmd_name, data, file_name, split)
            #wrap
            out = FileOperation.wrap_output_format(cmd_name, data, split)
                
            FileOperation.write(out, file_name)
            return True
        except Exception as err:
            info = "write file" 
            Logger().error("An exception occurred when executing [{}]: {}".format(info, err))
            return False

    @staticmethod
    def cmd_write_file(data, file_name, caller = ''):
        '''
            write the file
        '''
        try:    
            FileOperation.write(data, file_name)
            return True
        except Exception as err:
            info = "write file" 
            Logger().error("An exception occurred when executing [{}]: {}".format(info, err))
            return False

    @staticmethod
    def cmd_exists(cmd  = ''):
        if len(cmd):
            env_c = os.environ
            env_c['LANG'] = 'en_US.UTF-8'
            cmd = cmd.split(' ')[0]
            devnull = open("/dev/null", "w")
            # ret = subprocess.run('which ' + cmd, shell = True, stdout = subprocess.DEVNULL, stderr = subprocess.DEVNULL, env = env_c)
            ret = subprocess.Popen('which ' + cmd, shell = True, stdout = devnull, stderr = devnull, env = env_c)
            ret.communicate()
            devnull.close()
            if 0 == ret.returncode:
                return True
            else:
                Logger().warning("Command not found: {}".format(cmd))

        return False

    # add for hotspot collection
    @staticmethod
    def private_cmd_run(cmd, flag):
        cmd_result = []
        try:
            env_c = os.environ
            env_c['LANG'] = 'en_US.UTF-8'
            p = subprocess.Popen(cmd, shell = True, stdout = subprocess.PIPE , stderr = subprocess.PIPE, env = env_c)
            #result = p.communicate()
            p.wait()
            time.sleep(0.5)
            if p.returncode:
                if flag:
                    Logger().debug('Error code = %d, stderr = %s' % (p.returncode, p.stderr))
                cmd_result = []
            else:
                cmd_result = p.stdout
            return p.returncode, cmd_result
        except Exception as err:
            if flag:
                Logger().error("An exception occurred when executing [{}]: {}".format(cmd, err))
            else:
                print("An exception occurred when executing [{}]: {}".format(cmd, err))
            return -1,cmd_result

    @staticmethod
    def check_pid_exist(pid, flag):
        check_pid_cmd = "ps -p {}".format(pid)
        ret, res = Command.private_cmd_run(check_pid_cmd, flag)
        if ret:
            return False
        else:
            # 存在
            return True

    @staticmethod
    def check_pid_list(pid_list, flag):
        pid = pid_list.split(',')
        for item in pid:
            if item == '-1' and len(pid) != 1:
                if flag:
                    Logger().error("Pid list contains -1, but length not 1")
                return False
            if item != '-1' and not item.isdigit():
                if flag:
                    Logger().error("Process id should be digit number")
                return False
            if item != '-1':
                return Command.check_pid_exist(item, flag)
        return True
    # end add for hotspot collection
