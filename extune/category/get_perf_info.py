'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: xiejing <xiejing@kylinos.cn>
  Date: Wed Jun 12 10:38:05 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3

import io
import os
import sys
import base64

try:
    from common.config import Config
    from common.command import Command
    from common.global_call import GlobalCall
    from common.log import Logger
    from common.file import FileOperation
except:
    from ..common.config import Config
    from ..common.command import Command
    from ..common.global_call import GlobalCall
    from ..common.log import Logger
    from ..common.file import FileOperation

import re

# Global Variable - start
COMMUNICATE_TIMEOUT = 600
perf_args = {}           # perf args
offcpu_args = {}         # offcpu args
PERF_ENABLE_TYPE_1 = 1  # perf record / perf report
perf_enable_list = [PERF_ENABLE_TYPE_1]
perf_enable_flag = 0
offcpu_enable_flag = 0
# Global Variable - end


# Common Functions
def convert_str(value):
    if not sys.version_info[0] >= 3:
        return value.encode('utf-8')
    else:
        return value

# 执行perf命令的时候，出现$?为0，但是其实是有error信息产生
def is_errfile_empty(cmdname, err_filename):
    if os.path.getsize(err_filename):
        # 将异常信息记录到日志中
        with io.open(file = err_filename, mode = 'r', encoding = 'utf-8') as fp:
            tmp_txt = fp.read()
            Logger().debug("{} : {} ".format(cmdname, tmp_txt))

        # 对无法生成报告的错误进行处理
        perf_report_error_type1 = 'file has no samples'
        if cmdname == 'perf report':
            if perf_report_error_type1 in tmp_txt:
                # perf report -i perf.data的时候，提示The perf.data file has no samples!
                Logger().debug("{}异常, 文件路径: {}".format(cmdname, err_filename))
                return False
            else:
                # 例如：perf report -i perf.data的时候，
                #       若提示Failed to open /tmp/perf-xxxx.map, continuing without symbols
                #       这时候，其实是可以得到输出的，因此需要返回True
                return True
        else:
            # 暂不处理
            return False
    else:
        if os.path.exists(err_filename):
            os.remove(err_filename)
        return True

def replace_invisible_chars(input_file, output_file, flag):
    if not flag:
        # 制表符和换行符不进行替换
        invisible_chars_pattern = re.compile(r'[\x00-\x08\x0B-\x1F\x7F]')
    else:
        invisible_chars_pattern = re.compile(r'[\x00-\x1F\x7F]')

    with io.open(file = input_file, mode = 'r', encoding = 'utf-8') as fp:
        origin_content = fp.read()

    new_content = invisible_chars_pattern.sub('', origin_content)

    with io.open(file = output_file, mode = 'w', encoding = 'utf-8') as fp:
        fp.write(new_content)

    return True

