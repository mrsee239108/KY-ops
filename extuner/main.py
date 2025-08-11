'''
  Copyright (c) KylinSoft  Co., Ltd. 2024.All rights reserved.
  extuner licensed under the Mulan Permissive Software License, Version 2.
  See LICENSE file for more details.
  Author: dongjiao <dongjiao@kylinos.cn>
  Date: Thu Nov 16 17:11:10 2023 +0800
'''
#!/usr/bin/env python
# -*- coding: UTF-8 -*- 
# cython:language_level=3

from extuner import main
from common.log import Logger

# main function
if __name__=='__main__': 
    try:
        main()
    except Exception as err:
        Logger().error("Error: {}".format(err))
