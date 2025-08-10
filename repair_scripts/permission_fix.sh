#!/bin/bash
# 权限修复脚本
echo "开始修复权限问题..."

# 修复常见目录权限
chmod 755 /tmp /var/tmp
chmod 1777 /tmp /var/tmp

# 修复日志目录权限
chmod 755 /var/log
chown root:root /var/log

echo "权限修复完成"
