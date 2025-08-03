'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: wuzhaomin <wuzhaomin@kylinos.cn>
  Date: Tue Feb 27 14:04:12 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3
try:
    from common.file import FileOperation
    from common.command import Command
    from common.global_parameter import GlobalParameter
    from common.config import Config
    from common.log import Logger
    from common.global_call import GlobalCall
except:
    from ..common.file import FileOperation
    from ..common.command import Command
    from ..common.global_parameter import GlobalParameter
    from ..common.config import Config
    from ..common.log import Logger
    from ..common.global_call import GlobalCall

import os

class DiskInfo:
    def __init__(self, t_fileName):
        self.__default_file_name = t_fileName
        self.__bt_devlst = []
        FileOperation.remove_txt_file(self.__default_file_name)
        # 默认时间间隔为1s
        self.__interval  = GlobalParameter().get_disk_interval()
        # 默认执行5次
        self.__times     = GlobalParameter().get_disk_times()
        #默认不采集blktrace
        self.__bt_enable = GlobalParameter().get_disk_bt_enable()
        #blktrace默认采集时长为10s
        self.__bt_intval = GlobalParameter().get_disk_bt_intval()
        #blktrace采集dev块名，多个dev块使用‘，’分隔
        self.__bt_devlst = GlobalParameter().get_disk_bt_devlst()

    def __get_fdisk_info(self):
        '''
            fdisk -l and blkid
        '''
        fdisk_command="fdisk -l"
        cmd_name = fdisk_command 
        cmd_result = Command.cmd_run(fdisk_command)
        res_fdisk = FileOperation.wrap_output_format(cmd_name, cmd_result, '-')
        blkid_command="blkid"
        cmd_result = Command.cmd_run(blkid_command)
        res_blkid = FileOperation.wrap_output_format(cmd_name, cmd_result, '=')
        
        res_all = res_fdisk + res_blkid
        return Command.cmd_write_file(res_all, self.__default_file_name)
    
    def __get_df_h_info(self):
        '''
            exec df -h
        '''
        df_h_command="df -h"
        cmd_result = Command.cmd_run(df_h_command)
        cmd_name = df_h_command
        return Command.cmd_output(cmd_name, cmd_result, self.__default_file_name, '=')
    
    def __get_fstab_info(self):
        '''
            exec cat /etc/fstab
        '''
        fstab_command="cat /etc/fstab"
        cmd_result = Command.cmd_run(fstab_command)
        return Command.cmd_output(fstab_command, cmd_result, self.__default_file_name, '=')
    
    def __get_blkid_info(self):
        '''
            get blkid information
        '''
        blkid_command="blkid"
        cmd_result = Command.cmd_run(blkid_command)
        return Command.cmd_output(blkid_command, cmd_result, self.__default_file_name, '=')
    
    def __get_iostat_info(self, interval, times):
        '''
            get iostat information
        '''
        iostat_command="iostat -xmt {} {}".format(interval, times)
        cmd_result = Command.cmd_run(iostat_command)
        cmd_name = 'iostat'
        return Command.cmd_output(cmd_name, cmd_result, self.__default_file_name, '=')

    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_blktrace_info(self) :
        '''
            get blktrace information in output/blktrace
        '''

        if 1 != int(self.__bt_enable):
            return True

        if not Command.cmd_exists('blktrace'):
            return False

        ret = True
        bt_devlst = self.__bt_devlst.split(',')
        i = 0
        cmd_name = 'blktrace'
        for dev in bt_devlst:
            dev = dev.strip()
            if os.path.exists(dev):
                i = i + 1
                block  = os.path.basename(dev)
                output = "{}blktrace".format(Config.get_output_path())

                cmd = "blktrace -d {} -w {} -D {} -o {}test".format(dev, self.__bt_intval, output, block)
                Command.cmd_run(cmd)

                cmd = "pushd {} >/dev/null && blkparse -i {}test -d {}test.bin && popd 2>&1 >/dev/null".format(output, block, block)
                Command.cmd_run(cmd)

                cmd = "pushd {} >/dev/null && btt -i {}test.bin && popd 2>&1 >/dev/null".format(output, block)
                res = Command.cmd_run(cmd)
                res = "btt -i {}\n".format(block) + res[res.find('\n'):]
                split = '=' if i==len(bt_devlst) else '-' 
                ret &= Command.cmd_output(cmd_name, res, self.__default_file_name, split)

            else:
                Logger().error("blktrace功能异常: 配置文件中设置磁盘[{}]不存在，请修改后重试。".format(dev))
                ret &= False

        return ret

    def get_info(self):
        self.__get_fdisk_info()
        self.__get_df_h_info()
        self.__get_fstab_info()
        # self.__get_blkid_info()
        self.__get_iostat_info(self.__interval, self.__times)
        if self.__bt_enable:
            self.__get_blktrace_info()
