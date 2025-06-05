#!/bin/bash

# GPU監視モニターの削除スクリプト

set -e

echo "🗑️  GPU監視モニターを削除しています..."

# 全てのリソースを削除
echo "📦 リソースを削除中..."
kubectl delete -f k8s/web-ui.yaml --ignore-not-found=true
kubectl delete -f k8s/prometheus.yaml --ignore-not-found=true
kubectl delete -f k8s/dcgm-exporter.yaml --ignore-not-found=true

# 名前空間を削除（これにより残りのリソースも削除される）
echo "🏷️  名前空間を削除中..."
kubectl delete namespace gpu-monitoring --ignore-not-found=true

echo "✅ 削除が完了しました！"
echo ""
echo "📋 残っているリソースを確認:"
kubectl get all -n gpu-monitoring 2>/dev/null || echo "名前空間 'gpu-monitoring' は存在しません。"