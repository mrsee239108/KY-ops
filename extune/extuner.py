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

from common.log import Logger
from common.tool_cmd import ToolCmd
from summary_info import SummaryInfo
from common.threadpool import ThreadPool
from kyreport.ky_report import KyReport
import time

# main function
# if __name__=='__main__': 
def main():

    args = ToolCmd().args_help()
    func      = args.func

    work_path = args.work_path
    inst_path = args.inst_path
    out_path  = args.out_path

    SummaryInfo.init(out_path, work_path, inst_path)
    Logger().info("Extuner 开始执行")

    if 'col' == func:
        func_col()
    elif 'ana' == func:
        func_ana()


    Logger().info("Extuner 执行成功")


def func_col():
    timer = { "start": "", "stop": "" }

    timer["start"] = time.strftime("%Y-%m-%d %H:%M:%S")

    ret = SummaryInfo.get_info()

    if ThreadPool().is_thread_working():
        ThreadPool().thread_finish()

    timer["stop"] = time.strftime("%Y-%m-%d %H:%M:%S")

    if ret:
        KyReport().ky_build(timer)

    return ret

def func_ana():
    timer = { "start": "", "stop": "" }
    
    timer["start"] = time.strftime("%Y-%m-%d %H:%M:%S")

    ret = SummaryInfo.get_info()

    if ThreadPool().is_thread_working():
        ThreadPool().thread_finish()

    # analyze功能
    get_global_indicators()
    decide_global_indicators()

    timer["stop"] = time.strftime("%Y-%m-%d %H:%M:%S")

    if ret:
        KyReport().ky_build(timer)

    return ret
