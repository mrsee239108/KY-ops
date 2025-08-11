'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Wed Aug 14 00:05:21 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3
# Copyright (c) 2023 KylinSoft  Co., Ltd. All Rights Reserved.

import os
import time
import shutil
import json5
from common.log import Logger
from common.config import Config
from common.command import Command
from common.global_parameter import GlobalParameter
from kyreport.ky_data_collection import DATACOLLECTION

class KyReport:
    @classmethod
    def ky_build(self, tm):
        curr_time = time.strftime("%m%d%H%M")
        srcfile   = Config.get_inst_path()   + 'kyreport/extuner_report.html'
        outfile   = Config.get_output_path() + 'extuner_report_' + curr_time + '.html'
        info      = {
                'tm_info'  : { 'start': '', 'stop': '' },
                'base_info': {
                    'hostname'      : '',
                    'system_version': '',
                    'kernel_version': '',
                    'gcc_version'   : '',
                    'glibc_version' : '',
                    'jdk_version'   : '',
                    'net_sum'       : [],
                    'disk_sum'      : [],
                    'cpu_model'     : '',
                    'cpu_arch'      : '',
                    'cpu_cores'     : '',
                    'cpu_maxfreq'   : '',
                    'cpu_minfreq'   : '',
                    'mem_total'     : '',
                    'mem_free'      : '',
                    'mem_available' : ''
                },
                'cpu_info' : [],
                'mem_info' : [],
                'net_info' : [],
                'io_info'  : [],
                'synthesis_info'  : [],
                'jvm_info' : [],
                'sys_param': [],
                'sys_msg'  : [],
                'hotspot_info': [],
            }

        # setting timer info
        info['tm_info']['start'] = tm['start']
        info['tm_info']['stop']  = tm['stop']
        # end timer info

        # setting base info
        info['base_info']['hostname']         = Command.cmd_exec(r'hostname')
        info['base_info']['system_version']   = Command.cmd_exec(r'cat /etc/.productinfo | grep release')
        info['base_info']['kernel_version']   = Command.cmd_exec(r'uname -r')
        info['base_info']['gcc_version']      = Command.cmd_exec(r'gcc --version | head -n 1')
        info['base_info']['glibc_version']    = Command.cmd_exec(r'getconf GNU_LIBC_VERSION') # ldd --version | head -n 1
        info['base_info']['jdk_version']      = Command.cmd_exec(r'java -version 2>&1 | head -n 1')
        info['base_info']['net_sum']          = self.build_netsum()
        info['base_info']['disk_sum']         = self.build_disksum()
        # end base info

        # setting base cpu info
        info['base_info']['cpu_model']        = Command.cmd_exec('export LANG="en_US.UTF-8" && lscpu | grep \'^Model name:\' | cut -d \':\' -f 2 | sed -e \'s/^[ ]*//g\' | sed -e \'s/[ ]*$//g\'')
        info['base_info']['cpu_arch']         = Command.cmd_exec('export LANG="en_US.UTF-8" && lscpu | grep \'Architecture:\' | cut -d \':\' -f 2 | sed -e \'s/^[ ]*//g\' | sed -e \'s/[ ]*$//g\'')
        info['base_info']['cpu_cores']        = Command.cmd_exec('export LANG="en_US.UTF-8" && lscpu | grep \'CPU(s)\' | grep -v -E "NUMA|On-line" | cut -d \':\' -f 2 | sed -e \'s/^[ ]*//g\' | sed -e \'s/[ ]*$//g\'')
        info['base_info']['cpu_maxfreq']      = Command.cmd_exec('export LANG="en_US.UTF-8" && lscpu | grep \'CPU max MHz\' | cut -d \':\' -f 2 | sed -e \'s/^[ ]*//g\' | sed -e \'s/[ ]*$//g\'')
        info['base_info']['cpu_minfreq']      = Command.cmd_exec('export LANG="en_US.UTF-8" && lscpu | grep \'CPU min MHz\' | cut -d \':\' -f 2 | sed -e \'s/^[ ]*//g\' | sed -e \'s/[ ]*$//g\'')
        # end base cpu info

        # setting base mem info
        info['base_info']['mem_total']        = Command.cmd_exec('cat /proc/meminfo | grep "MemTotal" | cut -d \':\' -f 2 | sed -e "s/^[ ]*//g" | cut -d \' \' -f 1')
        info['base_info']['mem_free']         = Command.cmd_exec('cat /proc/meminfo | grep "MemFree" | cut -d \':\' -f 2 | sed -e "s/^[ ]*//g" | cut -d \' \' -f 1')
        info['base_info']['mem_available']    = Command.cmd_exec('cat /proc/meminfo | grep "MemAvailable" | cut -d \':\' -f 2 | sed -e "s/^[ ]*//g" | cut -d \' \' -f 1')
        # end base mem info

        # setting menu info
        if os.path.exists(Config.get_output_path() + 'CPUInfo.txt'):
            info['cpu_info']  = DATACOLLECTION().get_cpu_tag_data()
        if os.path.exists(Config.get_output_path() + 'memInfo.txt'):
            info['mem_info']  = self.build_info(Config.get_output_path() + 'memInfo.txt')
        if os.path.exists(Config.get_output_path() + 'netInfo.txt'):
            info['net_info']  = self.build_info(Config.get_output_path() + 'netInfo.txt')
        if os.path.exists(Config.get_output_path() + 'diskInfo.txt'):
            info['io_info']   = self.build_info(Config.get_output_path() + 'diskInfo.txt')
        # ending menu info


        content  = """
<script type="text/javascript">
var info = %s

window.onload = init();
</script>
"""%(json5.dumps(info))
        shutil.copyfile(srcfile, outfile)
        with open(outfile, 'a') as fp:
            fp.write(content)

        Logger().info(u'采集报告输出路径: {}'.format(outfile))
        
        # 生成txt格式的系统信息文件
        self.generate_info_txt(info)

    @classmethod
    def generate_info_txt(self, info):
        """生成txt格式的系统信息文件"""
        try:
            info_file = Config.get_inst_path() + 'info.txt'
            
            with open(info_file, 'w', encoding='utf-8') as f:
                f.write("=== 系统基本信息 ===\n")
                f.write(f"主机名: {info['base_info']['hostname']}\n")
                f.write(f"系统版本: {info['base_info']['system_version']}\n")
                f.write(f"内核版本: {info['base_info']['kernel_version']}\n")
                f.write(f"GCC版本: {info['base_info']['gcc_version']}\n")
                f.write(f"Glibc版本: {info['base_info']['glibc_version']}\n")
                f.write(f"JDK版本: {info['base_info']['jdk_version']}\n")
                f.write("\n")
                
                f.write("=== CPU信息 ===\n")
                f.write(f"CPU型号: {info['base_info']['cpu_model']}\n")
                f.write(f"CPU架构: {info['base_info']['cpu_arch']}\n")
                f.write(f"CPU核心数: {info['base_info']['cpu_cores']}\n")
                f.write(f"CPU最大频率: {info['base_info']['cpu_maxfreq']} MHz\n")
                f.write(f"CPU最小频率: {info['base_info']['cpu_minfreq']} MHz\n")
                f.write("\n")
                
                f.write("=== 内存信息 ===\n")
                f.write(f"总内存: {info['base_info']['mem_total']} KB\n")
                f.write(f"空闲内存: {info['base_info']['mem_free']} KB\n")
                f.write(f"可用内存: {info['base_info']['mem_available']} KB\n")
                f.write("\n")
                
                f.write("=== 网络接口信息 ===\n")
                for net in info['base_info']['net_sum']:
                    f.write(f"接口名: {net['name']}\n")
                    f.write(f"驱动: {net['driver']}\n")
                    f.write(f"版本: {net['version']}\n")
                    f.write(f"固件版本: {net['firmware_version']}\n")
                    f.write(f"链接状态: {net['link_status']}\n")
                    f.write(f"IP地址: {net['addr']}\n")
                    f.write(f"子网掩码: {net['netmask']}\n")
                    f.write("---\n")
                f.write("\n")
                
                f.write("=== 磁盘信息 ===\n")
                for disk in info['base_info']['disk_sum']:
                    f.write(f"磁盘名: {disk['name']}\n")
                    f.write(f"总容量: {disk['total']}\n")
                    f.write(f"序列号: {disk['sn']}\n")
                    f.write("---\n")
                f.write("\n")
                
                f.write("=== 时间信息 ===\n")
                f.write(f"开始时间: {info['tm_info']['start']}\n")
                f.write(f"结束时间: {info['tm_info']['stop']}\n")
            
            Logger().info(u'系统信息txt文件输出路径: {}'.format(info_file))
            
        except Exception as e:
            Logger().error(f'生成info.txt文件失败: {e}')

    @staticmethod
    def build_netsum():
        net_list = []
        str_comm = 'ethtool -i '
        ifc_text = Command.cmd_exec('nmcli device status | awk \'{i++; if(i>1 && "--"!=$4) {print $1}}\'')
        ifc_name = ifc_text.split('\n', -1)
        for ifc in ifc_name:
            if 0 != len(ifc.strip()) and  '--' != ifc:
                net_obj = { 'name': '', 'driver': '', 'version': '', 'firmware_version': '', 'link_status': '' }
                net_obj['name']             = ifc
                net_obj['driver']           = Command.cmd_exec(str_comm + ifc + ' | grep driver | cut -d \' \' -f 2')
                net_obj['version']          = Command.cmd_exec(str_comm + ifc + ' | grep version | grep -v -E \'firmware-version|expansion-rom-version\' | cut -d \' \' -f 2')
                net_obj['firmware_version'] = Command.cmd_exec(str_comm + ifc + ' | grep firmware-version | cut -d \' \' -f 2')
                net_obj['link_status']      = Command.cmd_exec('ethtool ' + ifc + ' | grep \'Link detected\' | cut -d \' \' -f 3')
                net_obj['addr']             = Command.cmd_exec('ifconfig ' + ifc + ' | grep "inet " | awk \'{print $2}\' ').strip()
                net_obj['netmask']          = Command.cmd_exec('ifconfig ' + ifc + ' | grep "inet " | awk \'{print $4}\' ').strip()

                net_list.append(net_obj)
        return net_list

    @staticmethod
    def build_disksum():
        disk_list = []
        disk_text = Command.cmd_exec('lsblk -rdn -o NAME,SIZE,TYPE | grep disk')
        disk_line = disk_text.split('\n', -1)
        for line in disk_line:
            if 0 != len(line.strip()):
                disk_obj   = { 'name': '', 'total': '', 'sn': '' }
                disk_items = line.split(' ')
                if 3 <= len(disk_items):
                    disk_obj['name']  = disk_items[0]
                    disk_obj['total'] = disk_items[1]
                    disk_obj['sn']    = Command.cmd_exec('fdisk -l /dev/{} | grep "Disk model" | cut -d ":" -f 2 | sed -e "s/^[ ]*//g" | sed -e "s/[ ]*$//g"'.format(disk_items[0])).strip()

                disk_list.append(disk_obj)
        return disk_list

    @staticmethod
    def build_info(fname  = ''):
        try:
            flg_cmd = '=========================kylin========================='
            flg_sub = '-------------------------kylin-------------------------'
            ret_arr = []

            if not os.path.exists(fname):
                Logger().warning("Report file not found: {}".format(fname))
                return ret_arr

            with open(file = fname, mode = 'r', encoding = 'utf-8') as fp:
                txt = fp.read()
                cmd_grp = txt.strip()[:-len(flg_cmd)].split(flg_cmd)
                for grp in cmd_grp:
                    grp_obj = { 'group': '', 'sub': [] }
                    cmd_sub = grp.strip().split(flg_sub)
                    for sub in cmd_sub:
                        sub_obj = { 'cmd': '', 'res': '' }
                        sub_arr = sub.strip().split('\n', 2)
                        if 3 == len(sub_arr):
                            sub_g = sub_arr[0].split('Command: ')[1]
                            sub_s = sub_arr[1].split('SubCommand: ')[1]
                            sub_c = sub_arr[2]

                            sub_obj['cmd'] = sub_s
                            sub_obj['res'] = sub_c

                            grp_obj['group'] = sub_g
                            grp_obj['sub'].append(sub_obj)

                    if 0 < len(grp_obj['group']) and 0 < len(grp_obj['sub']):
                        ret_arr.append(grp_obj)

            return ret_arr
        except Exception as err:
            Logger().error('Failed parse file "{}": {}'.format(fname, err))

