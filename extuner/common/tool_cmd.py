'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 10:03:01 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3

import argparse
import datetime
import sys
import platform

from .command import Command

class ToolCmd:
        
    def __get_version(self):
        # line = 'extuner version is 1.0. ' + 'Expires at ' + str(self.__last_day)
        line = 'Extuner version is 1.0. ' 
        return line

    # start add for perf/offcpu command line parser check
    def __check_perf_cmdline(self, args):
        error_msg = []
        if args.perf_enable_type and not args.perf_pid:
            error_msg = "need to specify --pid option"
        elif args.perf_pid and not args.perf_enable_type:
            error_msg = "need to specify --perf option"
        elif args.perf_duration and not args.perf_enable_type:
            error_msg = "need to specify --perf option"

        return error_msg

    def __check_offcpu_cmdline(self, args):
        error_msg = []
        if args.offcpu:
            if not args.offcpu_pid:
                error_msg = "need to specify --offcpu_pid option"
                return error_msg
        if not args.offcpu:
            if args.offcpu_pid or args.offcpu_duration:
                error_msg = "need to specify --offcpu option"
                return error_msg
        return error_msg

    def __check_perf_pid(self, val):
        if not Command.check_pid_list(val, False):
            raise argparse.ArgumentTypeError("should set to -1 or existed process id")
        return val

    def __check_offcpu_pid(self, val):
        try:
            ival = int(val)
        except ValueError:
            raise argparse.ArgumentTypeError("must be an integer")

        if ival <= 0:
            raise argparse.ArgumentTypeError("must be positive and nonzero")

        if not Command.check_pid_exist(ival, False):
            raise argparse.ArgumentTypeError("should set to an existed process id")

        return ival

    def __check_perf_enable_value(self, val):
        try:
            ival = int(val)
        except ValueError:
            raise argparse.ArgumentTypeError("invalid value, should set to 1, default 1 if no value set")
        
        #if ival not in [1,2]:
        if ival != 1:
            raise argparse.ArgumentTypeError("invalid value, should set to 1, default 1 if not value set")

        return ival

    def __check_duration_value(self, val):
        try:
            ival = int(val)
        except ValueError:
            raise argparse.ArgumentTypeError("must be an integer")

        if ival <= 0 or ival > 300:
            raise argparse.ArgumentTypeError("must be 1-300")

        return ival

    def get_hotspot_cmdline_parser(self, args):
        if 'col' == args.func or 'ana' == args.func:
            if args.perf_enable_type:
                perf_args = {'perf_enable_type': args.perf_enable_type, 'perf_pid':args.perf_pid, 'perf_duration':args.perf_duration}
            else:
                perf_args = {}
            if args.offcpu:
                offcpu_args = {'offcpu_enable': args.offcpu, 'offcpu_pid':args.offcpu_pid, 'offcpu_duration':args.offcpu_duration}
            else:
                offcpu_args = {}
        else:
            perf_args = {}
            offcpu_args = {}
        return perf_args, offcpu_args
        # end add for perf/offcpu command line parser check

    def args_help(self):

        usage_msg  = 'extuner [options]\n'
        usage_msg += '        --version    Get current version\n'
        usage_msg += '        --work_path  Extuner working path\n'
        usage_msg += '        --inst_path  Extuner installed path\n'
        usage_msg += '        --out_path   Output file path, including data, log and report\n'
        usage_msg += '        --func       Running function:\n'
        usage_msg += '                     col     collect system info\n'
        usage_msg += '                     ana     analyze system info\n'


        # parrent
        parent_parser = argparse.ArgumentParser(usage = usage_msg)
        parent_parser.add_argument('-v', '--version' , action = 'version', version = self.__get_version(),
                                   help = 'Get current version')
        parent_parser.add_argument('--work_path'     , type = str, default = '.',
                                   help = 'Work path for extuner')
        parent_parser.add_argument('--inst_path'     , type = str, default = '.',
                                   help = 'Install path for extuner tool')
        parent_parser.add_argument('-o', '--out_path', type = str, default = '.',
                                   help = 'Include log and report, default is current directory')
        parent_parser.add_argument('--func'          , type = str, default = 'col',
                                   help = 'Running func in [\'col\', \'ana\']')      
                
        args = parent_parser.parse_args()
       
        return args
    
    
