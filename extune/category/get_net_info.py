'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: 李璐 <lilu@kylinos.cn>
  Date: Tue Feb 27 11:40:58 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3
#!coding=utf-8

import os
import struct
import sys
try:
    from common.customizefunctionthread import CustomizeFunctionThread
except:
    from ..common.customizefunctionthread import CustomizeFunctionThread

if sys.getdefaultencoding() != 'utf-8':
    reload(sys)
    sys.setdefaultencoding('utf-8')
try:
    from common.decorator_wrap import DecoratorWrap
    from common.file import FileOperation
    from common.global_parameter import GlobalParameter
    from common.log import Logger
    from common.command import Command
    from common.global_call import GlobalCall
except:
    from ..common.decorator_wrap import DecoratorWrap
    from ..common.file import FileOperation
    from ..common.global_parameter import GlobalParameter
    from ..common.log import Logger
    from ..common.command import Command
    from ..common.global_call import GlobalCall

import threading
import time
import subprocess
import re
import os
import json
import socket


class RealTimeNet:
    def __init__(self, interval=2):
        self.interval = interval
        self._stop_event = threading.Event()
        self.thread = None
        self.data = {
            'net_interface': '',
            'rx_speed': 0.0,  # 下行速度 (KB/s)
            'tx_speed': 0.0,  # 上行速度 (KB/s)
            'net_io': {},      # 网络IO统计信息
            'net_interfaces': {}  # 网络接口详细信息
        }
        # 添加广播功能
        GlobalCall.real_time_net_data = self.data
        # 初始化最后一次统计值
        self.last_stats = {}
        # 状态信息更新计数器
        self.status_counter = 0

    def __get_all_interfaces(self):
        """获取所有网络接口"""
        ifc_all_dir = '/sys/class/net/'
        if not os.path.exists(ifc_all_dir):
            return []
        return os.listdir(ifc_all_dir)

    def __get_interface_stats(self):
        """获取网络接口统计信息（类似psutil）"""
        interfaces = {}

        # 1. 获取网络接口状态
        net_if_stats = {}
        try:
            for iface in self.__get_all_interfaces():
                operstate_path = f'/sys/class/net/{iface}/operstate'
                speed_path = f'/sys/class/net/{iface}/speed'
                mtu_path = f'/sys/class/net/{iface}/mtu'

                is_up = False
                speed = 0
                mtu = 1500

                if os.path.exists(operstate_path):
                    with open(operstate_path, 'r') as f:
                        is_up = 'up' in f.read().strip().lower()

                if os.path.exists(speed_path):
                    try:
                        with open(speed_path, 'r') as f:
                            speed = int(f.read().strip())
                    except:
                        pass

                if os.path.exists(mtu_path):
                    try:
                        with open(mtu_path, 'r') as f:
                            mtu = int(f.read().strip())
                    except:
                        pass

                net_if_stats[iface] = {
                    'is_up': is_up,
                    'speed': speed,
                    'mtu': mtu
                }
        except Exception as e:
            Logger().error(f"Error getting interface stats: {e}")

        # 2. 获取网络接口地址信息
        net_if_addrs = {}
        try:
            for iface in self.__get_all_interfaces():
                addrs = []
                try:
                    # 使用ip命令获取地址信息
                    cmd = f"ip addr show {iface}"
                    result = Command.cmd_run(cmd)

                    # 解析IPv4地址
                    ipv4_match = re.search(r'inet (\d+\.\d+\.\d+\.\d+/\d+)', result)
                    if ipv4_match:
                        ip, prefix = ipv4_match.group(1).split('/')
                        addrs.append({
                            'type': 'IPv4',
                            'address': ip,
                            'netmask': self.prefix_to_netmask(int(prefix)),
                            'prefix': prefix
                        })

                    # 解析IPv6地址
                    ipv6_match = re.search(r'inet6 ([a-f0-9:]+/\d+)', result)
                    if ipv6_match:
                        ip, prefix = ipv6_match.group(1).split('/')
                        addrs.append({
                            'type': 'IPv6',
                            'address': ip,
                            'prefix': prefix
                        })

                    # 解析MAC地址
                    mac_match = re.search(r'link/ether ([\da-f:]+)', result, re.I)
                    if mac_match:
                        addrs.append({
                            'type': 'MAC',
                            'address': mac_match.group(1)
                        })
                except Exception as e:
                    Logger().error(f"Error getting addresses for {iface}: {e}")

                net_if_addrs[iface] = addrs
        except Exception as e:
            Logger().error(f"Error getting interface addresses: {e}")

        # 3. 合并结果
        for iface in self.__get_all_interfaces():
            interfaces[iface] = {
                'stats': net_if_stats.get(iface, {}),
                'addrs': net_if_addrs.get(iface, [])
            }

        return interfaces

    def prefix_to_netmask(self, prefix):
        """将前缀长度转换为子网掩码"""
        mask = (0xffffffff << (32 - prefix)) & 0xffffffff
        return socket.inet_ntoa(struct.pack('>I', mask))

    def __get_active_interface(self):
        """获取活动网卡（参考get_net_info的__get_devices_info）"""
        for iface in self.__get_all_interfaces():
            cmd = f"ethtool {iface} | grep 'Link detected:'"
            result = subprocess.getoutput(cmd)
            if 'yes' in result.lower():
                return iface
        return ""

    def __collect_real_time_data(self):
        """使用/proc/net/dev采集实时网络数据"""
        try:
            # 获取所有接口的当前统计
            current_stats = {}
            try:
                with open('/proc/net/dev', 'r') as f:
                    lines = f.readlines()

                # 跳过前两行标题
                for line in lines[2:]:
                    if ':' not in line:
                        continue

                    # 解析行数据
                    parts = re.split(r'\s+', line.strip())
                    iface = parts[0].rstrip(':')

                    # 提取统计信息
                    rx_bytes = int(parts[1])
                    tx_bytes = int(parts[9])
                    rx_packets = int(parts[2])
                    tx_packets = int(parts[10])
                    rx_errors = int(parts[3])
                    tx_errors = int(parts[11])
                    rx_dropped = int(parts[4])
                    tx_dropped = int(parts[12])

                    current_stats[iface] = {
                        'bytes_sent': tx_bytes,
                        'bytes_recv': rx_bytes,
                        'packets_sent': tx_packets,
                        'packets_recv': rx_packets,
                        'errin': rx_errors,
                        'errout': tx_errors,
                        'dropin': rx_dropped,
                        'dropout': tx_dropped,
                        'timestamp': time.time()
                    }
            except Exception as e:
                Logger().error(f"Error reading /proc/net/dev: {e}")

            # 计算速度（如果存在上一次统计）
            # 初始化总速度和活动接口速度
            total_rx_speed = 0.0
            total_tx_speed = 0.0
            active_rx = 0.0
            active_tx = 0.0
            active_iface = self.__get_active_interface()  # 提前获取活动接口

            if self.last_stats:
                for iface, current in current_stats.items():
                    if iface in self.last_stats:
                        last = self.last_stats[iface]
                        # 修正：使用当前接口的时间差
                        time_diff = current['timestamp'] - last['timestamp']

                        if time_diff > 0:
                            rx_diff = current['bytes_recv'] - last['bytes_recv']
                            tx_diff = current['bytes_sent'] - last['bytes_sent']

                            # 计算当前接口速度 (KB/s)
                            iface_rx = rx_diff / time_diff / 1024
                            iface_tx = tx_diff / time_diff / 1024

                            # 更新总速度
                            total_rx_speed += iface_rx
                            total_tx_speed += iface_tx

                            # 更新活动接口速度
                            if iface == active_iface:
                                active_rx = iface_rx
                                active_tx = iface_tx

                            # 保存到当前统计
                            current['rx_speed'] = iface_rx
                            current['tx_speed'] = iface_tx

            # 更新最后一次统计
            self.last_stats = current_stats

            # 定期更新接口状态信息（每10次循环更新一次）
            if self.status_counter % 10 == 0:
                net_interfaces = self.__get_interface_stats()
                active_iface = self.__get_active_interface()
                self.status_counter = 0
            else:
                net_interfaces = self.data.get('net_interfaces', {})
                active_iface = self.data.get('net_interface', "")

            self.status_counter += 1

            # 更新数据
            self.data = {
                'net_interface': active_iface,
                'rx_speed': active_rx,  # 使用活动接口的RX
                'tx_speed': active_tx,  # 使用活动接口的TX
                'total_rx_speed': total_rx_speed,
                'total_tx_speed': total_tx_speed,
                'net_io': current_stats,
                'net_interfaces': net_interfaces
            }

            # 广播数据
            GlobalCall.real_time_net_data = self.data

        except Exception as e:
            Logger().error(f"Error collecting network data: {e}")

    def start_broadcasting(self):
        """启动广播线程"""
        if self.thread and self.thread.is_alive():
            return

        self._stop_event.clear()
        self.thread = threading.Thread(target=self._broadcast_loop)
        self.thread.daemon = True
        self.thread.start()

    def _broadcast_loop(self):
        """广播循环"""
        # 初始化最后一次统计
        self.__collect_real_time_data()

        while not self._stop_event.is_set():
            self.__collect_real_time_data()
            time.sleep(self.interval)

    def stop_broadcasting(self):
        """停止广播"""
        self._stop_event.set()
        if self.thread:
            self.thread.join(timeout=1)

    def get_current_data(self):
        """获取当前网络数据"""
        return self.data

