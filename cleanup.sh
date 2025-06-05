#!/bin/bash

# GPU監視モニター（MicroK8s対応）の削除スクリプト

set -e

echo "🗑️  GPU監視モニター（MicroK8s環境）を削除しています..."

# MicroK8s環境の確認
if ! command -v microk8s &> /dev/null; then
    echo "❌ MicroK8sが見つかりません。標準のkubectlを使用します。"
    KUBECTL_CMD="kubectl"
else
    KUBECTL_CMD="microk8s kubectl"
fi

# 全てのリソースを削除
echo "📦 リソースを削除中..."
$KUBECTL_CMD delete -f k8s/web-ui.yaml --ignore-not-found=true
$KUBECTL_CMD delete -f k8s/prometheus.yaml --ignore-not-found=true
$KUBECTL_CMD delete -f k8s/dcgm-exporter.yaml --ignore-not-found=true

# 名前空間を削除（これにより残りのリソースも削除される）
echo "🏷️  名前空間を削除中..."
$KUBECTL_CMD delete namespace gpu-monitoring --ignore-not-found=true

echo "✅ 削除が完了しました！"
echo ""
echo "📋 残っているリソースを確認:"
$KUBECTL_CMD get all -n gpu-monitoring 2>/dev/null || echo "名前空間 'gpu-monitoring' は存在しません。"