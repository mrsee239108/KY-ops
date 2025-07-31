'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Fri Aug 2 15:11:35 2024 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*- 
# cython:language_level=3
# Copyright (c) 2023 KylinSoft  Co., Ltd. All Rights Reserved.

import io
import os
from common.config import Config
from common.decorator_wrap import DecoratorWrap
from common.log import Logger
from common.global_parameter import GlobalParameter

@DecoratorWrap.singleton
class DATACOLLECTION:
    def __init__(self):
        self.__arr_cpu_info = []
        self.__arr_synthesis_info = []
        
        self.collection_cpu_txt_data(Config.get_output_path() + 'CPUInfo.txt')
        
    def collection_cpu_txt_data(self, fname  = ''):
        try:
            flg_cmd = '=========================kylin========================='
            flg_sub = '-------------------------kylin-------------------------'
            ret_arr = []

            if not os.path.exists(fname):
                Logger().warning("Report file not found: {}".format(fname))

            else:
                with io.open(file = fname, mode = 'r', encoding = 'utf-8') as fp:
                    txt = fp.read()
                    cmd_grp = txt.strip()[:-len(flg_cmd)].split(flg_cmd)
                    for grp in cmd_grp:
                        grp_obj = { 'group': '' , 'sub': [] }
                        cmd_sub = grp.strip().split(flg_sub)
                        for sub in cmd_sub:
                            sub_obj = { 'cmd': '', 'res': '' }
                            sub_arr = sub.strip().split('\n', 2)
                            if 3 == len(sub_arr):
                                sub_g = sub_arr[0].split('Command: ')[1]
                                sub_s = sub_arr[1].split('SubCommand: ')[1]
                                sub_c = sub_arr[2]
                                
                                sub_obj['cmd']   = sub_s
                                sub_obj['res']   = sub_c

                                if sub_s == GlobalParameter().sub_sarall:
                                    dict_synthesis = {'group': '' , 'sub': []}
                                    dict_synthesis["group"] = sub_g
                                    dict_synthesis["sub"].append(sub_obj)
                                    self.__arr_synthesis_info.append(dict_synthesis)
                                    continue

                                if sub_s == "cat /proc/cpuinfo":
                                    continue

                                grp_obj['group'] = sub_g
                                grp_obj['sub'].append(sub_obj)


                        if 0 < len(grp_obj['group']) and 0 < len(grp_obj['sub']):
                            if grp_obj['group'] == "cat /proc/cpuinfo":
                                ret_arr.insert(0, grp_obj)
                            elif grp_obj['group'] == "top":
                                ret_arr.insert(1, grp_obj)
                            elif grp_obj['group'] == "mpstat":
                                ret_arr.insert(2, grp_obj)
                            elif grp_obj['group'] == "pidstat":
                                ret_arr.insert(3, grp_obj)
                            elif grp_obj['group'] == "numactl":
                                ret_arr.insert(4, grp_obj)
                            elif grp_obj['group'] == "sar":
                                ret_arr.insert(5, grp_obj)
                            else:
                                ret_arr.append(grp_obj)

            self.__arr_cpu_info = ret_arr

        except Exception as err:
            Logger().error('Failed parse file "{}": {}'.format(fname, err))
            

    def get_cpu_tag_data(self):
        return self.__arr_cpu_info

    def get_synthesis_tag_data(self):
        return self.__arr_synthesis_info