# net class
@DecoratorWrap.singleton
class NetInfo:
    def __init__(self, t_fileName):
        # network output file
        self.__default_file_name = t_fileName
        # network devices
        #获得所有网卡设备，包括虚拟网卡和物理网卡，格式为：NAME.TYPE
        self.__netdevice = {} 
        #获得已连接网卡设备，格式为：NAME.TYPE
        self.__netdev_act = {} 
        #获得支持ring buffer 的已连接网卡设备
        self.__netdev_ring = [] #
        #网卡连接状态信息
        self.__link_status = {}
        FileOperation.remove_txt_file(self.__default_file_name)
        # 默认时间间隔为1s
        self.__interval = GlobalParameter().get_net_interval()
        # 默认执行5次
        self.__times    = GlobalParameter().get_net_times()

    def __get_devices(self):
        '''
            Get all network card names
        '''

        ifc_all_dir  = '/sys/class/net/'
        ifc_virt_dir = '/sys/devices/virtual/net/'
        ifc_all  = list()
        ifc_virt = list()
        self.__netdevice  = dict()
        self.__netdev_act = dict()

        if not os.path.exists(ifc_all_dir):
            Logger().error("Unable to get all interface info, directory {} not exists: ".format(ifc_all_dir))
            return False
        elif not os.path.exists(ifc_virt_dir):
            Logger().error("Unable to get virtual interface info, directory {} not exists: ".format(ifc_virt_dir))
            return False
        
        
        ifc_all = os.listdir(ifc_all_dir)
        ifc_virt = os.listdir(ifc_virt_dir)

        for ifc in ifc_all:
            # 跳过虚拟网卡
            if ifc in ifc_virt:
                continue

            self.__netdevice[ifc]  = 'ethernet'
            
            cmd = "ethtool {} | grep 'Link detected:' | cut -d ' ' -f 3".format(ifc)
            res = Command.cmd_run(cmd)
            if 'yes' in res.strip().lower():
                self.__netdev_act[ifc] = 'ethernet'
        
        return True
    
    def __get_devices_info(self):
        '''
            nmcli con show and ethtool
        '''
        cmd_name = "nmcli con show"
        res_list  = []
        res_e  = []
        res = ''
        
        devices_command="nmcli con show"
        cmd_result = Command.cmd_run(devices_command)
        res_list.append(cmd_result)
        
        for i, device in enumerate(self.__netdevice):
            type = self.__netdevice[device] 
            if type in ['bridge', 'ethernet']:
                cmd_result = Command.cmd_run('ethtool -i ' + device)
                res_list.append(cmd_result)

                cmd_result = Command.cmd_run('ethtool ' + device)
                for sent in reversed(cmd_result.split('\n')):
                    if 'Link detected' in sent:
                        status = sent.split(':',1)[1].strip()
                        self.__link_status[device] = status
                        break
                res_e.append(cmd_result)

        #wrap result 
        res_list += res_e
        for i,cmd_result in enumerate(res_list):
            split = '=' if i == len(res_list)-1 else '-'
            res += FileOperation.wrap_output_format(cmd_name, cmd_result, split)
        return Command.cmd_write_file(res, self.__default_file_name)
    
    def __get_eth_off_info(self):
        '''
            get net offload information
        '''
        cmd_name = "ethtool"
        res = ''
        res_list  = []
        
        for i, device in enumerate(self.__netdevice):
            ntype = self.__netdevice[device]
            if ntype == 'ethernet' and self.__link_status[device] == 'yes':
                cmd_result = Command.cmd_run("ethtool -k " + device)
                res_list.append(cmd_result)
                cmd_result = Command.cmd_run("ethtool -c " + device) 
                res_list.append(cmd_result)
                cmd_result = Command.cmd_run("ethtool -g " + device) 
                if len(cmd_result) != 0 :
                    if device in self.__netdev_act.keys():
                        self.__netdev_ring.append(device)
                    res_list.append(cmd_result)
                        
        #wrap result 
        for i,cmd_result in enumerate(res_list):
            split = '=' if i == len(res_list)-1 else '-'
            res += FileOperation.wrap_output_format(cmd_name, cmd_result, split)

        return Command.cmd_write_file(res, self.__default_file_name)
    
    def __multi_threads_get_info(self, funcs, interval, times):
        '''
        Multithreaded fetching information function
        funcs: The name of the function that requires multithreading to start
        '''
        res = ''
        tasks =  []
        for func in funcs:           
            task = CustomizeFunctionThread(func, (interval, times))
            task.start()
            tasks.append(task)
        
        for task in tasks:
            task.join()
            res = res + task.get_result()
        return res
    
    def __get_sar_DEV_task1(self, interval, times):
        sar_command ="sar -n DEV {} {}".format(interval, times)
        cmd_name = 'sar -n DEV'
        sar_result = Command.cmd_run(sar_command)
        res_d = FileOperation.wrap_output_format(cmd_name, sar_result, '-')
        return res_d
    
    def __get_sar_DEV_task2(self, interval, times):
        sar_command ="sar -n EDEV {} {}".format(interval, times)
        cmd_name = 'sar -n DEV'
        sar_result_e = Command.cmd_run(sar_command)
        res_e = FileOperation.wrap_output_format(cmd_name, sar_result_e, '=')
        return res_e
    
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_sar_DEV_info(self, interval, times):
        '''
            sar -n DEV
        '''
        # Multithreading obtains "sar -n DEV" command information
        tasks = [self.__get_sar_DEV_task1, self.__get_sar_DEV_task2]
        res = self.__multi_threads_get_info(tasks, interval, times)
        return Command.cmd_write_file(res, self.__default_file_name)

    def __get_sar_TCP_task1(self, interval, times):
        sar_command ="sar -n TCP {} {}".format(interval, times)
        cmd_name = 'sar -n TCP'
        sar_result = Command.cmd_run(sar_command)
        res_t = FileOperation.wrap_output_format(cmd_name, sar_result, '-')
        return res_t
    
    def __get_sar_TCP_task2(self, interval, times):
        sar_command ="sar -n ETCP {} {}".format(interval, times)
        cmd_name = 'sar -n TCP'
        sar_result_e = Command.cmd_run(sar_command)
        res_e = FileOperation.wrap_output_format(cmd_name, sar_result_e, '=')
        return res_e
    
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def __get_sar_TCP_info(self, interval, times):
        '''
            sar -n TCP
        '''
        # Multithreading obtains "sar -n TCP" command information
        tasks = [self.__get_sar_TCP_task1, self.__get_sar_TCP_task2]
        res = self.__multi_threads_get_info(tasks, interval, times)
        return Command.cmd_write_file(res, self.__default_file_name)
    
    def get_info(self):
        '''
            Get network monitoring information external interface
        '''
        if not self.__get_devices():
            return False
        self.__get_devices_info()
        self.__get_eth_off_info()
        self.__get_sar_DEV_info(self.__interval, self.__times)
        self.__get_sar_TCP_info(self.__interval, self.__times)
        return True
    
    def get_netdevice(self):
        dev_list = self.__netdev_act
        for device in list(dev_list):
            if dev_list[device] == 'bridge':
                dev_list.pop(device)
        return list(dev_list)
    
    def get_netdevice_g(self):
        return self.__netdev_ring
