#!/bin/bash
# 磁盘空间清理脚本
echo "开始清理磁盘空间..."

# 清理临时文件
find /tmp -type f -atime +7 -delete 2>/dev/null
find /var/tmp -type f -atime +7 -delete 2>/dev/null

# 清理日志文件
find /var/log -name "*.log" -size +100M -exec truncate -s 50M {} \;

# 清理包管理器缓存
if command -v apt-get >/dev/null; then
    apt-get clean
elif command -v yum >/dev/null; then
    yum clean all
fi

echo "磁盘空间清理完成"
df -h
