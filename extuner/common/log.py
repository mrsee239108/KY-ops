'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Mon Nov 20 11:31:33 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*- 
# cython:language_level=3

from functools import wraps
import logging
import os
import sys
import time
from .decorator_wrap import DecoratorWrap
from .config import Config

@DecoratorWrap.singleton
class Logger:
    def __init__(self):
        # Initialize format configuration
        self.__now = time.strftime("%Y-%m-%d")
        self.__logname = os.path.join(Config.get_log_path(), '{}.log'.format(self.__now))
        self.__type = logging.INFO
        self._log_debug = logging.DEBUG
        
        # create logger
        self.__logger = logging.getLogger()
        self.__logger.setLevel(self._log_debug)
        # self.__logger.opt(depth=-1)
        # log handler
        self.__fh = logging.FileHandler(self.__logname, 'a', encoding='utf-8')
        self.__fh.setLevel(self._log_debug)
        # console handler
        self.__ch = logging.StreamHandler()
        self.__ch.setLevel(self.__type)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        self.__fh.setFormatter(formatter)
        self.__ch.setFormatter(formatter)
        self.__logger.addHandler(self.__fh)
        self.__logger.addHandler(self.__ch)

    def __print(self, level, message):
        '''
            Internal output function 
        '''
        if level == 'info':
            self.__logger.info(message)
        elif level == 'debug':
            self.__logger.debug(message)
        elif level == 'warning':
            self.__logger.warning(message)
        elif level == 'error':
            self.__logger.error(message)

    def on_debug_type(self):
        '''
            Turn on the debug switch and output DEBUG information
        '''
        self.__type = logging.DEBUG
        self.__logger.setLevel(self.__type)
        self.__fh.setLevel(self.__type)
        self.__ch.setLevel(self.__type)
    
    def findcaller(func):
        '''
            return caller decorator
        '''
        @wraps(func)
        def wrapper(*args):
            # Get the file name, function name and line number that called the function
            filename =  sys._getframe(1).f_code.co_filename 
            lineno = sys._getframe(1).f_lineno
            # Convert the original input parameters into a list, and then add the caller's information to the input parameter list
            args = list(args)
            args.append("{}:{}".format(filename, lineno))
            func(*args)
        return wrapper
    
    @findcaller
    def debug(self, msg, caller=''):
        self.__print('debug', "{} - {}".format(caller, msg))
    
    @findcaller
    def info(self, msg, caller=''):
        self.__print('info', "{} - {}".format(caller, msg))
    
    @findcaller
    def warning(self, msg, caller=''):
        self.__print('warning', "{} - {}".format(caller, msg))
    
    @findcaller
    def error(self, msg, caller=''):
        self.__print('error', "{} - {}".format(caller, msg))
        
