'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 09:34:21 2023 +0800
'''
import threading

# 线程类
class CustomizeFunctionThread(threading.Thread):
    def __init__(self, func, args=()):
        super(CustomizeFunctionThread, self).__init__()
        self.func = func
        self.args = args
        self.result = []

    def run(self):
        try:
            self.result = self.func(*self.args)
        except Exception as e:
            print(f"An error occurred during function execution: {e}")
            self.result = None 

    def get_result(self):
            return self.result
