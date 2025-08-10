#!/bin/bash
# 服务重启脚本
SERVICE_NAME=$1

if [ -z "$SERVICE_NAME" ]; then
    echo "请指定服务名称"
    exit 1
fi

echo "重启服务: $SERVICE_NAME"

if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl restart "$SERVICE_NAME"
    echo "服务 $SERVICE_NAME 重启完成"
else
    echo "服务 $SERVICE_NAME 未运行，尝试启动..."
    systemctl start "$SERVICE_NAME"
fi

systemctl status "$SERVICE_NAME"