# Perf Class
class Perf():
    def __set_perf_parameter(self):
        if len(perf_args) == 0:
            self.__enable = GlobalCall.get_json_value("Getting.Application.Perf.enable", 0, Config.get_json_dict())
            self.__pid = GlobalCall.get_json_value("Getting.Application.Perf.pid", convert_str('-1'), Config.get_json_dict())
            self.perf_duration = GlobalCall.get_json_value("Getting.Application.Perf.duration", 15, Config.get_json_dict())
        else:
            self.__enable = int(perf_args['perf_enable_type'])
            self.__pid = convert_str(perf_args['perf_pid'])
            self.perf_duration = int(perf_args['perf_duration'])

        self.freq = 99
        self.perf_data_path = Config.get_output_path()
        self.perf_data_file = '{}{}'.format(self.perf_data_path,'perf.data')
        self.perf_svg_file_0 = '{}{}'.format(self.perf_data_path,'perf_0.svg')
        self.perf_svg_file = '{}{}'.format(self.perf_data_path,'perf.svg')
        self.perf_svg_errfile = '{}{}'.format(self.perf_data_path,'perf_svg_err.tmp')
        self.flamegraph_tool_path = '{}{}/{}/'.format(Config.get_inst_path(), 'third_party', 'FlameGraph')

        # perf report filter by default
        self.perf_report_errfile_default = '{}{}'.format(self.perf_data_path,'perf_report_err.tmp')
        self.perf_report_file_default = '{}{}'.format(self.perf_data_path, 'perf.txt')

        # perf report filter use a same err file to log
        self.perf_report_errfile_filter = '{}{}'.format(self.perf_data_path,'perf_report_err.filter')
        # perf report filter by --no-children --sort comm,dso,symbol
        self.perf_report_file_filter1 = '{}{}'.format(self.perf_data_path, 'perf_1.txt')
        # perf report filter by -sort comm,dso,symbol
        self.perf_report_file_filter2 = '{}{}'.format(self.perf_data_path, 'perf_2.txt')

    def __check_perf_command(self):
        if not Command.cmd_exists('perf'):
            return False
        else:
            return True

    # start add for extuner.conf parser, should consistent with command line parsing
    def __check_perf_enable_value(self):
        if self.__enable != 0 and self.__enable not in perf_enable_list:
            Logger().error("Application.Perf.enable 参数值不可用")
            return False
        else:
            return True

    def __check_perf_pid(self):
        if not Command.check_pid_list(self.__pid, True):
            Logger().error("检查参数 Application.Perf.pid 设置是否正确")
            return False
        else:
            return True

    def __check_perf_duration(self):
        try:
            ival = int(self.perf_duration)
        except ValueError:
            Logger().error("Application.Perf.duration must be an integer")
            return False
        if ival <= 0:
            Logger().error("Application.Perf.duration must be positive and nonzero")
            return False
        if ival > 300:
            Logger().error("Application.Perf.duration not allowed to exceed 300")
            return False
        return True
    
    # end add for extuner.conf parser, should consistent with command line parsing
    def __check_perf_parameter(self):
        if len(perf_args) == 0:
            if not self.__check_perf_enable_value():
                return False
            if not self.__check_perf_pid():
                return False
            if not self.__check_perf_duration():
                return False
        if not self.__check_perf_command():
            return False

        self.perf_object = '{}'.format("sys" if "-1" in self.__pid.split(",") else "app")

        return True

    # perf collect
    def __get_perf_collect(self):
        if self.perf_object == 'sys':
            perf_record_command = 'perf record -a -F {} -g -o {} sleep {}'.format(self.freq, self.perf_data_file, self.perf_duration)
        elif self.perf_object == 'app':
            perf_record_command = "perf record -a -F {} -g -p {} -o {} -- sleep {}".format(self.freq, self.__pid, self.perf_data_file, self.perf_duration)
        else:
            return False
        
        # perf record, perf report ,the default mode
        if self.__enable == PERF_ENABLE_TYPE_1:
            Logger().debug("perf_record_command : {}".format(perf_record_command))
            perf_record_ret, perf_record_res = Command.private_cmd_run(perf_record_command, True)
            # check perf record result
            if perf_record_ret != 0:
                perf_record_warning_info = "Perf采集数据为空,建议检查环境或进程状态是否存在异常"
                # 如果未生成perf.data文件或者产生了空的perf.data文件, 在终端进行显式提示.
                # 比如, perf record采集开始时, 进程已经终止，则命令会执行失败，不会产生数据.
                try:
                    if os.path.getsize(self.perf_data_file) == 0:
                        Logger().warning(perf_record_warning_info)
                        return False
                except FileNotFoundError:
                    Logger().warning(perf_record_warning_info)
                    return False
                except Exception as e:
                    # 记录日志, 继续后续动作, 此处不进行返回
                    Logger().debug("perf.data check: {}".format(e))
            else:
                # perf record命令返回结果为0时,当前不进行检查
                pass

            perf_report_short = 'perf report'

            perf_report_command_filter1 = "perf report -i {} --no-children --sort comm,dso,symbol | awk '/^#/ {{print; next}} /^ *[0-9.]+% / && !/---/ {{print}}' 1> {} 2>> {}" \
                .format(self.perf_data_file, self.perf_report_file_filter1, self.perf_report_errfile_filter)

            perf_report_command_filter2 = "perf report -i {} --sort comm,dso,symbol | awk '/^#/ {{print; next}} /^ *[0-9.]+% / && !/---/ {{print}}' 1> {} 2>> {}" \
                .format(self.perf_data_file, self.perf_report_file_filter2, self.perf_report_errfile_filter)
            perf_report_command_default = "perf report -i {} 1> {} 2>> {}".format(self.perf_data_file, self.perf_report_file_default, self.perf_report_errfile_default)

            Logger().debug("perf_report_command_filter1 : {}".format(perf_report_command_filter1))
            Command.private_cmd_run(perf_report_command_filter1, True)
            Command.private_cmd_run(perf_report_command_filter2, True)

            if is_errfile_empty(perf_report_short, self.perf_report_errfile_filter):
                with io.open(file = self.perf_report_file_filter1, mode = 'r', encoding = 'utf-8') as fp1:
                    perf_txt_filter1 = fp1.read()
                    format_perf_txt_filter1 = "".join(["perf report -i perf.data --no-children --sort comm,dso,symbol", '\n', perf_txt_filter1])
                    if Command.cmd_output("perf report hotfunc", format_perf_txt_filter1, GlobalCall.output_hotspot_file, '-'):
                        with io.open(file = self.perf_report_file_filter2, mode = 'r', encoding = 'utf-8') as fp2:
                                perf_txt_filter2 = fp2.read()
                                format_perf_txt_filter2 = "".join(["perf report -i perf.data --sort comm,dso,symbol", '\n', perf_txt_filter2])
                                if Command.cmd_output("perf report hotfunc", format_perf_txt_filter2, GlobalCall.output_hotspot_file, '='):
                                    pass
                                else:
                                    Command.cmd_output("perf report hotfunc","",GlobalCall.output_hotspot_file, '=')
                                    Logger().debug("write perf report filter2 info error")
                        pass
                    else:
                        Logger().debug("write perf report filter1 info error")
                        pass
            
            Logger().debug("perf_report_command_default : {}".format(perf_report_command_default))
            Command.private_cmd_run(perf_report_command_default, True)

            if is_errfile_empty(perf_report_short, self.perf_report_errfile_default):
                with io.open(file = self.perf_report_file_default, mode = 'r', encoding = 'utf-8') as fp:
                    perf_txt_default = fp.read()
                    format_perf_txt_default = "".join(["perf report -i perf.data", '\n', perf_txt_default])
                    if Command.cmd_output("perf report funcrel", format_perf_txt_default, GlobalCall.output_hotspot_file, '='):
                        return True
                    else:
                        Logger().debug("write perf report default info error")
                        return False
            else:
                # can not generate flamegraph
                return False

        return True

    # perf CPU flamegraph
    def __do_perf_flamegraph(self):
        perf_svg_short = "perf flame svg"
        perf_svg_command = "perf script -i {} | {}stackcollapse-perf.pl --all | {}flamegraph.pl 1> {} 2>> {}"\
                    .format(self.perf_data_file, self.flamegraph_tool_path , self.flamegraph_tool_path, self.perf_svg_file_0, self.perf_svg_errfile)

        Logger().debug(perf_svg_command)
        Command.private_cmd_run(perf_svg_command, True)

        if not is_errfile_empty(perf_svg_short, self.perf_svg_errfile):
            return False

        # 去掉不可见字符, 避免火焰图展示出错.
        # 实际上是perf命令采集热点函数的时候,其结果中函数名显示可能带有不可见字符.已知,该问题在龙芯上会出现.
        if replace_invisible_chars(self.perf_svg_file_0, self.perf_svg_file, False):
            pass
        else:
            Logger().debug("replace_invisible_chars error.")
            return False

        with io.open(file = self.perf_svg_file, mode = 'r', encoding = 'utf-8') as fp:
            perf_svg_content = fp.read()
            base64_perf_svg_content = base64.b64encode(perf_svg_content.encode('utf-8')).decode('utf-8')
            format_perf_svg = "".join([perf_svg_short, '\n', base64_perf_svg_content])
            if Command.cmd_output(perf_svg_short, format_perf_svg, GlobalCall.output_hotspot_file, '='):
                return True
            else:
                Logger().debug("write perf flame svg info error")
                return False

    def __check_and_execute_perf_steps(self):
        try:
            self.__set_perf_parameter()
            if not self.__check_perf_parameter():
                return False
            if not self.__get_perf_collect():
                return False
            self.__do_perf_flamegraph()
        except Exception as e:
            Logger().debug("do perf collect error: {}".format(e))
        return True

    # perf main function
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def do_perf_collect(self):
        Logger().info("Perf数据采集开始")
        self.__check_and_execute_perf_steps()
        Logger().info("Perf数据采集结束")


