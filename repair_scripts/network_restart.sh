#!/bin/bash
# 网络服务重启脚本
echo "开始重启网络服务..."

# 重启网络服务
if systemctl is-active --quiet NetworkManager; then
    systemctl restart NetworkManager
elif systemctl is-active --quiet networking; then
    systemctl restart networking
fi

# 刷新DNS
if command -v systemd-resolve >/dev/null; then
    systemd-resolve --flush-caches
fi

echo "网络服务重启完成"
