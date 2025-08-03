'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 09:39:45 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*-
# cython:language_level=3

import io
import json5
import os
from .config import Config

# file operation class
class FileOperation:

    @staticmethod
    def remove_txt_file(file_name):
        '''
            empty file
        '''
        if os.path.exists(Config.get_output_path() + file_name):
            os.remove(Config.get_output_path() + file_name)
        else:
            # os.mkdir(Config.get_output_path() + file_name)
            file = open(Config.get_output_path() + file_name,'w')
            file.close()

    @staticmethod
    def wrap_output_format(cmd_name, data, split):
        '''
            wrap file format to data , use --- or === split and return 
            do not write file
        '''
        out = 'Command: ' + cmd_name + '\nSubCommand: ' + data
        if split == '=':
            out = out + "=========================kylin=========================\n"
        else:
            out = out + "-------------------------kylin-------------------------\n"
        
        return out
    
    @staticmethod
    def write(data, file_name):
        '''
            write to the file
        '''
        full_file_name = Config.get_output_path() + file_name
        with io.open(full_file_name, mode='a', encoding='utf-8') as file_obj:
            file_obj.write(data)
            
    @staticmethod
    def write_json_file(data_dict, file_name):
        '''
            Write dict type content to json file
        '''
        js_obj = json5.dumps(data_dict, indent=4)
        full_file_name = Config.get_output_path() + file_name
        with io.open(full_file_name, mode='a', encoding='utf-8') as file_obj:
            file_obj.write(js_obj)

    @staticmethod
    def if_str_in_file(file_name, dist_str):
        i = 0
        try:
            with io.open(file_name,'r') as file:
                for item in file.readlines():
                    if dist_str in str(item):
                        i = i + 1
            if i != 0:
                return True
            else:
                return False
        except FileNotFoundError:
            return False

    @staticmethod
    def get_str_num_in_file(file_name, dist_str):
        i = 1 
        dist_list = []
        try:
            with io.open(file_name,'r') as file:
                for item in file.readlines():
                    if dist_str in str(item):
                        dist_list.append(i)
                    i = i + 1
            return dist_list
        except FileNotFoundError:
            return []

    @staticmethod
    def readfile(filename):
        txt = ''
        with io.open(file = filename, mode = 'r', encoding = 'utf-8') as fp:
            txt = fp.read()
        return txt
