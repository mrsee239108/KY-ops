'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 10:05:54 2023 +0800
'''
# -*- coding:utf-8 -*-
#!/usr/bin/env python
# cython:language_level=3

import functools
from concurrent.futures import ThreadPoolExecutor, as_completed
from .log import Logger
from .decorator_wrap import DecoratorWrap

@DecoratorWrap.singleton
class ThreadPool():
    def __init__(self, max_threads = 10):
        # Maximum concurrent threads
        self.__max_threads = max_threads
        self.__thread_obj = ThreadPoolExecutor(self.__max_threads)
        # Store the created thread
        self.__generate_list = []
    
    def threaded_pool(self, func):
        '''
            Externally callable thread pool decorator
        '''
        @functools.wraps(func)
        def inner(*args, **kwargs):
            obj = self.__thread_obj.submit(func, *args)
            self.__generate_list.append(obj)
        return inner
    
    def is_thread_working(self):
        '''
            Determine if there is an execution child thread
        '''
        if self.__generate_list:
            return True
        else:
            Logger().debug("no child thread working")
            return False
        
    def thread_finish(self):
        '''
            Return the result after waiting for all threads to finish executing
        '''
        data = ''
        for future in as_completed(self.__generate_list):
            data = future.result()
            
        Logger().debug("Thread task execution ends {} ".format(data))
   
