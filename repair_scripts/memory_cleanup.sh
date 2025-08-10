#!/bin/bash
# 内存清理脚本
echo "开始清理内存..."

# 清理页面缓存
sync
echo 1 > /proc/sys/vm/drop_caches

# 清理交换空间
swapoff -a && swapon -a

# 显示内存使用情况
free -h

echo "内存清理完成"