# OffCPU Class
class OffCPU():
    def __init__(self):
        self.__get_kernel_version()

    def __get_kernel_version(self):
        try:
            self.kernel_version = Command.cmd_exec('cat /proc/version').split()[2]
        except Exception as err:
            Logger().error("Error: {}".format(err))

    def __set_offcpu_parameter(self):
        self.flamegraph_tool_path = '{}{}/{}/'.format(Config.get_inst_path(), 'third_party', 'FlameGraph')
        self.offcputime_tool = '/usr/share/bcc/tools/offcputime'
        self.offcputime_stack_file = '{}{}'.format(Config.get_output_path(),'offcputime.out.stacks')
        self.offcputime_stack_errfile = '{}{}'.format(Config.get_output_path(),'offcputime.out.stacks.err.tmp')
        self.offcputime_svg_file = '{}{}'.format(Config.get_output_path(),'offcputime.out.svg')
        self.offcputime_svg_errfile = '{}{}'.format(Config.get_output_path(),'offcputime.out.svg.err.tmp')

        if len(offcpu_args) == 0:
            self.__enable = GlobalCall.get_json_value("Getting.Application.OffCPU.enable" , 0, Config.get_json_dict())
            self.__pid = GlobalCall.get_json_value("Getting.Application.OffCPU.pid", convert_str(''), Config.get_json_dict())
            self.offcpu_duration = GlobalCall.get_json_value("Getting.Application.OffCPU.duration", 15, Config.get_json_dict())
        else:
            self.__enable = int(offcpu_args['offcpu_enable'])
            self.__pid = convert_str(offcpu_args['offcpu_pid'])
            self.offcpu_duration = int(offcpu_args['offcpu_duration'])

    def __diff_kernel_version(self, dest):
        res = True
        # only compare major and minor part
        iteration_len = 2
        k = self.kernel_version.split(".")
        d = dest.split(".")
        if len(k) < iteration_len or len(d) < iteration_len:
            Logger().error("kernel version used to compare must contain major and minor part.")
            return None
        for i in range(iteration_len):
            if int(k[i]) == int(d[i]):
                res = True
            elif int(k[i]) < int(d[i]):
                res = False
                break
            else:
                res = True
                break
        return res

    def __set_offcpu_parameter(self):
        self.flamegraph_tool_path = '{}{}/{}/'.format(Config.get_inst_path(), 'third_party', 'FlameGraph')
        self.offcputime_tool = '/usr/share/bcc/tools/offcputime'
        self.offcputime_stack_file = '{}{}'.format(Config.get_output_path(),'offcputime.out.stacks')
        
        self.offcputime_stack_errfile = '{}{}'.format(Config.get_output_path(),'offcputime.out.stacks.err.tmp')
        self.offcputime_svg_file = '{}{}'.format(Config.get_output_path(),'offcputime.out.svg')
        self.offcputime_svg_errfile = '{}{}'.format(Config.get_output_path(),'offcputime.out.svg.err.tmp')

        if len(offcpu_args) == 0:
            self.__enable = GlobalCall.get_json_value("Getting.Application.OffCPU.enable" , 0, Config.get_json_dict())
            self.__pid = GlobalCall.get_json_value("Getting.Application.OffCPU.pid", convert_str(''), Config.get_json_dict())
            self.offcpu_duration = GlobalCall.get_json_value("Getting.Application.OffCPU.duration", 15, Config.get_json_dict())
        else:
            self.__enable = int(offcpu_args['offcpu_enable'])
            self.__pid = convert_str(offcpu_args['offcpu_pid'])
            self.offcpu_duration = int(offcpu_args['offcpu_duration'])

    def __check_offcpu_command(self):
        if not Command.cmd_exists(self.offcputime_tool):
            return False
        else:
            return True

    # start add for extuner.conf parser, should consistent with command line parsing
    def __check_offcpu_enable_value(self):
        if self.__enable != 0 and self.__enable != 1:
            Logger().error("Application.OffCPU.enable 参数值不可用")
            return False
        else:
            return True

    def __check_offcpu_pid(self):
        if not (self.__pid.isdigit() and int(self.__pid) > 0):
            Logger().error("检查参数 Application.OffCPU.pid 设置是否正确")
            return False
        if not Command.check_pid_exist(self.__pid, True):
            Logger().error("检查参数 Application.OffCPU.pid 设置是否正确")
            return False
        else:
            return True

    def __check_offcpu_duration(self):
        try:
            ival = int(self.offcpu_duration)
        except ValueError:
            Logger().error("Application.OffCPU.duration must be an integer")
            return False
        if ival <= 0:
            Logger().error("Application.OffCPU.duration must be positive and nonzero")
            return False
        if ival > 60:
            Logger().error("Application.OffCPU.duration not allowed to exceed 60")
            return False
        if ival < 5:
            Logger().error("Application.OffCPU.duration not allowed below 5")
            return False
        return True

    # end add for extuner.conf parser, should consistent with command line parsing
    def __check_offcpu_parameter(self):
        if len(offcpu_args) == 0:
            if not self.__check_offcpu_enable_value():
                return False
            if not self.__check_offcpu_pid():
                return False
            if not self.__check_offcpu_duration():
                return False

        if not self.__check_offcpu_command():
            return False

        return True

    def __offcputime_execute(self):
        offcputime_cmd = '{} -df -p {} {} > {} 2> {}'.format(self.offcputime_tool, self.__pid, \
                self.offcpu_duration, self.offcputime_stack_file, self.offcputime_stack_errfile)

        Logger().debug("offcputime_cmd : {}".format(offcputime_cmd))
        ret1, _ = Command.private_cmd_run(offcputime_cmd, True)

        if ret1:
            Logger().debug("off-cpu采集异常, 请查看日志以分析原因")
            return False
        else:
            if ret1 == 0 and os.path.getsize(self.offcputime_stack_file) == 0:
                Logger().warning("offcputime采集数据为空, 文件路径: {}".format(self.offcputime_stack_file))
                return False

        return True

    def __do_offcputime_flamegraph(self):
        if self.__diff_kernel_version('4.8'):
            if not self.__offcputime_execute():
                return False

            offcputime_svg_short = "offcputime flame svg"
            offcputime_svg_cmd = "{}flamegraph.pl --color=io --title=\"Off-CPU Time Flame Graph\" --countname=us < {} > {} 2>> {}"\
                        .format(self.flamegraph_tool_path, self.offcputime_stack_file, self.offcputime_svg_file, self.offcputime_svg_errfile)

            Logger().debug("offcputime_svg_cmd : {}".format(offcputime_svg_cmd))

            ret2, _ = Command.private_cmd_run(offcputime_svg_cmd, True)
            if ret2 or not is_errfile_empty(offcputime_svg_short, self.offcputime_svg_errfile):
                return False
            else:
                with io.open(file = self.offcputime_svg_file, mode = 'r', encoding = 'utf-8') as fp:
                    offcputime_svg_content = fp.read()
                    base64_offcputime_svg_content = base64.b64encode(offcputime_svg_content.encode('utf-8')).decode('utf-8')
                    format_offcputime_svg = "".join([offcputime_svg_short, '\n', base64_offcputime_svg_content])
                    if Command.cmd_output(offcputime_svg_short, format_offcputime_svg, GlobalCall.output_hotspot_file, '='):
                        return True
                    else:
                        Logger().debug("write offcpu flame svg info error")
                        return False
        else:
            Logger().warning("当前内核版本下，工具暂不提供off-cpu采集功能.")
            return False

    # offcpu main function
    @GlobalCall.monitor_info_thread_pool.threaded_pool
    def do_offcputime_collect(self):
        Logger().info("OffCPU数据采集开始")
        try:
            self.__set_offcpu_parameter()
            if not self.__check_offcpu_parameter():
                return False
            self.__do_offcputime_flamegraph()
        except Exception as e:
            Logger().debug("do offcpu collect error: {}".format(e))
        Logger().info("OffCPU数据采集结束")

# hotspot main function
class Hotspot():
	def __init__(self):
        # to avoid report warning, create empty file
		pass

	def get_hotspot_report_flag(self):
		if perf_enable_flag != 0 or offcpu_enable_flag != 0:
			return True
		else:
			return False

    def get_info(self):
        global perf_enable_flag
        global offcpu_enable_flag

        if len(perf_args) == 0:
            perf_enable_flag = GlobalCall.get_json_value("Getting.Application.Perf.enable", 0, Config.get_json_dict())
        else:
            perf_enable_flag = int(perf_args['perf_enable_type'])

        if len(offcpu_args) == 0:
            offcpu_enable_flag = GlobalCall.get_json_value("Getting.Application.OffCPU.enable" , 0, Config.get_json_dict())
        else:
            offcpu_enable_flag = int(offcpu_args['offcpu_enable'])

        if perf_enable_flag == 1 and offcpu_enable_flag == 1:
            Logger().warning("不支持同时开启Perf和OffCPU选项进行数据采集")
            return False

        if perf_enable_flag != 0:
            Perf().do_perf_collect()

        if offcpu_enable_flag != 0:
            OffCPU().do_offcputime_collect()
