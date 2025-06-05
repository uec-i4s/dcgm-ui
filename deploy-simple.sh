#!/bin/bash

# 簡易版GPU監視モニターのデプロイスクリプト（トラブルシューティング用）

set -e

echo "🔍 簡易版GPU監視モニターをデプロイしています..."

# MicroK8s環境の確認
if ! command -v microk8s &> /dev/null; then
    echo "❌ MicroK8sが見つかりません。MicroK8sがインストールされていることを確認してください。"
    exit 1
fi

KUBECTL_CMD="microk8s kubectl"

echo "🧹 既存のリソースをクリーンアップ中..."
$KUBECTL_CMD delete namespace gpu-monitoring --ignore-not-found=true
sleep 5

echo "📦 簡易版をデプロイ中..."
$KUBECTL_CMD apply -f k8s/simple-deploy.yaml

echo "📊 Prometheusをデプロイ中..."
$KUBECTL_CMD apply -f k8s/prometheus.yaml

echo "⏳ ポッドの起動を待機中..."
sleep 10

echo "📋 デプロイ状況:"
$KUBECTL_CMD get all -n gpu-monitoring

echo ""
echo "🌐 簡易版WebUIにアクセス:"
NODE_IP=$($KUBECTL_CMD get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
echo "   http://${NODE_IP}:30090"
echo ""

echo "🔍 トラブルシューティング:"
echo "1. ポッド状況確認: $KUBECTL_CMD get pods -n gpu-monitoring"
echo "2. ログ確認: $KUBECTL_CMD logs -l app=simple-gpu-monitor-ui -n gpu-monitoring"
echo "3. 詳細診断: ./debug.sh"
echo ""

echo "✅ 簡易版デプロイが完了しました！"
echo "WebUIにアクセスして「システム診断」ボタンをクリックしてください。"