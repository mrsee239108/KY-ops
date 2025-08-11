'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Tue Nov 28 09:35:26 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*- 
# cython:language_level=3

class DecoratorWrap:
    @staticmethod
    def singleton(cls):
        '''
            singleton decorator
        '''
        instances = {}
        def _singleton(*args, **kwargs):
            if cls not in instances:
                instances[cls] = cls(*args, **kwargs)
            return instances[cls]

        return _singleton
