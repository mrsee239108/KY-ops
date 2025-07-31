'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Fri Nov 17 09:30:22 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*- 
# cython:language_level=3

import io
import json5
import os
import sys
import time

# Initialize classes, load working directory and output directory, etc.
class Config:
    inst_path = ''
    work_path = ''
    out_path = ''
    dict_json = {}
    conf_fn = ''
    dt = time.strftime("%m%d%H%M")  # 添加缺失的dt属性
    out_d = '/output-{}/'.format(time.strftime("%m%d%H%M"))

    # set work path 
    @staticmethod
    def set_work_path(path = os.getcwd()):
        if os.path.exists(path):
            #路径转换为绝对路径
            if os.path.isabs(path):
                abspath = path
            else:
                abspath = os.path.abspath(path) 
            
            Config.work_path = abspath
        else:
            print("init failed : {} Path does not exist, make sure it exists.".format(path))
            sys.exit()
        
        Config.conf_fn = Config.work_path + '/extuner.conf' 
        if not os.path.exists(Config.conf_fn):
            print("init failed : {} does not exist, make sure it exists.".format(Config.conf_fn))
            sys.exit()
            
    # 获取阈值文件中设置内容
    @staticmethod
    def get_threshold_data():
        ret_threshold_data = {}
        threshold_file = Config.work_path + '/optimization/set_threshold.conf'
        if os.path.exists(threshold_file):
            try:
                with io.open(threshold_file, 'r', encoding='utf-8') as file:
                    ret_threshold_data = json5.load(file)
            except Exception as err:
                print("阈值配置文件内容设置异常 {}".format(err))
        
        return ret_threshold_data
        
            
    # set out path 
    @staticmethod
    def set_out_path(path = os.getcwd()):
        if os.path.exists(path):
            #路径转换为绝对路径
            if os.path.isabs(path):
                abspath = path
            else:
                abspath = os.path.abspath(path) 
            
            #给定目录下创建extunerData用于存放采集数据及日志
            kypath = abspath + "/extunerData"
            if not os.path.exists(kypath):
                os.makedirs(kypath)
            Config.out_path = kypath
        else:
            print("init failed : {} Path does not exist, make sure it exists.".format(path))
            sys.exit()

    # set installation path 
    @staticmethod
    def set_inst_path(path = os.getcwd()):
        if os.path.exists(path):
            Config.inst_path = path
        else:
            print("init failed : {} Path does not exist, make sure it exists.".format(path))
            sys.exit()
    
    @staticmethod
    def init_config(opath, wpath , ipath ):
        '''
            Initialize working directory information, must be called
        '''
        Config.set_work_path(wpath)
        Config.set_inst_path(ipath)
        Config.set_out_path(opath)
        
        try:
            with io.open(Config.conf_fn, 'r', encoding='utf-8') as file:
                Config.dict_json = json5.load(file)
        except Exception as err:
            print("程序初始化失败: 配置文件内容设置异常 {}，请修改后重新启动程序。".format(err))
            sys.exit()

        if not os.path.exists('{}/output-{}/'.format(Config.out_path, Config.dt)):
            os.makedirs('{}/output-{}/'.format(Config.out_path, Config.dt))

        if not os.path.exists(Config.out_path + Config.out_d):
            os.makedirs(Config.out_path + Config.out_d)

        if not os.path.exists(Config.out_path + '/log/'):
            os.makedirs(Config.out_path + '/log/')

        # if not os.path.exists(Config.out_path+'/temp/'):
        #     os.makedirs(Config.out_path + '/temp/') 

    @staticmethod
    def get_json_dict():
        return Config.dict_json


    @staticmethod
    def get_work_path():
        '''
            get work path
        '''
        return Config.path_format(Config.work_path)
    
    @staticmethod
    def get_out_path():
        '''
            get out path
        '''
        return Config.path_format(Config.out_path)

    @staticmethod
    def get_inst_path():
        '''
            get install path
        '''
        return Config.path_format(Config.inst_path)

    @staticmethod
    def set_output_path():
        '''
            set the output file save directory
        '''
        Config.whole_out_d = Config.path_format(Config.out_path + Config.out_d)

    @staticmethod
    def get_output_path():
        '''
            Get the output file save directory
        '''
        # 修改输出路径到 extune\extunerData
        return Config.path_format(Config.out_path + '/')
    
    @staticmethod
    def get_log_path():
        '''
            get log directory
        '''
        return Config.path_format(Config.out_path + '/log/')
    
    
    @staticmethod
    def path_format(path ):
        if len(path):
            return path.rstrip(r'\/') + '/'
        else:
            return './'
